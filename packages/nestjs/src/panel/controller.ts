import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { SimplyConnectClient } from "@simply-connect/node";
import type { SimplyConnectPanelOptions } from "../options.js";
import { dashboardHtml, loginHtml } from "./html.js";
import {
  header,
  isSecure,
  remoteAddress,
  requestHeader,
  secureHeaders,
  status,
  type RequestLike,
  type ResponseLike,
} from "./http.js";
import { PanelSession } from "./session.js";

type Form = Record<string, string | undefined>;

export function createPanelController(
  options: Required<SimplyConnectPanelOptions>,
): new (client: SimplyConnectClient) => object {
  const sessions = new PanelSession(options.password, options.sessionTtlMs);
  const attempts = new Map<string, { count: number; resetAt: number }>();

  @Controller(options.path.replace(/^\//, ""))
  class SimplyConnectPanelController {
    constructor(
      @Inject(SimplyConnectClient) private readonly client: SimplyConnectClient,
    ) {}

    @Get()
    async dashboard(
      @Req() request: RequestLike,
      @Res({ passthrough: true }) response: ResponseLike,
    ) {
      secureHeaders(response);
      const session = sessions.validate(requestHeader(request, "cookie"));
      if (!session) {
        status(response, 401);
        return loginHtml(options.path);
      }
      return this.render(session);
    }

    @Post("login")
    @HttpCode(200)
    async login(
      @Body() form: Form,
      @Req() request: RequestLike,
      @Res({ passthrough: true }) response: ResponseLike,
    ) {
      secureHeaders(response);
      const address = remoteAddress(request);
      const now = Date.now();
      pruneAttempts(attempts, now);
      const attempt = attempts.get(address);
      if (attempt && attempt.resetAt > now && attempt.count >= 5) {
        status(response, 429);
        return loginHtml(
          options.path,
          "Too many attempts. Try again in a few minutes.",
        );
      }
      if (!safePassword(form.password, options.password)) {
        attempts.set(address, {
          count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1,
          resetAt: now + 5 * 60_000,
        });
        status(response, 401);
        return loginHtml(options.path, "Invalid password.");
      }
      attempts.delete(address);
      const session = sessions.create();
      header(
        response,
        "Set-Cookie",
        sessions.cookie(session, isSecure(request), options.path),
      );
      return this.render(session, "Signed in.");
    }

    @Post("sms")
    @HttpCode(200)
    async sms(
      @Body() form: Form,
      @Req() request: RequestLike,
      @Res({ passthrough: true }) response: ResponseLike,
    ) {
      secureHeaders(response);
      const session = this.authorize(request, response, form.csrf, "sms");
      if (!session)
        return loginHtml(options.path, "Your session expired. Sign in again.");
      try {
        const result = await this.client.sendSms(
          {
            endpointId: required(form.endpointId, "SMS endpoint"),
            to: required(form.to, "Recipient"),
            body: required(form.body, "Message"),
          },
          { idempotencyKey: `panel-sms-${randomUUID()}` },
        );
        return this.render(
          session,
          `SMS accepted with status ${result.status}.`,
        );
      } catch (error) {
        return this.render(session, undefined, errorMessage(error));
      }
    }

    @Post("call")
    @HttpCode(200)
    async call(
      @Body() form: Form,
      @Req() request: RequestLike,
      @Res({ passthrough: true }) response: ResponseLike,
    ) {
      secureHeaders(response);
      const session = this.authorize(request, response, form.csrf, "call");
      if (!session)
        return loginHtml(options.path, "Your session expired. Sign in again.");
      try {
        const item = await this.client.createCallQueueEntry({
          endpointId: required(form.endpointId, "Voice endpoint"),
          flowVersionId: required(form.flowVersionId, "Flow"),
          destination: required(form.destination, "Destination"),
          timeZone: required(form.timeZone, "Time zone"),
        });
        return this.render(session, `Call queued with status ${item.status}.`);
      } catch (error) {
        return this.render(session, undefined, errorMessage(error));
      }
    }

    private authorize(
      request: RequestLike,
      response: ResponseLike,
      csrf: unknown,
      action: string,
    ): string | null {
      const session = sessions.validate(requestHeader(request, "cookie"));
      if (!session || !sessions.verifyCsrf(session, action, csrf)) {
        status(response, 403);
        return null;
      }
      return session;
    }

    private async render(
      session: string,
      message?: string,
      error?: string,
    ): Promise<string> {
      const [smsEndpoints, messages, callEndpoints, flows, queue] =
        await Promise.all([
          settled(() => this.client.listSmsEndpoints(), []),
          settled(() => this.client.listMessages({ size: 10 }), {
            items: [],
            page: 0,
            size: 10,
            totalElements: 0,
            totalPages: 0,
          }),
          settled(() => this.client.listCallQueueEndpoints(), []),
          settled(() => this.client.listPublishedCallFlows(), []),
          settled(
            () =>
              this.client.listCallQueue({
                size: 10,
                sort: "createdAt",
                descending: true,
              }),
            {
              items: [],
              page: 0,
              totalElements: 0,
              totalPages: 0,
            },
          ),
        ]);
      return dashboardHtml({
        path: options.path,
        csrf: (action) => sessions.csrf(session, action),
        smsEndpoints,
        messages: messages.items,
        callEndpoints,
        flows,
        queue: queue.items,
        ...(message ? { message } : {}),
        ...(error ? { error } : {}),
      });
    }
  }

  return SimplyConnectPanelController;
}

function pruneAttempts(
  attempts: Map<string, { count: number; resetAt: number }>,
  now: number,
): void {
  if (attempts.size < 1_000) return;
  for (const [address, attempt] of attempts) {
    if (attempt.resetAt <= now) attempts.delete(address);
  }
  while (attempts.size >= 1_000) {
    const oldest = attempts.keys().next().value;
    if (typeof oldest !== "string") break;
    attempts.delete(oldest);
  }
}

async function settled<T>(
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch {
    return fallback;
  }
}

function required(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new TypeError(`${label} is required.`);
  return value.trim();
}

function safePassword(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The operation failed.";
}
