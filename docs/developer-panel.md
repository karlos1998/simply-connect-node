# NestJS developer panel

`SimplyConnectPanelModule` is an optional operational aid for developers. It is not an administrator interface and
does not grant capabilities beyond the configured API key.

## Security boundary

- The panel is absent unless `SimplyConnectPanelModule.forRoot()` is imported.
- Use a separate password of at least 12 characters. Never reuse the Simply Connect API key.
- The API key remains in the server-side client and is never included in HTML, cookies, logs, or form fields.
- Sessions are signed, HttpOnly, SameSite=Strict, expire after 30 minutes by default, and add `Secure` behind HTTPS.
- Every state-changing form has an action-specific CSRF token.
- Five failed logins from one application-observed address produce a five-minute cooldown.
- Responses use no-store caching, CSP, frame denial, MIME sniffing protection, and no-referrer policy.
- The panel does not automatically retry an SMS or call submission.

Place the application behind its ordinary TLS reverse proxy. If the panel is exposed outside a trusted network,
add the application's normal authentication/authorization layer in front of the route as defense in depth. Rotate
the panel password after accidental disclosure. The configured path may be changed, but an obscure path is not an
authentication control.

## Available operations

- discover API-key-visible SMS endpoints;
- show the ten latest messages;
- send one controlled test SMS;
- discover voice endpoints and published IVR flows;
- inspect ten recent queue entries;
- add one call to the durable queue;
- copy a minimal SDK example.

Missing cards usually mean that the API key lacks a required scope or endpoint grant. The panel deliberately shows
an empty state instead of weakening the API authorization model.
