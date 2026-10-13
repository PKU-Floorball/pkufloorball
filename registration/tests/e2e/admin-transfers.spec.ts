import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) test(`administrator roster transfers at ${width}px`, async ({ page }) => {
  let players = [
    { id: 'cap-a', name: '甲队长', gender: '女', school: '北京大学', phone: '13800138001', role: 'captain', teamId: 'a' as string | null },
    { id: 'cap-b', name: '乙队长', gender: '男', school: '北京大学', phone: '13800138002', role: 'captain', teamId: 'b' as string | null },
    { id: 'free', name: '自由伙伴', gender: '非二元性别', school: '北京大学', phone: '13800138003', role: 'player', teamId: null as string | null },
    { id: 'other-free', name: '另一位自由球员', gender: '女', school: '北京大学', phone: '13800138005', role: 'player', teamId: null as string | null },
    { id: 'member', name: '甲队员', gender: '不愿意透露', school: '北京大学', phone: '13800138004', role: 'player', teamId: 'a' as string | null },
  ];
  const teams = [{ id: 'a', name: '甲队', captainId: 'cap-a' }, { id: 'b', name: '乙队', captainId: 'cap-b' }];
  const actions: Record<string, unknown>[] = [];
  let fail = false;
  await page.route('**/registration/api/admin', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); actions.push(body);
      if (fail) { await route.fulfill({ status: 400, json: { error: '调配失败，请重试' } }); return; }
      players = players.map(p => p.id === body.playerId ? { ...p, teamId: body.teamId } : p);
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: { players, teams, applications: [] } });
  });
  await page.setViewportSize({ width, height: width > 1000 ? 1800 : 900 });
  await page.goto('/registration/login');
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  const a = page.getByRole('article', { name: '甲队', exact: true });
  const b = page.getByRole('article', { name: '乙队', exact: true });
  const free = page.getByRole('region', { name: '管理员自由球员' });
  await expect(free.getByText('自由伙伴', { exact: true })).toBeVisible();
  await a.getByText('添加球员', { exact: true }).click();
  await expect(a.getByRole('combobox', { name: '选择要添加的球员' }).locator('option').filter({ hasText: '乙队长' })).toHaveCount(0);
  await a.getByRole('combobox', { name: '选择要添加的球员' }).selectOption('free');
  await a.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(a.getByText('自由伙伴', { exact: true })).toBeVisible();
  await expect(free.getByText('自由伙伴', { exact: true })).toHaveCount(0);
  expect(actions.at(-1)).toEqual({ action: 'move_player', playerId: 'free', teamId: 'a' });
  const row = a.getByRole('listitem').filter({ hasText: '自由伙伴' });
  await row.getByText('转队', { exact: true }).click();
  await row.getByRole('combobox', { name: '目标球队' }).selectOption('b');
  fail = true;
  await row.getByRole('button', { name: '确认调配' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('调配失败，请重试');
  await expect(a.getByText('自由伙伴', { exact: true })).toBeVisible();
  fail = false;
  await row.getByRole('button', { name: '确认调配' }).click();
  await expect(b.getByText('自由伙伴', { exact: true })).toBeVisible();
  expect(actions.at(-1)).toEqual({ action: 'move_player', playerId: 'free', teamId: 'b' });
  const captain = a.getByRole('listitem').filter({ hasText: '甲队长' });
  await expect(captain).toHaveAttribute('draggable', 'false');
  await expect(captain.getByText('转队', { exact: true })).toHaveCount(0);
  if (width > 1000) {
    await page.evaluate(() => {
      const original = DataTransfer.prototype.setDragImage;
      DataTransfer.prototype.setDragImage = function(element, x, y) {
        (window as unknown as { dragPreview: { width: number; height: number } }).dragPreview = {
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        };
        original.call(this, element, x, y);
      };
    });
    await expect(a.getByRole('listitem').filter({ hasText: '甲队员' })).toHaveAttribute('draggable', 'true');
    await a.getByRole('listitem').filter({ hasText: '甲队员' }).dragTo(b, { sourcePosition: { x: 8, y: 20 }, targetPosition: { x: 20, y: 20 } });
    await expect(b.getByText('甲队员', { exact: true })).toBeVisible();
    expect(actions.at(-1)).toEqual({ action: 'move_player', playerId: 'member', teamId: 'b' });
    await b.getByRole('listitem').filter({ hasText: '甲队员' }).dragTo(free, { sourcePosition: { x: 8, y: 20 } });
    await expect(free.getByText('甲队员', { exact: true })).toBeVisible();
    await free.getByRole('listitem').filter({ hasText: '甲队员' }).dragTo(a, { sourcePosition: { x: 8, y: 20 } });
    await expect(a.getByText('甲队员', { exact: true })).toBeVisible();
    await expect(free.getByText('另一位自由球员', { exact: true })).toBeVisible();
    expect(actions.filter(action => action.playerId === 'other-free')).toHaveLength(0);
    const preview = await page.evaluate(() => (window as unknown as { dragPreview?: { width: number; height: number } }).dragPreview);
    expect(preview).toBeDefined();
    expect(preview!.width).toBeLessThanOrEqual(280);
    expect(preview!.height).toBeLessThanOrEqual(60);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('roster-transfers.png'), fullPage: true });
});
