import {test,expect} from '@playwright/test';
test('main navigation, full viewport hero and form typography',async({page,isMobile})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/registration');
 await expect(page.locator('.race-crumb')).toHaveCount(0);
 await expect(page.locator('.floorball-word')).toHaveText('Floorball');
 await expect(page.locator('.registration-identity')).toBeHidden();
 await page.evaluate(()=>scrollTo(0,400));expect((await page.locator('.association-header').boundingBox())!.y).toBe(0);await page.evaluate(()=>scrollTo(0,0));
 await expect.poll(async()=>(await page.locator('.site-foot').boundingBox())!.y).toBeGreaterThanOrEqual(page.viewportSize()!.height-1);
 await expect(page.getByRole('button',{name:'立即注册',exact:true})).toBeInViewport();
 await expect(page.getByRole('button',{name:'登录',exact:true})).toBeInViewport();
 await page.screenshot({path:test.info().outputPath('home.png')});
 const header=page.locator('.association-header');
 if(isMobile)await header.locator('.navbar-toggler').click();
 await header.getByRole('button',{name:'赛事',exact:true}).click();
 await expect(header.getByRole('link',{name:'公开赛',exact:true})).toHaveAttribute('href','/registration');
 await expect(header.getByRole('link',{name:'新生杯',exact:true})).toHaveAttribute('href','/htmls/3-association/2-rk-cup.html');
 await header.getByRole('link',{name:'公开赛',exact:true}).click();
 await page.getByRole('button',{name:'立即注册',exact:true}).click();
 await expect(page.getByRole('heading',{name:/报名参赛\s*您就是下一个冠军！/})).toBeVisible();
 const gender=page.getByLabel('性别',{exact:true});expect(await gender.locator('option').allTextContents()).toEqual(['','男','女','非二元性别','不愿意透露']);
 expect(await page.getByLabel('手机号',{exact:true}).getAttribute('placeholder')).toBeNull();
 await expect(page.locator('.auth-note')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'返回',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('register.png'),fullPage:true});
 await page.getByRole('button',{name:'前往登录',exact:true}).click();
 await expect(page.getByText('参赛选手登陆',{exact:true})).toBeVisible();
 await expect(page.locator('.login-hint')).toHaveCount(0);
 await expect(page.locator('.form-heading p')).toHaveCount(0);
 expect(errors).toEqual([]);
});
test('multiple teams, player identity, creation and dialog styles retain behavior',async({page})=>{
 const base='http://127.0.0.1:3101',name=`视觉${test.info().project.name.slice(0,6)}${Date.now()}`;
 const post=async(data:Record<string,unknown>)=>{const r=await page.request.post('/registration/api/registration',{headers:{Origin:base},data});expect(r.ok()).toBe(true)};
 const phone='186'+String(Date.now()).slice(-8);
 await post({action:'register',name,gender:'非二元性别',school:'北京大学',phone});
 await post({action:'login',name,phone:phone.slice(-4)});await page.addInitScript(()=>sessionStorage.setItem('floorball-tab-login','1')); await page.goto('/registration/teams');
 await expect(page.locator('.team-card').first()).toBeVisible();expect(await page.locator('.team-card').count()).toBeGreaterThanOrEqual(2);
 const cards=await page.locator('.team-card').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom}}));
 expect(cards.every((a,i)=>cards.slice(i+1).every(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)<1||Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<1))).toBe(true);
 await expect(page.getByText('THE TEAM BOARD')).toHaveCount(0);
 await page.getByRole('button',{name:'我的申请',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByText('TEAM INBOX')).toHaveCount(0);
 await page.getByRole('button',{name:'关闭消息',exact:true}).click();
 await page.getByRole('button',{name:'点击建队',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'创建球队',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.getByLabel('队伍名称',{exact:true})).toHaveAttribute('placeholder','快来给您的球队起名吧！');
 const font=await dialog.getByRole('heading').evaluate(el=>getComputedStyle(el).fontFamily);expect(font).toContain('GoogleSansFlex');expect(font).toContain('Source Sans 3');
 await dialog.getByLabel('队伍名称',{exact:true}).fill(name+'队');await dialog.getByRole('button',{name:'确认创建球队',exact:true}).click();
 await expect(page.getByRole('article',{name:name+'队',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'点击建队',exact:true})).toBeDisabled();await expect(page.getByText('您已加入球队~每位选手只能属于一支球队，成为自由球员后可创建新的队伍',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('teams.png'),fullPage:true});
});

test('small phones, tablets, wide screens and reduced motion stay usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const viewport of [{width:320,height:568},{width:659,height:844},{width:1920,height:1080},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.goto('/registration');
  await expect(page.getByRole('button',{name:'立即注册',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'立即注册',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByLabel('手机号',{exact:true})).toBeVisible();
 }
});
