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

test('read messages stay read in a different browser context after a team rename', async ({browser}) => {
  const contexts = await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
  try {
    const base = 'http://127.0.0.1:3101';
    const suffix = String(Date.now()).slice(-8);
    const captainName = '已读队长'+suffix, playerName = '已读球员'+suffix;
    const post = async (index:number,body:Record<string,unknown>) => {
      const response = await contexts[index].request.post(base+'/registration/api/registration',{data:body,headers:{Origin:base}});
      expect(response.ok()).toBe(true);
      return response.json();
    };
    const snapshot = async (index:number) => (await (await contexts[index].request.get(base+'/registration/api/registration')).json()).snapshot;
    await post(0,{action:'register',name:captainName,gender:'男',school:'北京大学',phone:'138'+suffix});
    await post(1,{action:'register',name:playerName,gender:'女',school:'北京大学',phone:'139'+suffix});
    await post(0,{action:'login',name:captainName,phone:suffix.slice(-4)});
    await post(1,{action:'login',name:playerName,phone:suffix.slice(-4)});
    await post(0,{action:'create_team',name:'已读测试队'+suffix,memberIds:[]});
    const teamId=(await snapshot(0)).viewer.teamId;
    const playerId=(await snapshot(1)).viewer.id;
    await post(0,{action:'recruit',teamId,playerId});
    await contexts[1].addInitScript(()=>sessionStorage.setItem('floorball-tab-login','1'));
    const first = await contexts[1].newPage();
    await first.goto(base+'/registration/teams');
    await expect(first.getByLabel('1 条新消息')).toBeVisible();
    await first.getByRole('button',{name:'查看消息',exact:true}).click();
    await expect.poll(async()=>Object.keys((await snapshot(1)).readMessages).length).toBe(1);
    await post(0,{action:'rename_team',teamId,name:'更名已读队'+suffix});
    await post(2,{action:'login',name:playerName,phone:suffix.slice(-4)});
    await contexts[2].addInitScript(()=>sessionStorage.setItem('floorball-tab-login','1'));
    const second = await contexts[2].newPage();
    await second.goto(base+'/registration/teams');
    await expect(second.getByRole('button',{name:'查看消息',exact:true})).toBeVisible();
    await expect(second.locator('.message-bubble')).toHaveCount(0);
    await second.getByRole('button',{name:'查看消息',exact:true}).click();
    await expect(second.getByRole('dialog',{name:'我的消息'})).toContainText('将您加入了');
  } finally {
    await Promise.all(contexts.map(c=>c.close()));
  }
});
