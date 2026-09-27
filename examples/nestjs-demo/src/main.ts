import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  SimplyConnectModule,
  SimplyConnectPanelModule,
} from "@simply-connect/nestjs";
import { startMockApi } from "./mock-api.js";

@Module({
  imports: [
    SimplyConnectModule.forRoot({
      apiKey: "demo-api-key",
      baseUrl: "http://127.0.0.1:38085",
      defaultSmsEndpointId: "018f2f60-9f89-7ce0-9b3a-111111111111",
    }),
    SimplyConnectPanelModule.forRoot({
      password:
        process.env.SIMPLY_CONNECT_PANEL_PASSWORD ?? "simply-connect-demo",
    }),
  ],
})
class DemoModule {}

startMockApi(38085);
const app = await NestFactory.create(DemoModule);
await app.listen(38086, "127.0.0.1");
console.log("Mock API: http://127.0.0.1:38085");
console.log("Developer panel: http://127.0.0.1:38086/simply-connect");
console.log("Demo panel password: simply-connect-demo");
