import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import asset from '../../src/components/ball-asset-data.json';

test('versioned renderer is immutable and repeat visits reuse browser cache', async ({ page, request }) => {
  test.setTimeout(60000);
  const response = await request.get(asset.src);
  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toContain('max-age=31536000');
  expect(response.headers()['cache-control']).toContain('immutable');
  const hash = createHash('sha256').update(await response.body()).digest('hex').slice(0, 16);
  expect(asset.src).toBe(`/registration-visual/interactive-ball.${hash}.js`);
  const html = await request.get('/registration-visual/ball.html');
  expect(await html.text()).toContain(`src="interactive-ball.${hash}.js"`);
  expect(html.headers()['cache-control']).not.toContain('immutable');
  const ready = async (frame: typeof page | import('@playwright/test').Frame) => {
    await frame.waitForFunction(() => {
      const stage = document.querySelector('.ball-stage')!;
      return stage.classList.contains('webgl-ready') || !(stage.querySelector('img') as HTMLImageElement).hidden;
    });
    const webgl = await frame.locator('.ball-stage').evaluate(el => el.classList.contains('webgl-ready'));
    if (webgl) await expect(frame.getByRole('button')).toHaveAttribute('data-rotation', /.+/);
    else await expect(frame.locator('.ball-stage img')).toBeVisible();
    return webgl;
  };
  const measure = async () => {
    await ready(page);
    return page.evaluate(src => {
      const entry = performance.getEntriesByName(location.origin + src)[0] as PerformanceResourceTiming;
      return { transfer: entry.transferSize, decoded: entry.decodedBodySize };
    }, asset.src);
  };
  await page.goto('/registration-visual/ball.html');
  const cold = await measure();
  expect(cold.transfer).toBeGreaterThan(0);
  await page.goto('about:blank');
  await page.goto('/registration-visual/ball.html');
  const warm = await measure();
  expect(warm.transfer).toBe(0);
  expect([0, cold.decoded]).toContain(warm.decoded); // WebKit omits body size for cached modules.
  await page.reload();
  const reload = await measure();
  expect(reload.transfer).toBeLessThan(2048); // Allows small conditional response headers.
  expect([0, cold.decoded]).toContain(reload.decoded);
  await page.goto('/registration');
  await expect(page.locator('link[rel="modulepreload"]')).toHaveAttribute('href', asset.src);
  await expect(page.locator('.race-ball-frame')).toBeVisible();
  const iframe = page.frames().find(frame => frame.url().endsWith('/registration-visual/ball.html'))!;
  const webgl = await ready(iframe);
  const embedded = await iframe.evaluate(src => {
    const entry = performance.getEntriesByName(location.origin + src)[0] as PerformanceResourceTiming;
    return { transfer: entry.transferSize, decoded: entry.decodedBodySize };
  }, asset.src);
  expect(embedded.transfer).toBeLessThan(2048);
  expect([0, cold.decoded]).toContain(embedded.decoded);
  await test.info().attach('renderer-cache.json' , { body: JSON.stringify({ cold, warm, reload, embedded, webgl }), contentType: 'application/json' });
});
