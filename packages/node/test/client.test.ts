import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyConflictError,
  RateLimitError,
  SimplyConnectClient,
  ValidationError,
} from "../src/index.js";

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("SimplyConnectClient", () => {
  it("discovers endpoints without leaking configuration into the URL", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      json([
        {
          id: "endpoint-1",
          name: "Main SIM",
          phoneNumber: "+48500100200",
          enabled: true,
        },
      ]),
    );
    const client = new SimplyConnectClient({ apiKey: "secret", fetch });

    await expect(client.listSmsEndpoints()).resolves.toHaveLength(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.simply-connect.ovh/api/v1/external/endpoints",
    );
    expect(new Headers(init?.headers).get("X-API-Key")).toBe("secret");
    expect(String(url)).not.toContain("secret");
  });

  it("uses the default endpoint and caller-owned idempotency key", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        json(
          { messageId: "m", dispatchId: "d", commandId: "c", status: "QUEUED" },
          202,
        ),
      );
    const client = new SimplyConnectClient({
      apiKey: "secret",
      defaultSmsEndpointId: "endpoint-1",
      fetch,
    });

    await client.sendSms(
      { to: "+48500100200", body: "Hello" },
      { idempotencyKey: "order-1842-ready" },
    );

    const [, init] = fetch.mock.calls[0]!;
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
      "order-1842-ready",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      endpointId: "endpoint-1",
      to: "+48500100200",
      body: "Hello",
    });
  });

  it("generates one idempotency key but never retries a mutation", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        json(
          { messageId: "m", dispatchId: "d", commandId: "c", status: "QUEUED" },
          202,
        ),
      );
    const client = new SimplyConnectClient({ apiKey: "secret", fetch });

    await client.sendSms({
      endpointId: "endpoint-1",
      to: "+48500100200",
      body: "Hello",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      new Headers(fetch.mock.calls[0]![1]?.headers).get("Idempotency-Key"),
    ).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("encodes message filters deterministically", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        json({ items: [], page: 0, size: 25, totalElements: 0, totalPages: 0 }),
      );
    const client = new SimplyConnectClient({ apiKey: "secret", fetch });

    await client.listMessages({
      query: "+48 500",
      direction: "INBOUND",
      page: 0,
      size: 25,
    });

    expect(String(fetch.mock.calls[0]![0])).toBe(
      "https://api.simply-connect.ovh/api/v1/external/messages?query=%2B48+500&direction=INBOUND&page=0&size=25",
    );
  });

  it("generates a stable request id for one call-queue submission", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(json({ id: "queue-1", status: "PENDING" }, 202));
    const client = new SimplyConnectClient({ apiKey: "secret", fetch });

    await client.createCallQueueEntry({
      endpointId: "voice-1",
      destination: "+48500100200",
      flowVersionId: "flow-1",
      timeZone: "Europe/Warsaw",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body)).requestId).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it.each([
    [422, ValidationError],
    [409, IdempotencyConflictError],
    [429, RateLimitError],
  ])("maps HTTP %s to a typed error", async (status, ErrorType) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        json(
          { title: "Request rejected", detail: "Useful detail", status },
          status,
          status === 429
            ? { "retry-after": "12", "x-correlation-id": "corr-1" }
            : undefined,
        ),
      );
    const client = new SimplyConnectClient({ apiKey: "secret", fetch });

    const request = client.sendSms({
      endpointId: "endpoint-1",
      to: "bad",
      body: "Hello",
    });
    await expect(request).rejects.toBeInstanceOf(ErrorType);
    await expect(request).rejects.toMatchObject({
      status,
      message: "Useful detail",
    });
  });
});
