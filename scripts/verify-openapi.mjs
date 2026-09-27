import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const requested = process.argv[2];
const defaultPath = resolve(
  "../modern-simply-connect-api/contracts/openapi/v1/openapi.json",
);
const document = JSON.parse(
  await readFile(requested ? resolve(requested) : defaultPath, "utf8"),
);

const requirements = [
  ["paths", "/api/v1/external/messages", "post", "responses", "202"],
  ["paths", "/api/v1/external/messages", "get", "responses", "200"],
  ["paths", "/api/v1/external/messages/{messageId}", "get"],
  ["paths", "/api/v1/external/endpoints", "get"],
  ["paths", "/api/v1/external/call-queue", "get", "responses", "200"],
  ["paths", "/api/v1/external/call-queue", "post", "responses", "202"],
  ["paths", "/api/v1/external/call-queue/endpoints", "get"],
  ["paths", "/api/v1/external/call-queue/flows", "get"],
  ["components", "schemas", "ExternalSmsRequest"],
  ["components", "schemas", "SmsSendResult"],
  ["components", "schemas", "ExternalMessagePage"],
  ["components", "schemas", "ExternalMessageDetails"],
  ["components", "schemas", "ExternalCallQueueEndpoint"],
  ["components", "schemas", "ExternalPublishedCallFlow"],
  ["components", "schemas", "ExternalCallQueuePage"],
  ["components", "schemas", "ExternalCallQueueRequest"],
  ["components", "schemas", "ExternalCallQueueItem"],
];

const missing = requirements.filter((segments) => {
  let value = document;
  for (const segment of segments) {
    if (!value || typeof value !== "object" || !(segment in value)) return true;
    value = value[segment];
  }
  return false;
});

const parameters =
  document.paths?.["/api/v1/external/messages"]?.post?.parameters ?? [];
if (
  !parameters.some(
    (parameter) =>
      parameter?.name === "Idempotency-Key" && parameter?.in === "header",
  )
) {
  missing.push([
    "paths",
    "/api/v1/external/messages",
    "post",
    "parameters",
    "Idempotency-Key",
  ]);
}

if (missing.length) {
  console.error(
    `The canonical External API contract is missing:\n- ${missing.map((item) => item.join(" → ")).join("\n- ")}`,
  );
  process.exit(1);
}

console.log("Simply Connect External API contract is compatible.");
