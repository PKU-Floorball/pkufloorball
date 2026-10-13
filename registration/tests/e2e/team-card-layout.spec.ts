import { test, expect } from '@playwright/test';

for (const role of ['player', 'captain']) for (const width of [1280, 390]) {
  test(`compact team cards preserve ${role} exit at ${width}px`, async ({ page }) => {
    const players = [
      { id: 'captain', name: '测试队长', role: 'captain', gender: '女', school: '北京大学', teamId: 'team' },
      { id: 'member', name: '测试队员', role: 'player', gender: '非二元性别', school: '北京大学', teamId: 'team' },
      { id: 'third', name: '另一位队员', role: 'player', gender: '不愿意透露', school: '清华大学', teamId: 'team' },
      { id: 'fourth', name: '第四名队员', role: 'player', gender: '男', school: '北京大学校友', teamId: 'team' },
    ];
    const viewer = players.find(p => p.role === role)!;
    const teams = [{ id: 'team', name: '测试球队', captainId: 'captain', captainPhone: '13800138001', players }, ...['二', '三'].map(n => ({ id: n, name: `球队${n}`, captainId: `cap-${n}`, captainPhone: '13800138002', players: [{ ...players[0], id: `cap-${n}`, teamId: n }] }))];
    await page.addInitScript(() => sessionStorage.setItem('floorball-tab-login', '1'));
    await page.route('**/registration/api/registration', route => route.fulfill({ json: { mode: 'demo', teams: [], snapshot: { viewer, teams, freePlayers: [], applications: [] } } }));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/registration/teams');
    const card = page.getByRole('article', { name: '测试球队', exact: true });
    await expect(card.locator('.team-top').getByRole('button', { name: '退出球队', exact: true })).toBeVisible();
    const heading = await card.getByRole('heading', { name: '测试球队', exact: true }).boundingBox();
    const badge = await card.getByText('我的球队', { exact: true }).boundingBox();
    expect(Math.abs(heading!.y + heading!.height / 2 - badge!.y - badge!.height / 2)).toBeLessThan(2);
    expect(badge!.x).toBeGreaterThan(heading!.x);
    if (width > 1000) {
      const rows = card.locator('.roster-player');
      const first = (await rows.nth(0).boundingBox())!;
      for (const i of [1, 2]) expect(Math.abs((await rows.nth(i).boundingBox())!.y - first.y)).toBeLessThan(2);
      expect((await rows.nth(3).boundingBox())!.y).toBeGreaterThan(first.y);
      const firstTeam = (await card.boundingBox())!;
      expect(Math.abs((await page.getByRole('article', { name: '球队二', exact: true }).boundingBox())!.y - firstTeam.y)).toBeLessThan(2);
      expect((await page.getByRole('article', { name: '球队三', exact: true }).boundingBox())!.y).toBeGreaterThan(firstTeam.y);
    }
    await card.screenshot({ path: test.info().outputPath('team-card.png') });
    await card.getByRole('button', { name: '退出球队', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '退出球队', exact: true });
    await expect(dialog).toBeVisible();
    if (role === 'captain') await expect(dialog.getByLabel('接任队长')).toBeVisible();
    else await expect(dialog.getByRole('button', { name: '确认退出', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    const dropTarget = role === 'captain' ? card : page.getByRole('article', { name: '球队二', exact: true });
    const initialBackground = await dropTarget.evaluate(el => getComputedStyle(el).backgroundColor);
    const transfer = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.setData('application/x-pku-player', 'member');
      return data;
    });
    await dropTarget.dispatchEvent('dragover', { dataTransfer: transfer });
    await expect(dropTarget).toHaveClass(/drop-active/);
    await expect(dropTarget).not.toHaveCSS('background-color', initialBackground);
    await expect(dropTarget.getByRole('status')).toHaveText(role === 'captain' ? '松开，将球员加入本队' : '松开，申请加入这支球队');
    await dropTarget.screenshot({ path: test.info().outputPath('team-drop.png') });
    await dropTarget.dispatchEvent('dragleave', { dataTransfer: transfer });
    await expect(dropTarget).not.toHaveClass(/drop-active/);
    await expect(dropTarget.getByRole('status')).toHaveCount(0);
    if (role === 'player') {
      const apply = page.getByRole('article', { name: '球队二', exact: true }).getByRole('button', { name: '申请加入' });
      await apply.hover();
      await expect(apply).toHaveCSS('color', 'rgb(255, 255, 255)');
      const red = await apply.evaluate(el => getComputedStyle(el).getPropertyValue('--red').trim());
      const expectedBackground = await page.evaluate(red => {
        const el = document.createElement('div');
        el.style.backgroundColor = red;
        document.body.append(el);
        const color = getComputedStyle(el).backgroundColor;
        el.remove();
        return color;
      }, red);
      await expect(apply).toHaveCSS('background-color', expectedBackground);
      await apply.focus();
      await page.mouse.move(0, 0);
      await expect(apply).toHaveCSS('background-color', expectedBackground);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
