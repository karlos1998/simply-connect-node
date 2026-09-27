import { DynamicModule, Module } from "@nestjs/common";
import type { SimplyConnectPanelOptions } from "./options.js";
import { createPanelController } from "./panel/controller.js";

@Module({})
export class SimplyConnectPanelModule {
  static forRoot(options: SimplyConnectPanelOptions): DynamicModule {
    const normalized = normalize(options);
    return {
      module: SimplyConnectPanelModule,
      controllers: [createPanelController(normalized)],
    };
  }
}

function normalize(
  options: SimplyConnectPanelOptions,
): Required<SimplyConnectPanelOptions> {
  if (!options.password || options.password.length < 12) {
    throw new TypeError(
      "Simply Connect panel password must contain at least 12 characters",
    );
  }
  const path = `/${(options.path ?? "/simply-connect").trim().replace(/^\/+|\/+$/g, "")}`;
  if (path === "/" || !/^\/[a-zA-Z0-9/_-]+$/.test(path)) {
    throw new TypeError("Simply Connect panel path is invalid");
  }
  const sessionTtlMs = options.sessionTtlMs ?? 30 * 60_000;
  if (
    !Number.isInteger(sessionTtlMs) ||
    sessionTtlMs < 60_000 ||
    sessionTtlMs > 24 * 60 * 60_000
  ) {
    throw new TypeError(
      "Simply Connect panel sessionTtlMs must be between one minute and 24 hours",
    );
  }
  return { path, password: options.password, sessionTtlMs };
}
