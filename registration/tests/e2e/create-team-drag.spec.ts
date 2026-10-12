import {test,expect} from '@playwright/test';
test('free player drops into blank team space to confirm creation, cancellation preserves membership',async({page})=>{
  const name='拖拽建队'+Date.now(),base='http://127.0.0.1:3101';
  const post=async(data:Record<string,unknown>)=>{const r=await page.request.post('/registration/api/registration',{headers:{Origin:base},data});expect(r.ok()).toBe(true);};
  const snapshot=async()=>(await(await page.request.get('/registration/api/registration')).json()).snapshot;
  await post({action:'register',name,gender:'女',school:'北京大学',phone:'186'+String(Date.now()).slice(-8)});
  await post({action:'login',name});
  await page.setViewportSize({width:1280,height:2200});await page.goto('/registration/teams');
  const self=page.getByRole('article',{name:'自由球员 '+name,exact:true}),blank=page.getByRole('group',{name:'创建球队区域',exact:true});
  const teams=page.getByRole('region',{name:'球队名单',exact:true});
  const regionBox=(await teams.boundingBox())!,firstBox=(await teams.getByRole('article').first().boundingBox())!;
  // Drop in the grid gap itself, outside every card and the explicit tile.
  await self.dragTo(teams,{targetPosition:{x:firstBox.x+firstBox.width-regionBox.x+10,y:30}});
  let dialog=page.getByRole('dialog',{name:'创建球队',exact:true});await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'取消',exact:true}).click();expect((await snapshot()).viewer.teamId).toBeNull();
  // Other identities cannot create a team through a forged drop.
  await blank.evaluate((el)=>{const dataTransfer=new DataTransfer();dataTransfer.setData('application/x-pku-player','someone-else');el.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer}));});
  await expect(dialog).toHaveCount(0);
  await self.dragTo(blank);dialog=page.getByRole('dialog',{name:'创建球队',exact:true});await dialog.getByLabel('队伍名称',{exact:true}).fill(name+'队');await dialog.getByRole('button',{name:'确认创建球队',exact:true}).click();
  await expect(page.getByRole('article',{name:name+'队',exact:true})).toBeVisible();expect((await snapshot()).viewer.role).toBe('captain');await expect(blank).toHaveCount(0);
});
test('blank drop target is usable when there are no teams',async({page})=>{
  const viewer={id:'drag-empty',name:'空大厅球员',role:'player',teamId:null,gender:'女',school:'北京大学',phone:'13800138887'};
  await page.route('**/registration/api/registration',route=>route.fulfill({json:{mode:'demo',teams:[],snapshot:{viewer,teams:[],freePlayers:[viewer],applications:[]}}}));
  await page.setViewportSize({width:1280,height:1000});await page.goto('/registration/teams');
  await page.getByRole('article',{name:'自由球员 '+viewer.name,exact:true}).dragTo(page.getByRole('group',{name:'创建球队区域',exact:true}));
  await expect(page.getByRole('dialog',{name:'创建球队',exact:true})).toBeVisible();
});
