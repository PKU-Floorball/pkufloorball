import {test,expect} from '@playwright/test';
test('registration and login annotations use the supplied copy and shared fonts',async({page})=>{
 await page.goto('/registration/register');
 await expect(page.locator('.privacy-note')).toHaveCount(0);
 for(const old of ['JOIN THE GAME','无论是带队出发，还是寻找伙伴，都欢迎加入。','无需密码 · 简单报名','填写信息，开启你的组队之旅。'])await expect(page.getByText(old,{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'返回',exact:true})).toBeVisible();
 if(page.viewportSize()!.width>760){const left=(await page.locator('.auth-copy').boundingBox())!,right=(await page.locator('.auth-card').boundingBox())!;expect(Math.abs(left.height-right.height)).toBeLessThan(2);}
 expect(await page.getByRole('button',{name:'返回',exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 const heading=page.locator('.champion-title');await expect(heading.locator('span')).toHaveText(['报名参赛','您就是下一个冠军！']);
 expect(await heading.locator('span').first().evaluate(el=>getComputedStyle(el).textShadow)).not.toBe('none');
 expect(await heading.locator('span').first().evaluate(el=>getComputedStyle(el).transform)).not.toBe('none');
 expect(await page.locator('.auth-main').innerText()).not.toContain('你');
 await page.getByRole('button',{name:'前往登录',exact:true}).click();
 await expect(page.getByText('参赛选手登陆',{exact:true})).toBeVisible();
 await expect(page.getByText('使用注册时的姓名进入球队大厅。',{exact:true})).toHaveCount(0);
 await expect(page.locator('.login-hint')).toHaveCount(0);
 await expect(page.locator('.champion-title span')).toHaveText(['报名参赛','您就是下一个冠军！']);
 await expect(page.locator('.auth-watermark')).toHaveText('FLOORBALL');
 await expect(page.getByRole('heading',{name:'登陆',exact:true})).toBeVisible();
 await expect(page.getByLabel('安全验证',{exact:true})).toHaveAttribute('placeholder','请输入手机号后四位');
 expect(await page.locator('.auth-copy').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(148, 7, 10)');
});
test('team board annotations cover the creation tile, inbox and captain dialog',async({page})=>{
 const captain={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'测试队长',gender:'女',school:'北京大学',role:'captain',teamId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
 const member={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'测试队员',gender:'非二元性别',school:'北京大学',role:'player',teamId:captain.teamId};
 const free={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'自由选手',gender:'不愿意透露',school:'北京大学',role:'player',teamId:null};
 const team={id:captain.teamId,name:'测试球队',captainId:captain.id,captainPhone:'13800138000',players:[captain,member]};
 let viewer:any=free;
 await page.route('**/registration/api/registration',r=>r.fulfill({json:{mode:'demo',teams:[],snapshot:{viewer,teams:[team],freePlayers:[free],applications:[]}}}));
 await page.goto('/registration/teams');
 for(const old of ['THE TEAM BOARD','一起集结，准备上场。','每 15 秒同步名单'])await expect(page.getByText(old,{exact:true})).toHaveCount(0);
 const tile=page.getByRole('group',{name:'创建球队区域',exact:true});await expect(tile.locator('p')).toHaveText('拖入您的自由球员卡片！创建您自己的球队！');
 expect(await tile.getByRole('button').locator('svg').evaluate(el=>getComputedStyle(el).animationName)).toBe('create-team-hop');
 await expect(page.getByText('您可以拖动您的球员卡片到已有球队的空白处申请加入，或是创建属于您的球队~',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看消息',exact:true}).click();
 await expect(page.getByText('TEAM INBOX',{exact:true})).toHaveCount(0);await expect(page.getByText('查看队长的处理结果。',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'关闭消息',exact:true}).click();
 await page.getByRole('button',{name:'点击建队',exact:true}).click();
 const creation=page.getByRole('dialog',{name:'创建球队',exact:true});
 await expect(creation.getByLabel('队伍名称',{exact:true})).toHaveAttribute('placeholder','快来给您的球队起名吧！');
 await expect(creation.getByText('请组建属于您的队伍！后续也可以再招募队友喔~',{exact:true})).toBeVisible();
 await expect(creation.getByText('您的手机号将作为队长手机号展示~',{exact:true})).toHaveCount(0);
 await creation.getByRole('button',{name:'取消',exact:true}).click();
 viewer=captain;await page.reload();
 await expect(page.getByText('等待一起上场',{exact:true})).toHaveCount(0);
 expect(await page.locator('.team-card .player-name').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 await expect(page.getByRole('button',{name:'点击建队',exact:true})).toBeDisabled();
 expect(await page.locator('.identity').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(17);
 await page.getByRole("button",{name:"编辑球队",exact:true}).click();
 await page.getByRole('button',{name:'转让队长',exact:true}).click();
 const transfer=page.getByRole('dialog',{name:'转让队长',exact:true});
 await expect(transfer.locator('.confirm-copy')).toHaveText('请选择接任队长');
 await expect(transfer.getByLabel('接任队长',{exact:true})).toBeVisible();
 expect(await transfer.locator('.sr-only').evaluate(el=>getComputedStyle(el).clip)).toBe('rect(0px, 0px, 0px, 0px)');
 for(const selector of ['.modal-heading h2','.confirm-copy','select']){
  const font=await transfer.locator(selector).evaluate(el=>getComputedStyle(el).fontFamily);
  expect(font).toContain('GoogleSansFlex');expect(font).toContain('Source Sans 3');expect(font).not.toMatch(/Songti|Georgia|(?:^|,)\s*serif/);
 }
});
