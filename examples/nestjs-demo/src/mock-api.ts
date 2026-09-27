import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";

const endpointId = "018f2f60-9f89-7ce0-9b3a-111111111111";
const voiceEndpointId = "018f2f60-9f89-7ce0-9b3a-222222222222";
const flowVersionId = "018f2f60-9f89-7ce0-9b3a-333333333333";
const messages: Array<Record<string, unknown>> = [];
const queue: Array<Record<string, unknown>> = [];

export function startMockApi(port: number) {
  return createServer(async (request, response) => {
    if (request.headers["x-api-key"] !== "demo-api-key") {
      return send(response, 401, {
        title: "Unauthorized",
        detail: "Invalid demo API key",
      });
    }
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    const path = url.pathname.replace("/api/v1/external/", "");
    if (request.method === "GET" && path === "endpoints") {
      return send(response, 200, [
        {
          id: endpointId,
          name: "Demo SMS gateway",
          phoneNumber: "+48500100200",
          enabled: true,
        },
      ]);
    }
    if (request.method === "POST" && path === "messages") {
      const body = await readJson(request);
      const item = {
        id: randomUUID(),
        conversationId: randomUUID(),
        direction: "OUTBOUND",
        channel: "SMS",
        body: body.body,
        remoteAddress: body.to,
        occurredAt: new Date().toISOString(),
        status: "QUEUED",
        endpoint: {
          id: endpointId,
          name: "Demo SMS gateway",
          phoneNumber: "+48500100200",
          enabled: true,
        },
      };
      messages.unshift(item);
      return send(response, 202, {
        messageId: item.id,
        dispatchId: randomUUID(),
        commandId: randomUUID(),
        status: "QUEUED",
      });
    }
    if (request.method === "GET" && path.startsWith("messages")) {
      return send(response, 200, {
        items: messages,
        page: 0,
        size: 10,
        totalElements: messages.length,
        totalPages: messages.length ? 1 : 0,
      });
    }
    if (request.method === "GET" && path === "call-queue/endpoints") {
      return send(response, 200, [
        {
          id: voiceEndpointId,
          name: "Demo voice gateway",
          phoneNumber: "+48500100200",
          gatewayId: randomUUID(),
          gatewayName: "Mock gateway",
          gatewayStatus: "ONLINE",
        },
      ]);
    }
    if (request.method === "GET" && path === "call-queue/flows") {
      return send(response, 200, [
        {
          id: randomUUID(),
          name: "Demo IVR",
          description: "No-cost example",
          publishedVersionId: flowVersionId,
          updatedAt: new Date().toISOString(),
        },
      ]);
    }
    if (request.method === "POST" && path === "call-queue") {
      const body = await readJson(request);
      const item = {
        id: randomUUID(),
        ...body,
        flowName: "Demo IVR",
        flowVersion: 1,
        source: "EXTERNAL_API",
        status: "PENDING",
        notBefore: new Date().toISOString(),
        intervalSeconds: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queue.unshift(item);
      return send(response, 202, item);
    }
    if (request.method === "GET" && path.startsWith("call-queue")) {
      return send(response, 200, {
        items: queue,
        page: 0,
        totalElements: queue.length,
        totalPages: queue.length ? 1 : 0,
      });
    }
    return send(response, 404, { title: "Not found" });
  }).listen(port, "127.0.0.1");
}

async function readJson(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
