import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@opentrust/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@opentrust/core/schemas": new URL("./packages/core/src/schemas.ts", import.meta.url).pathname,
      "@opentrust/core/reason-codes": new URL("./packages/core/src/reason-codes.ts", import.meta.url).pathname,
      "@opentrust/core/proof-ledger": new URL("./packages/core/src/proof-ledger.ts", import.meta.url).pathname,
      "@opentrust/core/trust-score": new URL("./packages/core/src/trust-score.ts", import.meta.url).pathname,
      "@opentrust/core/offline": new URL("./packages/core/src/offline.ts", import.meta.url).pathname
    }
  }
});
