import { defineConfig } from "@playwright/test";

const browserName = process.env.PLAYWRIGHT_BROWSER === "webkit" ? "webkit" : "chromium";
const emulateMobile = process.env.PLAYWRIGHT_MOBILE === "1";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4178",
    browserName,
    ...(browserName === "chromium" ? { channel: "msedge" } : {}),
    hasTouch: emulateMobile,
    isMobile: emulateMobile,
    trace: "retain-on-failure",
  },
});
