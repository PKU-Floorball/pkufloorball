import {test,expect} from '@playwright/test';
test('decorative ball is reachable and drag rotates its rendered surface',async({page})=>{
 await page.goto('/registration');
 const ball=page.getByRole('button',{name:'拖动旋转或点击弹跳',exact:true});
 const box=(await ball.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);
 expect(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.hero-ball'),{x,y})).toBe(true);
 const before=await ball.evaluate(el=>getComputedStyle(el).transform);
 await page.mouse.down();await page.mouse.move(x+45,y+25,{steps:6});await page.mouse.up();
 await expect.poll(()=>ball.evaluate(el=>getComputedStyle(el).transform)).not.toBe(before);
 await expect(ball).not.toHaveClass(/is-jumping/);
});
test('hovered decorative ball animation preserves 3D rotation and keyboard bounce',async({page})=>{
 await page.goto('/registration');
 const ball=page.getByRole('button',{name:'拖动旋转或点击弹跳',exact:true});
 const box=(await ball.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await ball.evaluate(el=>{el.style.transform='rotateX(30deg) rotateY(70deg)';});
 await expect.poll(()=>ball.evaluate(el=>getComputedStyle(el).transform)).toContain('matrix3d');
 await ball.press('Enter');await expect(ball).toHaveClass(/is-jumping/);
 expect(await ball.evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('running');
});
