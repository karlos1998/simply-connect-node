import { DynamicModule, Global, Module, type Provider } from "@nestjs/common";
import { SimplyConnectClient } from "@simply-connect/node";
import type {
  SimplyConnectModuleAsyncOptions,
  SimplyConnectModuleOptions,
} from "./options.js";

@Global()
@Module({})
export class SimplyConnectModule {
  static forRoot(options: SimplyConnectModuleOptions): DynamicModule {
    return this.withProvider({
      provide: SimplyConnectClient,
      useValue: new SimplyConnectClient(options),
    });
  }

  static forRootAsync(options: SimplyConnectModuleAsyncOptions): DynamicModule {
    const provider: Provider = {
      provide: SimplyConnectClient,
      inject: options.inject ?? [],
      useFactory: async (...dependencies: any[]) =>
        new SimplyConnectClient(await options.useFactory(...dependencies)),
    };
    return {
      module: SimplyConnectModule,
      global: true,
      imports: options.imports ?? [],
      providers: [provider],
      exports: [SimplyConnectClient],
    };
  }

  private static withProvider(provider: Provider): DynamicModule {
    return {
      module: SimplyConnectModule,
      global: true,
      providers: [provider],
      exports: [SimplyConnectClient],
    };
  }
}
