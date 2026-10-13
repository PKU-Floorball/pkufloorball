import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : {},
  },
  webServer: {
    command:
      "REGISTRATION_BUILD_DIR=.next-e2e REGISTRATION_DEMO=true npm run dev -- --webpack --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_SERVER,
    timeout: 120000,
  },
});
