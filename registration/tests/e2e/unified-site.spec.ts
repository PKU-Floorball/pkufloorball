import { test, expect } from '@playwright/test';
test('association homepage links to registration and back, deep pages preserve assets', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('北京大学软式曲棍球协会');
  await page.getByRole('button', { name: '赛事', exact: true }).click();
  await page.getByRole('link', { name: '公开赛', exact: true }).click();
  await expect(page).toHaveURL(/\/registration$/);
  await page.getByRole('link', { name: '返回协会主页' }).click();
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
  await page.goto('/');
  await page.locator('.navbar-toggler').click();
  await page.getByRole('button', { name: '赛事', exact: true }).click();
  await page.getByRole('link', { name: '公开赛', exact:true }).click();
  await expect(page).toHaveURL(/\/registration$/);
  await expect(page.getByRole('button',{name:'立即注册',exact:true})).toBeVisible();
});
