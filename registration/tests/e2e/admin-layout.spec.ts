import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) test(`admin expanded player and application layouts at ${width}px`, async ({ page }) => {
  const players = [
    { id: 'one', name: '自由球员一', phone: '13800138001', gender: '男', school: '北京大学', role: 'player', teamId: null },
    { id: 'two', name: '自由球员二', phone: '13800138002', gender: '非二元性别', school: '北京大学', role: 'player', teamId: null },
  ];
  let applications = ['pending', 'approved', 'cancelled', 'rejected'].map((status, i) => ({ id: String(i), playerId: 'one', teamId: 'team', name: '自由球员一', gender: '男', teamName: '未名球队', reason: i === 0 ? '每周都能参加训练，希望一起上场。' : '', status, createdAt: '2026-10-13T07:15:43Z' }));
  const actions: Record<string, unknown>[] = [];
  await page.route('**/registration/api/admin', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); actions.push(body);
      applications = applications.map(a => a.id === body.applicationId ? { ...a, status: 'approved' } : a);
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: { players, teams: [{ id: 'team', name: '未名球队', captainId: 'captain' }], applications } });
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/registration/login');
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  const free = page.getByRole('region', { name: '管理员自由球员' });
  const first = free.getByRole('listitem').nth(0), second = free.getByRole('listitem').nth(1);
  await first.getByText('加入球队', { exact: true }).click();
  if (width > 1000) {
    const firstName = await first.getByText('自由球员一', { exact: true }).boundingBox();
    const secondName = await second.getByText('自由球员二', { exact: true }).boundingBox();
    expect(Math.abs(firstName!.y - secondName!.y)).toBeLessThan(2);
  }
  await free.screenshot({ path: test.info().outputPath('free-players.png') });
  await page.getByRole('button', { name: /^申请管理/ }).click();
  const pending = page.locator('.admin-applications article').first();
  await expect(pending.getByText('每周都能参加训练，希望一起上场。', { exact: false })).toBeVisible();
  const history = page.locator('.admin-applications article').nth(1);
  expect((await history.boundingBox())!.height).toBeLessThan(160);
  await page.locator('.admin-applications').screenshot({ path: test.info().outputPath('applications.png') });
  await pending.getByRole('button', { name: '批准', exact: true }).click();
  await expect(pending.getByText('已批准', { exact: true })).toBeVisible();
  expect(actions).toEqual([{ action: 'approve', applicationId: '0' }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
