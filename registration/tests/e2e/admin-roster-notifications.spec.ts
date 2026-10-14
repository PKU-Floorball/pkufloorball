import { test, expect } from '@playwright/test';

for (const role of ['player', 'captain']) for (const width of [1280, 390]) {
  test(`administrator roster messages reach ${role} inbox at ${width}px`, async ({page}) => {
    const viewer = {id:'viewer',name:'测试球员',gender:'男',school:'北京大学',role,teamId:role === 'captain' ? 'team' : null};
    const message = role === 'captain' ? '管理员将「新队员」从「原队」调整至「本队」。' : '管理员将您移出了「原队」，现为自由球员。';
    await page.addInitScript(() => sessionStorage.setItem('floorball-tab-login','1'));
    await page.route('**/registration/api/registration', route => route.fulfill({json:{
      mode:'demo',teams:[],snapshot:{viewer,teams:role === 'captain' ? [{id:'team',name:'本队',captainId:'viewer',players:[viewer]}] : [],freePlayers:role === 'player' ? [viewer] : [],applications:[],
      notifications:[{id:'admin-change',actorName:'管理员',teamName:'本队',message,createdAt:'2026-10-14T06:00:00Z'},
      {id:'legacy',actorName:'原队长',teamName:'原队',createdAt:'2026-10-13T06:00:00Z'}]}}}));
    await page.setViewportSize({width,height:900});
    await page.goto('/registration/teams');
    const messages = page.getByRole('button',{name:'查看消息',exact:true});
    await expect(messages.getByLabel('2 条新消息')).toBeVisible();
    await messages.click();
    const inbox = page.getByRole('dialog',{name:'我的消息'});
    await expect(inbox.getByText(message,{exact:true})).toBeVisible();
    await expect(inbox.getByText('管理员调整',{exact:true})).toBeVisible();
    await expect(inbox.getByText('原队长将您加入了「原队」',{exact:true})).toBeVisible();
    await inbox.screenshot({path:test.info().outputPath('admin-roster-message.png')});
    await inbox.getByRole('button',{name:'关闭消息'}).click();
    await expect(messages.locator('.message-bubble')).toHaveCount(0);
    await messages.click();
    await expect(inbox.getByText(message,{exact:true})).toBeVisible();
  });
}
