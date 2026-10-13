import { test, expect } from '@playwright/test';
test('association homepage links to registration and back, deep pages preserve assets', async ({ page }) => {
  // The association site must work even when third-party asset hosts are blocked.
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|code\.iconify\.design|api\.iconify\.design)\//, route => route.abort());
  await page.goto('/');
  await expect(page).toHaveTitle('北京大学软式曲棍球协会');
  expect(await page.locator('.header-top li.social-icon').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: '赛事', exact: true }).click();
  await page.getByRole('link', { name: '公开赛', exact: true }).click();
  await expect(page).toHaveURL(/\/registration$/);
  await page.getByRole('link', { name: '北京大学软式曲棍球', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const deep = await page.request.get('/htmls/3-association/2-rk-cup/24-rk-cup/main.html');
  expect(deep.ok()).toBe(true);
  expect(await deep.text()).toContain('/assets/css/cup-style.css');
  expect((await page.request.get('/assets/images/bg1.png')).ok()).toBe(true);
  await page.goto('/registration/register');
  await expect(page.getByLabel('姓名', {exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('姓名', {exact:true})).toBeVisible();
  expect((await page.request.get('/api/registration')).status()).toBe(404);
});
test('mobile association navigation opens competition', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  // The association site must work even when third-party asset hosts are blocked.
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|code\.iconify\.design|api\.iconify\.design)\//, route => route.abort());
  await page.goto('/');
  await page.locator('.navbar-toggler').click();
  await page.getByRole('button', { name: '赛事', exact: true }).click();
  await page.getByRole('link', { name: '公开赛', exact:true }).click();
  await expect(page).toHaveURL(/\/registration$/);
  await expect(page.getByRole('button',{name:'立即注册',exact:true})).toBeVisible();
});

test('lazy gallery images keep masonry cards from overlapping', async ({ page }) => {
  await page.setViewportSize({ width:1280, height:900 });
  await page.goto('/');
  await page.locator('#gallery').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('#gallery img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect.poll(() => page.locator('#gallery .entry-item').evaluateAll(items => {
    const boxes=items.map(el=>el.getBoundingClientRect());
    return boxes.every((a,i)=>boxes.slice(i+1).every(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)<1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<1));
  })).toBe(true);
});
