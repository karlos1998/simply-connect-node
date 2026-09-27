import { randomUUID } from "node:crypto";
import {
  AuthenticationError,
  IdempotencyConflictError,
  NotFoundError,
  RateLimitError,
  SimplyConnectApiError,
  SimplyConnectError,
  ValidationError,
} from "./errors.js";
import type {
  CallQueueEndpoint,
  CallQueueItem,
  CallQueuePage,
  CallQueueQuery,
  CreateCallQueueEntryRequest,
  MessageDetails,
  MessagePage,
  MessageQuery,
  MutationOptions,
  ProblemDetail,
  PublishedCallFlow,
  RequestOptions,
  SendSmsRequest,
  SimplyConnectClientOptions,
  SmsEndpoint,
  SmsSendResult,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.simply-connect.ovh";

export class SimplyConnectClient {
  readonly #apiKey: string;
  readonly #baseUrl: URL;
  readonly #defaultSmsEndpointId: string | undefined;
  readonly #timeoutMs: number;
  readonly #fetch: typeof globalThis.fetch;
  readonly #userAgent: string;

  constructor(options: SimplyConnectClientOptions) {
    this.#apiKey = requireNonBlank(options.apiKey, "apiKey");
    this.#baseUrl = externalApiBase(options.baseUrl ?? DEFAULT_BASE_URL);
    this.#defaultSmsEndpointId = options.defaultSmsEndpointId;
    this.#timeoutMs = positiveInteger(options.timeoutMs ?? 15_000, "timeoutMs");
    this.#fetch = options.fetch ?? globalThis.fetch;
    if (!this.#fetch) {
      throw new TypeError("A Fetch API implementation is required");
    }
    this.#userAgent = options.userAgent ?? "simply-connect-node/0.1";
  }

  listSmsEndpoints(options?: RequestOptions): Promise<SmsEndpoint[]> {
    return this.#request("endpoints", { signal: options?.signal });
  }

  sendSms(
    request: SendSmsRequest,
    options: MutationOptions = {},
  ): Promise<SmsSendResult> {
    const endpointId = request.endpointId ?? this.#defaultSmsEndpointId;
    if (!endpointId) {
      throw new TypeError(
        "endpointId is required when no defaultSmsEndpointId is configured",
      );
    }
    return this.#request("messages", {
      method: "POST",
      body: { endpointId, to: request.to, body: request.body },
      idempotencyKey: options.idempotencyKey ?? randomUUID(),
      signal: options.signal,
    });
  }

  listMessages(
    query: MessageQuery = {},
    options?: RequestOptions,
  ): Promise<MessagePage> {
    return this.#request(withQuery("messages", query), {
      signal: options?.signal,
    });
  }

  getMessage(
    messageId: string,
    options?: RequestOptions,
  ): Promise<MessageDetails> {
    return this.#request(
      `messages/${encodeURIComponent(requireNonBlank(messageId, "messageId"))}`,
      {
        signal: options?.signal,
      },
    );
  }

  listCallQueueEndpoints(
    options?: RequestOptions,
  ): Promise<CallQueueEndpoint[]> {
    return this.#request("call-queue/endpoints", { signal: options?.signal });
  }

  listPublishedCallFlows(
    options?: RequestOptions,
  ): Promise<PublishedCallFlow[]> {
    return this.#request("call-queue/flows", { signal: options?.signal });
  }

  listCallQueue(
    query: CallQueueQuery = {},
    options?: RequestOptions,
  ): Promise<CallQueuePage> {
    return this.#request(withQuery("call-queue", query), {
      signal: options?.signal,
    });
  }

  createCallQueueEntry(
    request: CreateCallQueueEntryRequest,
    options?: RequestOptions,
  ): Promise<CallQueueItem> {
    return this.#request("call-queue", {
      method: "POST",
      body: { ...request, requestId: request.requestId ?? randomUUID() },
      signal: options?.signal,
    });
  }

  async #request<T>(
    path: string,
    request: {
      method?: "GET" | "POST";
      body?: unknown;
      idempotencyKey?: string;
      signal?: AbortSignal | undefined;
    },
  ): Promise<T> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(new Error("Request timed out")),
      this.#timeoutMs,
    );
    timeout.unref?.();
    const signal = request.signal
      ? AbortSignal.any([request.signal, timeoutController.signal])
      : timeoutController.signal;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-API-Key": this.#apiKey,
      "User-Agent": this.#userAgent,
    };
    if (request.body !== undefined)
      headers["Content-Type"] = "application/json";
    if (request.idempotencyKey)
      headers["Idempotency-Key"] = request.idempotencyKey;

    let response: Response;
    try {
      response = await this.#fetch(new URL(path, this.#baseUrl), {
        method: request.method ?? "GET",
        headers,
        signal,
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
      });
    } catch (error) {
      throw new SimplyConnectError(
        signal.aborted
          ? "Simply Connect request was aborted"
          : "Could not reach Simply Connect",
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }

    const responseBody = await response.text();
    if (!response.ok) this.#throwApiError(response, responseBody);
    if (!responseBody) return undefined as T;
    try {
      return JSON.parse(responseBody) as T;
    } catch (error) {
      throw new SimplyConnectError(
        "Simply Connect returned an unreadable JSON response",
        { cause: error },
      );
    }
  }

  #throwApiError(response: Response, responseBody: string): never {
    const problem = parseProblem(responseBody);
    const correlationId = response.headers.get("x-correlation-id");
    const message =
      problem?.detail?.trim() ||
      `Simply Connect returned HTTP ${response.status}`;
    const args = [
      message,
      response.status,
      correlationId,
      problem,
      responseBody,
    ] as const;
    switch (response.status) {
      case 401:
      case 403:
        throw new AuthenticationError(...args);
      case 400:
      case 422:
        throw new ValidationError(...args);
      case 404:
        throw new NotFoundError(...args);
      case 409:
        throw new IdempotencyConflictError(...args);
      case 429:
        throw new RateLimitError(
          ...args,
          parseRetryAfter(response.headers.get("retry-after")),
        );
      default:
        throw new SimplyConnectApiError(...args);
    }
  }
}

function externalApiBase(baseUrl: string): URL {
  const value = requireNonBlank(baseUrl, "baseUrl").replace(/\/+$/, "");
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("baseUrl must use http or https");
  }
  const suffix = "/api/v1/external";
  if (!url.pathname.replace(/\/+$/, "").endsWith(suffix)) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}${suffix}`;
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  url.search = "";
  url.hash = "";
  return url;
}

function withQuery(path: string, query: object): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null || raw === "") continue;
    const value = raw instanceof Date ? raw.toISOString() : String(raw);
    params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function parseProblem(body: string): ProblemDetail | null {
  if (!body) return null;
  try {
    const value: unknown = JSON.parse(body);
    return value && typeof value === "object" ? (value as ProblemDetail) : null;
  } catch {
    return null;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function requireNonBlank(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new TypeError(`${name} must not be blank`);
  return value.trim();
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0)
    throw new TypeError(`${name} must be a positive integer`);
  return value;
}
