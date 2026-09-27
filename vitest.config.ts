import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@simply-connect/node": fileURLToPath(
        new URL("./packages/node/src/index.ts", import.meta.url),
      ),
      "@simply-connect/nestjs": fileURLToPath(
        new URL("./packages/nestjs/src/index.ts", import.meta.url),
      ),
    },
  },
});
