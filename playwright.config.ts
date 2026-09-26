import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Fresh embedded database per run so the journey starts from an empty app.
const dataDir = `.data/e2e-${Date.now()}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx tsx scripts/migrate.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      PGLITE_DATA_DIR: dataDir,
      DATABASE_URL: "",
      E2E_DISABLE_RATE_LIMIT: "1",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
    },
  },
});
