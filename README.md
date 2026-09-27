# Simply Connect for Node.js and NestJS

Official TypeScript integration for the [Simply Connect External API](https://api.simply-connect.ovh/api/external/docs).
The repository ships two focused packages:

- `@simply-connect/node` — dependency-light client based on the native Fetch API;
- `@simply-connect/nestjs` — NestJS dependency injection plus an optional server-rendered developer panel.

Both packages publish ESM, CommonJS, source maps, and TypeScript declarations. Node.js 22.12+, 24 LTS,
and 26 Current are tested. The NestJS package supports NestJS 10, 11, and 12.

## Install

The first public release can be installed from its immutable GitHub assets:

```bash
npm install \
  https://github.com/karlos1998/simply-connect-node/releases/download/v0.1.0/simply-connect-node-0.1.0.tgz
```

For NestJS install both packages together:

```bash
npm install \
  https://github.com/karlos1998/simply-connect-node/releases/download/v0.1.0/simply-connect-node-0.1.0.tgz \
  https://github.com/karlos1998/simply-connect-node/releases/download/v0.1.0/simply-connect-nestjs-0.1.0.tgz
```

The canonical npm names are set in package metadata. A future registry release will use the same
`@simply-connect/node` and `@simply-connect/nestjs` imports without code changes.

## Node.js

```ts
import { SimplyConnectClient } from "@simply-connect/node";

const client = new SimplyConnectClient({
  apiKey: process.env.SIMPLY_CONNECT_API_KEY!,
  defaultSmsEndpointId: process.env.SIMPLY_CONNECT_SMS_ENDPOINT_ID,
});

const result = await client.sendSms(
  { to: "+48500100200", body: "Your order is ready." },
  { idempotencyKey: "order-1842-ready" },
);
```

Mutations are never retried automatically. The SDK creates one UUID for a send when an idempotency key is omitted,
but a business-owned key is recommended whenever a job can be repeated. Call-queue submissions use their own
`requestId`; reuse it only for the same logical call.

## NestJS

```ts
import { Module } from "@nestjs/common";
import { SimplyConnectModule } from "@simply-connect/nestjs";

@Module({
  imports: [
    SimplyConnectModule.forRoot({
      apiKey: process.env.SIMPLY_CONNECT_API_KEY!,
      defaultSmsEndpointId: process.env.SIMPLY_CONNECT_SMS_ENDPOINT_ID,
    }),
  ],
})
export class AppModule {}
```

Inject the same typed client anywhere:

```ts
import { Injectable } from "@nestjs/common";
import { SimplyConnectClient } from "@simply-connect/nestjs";

@Injectable()
export class OrderNotifications {
  constructor(private readonly simplyConnect: SimplyConnectClient) {}

  notify(order: { id: string; phone: string }) {
    return this.simplyConnect.sendSms(
      { to: order.phone, body: `Order ${order.id} is ready.` },
      { idempotencyKey: `order-${order.id}-ready` },
    );
  }
}
```

`SimplyConnectModule.forRootAsync()` supports configuration services and secret managers.

## Optional NestJS developer panel

The panel is a separate import, so it is off unless the application explicitly enables it:

```ts
import {
  SimplyConnectModule,
  SimplyConnectPanelModule,
} from "@simply-connect/nestjs";

@Module({
  imports: [
    SimplyConnectModule.forRoot({
      apiKey: process.env.SIMPLY_CONNECT_API_KEY!,
      defaultSmsEndpointId: process.env.SIMPLY_CONNECT_SMS_ENDPOINT_ID,
    }),
    SimplyConnectPanelModule.forRoot({
      path: "/simply-connect",
      password: process.env.SIMPLY_CONNECT_PANEL_PASSWORD!,
    }),
  ],
})
export class AppModule {}
```

Open `/simply-connect`. The password must contain at least 12 characters and must be different from the API key.
The panel uses a signed, short-lived, HttpOnly, SameSite session cookie, action-specific CSRF tokens, login throttling,
strict security headers, and server-side API calls. It never renders the API key. See
[docs/developer-panel.md](docs/developer-panel.md) before enabling it outside local development.

## API-key scopes

| Capability                                     | Required scope     |
| ---------------------------------------------- | ------------------ |
| Discover SMS endpoints and send SMS            | `SMS_SEND`         |
| List messages and delivery history             | `MESSAGES_READ`    |
| List the outbound call queue                   | `CALL_QUEUE_READ`  |
| Discover voice endpoints/flows and queue calls | `CALL_QUEUE_WRITE` |

Endpoint restrictions configured on the key are honored by every method and panel action.

## Local no-cost demo

```bash
npm install
npm run build
npm run start --workspace simply-connect-nestjs-demo
```

Open <http://127.0.0.1:38086/simply-connect> and use password `simply-connect-demo`. The demo starts an
in-process mock API on port `38085`; it cannot send a carrier SMS or place a call.

## Verification and compatibility

```bash
npm ci
npm run check
```

CI checks Node.js 22, 24, and 26, NestJS 10/11/12, both module formats, packed artifacts, and the canonical
External API OpenAPI contract. Supported applications may themselves use ESM or CommonJS. NestJS 12 applications
must still meet NestJS's own runtime requirements, especially Node.js 22.12+ when consuming ESM from CommonJS.

## Errors

API failures preserve status, correlation ID, response body, and RFC 9457 problem details. Common cases have typed
classes: `AuthenticationError`, `ValidationError`, `NotFoundError`, `IdempotencyConflictError`, and `RateLimitError`.
Network and unreadable-response failures use `SimplyConnectError`.

## License

MIT
