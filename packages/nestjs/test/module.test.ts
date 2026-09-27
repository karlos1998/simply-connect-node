import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { SimplyConnectClient } from "@simply-connect/node";
import { SimplyConnectModule, SimplyConnectPanelModule } from "../src/index.js";
import { PanelSession } from "../src/panel/session.js";

describe("SimplyConnectModule", () => {
  it("provides a client with synchronous configuration", async () => {
    const module = await Test.createTestingModule({
      imports: [
        SimplyConnectModule.forRoot({
          apiKey: "test-key",
          baseUrl: "https://api.simply-connect.test",
        }),
      ],
    }).compile();

    expect(module.get(SimplyConnectClient)).toBeInstanceOf(SimplyConnectClient);
  });

  it("provides a client with asynchronous configuration", async () => {
    const module = await Test.createTestingModule({
      imports: [
        SimplyConnectModule.forRootAsync({
          useFactory: () => ({ apiKey: "async-test-key" }),
        }),
      ],
    }).compile();

    expect(module.get(SimplyConnectClient)).toBeInstanceOf(SimplyConnectClient);
  });

  it("keeps the panel opt-in and validates its password", () => {
    expect(() =>
      SimplyConnectPanelModule.forRoot({ password: "short" }),
    ).toThrow(/at least 12 characters/);
    expect(
      SimplyConnectPanelModule.forRoot({ password: "separate-panel-password" })
        .controllers,
    ).toHaveLength(1);
  });
});

describe("PanelSession", () => {
  it("signs sessions and action-specific CSRF tokens", () => {
    const sessions = new PanelSession("separate-panel-password", 60_000);
    const session = sessions.create(1_000);
    const cookie = sessions.cookie(session, true);

    expect(sessions.validate(cookie, 2_000)).toBe(session);
    expect(
      sessions.verifyCsrf(session, "sms", sessions.csrf(session, "sms")),
    ).toBe(true);
    expect(
      sessions.verifyCsrf(session, "call", sessions.csrf(session, "sms")),
    ).toBe(false);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
  });

  it("rejects modified and expired sessions", () => {
    const sessions = new PanelSession("separate-panel-password", 60_000);
    const session = sessions.create(1_000);

    expect(
      sessions.validate(`simply_connect_panel=${session}x`, 2_000),
    ).toBeNull();
    expect(
      sessions.validate(`simply_connect_panel=${session}`, 61_001),
    ).toBeNull();
  });
});
