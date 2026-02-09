import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
