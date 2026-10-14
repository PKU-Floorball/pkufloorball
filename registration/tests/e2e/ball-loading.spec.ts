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
      await route.fulfill({ response, body: (await response.text()).replace('interactive-ball.bundle.js', 'interactive-ball.js') });
    });
    await page.goto('/registration-visual/ball.html');
    const ball = page.getByRole('button');
    await expect(ball).toHaveClass(/webgl-ready/);
    await expect(ball).toHaveAttribute('data-rotation', /.+/);
    screenshots.push(await page.screenshot());
    if (!original) {
      expect(scripts.map(url => new URL(url).pathname)).toEqual(['/registration-visual/interactive-ball.bundle.js']);
      const bytes = await page.request.get('/registration-visual/interactive-ball.bundle.js');
      expect((await bytes.body()).length).toBeLessThan(600000);
    }
    await context.close();
  }
  expect(screenshots[1].equals(screenshots[0])).toBe(true);
});
