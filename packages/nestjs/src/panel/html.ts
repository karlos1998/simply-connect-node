import type {
  CallQueueEndpoint,
  CallQueueItem,
  Message,
  PublishedCallFlow,
  SmsEndpoint,
} from "@simply-connect/node";

export function loginHtml(path: string, message?: string): string {
  return page(
    "Simply Connect",
    `<main class="login"><section class="card"><p class="eyebrow">Developer panel</p><h1>Simply Connect</h1><p>Sign in with the separate panel password configured by your application.</p>${notice(message, "error")}<form method="post" action="${escape(path)}/login"><label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label><button type="submit">Open panel</button></form><small>The API key stays on the server and is never rendered in this page.</small></section></main>`,
  );
}

export function dashboardHtml(input: {
  path: string;
  csrf: (action: string) => string;
  smsEndpoints: SmsEndpoint[];
  messages: Message[];
  callEndpoints: CallQueueEndpoint[];
  flows: PublishedCallFlow[];
  queue: CallQueueItem[];
  message?: string;
  error?: string;
}): string {
  const smsOptions = options<SmsEndpoint>(
    input.smsEndpoints,
    (item) => item.id,
    endpointLabel,
  );
  const callOptions = options<CallQueueEndpoint>(
    input.callEndpoints,
    (item) => item.id,
    endpointLabel,
  );
  const flowOptions = options(
    input.flows,
    (item) => item.publishedVersionId,
    (item) => item.name,
  );
  return page(
    "Simply Connect developer panel",
    `<header><div><p class="eyebrow">Developer panel</p><h1>Simply Connect</h1><p>Live view of the capabilities available to this API key.</p></div><span class="pill">API key hidden</span></header><main>${notice(input.message, "ok")}${notice(input.error, "error")}<section class="grid summary">${metric("SMS endpoints", input.smsEndpoints.length, "SMS_SEND")}${metric("Recent messages", input.messages.length, "MESSAGES_READ")}${metric("Voice endpoints", input.callEndpoints.length, "CALL_QUEUE_WRITE")}${metric("Queue entries", input.queue.length, "CALL_QUEUE_READ")}</section><section class="grid"><article class="card"><h2>Send a test SMS</h2><form method="post" action="${escape(input.path)}/sms"><input type="hidden" name="csrf" value="${escape(input.csrf("sms"))}"><label>SMS endpoint<select name="endpointId" required>${smsOptions}</select></label><label>Recipient<input name="to" autocomplete="tel" placeholder="+48500100200" required></label><label>Message<textarea name="body" maxlength="5000" required>Your Simply Connect integration works.</textarea></label><button type="submit">Queue test SMS</button></form></article><article class="card"><h2>Queue an IVR call</h2><form method="post" action="${escape(input.path)}/call"><input type="hidden" name="csrf" value="${escape(input.csrf("call"))}"><label>Voice endpoint<select name="endpointId" required>${callOptions}</select></label><label>Published flow<select name="flowVersionId" required>${flowOptions}</select></label><label>Destination<input name="destination" autocomplete="tel" placeholder="+48500100200" required></label><label>Time zone<input name="timeZone" value="Europe/Warsaw" required></label><button type="submit">Add to call queue</button></form></article></section><section class="grid"><article class="card"><h2>Recent messages</h2>${messageTable(input.messages)}</article><article class="card"><h2>Call queue</h2>${queueTable(input.queue)}</article></section><section class="card code"><h2>Use the same client in code</h2><pre><code>const result = await client.sendSms({ to: "+48500100200", body: "Order ready" }, { idempotencyKey: "order-" + order.id + "-ready" });</code></pre><p>Mutations are not retried automatically. Reuse an idempotency key only for the same logical request.</p></section></main>`,
  );
}

function page(title: string, content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>:root{color-scheme:light dark;--bg:#071b1d;--surface:#0d292c;--line:#245156;--text:#eefbfa;--muted:#a9c7c5;--accent:#48d5c5}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#153e42,var(--bg) 45%);color:var(--text);font:15px/1.55 system-ui,sans-serif}header,main{width:min(1120px,calc(100% - 32px));margin:auto}header{display:flex;justify-content:space-between;gap:24px;align-items:end;padding:48px 0 24px}h1{font-size:clamp(2rem,6vw,4rem);line-height:1;margin:.15em 0}h2{margin-top:0}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:.12em;text-transform:uppercase}.pill{border:1px solid var(--line);border-radius:999px;padding:8px 12px;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:16px}.summary{grid-template-columns:repeat(4,minmax(0,1fr))}.card{background:color-mix(in srgb,var(--surface) 92%,transparent);border:1px solid var(--line);border-radius:18px;padding:22px;overflow:auto}.metric strong{display:block;font-size:2rem}.metric small,small,p{color:var(--muted)}label{display:grid;gap:6px;margin:14px 0;font-weight:700}input,select,textarea,button{font:inherit;border-radius:10px;border:1px solid var(--line);padding:11px 12px;background:#071b1d;color:var(--text)}textarea{min-height:100px;resize:vertical}button{background:var(--accent);color:#032522;border:0;font-weight:900;cursor:pointer}.notice{border-radius:12px;padding:12px 14px;margin:0 0 16px}.notice.ok{background:#153d36}.notice.error{background:#542725;color:#ffd8d5}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid var(--line);white-space:nowrap}pre{background:#041315;padding:16px;border-radius:12px;overflow:auto}.login{min-height:100vh;display:grid;place-items:center}.login .card{width:min(460px,100%)}@media(max-width:800px){.summary,.grid{grid-template-columns:1fr 1fr}header{align-items:start;flex-direction:column}}@media(max-width:540px){.summary,.grid{grid-template-columns:1fr}header{padding-top:28px}}</style></head><body>${content}</body></html>`;
}

function metric(label: string, value: number, scope: string): string {
  return `<article class="card metric"><small>${escape(scope)}</small><strong>${value}</strong><span>${escape(label)}</span></article>`;
}

function messageTable(messages: Message[]): string {
  if (!messages.length)
    return "<p>No visible messages or the key lacks MESSAGES_READ.</p>";
  return `<table><thead><tr><th>When</th><th>Number</th><th>Status</th></tr></thead><tbody>${messages.map((item) => `<tr><td>${escape(item.occurredAt)}</td><td>${escape(item.remoteAddress)}</td><td>${escape(item.status ?? "—")}</td></tr>`).join("")}</tbody></table>`;
}

function queueTable(items: CallQueueItem[]): string {
  if (!items.length)
    return "<p>No visible queue entries or the key lacks CALL_QUEUE_READ.</p>";
  return `<table><thead><tr><th>Destination</th><th>Status</th><th>Not before</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escape(item.destination)}</td><td>${escape(item.status)}</td><td>${escape(item.notBefore)}</td></tr>`).join("")}</tbody></table>`;
}

function options<T>(
  items: T[],
  value: (item: T) => string,
  label: (item: T) => string,
): string {
  if (!items.length) return '<option value="">No available item</option>';
  return items
    .map(
      (item) =>
        `<option value="${escape(value(item))}">${escape(label(item))}</option>`,
    )
    .join("");
}

function endpointLabel(item: {
  name: string;
  phoneNumber?: string | null;
}): string {
  return item.phoneNumber ? `${item.name} · ${item.phoneNumber}` : item.name;
}

function notice(value: string | undefined, kind: "ok" | "error"): string {
  return value
    ? `<div class="notice ${kind}" role="status">${escape(value)}</div>`
    : "";
}

function escape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
