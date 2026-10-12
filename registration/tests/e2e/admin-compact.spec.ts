import {test,expect} from '@playwright/test';
for (const width of [1280,390]) test(`compact player management preserves editing and moving at ${width}px`,async({page})=>{
 let players=[{id:'one',name:'紧凑球员',gender:'女',school:'北京大学',phone:'13800138001',teamId:null as string|null,role:'player'},{id:'two',name:'其他球员',gender:'男',school:'清华大学',phone:'13800138002',teamId:'team',role:'captain'}];
 const actions:any[]=[];
 await page.route('**/registration/api/admin',async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();actions.push(body);if(body.action==='edit_player')players=players.map(p=>p.id===body.playerId?{...p,...body}:p);if(body.action==='move_player')players=players.map(p=>p.id===body.playerId?{...p,teamId:body.teamId}:p);await route.fulfill({json:{ok:true}});}else await route.fulfill({json:{players,teams:[{id:'team',name:'测试球队',captainId:'two',players:players.filter(p=>p.teamId==='team')}],applications:[]}});
 });
 await page.setViewportSize({width,height:900});await page.goto('/registration/login');await page.getByRole('button',{name:'管理员登录',exact:true}).click();await page.getByRole('button',{name:'球员管理',exact:true}).click();
 const card=page.getByRole('article',{name:'管理球员 紧凑球员',exact:true});
 await expect(card.locator('summary')).toHaveAccessibleName(/紧凑球员.*北京大学.*13800138001/);
 await expect(card.getByText('北京大学',{exact:true})).toBeVisible();await expect(card.getByText('13800138001',{exact:true})).toBeVisible();await expect(card.getByText('自由球员',{exact:true}).first()).toBeVisible();
 if(width>1000){
  const metadata=page.locator('.admin-player-metadata');
  for(let column=0;column<4;column++){
   const first=(await metadata.nth(0).locator(':scope > span').nth(column).boundingBox())!;
   const second=(await metadata.nth(1).locator(':scope > span').nth(column).boundingBox())!;
   expect(Math.abs(first.x-second.x)).toBeLessThan(1);
  }
 }
 await expect(card.getByLabel('姓名',{exact:true})).not.toBeVisible();await expect(page.getByRole('button',{name:'保存报名信息',exact:true})).not.toBeVisible();
 await page.screenshot({path:test.info().outputPath('compact-list.png'),fullPage:true});
 await card.locator('summary').click();
 if(width>1000){
  const nameBox=(await card.getByLabel('姓名',{exact:true}).boundingBox())!;
  const teamBox=(await card.getByRole('combobox',{name:'调整所属球队',exact:true}).boundingBox())!;
  expect(Math.abs(nameBox.y-teamBox.y)).toBeLessThan(1);
 }
 await page.screenshot({path:test.info().outputPath('expanded-editor.png'),fullPage:true});
 await card.getByLabel('学校信息',{exact:true}).fill('北京大学校友');await card.getByRole('button',{name:'保存信息',exact:true}).click();await expect(card.getByText('北京大学校友',{exact:true})).toBeVisible();expect(actions[0]).toMatchObject({action:'edit_player',playerId:'one',school:'北京大学校友'});
 await card.getByRole('combobox',{name:'调整所属球队',exact:true}).selectOption('team');await expect(card.getByText('测试球队',{exact:true}).first()).toBeVisible();expect(actions[1]).toMatchObject({action:'move_player',playerId:'one',teamId:'team'});
 await card.locator('summary').click();await expect(card.getByLabel('姓名',{exact:true})).not.toBeVisible();await page.locator('details.admin-create > summary').click();await expect(page.getByRole('button',{name:'保存报名信息',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByPlaceholder('输入姓名、手机号或学校').fill('找不到');await expect(page.getByText('没有匹配的球员',{exact:true})).toBeVisible();
});
