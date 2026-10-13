import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/visual',outputDir:'visual-test-results',fullyParallel:true,workers:2,timeout:30000,
 use:{baseURL:'http://127.0.0.1:3101',trace:'retain-on-failure'},
 projects:[
  {name:'chromium-desktop',use:{...devices['Desktop Chrome']}},
  {name:'firefox-desktop',use:{...devices['Desktop Firefox']}},
  {name:'webkit-desktop',use:{...devices['Desktop Safari']}},
  {name:'android',use:{...devices['Pixel 7']}},
  {name:'iphone',use:{...devices['iPhone 13']}},
 ],
 webServer:{command:'REGISTRATION_BUILD_DIR=.next-e2e REGISTRATION_DEMO=true npm run dev -- --hostname 127.0.0.1 --port 3101',url:'http://127.0.0.1:3101',reuseExistingServer:!!process.env.PLAYWRIGHT_REUSE_SERVER,timeout:120000},
});
