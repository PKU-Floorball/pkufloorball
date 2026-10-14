import {test,expect} from '@playwright/test';
test('admin polls players and applications and preserves open editing drafts',async({page})=>{
  let playerName='原球员', teamName='原球队', applications:unknown[]=[];
  let reads=0, expired=false;
  await page.clock.install();
  await page.route('**/registration/api/admin',async route=>{
    reads++;
    if(expired){await route.fulfill({status:401,json:{error:'登录过期'}});return;}
    await route.fulfill({json:{players:[{id:'p',name:playerName,phone:'13800138000',gender:'男',school:'北京大学',role:'captain',teamId:'t'}],teams:[{id:'t',name:teamName,captainId:'p'}],applications}});
  });
  await page.goto('/registration/login?admin=1');
  await page.getByRole('button',{name:'球员管理',exact:true}).click();
  await expect(page.getByRole('article',{name:'管理球员 原球员'})).toBeVisible();
  playerName='最新球员';
  await page.clock.fastForward(15000);
  await expect(page.getByRole('article',{name:'管理球员 最新球员'})).toBeVisible();
  applications=[{id:'a',name:'申请球员',teamName:'原球队',status:'pending',createdAt:'2026-10-14T07:00:00Z'}];
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByRole('button',{name:/申请管理/}).click();
  await expect(page.getByText('申请球员',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'球队管理',exact:true}).click();
  await page.getByRole('article',{name:'原球队',exact:true}).getByRole('button',{name:'编辑',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'编辑球队',exact:true});
  await dialog.getByLabel('队伍名称',{exact:true}).fill('未保存的队名');
  teamName='外部修改球队';
  const before=reads;
  await page.clock.fastForward(15000);
  expect(reads).toBe(before);
  await expect(dialog.getByLabel('队伍名称',{exact:true})).toHaveValue('未保存的队名');
  await dialog.getByRole('button',{name:'关闭编辑球队'}).click();
  await page.clock.fastForward(15000);
  await expect(page.getByRole('article',{name:'外部修改球队',exact:true})).toBeVisible();
  expired=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button',{name:'进入管理面板'})).toBeVisible();
});
