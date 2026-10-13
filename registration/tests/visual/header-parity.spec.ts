import {test,expect} from '@playwright/test';
test('registration header uses the exact main templates and computed styles',async({page,isMobile})=>{
 test.setTimeout(60000);
 const styles=()=>page.locator('#primary-header,.header-top,#primary-header .navbar-brand,#primary-header .navbar-toggler,#primary-header .nav-link').evaluateAll(nodes=>nodes.map(el=>{const c=getComputedStyle(el);return {tag:el.tagName,text:el.textContent?.trim(),font:c.fontFamily,size:c.fontSize,weight:c.fontWeight,line:c.lineHeight,color:c.color,background:c.backgroundColor,padding:c.padding,border:c.border,radius:c.borderRadius,spacing:c.letterSpacing,display:c.display}}));
 await page.goto('/index.html');await page.evaluate(()=>document.fonts.ready);
 const original=await styles(),nav=await page.locator('#primary-header').innerHTML(),top=await page.locator('#header').innerHTML();
 for(const route of ['/registration','/registration/register','/registration/login']){
  await page.goto(route);await expect(page.locator('.environment-banner')).toContainText('本地演示');await page.evaluate(()=>document.fonts.ready);
  expect(await page.locator('#primary-header').innerHTML()).toBe(nav);expect(await page.locator('#header').innerHTML()).toBe(top);
  expect(await styles()).toEqual(original);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.waitForFunction(()=>!!(window as unknown as {bootstrap?:unknown}).bootstrap);
 if(isMobile)await page.locator('.navbar-toggler').click();
 await page.getByRole('button',{name:'赛事',exact:true}).click();
 await expect(page.getByRole('link',{name:'公开赛',exact:true})).toHaveAttribute('href','/registration');
 await page.screenshot({path:test.info().outputPath('shared-navigation.png')});
});
