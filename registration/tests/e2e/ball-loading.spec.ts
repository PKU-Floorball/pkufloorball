import { test, expect } from '@playwright/test';

test('bundled ball renders identical pixels with one script download', async ({ browser }) => {
  test.setTimeout(60000);
  const screenshots: Buffer[] = [];
  for (const original of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 300, height: 300 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const scripts: string[] = [];
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    if (original) await page.route('**/registration-visual/ball.html', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace(/interactive-ball\.[a-f0-9]{16}\.js/g, 'interactive-ball.js') });
    });
    await page.goto('/registration-visual/ball.html');
    const ball = page.getByRole('button');
    await expect(ball).toHaveClass(/webgl-ready/);
    await expect(ball).toHaveAttribute('data-rotation', /.+/);
    screenshots.push(await page.screenshot());
    if (!original) {
      expect(scripts).toHaveLength(1);
      const asset = new URL(scripts[0]).pathname;
      expect(asset).toMatch(/^\/registration-visual\/interactive-ball\.[a-f0-9]{16}\.js$/);
      const bytes = await page.request.get(asset);
      expect((await bytes.body()).length).toBeLessThan(600000);
    }
    await context.close();
  }
  expect(screenshots[1].equals(screenshots[0])).toBe(true);
});
