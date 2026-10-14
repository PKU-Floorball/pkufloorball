import {test,expect} from '@playwright/test';
test('login requires a correct phone suffix and login persists across refreshes and reopened tabs',async({page,context})=>{
 const name='验证选手'+Date.now(),base='http://127.0.0.1:3101';
 const phone='188'+String(Date.now()).slice(-8),verifiedName=name+'甲';
 expect((await page.request.post('/registration/api/registration',{headers:{Origin:base},data:{action:'register',name:verifiedName,gender:'男',school:'北京大学',phone}})).ok()).toBe(true);
 for(const suffix of [undefined,'123','12345','abcd',phone]){
  const r=await page.request.post('/registration/api/registration',{headers:{Origin:base},data:{action:'login',name:verifiedName,phone:suffix}});
  expect(r.status()).toBe(400);expect((await r.json()).code).toBe('INVALID_PHONE_SUFFIX');
 }
 const wrong=await page.request.post('/registration/api/registration',{headers:{Origin:base},data:{action:'login',name:verifiedName,phone:phone.endsWith('9999')?'0000':'9999'}});
 expect(wrong.status()).toBe(400);expect((await wrong.json()).code).toBe('NOT_FOUND');
 await page.goto('/registration/login');
 await page.getByLabel('姓名',{exact:true}).fill(verifiedName);
 await page.getByLabel('安全验证',{exact:true}).fill(phone.slice(-4));
 await page.getByRole('button',{name:'进入球队大厅'}).click();await expect(page).toHaveURL(/teams$/);
 const cookie=(await context.cookies()).find(c=>c.name==='floorball_session')!;
 expect(cookie.expires-Date.now()/1000).toBeGreaterThan(6.9*86400);expect(cookie.expires-Date.now()/1000).toBeLessThan(7.1*86400);expect(cookie.httpOnly).toBe(true);
 await page.reload();await expect(page.getByRole('article',{name:'自由球员 '+verifiedName,exact:true})).toBeVisible();
 await page.close();const reopened=await context.newPage();await reopened.goto('/registration/teams');
 await expect(reopened.getByRole('button',{name:'编辑个人信息'})).toContainText(verifiedName);
 await reopened.goto('/registration/login');
 await expect(reopened).toHaveURL(/teams$/);
 await reopened.getByRole('button',{name:'退出登录',exact:true}).click();
 const afterLogout=await context.newPage();await afterLogout.goto('/registration/teams');
 await expect(afterLogout).toHaveURL(/login$/);
 expect((await context.cookies()).some(c=>c.name==='floorball_session')).toBe(false);
});
