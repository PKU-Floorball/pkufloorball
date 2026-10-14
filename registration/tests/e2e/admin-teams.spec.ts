import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`team information and explicit editing at ${width}px`, async ({ page }) => {
    const players = [
      { id: 'captain', name: '测试队长', gender: '女', school: '北京大学', phone: '13800138001', teamId: 'team', role: 'captain' },
      { id: 'member', name: '测试队员', gender: '男', school: '北京大学', phone: '13800138002', teamId: 'team', role: 'player' },
    ];
    let team = { id: 'team', name: '测试球队', captainId: 'captain' };
    const actions: Record<string, unknown>[] = [];
    let rejectRename = false;
    await page.route('**/registration/api/admin', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        actions.push(body);
        if (body.action === 'rename_team' && rejectRename) {
          await route.fulfill({ status: 400, json: { error: '队名已存在' } });
          return;
        }
        if (body.action === 'rename_team') team = { ...team, name: body.name };
        if (body.action === 'set_captain') {
          team = { ...team, captainId: body.playerId };
          players.forEach(p => { p.role = p.id === body.playerId ? 'captain' : 'player'; });
        }
        await route.fulfill({ json: { ok: true } });
      } else await route.fulfill({ json: { players, teams: [team], applications: [] } });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/registration/login');
    const footer = page.getByRole('contentinfo');
    const ordinaryFooter = await footer.innerHTML();
    await page.getByRole('button', { name: '管理员登录', exact: true }).click();
    const card = page.getByRole('article', { name: /^(测试球队|新球队名)$/ });
    await expect(card.getByLabel('队伍名称', { exact: true })).not.toBeVisible();
    await expect(card.getByText('13800138001')).toBeVisible();
    await expect(card.getByRole('listitem').filter({ hasText: '测试队员' })).toBeVisible();
    await expect(card.getByRole('button', { name: '删除球队', exact: true })).not.toBeVisible();
    await expect(footer).toHaveJSProperty('innerHTML', ordinaryFooter);
    await page.screenshot({ path: test.info().outputPath('team-information.png'), fullPage: true });
    await card.getByRole('button', { name: '编辑', exact: true }).click();
    const editor = page.getByRole('dialog', {name:'编辑球队', exact:true});
    await editor.getByLabel('队伍名称', { exact: true }).fill('尚未保存');
    await editor.getByRole('button', { name: '关闭编辑球队', exact: true }).click();
    expect(actions).toHaveLength(0);
    await card.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(editor.getByLabel('队伍名称', { exact: true })).toHaveValue('测试球队');
    await editor.getByLabel('队伍名称', { exact: true }).fill('新球队名');
    rejectRename = true;
    await editor.getByRole('button', { name: '保存队名', exact: true }).click();
    await expect(editor.getByRole('alert')).toHaveText('队名已存在');
    await expect(editor.getByLabel('队伍名称', { exact: true })).toHaveValue('新球队名');
    rejectRename = false;
    await editor.getByRole('button', { name: '保存队名', exact: true }).click();
    await expect(editor.getByLabel('队伍名称', {exact:true})).toHaveValue('新球队名');
    expect(actions.at(-1)).toMatchObject({ action: 'rename_team', teamId: 'team', name: '新球队名' });
    await editor.getByRole('combobox', { name: /^队长/ }).selectOption('member');
    await editor.getByRole('button', { name: '更换队长', exact: true }).click();
    await expect(card.getByText('13800138002')).toBeVisible();
    expect(actions.at(-1)).toMatchObject({ action: 'set_captain', teamId: 'team', playerId: 'member' });
    await expect(page.getByText('修改已保存。', {exact:true})).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('team-editor.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
