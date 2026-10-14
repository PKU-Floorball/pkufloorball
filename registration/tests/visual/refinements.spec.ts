import {test,expect} from '@playwright/test';
test('verification is masked and identity is limited to the team board',async({page})=>{
 await page.route('**/registration/api/registration',r=>r.fulfill({json:{mode:'demo',teams:[],snapshot:null}}));
 await page.goto('/registration/login');await expect(page.locator('.registration-identity')).toBeHidden();
 const input=page.getByLabel('安全验证',{exact:true});await input.fill('0123');await expect(input).toHaveAttribute('type','password');
 await page.getByRole('button',{name:'显示安全验证数字',exact:true}).click();await expect(input).toHaveAttribute('type','text');await expect(input).toHaveValue('0123');
 await page.getByRole('button',{name:'隐藏安全验证数字',exact:true}).click();await expect(input).toHaveAttribute('type','password');await expect(input).toHaveValue('0123');
 await page.goto('/registration/register');await expect(page.locator('.registration-identity')).toBeHidden();
});
test('team cards hide contacts and operation notice scrolls into view then removes its space',async({page})=>{
 const captain={id:'11111111-1111-4111-8111-111111111111',name:'测试队长',gender:'女',school:'北京大学',role:'captain',teamId:'22222222-2222-4222-8222-222222222222'};
 let free=Array.from({length:12},(_,i)=>({id:`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`,name:'自由选手'+i,gender:'男',school:'北京大学',role:'player',teamId:null}));
 const team={id:captain.teamId,name:'公开赛测试球队',captainId:captain.id,captainPhone:'13800138000',players:[captain] as any[]};
 await page.route('**/registration/api/registration',async r=>{
  if(r.request().method()==='POST'){
   const data=r.request().postDataJSON();if(data.action==='recruit'){const player=free.find(p=>p.id===data.playerId)!;free=free.filter(p=>p.id!==data.playerId);team.players.push({...player,teamId:team.id})}
   return r.fulfill({json:{ok:true}});
  }
  return r.fulfill({json:{mode:'demo',teams:[],snapshot:{viewer:captain,teams:[team],freePlayers:free,applications:[]}}});
 });
 await page.goto('/registration/teams');await expect(page.locator('.team-card')).toBeVisible();
 await expect(page.locator('.team-contact')).toHaveCount(0);await expect(page.getByText('13800138000',{exact:true})).toHaveCount(0);
 await expect(page.locator('.team-summary .team-member-count')).toHaveText('1 人');
 const badge=await page.locator('.my-team-label').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));expect(badge).toEqual({background:'rgb(148, 7, 10)',color:'rgb(255, 255, 255)'});
 await expect(page.locator('.team-card .roster')).toBeVisible();
 await expect(page.locator('.free-section .section-heading p')).toHaveText('将自由球员卡片拖入您的球队，或点击球员右上角的“＋”邀请加入。');
 await page.evaluate(()=>document.fonts.ready);
 const before=(await page.locator('.board-heading').boundingBox())!.y;
 const invite=page.getByRole('button',{name:'邀请加入我的球队',exact:true}).last();await invite.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(100);
 const clockTime=new Date('2026-10-14T00:00:00Z');await page.clock.install({time:clockTime});await page.clock.pauseAt(new Date(clockTime.getTime()+10000));
 await invite.click();const dialog=page.getByRole('dialog',{name:'确认加入球队',exact:true});
 await expect(dialog.locator('.recruit-confirm-note')).toHaveText('确认后，该球员会从自由球员区移至您的队伍');
 await dialog.getByRole('button',{name:'确认加入',exact:true}).click();
 const notice=page.locator('.feedback.success');await expect(notice).toBeVisible();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 await expect(page.locator('.team-summary .team-member-count')).toHaveText('2 人');
 await page.clock.fastForward(6500);await expect(notice).toBeVisible();await expect(notice).not.toHaveClass(/is-fading/);await page.clock.fastForward(500);await expect(notice).toHaveClass(/is-fading/);await page.waitForTimeout(450);
 const opacity=await notice.evaluate(el=>Number(getComputedStyle(el).opacity));expect(opacity).toBeGreaterThan(0);expect(opacity).toBeLessThan(1);
 await page.clock.fastForward(1400);await expect(notice).toHaveCount(0);
 expect(Math.abs((await page.locator('.board-heading').boundingBox())!.y-before)).toBeLessThan(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('refined-teams.png')});
 await page.locator('.team-card').screenshot({path:test.info().outputPath('refined-card.png')});
});
