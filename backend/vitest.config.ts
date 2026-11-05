import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 15000,
    maxWorkers: 2,
    fileParallelism: true,

    env: {
      BID_AUDIT_HMAC_KEY:
        "aureo-chave-exclusiva-para-testes-hmac-2026-nao-usar-em-producao",
    },
  },
});