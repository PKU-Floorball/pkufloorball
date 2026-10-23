import {test, expect} from '@playwright/test';
for (const width of [1440, 1100, 390, 320]) {
  test(`competition navigation and pending results at ${width}px`, async ({page}) => {
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.setViewportSize({width, height: 960});
    const name = `赛程测试${width}${Date.now()}`;
    const phone = '185' + String(Date.now()).slice(-8);
    const post = async (data: Record<string, unknown>) => {
      const response = await page.request.post('/registration/api/registration', {headers: {Origin: 'http://127.0.0.1:3101'}, data});
      expect(response.ok()).toBeTruthy();
    };
    await post({action:'register', name, phone, school:'北京大学', gender:'男'});
    await post({action:'login', name, phone:phone.slice(-4)});
    await page.goto('/registration/teams');
    await expect(page.getByRole('heading', {name:'已集结球队', exact:false})).toBeVisible();
    await page.screenshot({path:test.info().outputPath('roster.png'), fullPage:true});
    const nav = page.getByRole('navigation', {name:'赛事板块'});
    await nav.getByRole('button', {name:'比赛赛程'}).click({timeout:5000});
    await expect(page.getByRole('heading', {name:'第一轮', exact:true})).toBeVisible();
    await expect(page.getByText('未命名(1)', {exact:true}).first()).toBeVisible();
    await expect(page.getByText('10.23 18:20', {exact:true})).toBeVisible();
    await expect(page.getByText('10.24 19:00', {exact:true})).toBeVisible();
    await page.screenshot({path:test.info().outputPath('schedule.png'), fullPage:true});
    await page.getByRole('button', {name:'排位赛', exact:true}).click();
    await expect(page.getByRole('heading', {name:'排位赛赛程待公布'})).toBeVisible();
    await page.getByRole('button', {name:'数据', exact:true}).click();
    await expect(page.getByRole('heading', {name:'球队积分榜'})).toBeVisible();
    await page.getByRole('button', {name:'助攻榜', exact:true}).click();
    await expect(page.getByText('暂无助攻数据', {exact:true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:test.info().outputPath('statistics.png'), fullPage:true});
    await nav.getByRole('button', {name:'参赛名单'}).click();
    await expect(page.getByRole('button', {name:'点击建队', exact:true})).toBeVisible();
    await page.getByRole('button', {name:'查看消息', exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}
