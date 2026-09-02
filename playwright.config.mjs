import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4178",
    browserName: "chromium",
    channel: "msedge",
    trace: "retain-on-failure",
  },
});
