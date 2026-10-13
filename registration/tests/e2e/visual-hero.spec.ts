import {test,expect} from '@playwright/test';
test('3D ball responds to drag and keyboard, buttons retain their destinations',async({page})=>{
 await page.goto('/registration');
 const ball=page.frameLocator('.race-ball-frame').getByRole('button');
 await expect(ball).toHaveClass(/webgl-ready/);
 const before=await ball.getAttribute('data-rotation');
 const box=(await ball.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y+25,{steps:6});await page.mouse.up();
 expect(await ball.getAttribute('data-rotation')).not.toBe(before);
 await ball.press('Enter');await expect(ball).toHaveClass(/tap-feedback/);
 await expect.poll(async()=>Number(await ball.getAttribute('data-travel'))).toBeGreaterThan(.1);
 await expect.poll(async()=>Number(await ball.getAttribute('data-travel')),{timeout:6000}).toBe(0);
 await page.getByRole('button',{name:'立即注册',exact:true}).click();await expect(page).toHaveURL(/\/registration\/register$/);
 await page.getByRole('button',{name:'返回',exact:true}).click();await expect(page).toHaveURL(/\/registration$/);
 await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page).toHaveURL(/\/registration\/login$/);
});
