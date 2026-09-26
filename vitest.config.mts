import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { PGLITE_DATA_DIR: "memory", DATABASE_URL: "" },
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
