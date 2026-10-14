import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/cache', outputDir: 'cache-test-results', workers: 1,
  use: { baseURL: 'http://127.0.0.1:3102', trace: 'retain-on-failure', reducedMotion: 'reduce' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'REGISTRATION_DEMO=true REGISTRATION_BUILD_DIR=.next-cache npm run build && REGISTRATION_DEMO=true REGISTRATION_BUILD_DIR=.next-cache npm run start -- --hostname 127.0.0.1 --port 3102',
    url: 'http://127.0.0.1:3102', timeout: 120000,
  },
});
