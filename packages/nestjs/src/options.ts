import type { ModuleMetadata } from "@nestjs/common";
import type { SimplyConnectClientOptions } from "@simply-connect/node";

export type SimplyConnectModuleOptions = SimplyConnectClientOptions;

export interface SimplyConnectModuleAsyncOptions extends Pick<
  ModuleMetadata,
  "imports"
> {
  inject?: Array<string | symbol | (abstract new (...args: any[]) => unknown)>;
  useFactory: (
    ...args: any[]
  ) => Promise<SimplyConnectModuleOptions> | SimplyConnectModuleOptions;
}

export interface SimplyConnectPanelOptions {
  /** Mount path without a trailing slash. Defaults to /simply-connect. */
  path?: string;
  /** Separate panel password. At least 12 characters. Never reuse the API key. */
  password: string;
  /** Signed session lifetime. Defaults to 30 minutes. */
  sessionTtlMs?: number;
}
