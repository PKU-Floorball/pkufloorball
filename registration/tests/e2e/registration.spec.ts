import { expect, test } from "@playwright/test";

test("no-password registration, name login, captain approval and recruitment", async ({
  page,
}) => {
  await page.goto("/registration");
  await expect(
    page.getByRole("heading", { name: /公开赛/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "立即注册" }).click();
  await expect(
    page.getByRole("button", { name: /队长注册|队员注册/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel("所属球队")).toHaveCount(0);
  await expect(page.getByLabel("队伍名称")).toHaveCount(0);
  await expect(page.locator('select[name="gender"]')).toHaveValue("");
  await page.getByLabel("姓名", { exact: true }).fill("测试队长");
  await page.locator('select[name="gender"]').selectOption("男");
  await page.getByLabel("学校信息", {exact:true}).fill("北京大学校友");
  await page.getByLabel("手机号", { exact: true }).fill("13900000001");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "完成注册" }).click();
  await page.getByRole("button", { name: "前往登录" }).click();
  await page.getByLabel("姓名", { exact: true }).fill("测试队长");
  await page.getByRole("button", { name: "进入球队大厅" }).click();
  await expect(
    page.getByRole("article", { name: "自由球员 测试队长", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "点击建队", exact: true })
    .click({ timeout: 3000 });
  const creation = page.getByRole("dialog", { name: "创建球队" });
  await creation.getByLabel("队伍名称", { exact: true }).fill("测试球队");
  await creation.getByRole("checkbox", { name: /李可/ }).check();
  await creation.getByRole("button", { name: "确认创建球队" }).click();
  await expect(page.getByText("我的球队", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("article", { name: "测试球队", exact: true })
      .getByText("李可", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "点击建队", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("button", { name: "立即注册" }).click();
  await page.getByLabel("姓名", { exact: true }).fill("测试球员");
  await page.locator('select[name="gender"]').selectOption("男");
  await page.getByLabel("学校信息", {exact:true}).fill("北京大学校友");
  await page.getByLabel("手机号", { exact: true }).fill("13900000002");
  await page.getByRole("button", { name: "完成注册" }).click();
  await page.getByRole("button", { name: "前往登录" }).click();
  await page.getByLabel("姓名", { exact: true }).fill("测试球员");
  await page.getByRole("button", { name: "进入球队大厅" }).click();
  await page
    .getByRole("article", { name: "测试球队" })
    .getByRole("button", { name: "申请加入" })
    .click();
  await page.getByRole("dialog", {name:"申请加入球队"}).getByRole("button", {name:"提交申请",exact:true}).click();
  await expect(
    page
      .getByRole("article", { name: "测试球队" })
      .getByRole("button", { name: "等待审核" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByLabel("姓名", { exact: true }).fill("测试队长");
  await page.getByRole("button", { name: "进入球队大厅" }).click();
  await page.getByRole("button", { name: /查看消息/ }).click();
  await page.getByRole("button", { name: "批准", exact: true }).click();
  await expect(page.getByText("已批准", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "关闭消息" }).click();
  await expect(
    page
      .getByRole("article", { name: "测试球队" })
      .getByText("测试球员", { exact: true }),
  ).toBeVisible();
  const free = page.getByRole("article", { name: "自由球员 林夏" });
  await free.getByRole("button", { name: "加入我的球队" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认加入" })
    .click();
  await expect(
    page
      .getByRole("article", { name: "测试球队" })
      .getByText("林夏", { exact: true }),
  ).toBeVisible();
  const dragged = page.getByRole("article", { name: "自由球员 陆一凡" });
  await expect(dragged).toHaveAttribute("draggable", "true");
  await page.setViewportSize({width:1280,height:1600});
  await dragged.dragTo(page.getByRole("article", { name: "测试球队" }), {targetPosition:{x:30,y:30}});
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认加入" })
    .click();
  await expect(
    page
      .getByRole("article", { name: "测试球队" })
      .getByText("陆一凡", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});

test("mobile layout reflows without horizontal overflow and supports touch recruitment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/registration");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByLabel("姓名", { exact: true }).fill("陈宇");
  await page.getByRole("button", { name: "进入球队大厅" }).click();
  await expect(page.getByRole("heading", { name: /^球队大厅/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "加入我的球队" }).first(),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("committed registration still shows success if the subsequent list refresh fails", async ({
  page,
}) => {
  let failRead = false;
  await page.route("**/registration/api/registration", async (route) => {
    if (route.request().method() === "GET" && failRead) {
      failRead = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "暂时无法连接报名服务，请稍后重试。",
          code: "SERVICE_UNAVAILABLE",
        }),
      });
      return;
    }
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.action === "register"
    ) {
      const response = await route.fetch();
      failRead = response.ok();
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });
  await page.goto("/registration/register");
  await page.getByLabel("姓名", { exact: true }).fill("网络测试球员");
  await page.locator('select[name="gender"]').selectOption("男");
  await page.getByLabel("学校信息", {exact:true}).fill("北京大学校友");
  await page.getByLabel("手机号", { exact: true }).fill("13900000003");
  await page.getByRole("button", { name: "完成注册" }).click();
  await expect(page.getByRole("heading", { name: "报名成功！" })).toBeVisible();
  await expect(page.getByRole("button", { name: "完成注册" })).toHaveCount(0);
});

test("captain removes a teammate to the free-player area after confirmation on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/registration/login");
  await page.getByLabel("姓名", { exact: true }).fill("陈宇");
  await page.getByRole("button", { name: "进入球队大厅" }).click();
  const team = page.getByRole("article", { name: "未名之翼" });
  await expect(team.getByText("王子安", { exact: true })).toBeVisible();
  await expect(
    team.getByRole("button", { name: "移出陈宇", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("article", { name: "燕园闪电" })
      .getByRole("button", { name: /移出/ }),
  ).toHaveCount(0);
  await team.getByRole("button", { name: "移出王子安", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(team.getByText("王子安", { exact: true })).toBeVisible();
  await team.getByRole("button", { name: "移出王子安", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认移出", exact: true })
    .click();
  await expect(team.getByText("王子安", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "自由球员 王子安", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/removal-mobile.png",
    fullPage: true,
  });
});

test("administrator login keeps password separate from name-only player login", async ({
  page,
}) => {
  await page.goto("/registration/login");
  await page
    .getByRole("button", { name: "管理员登录", exact: true })
    .click({ timeout: 3000 });
  await expect(
    page.getByRole("heading", { name: "管理员登录", exact: true }),
  ).toBeVisible();
  await page.getByLabel("管理员密码").fill("wrong-password");
  await page.getByRole("button", { name: "进入管理面板" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "管理员密码不正确",
  );
  await page.getByRole("button", { name: "返回普通登录" }).click();
  await expect(page.getByLabel("姓名", { exact: true })).toBeVisible();
});

test("two free agents cannot select the same teammate into different new teams", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const base = "http://127.0.0.1:3101",
    names = ["并发创建甲", "并发创建乙", "并发伙伴"];
  try {
    for (let i = 0; i < contexts.length; i++) {
      const r = contexts[i].request;
      expect(
        (
          await r.post(base + "/registration/api/registration", {
            headers: { Origin: base },
            data: {
              action: "register",
              name: names[i],
              gender: "男",
              school: "北京大学",
              phone: "1390000001" + i,
            },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await r.post(base + "/registration/api/registration", {
            headers: { Origin: base },
            data: { action: "login", name: names[i] },
          })
        ).ok(),
      ).toBe(true);
    }
    const player = (
      await (await contexts[2].request.get(base + "/registration/api/registration")).json()
    ).snapshot.viewer.id;
    const responses = await Promise.all(
      contexts.slice(0, 2).map((c, i) =>
        c.request.post(base + "/registration/api/registration", {
          headers: { Origin: base },
          data: {
            action: "create_team",
            name: "并发新队" + i,
            memberIds: [player],
          },
        }),
      ),
    );
    expect(responses.map((r) => r.status()).sort()).toEqual([200, 400]);
    const loser = responses.findIndex((r) => r.status() === 400);
    expect((await responses[loser].json()).code).toBe("PLAYER_UNAVAILABLE");
    const data = (
      await (
        await contexts[loser].request.get(base + "/registration/api/registration")
      ).json()
    ).snapshot;
    expect(data.viewer.role).toBe("player");
    expect(data.viewer.teamId).toBeNull();
    expect(
      data.teams.filter((t: any) => t.name.startsWith("并发新队")),
    ).toHaveLength(1);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test("captain transfer, succession before exit and solo dissolution", async ({page}) => {
  const login = async (name:string) => {
    await page.goto("/registration/login");
    await page.getByLabel("姓名",{exact:true}).fill(name);
    await page.getByRole("button",{name:"进入球队大厅"}).click();
  };
  await login("周悦");
  await page.getByRole("button",{name:"转让队长",exact:true}).click();
  let dialog=page.getByRole("dialog",{name:"转让队长"});
  await expect(dialog.getByLabel("接任队长")).toHaveValue("");
  await expect(dialog.getByRole("button",{name:"确认转让"})).toBeDisabled();
  await dialog.getByLabel("接任队长").selectOption({label:"许星"});
  await dialog.getByRole("button",{name:"确认转让"}).click();
  await expect(page.getByRole("button",{name:"解散球队",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"退出登录"}).click();
  await login("许星");
  await page.getByRole("button",{name:"退出球队",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"退出球队"});
  await dialog.getByLabel("接任队长").selectOption({label:"周悦"});
  await dialog.getByRole("button",{name:"交接并退出"}).click();
  await expect(page.getByRole("article",{name:"自由球员 许星",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"退出登录"}).click();
  await login("周悦");
  await expect(page.getByRole("button",{name:"退出球队",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"解散球队",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"解散球队"});
  await dialog.getByRole("button",{name:"取消",exact:true}).click();
  await expect(page.getByRole("article",{name:"燕园闪电",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"解散球队",exact:true}).click();
  await page.getByRole("dialog",{name:"解散球队"}).getByRole("button",{name:"确认解散"}).click();
  await expect(page.getByRole("article",{name:"自由球员 周悦",exact:true})).toBeVisible();
  await expect(page.getByRole("article",{name:"燕园闪电",exact:true})).toHaveCount(0);
});

test("an open captain confirmation closes when an administrator changes the captain's team", async ({page}) => {
  await page.goto("/registration/login");
  await page.getByLabel("姓名",{exact:true}).fill("陈宇");
  await page.getByRole("button",{name:"进入球队大厅"}).click();
  await page.getByRole("button",{name:"解散球队",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"解散球队"})).toBeVisible();
  const data=await (await page.request.get("/registration/api/registration")).json();
  const other=data.snapshot.teams.find((t:any)=>t.id!==data.snapshot.viewer.teamId);
  data.snapshot.teams.find((t:any)=>t.id===data.snapshot.viewer.teamId).captainId="00000000-0000-4000-8000-000000000000";
  data.snapshot.viewer.teamId=other.id;
  other.captainId=data.snapshot.viewer.id;
  await page.route("**/registration/api/registration",async route=>{
    if(route.request().method()==="GET") await route.fulfill({json:data});
    else await route.continue();
  });
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("dialog",{name:"解散球队"})).toHaveCount(0);
});

test("matching registration shows existing identity and a direct login entry", async ({page})=>{
  await page.goto("/registration/register");
  await page.getByLabel("姓名",{exact:true}).fill("陈宇");
  await page.getByLabel("性别",{exact:true}).selectOption("女");
  await page.getByLabel("学校信息", {exact:true}).fill("北京大学");
  await page.getByLabel("手机号",{exact:true}).fill("13800000001");
  await page.getByRole("button",{name:"完成注册"}).click();
  await expect(page.getByRole("heading",{name:"您已经注册过了"})).toBeVisible();
  await page.getByRole("button",{name:"前往登录",exact:true}).click();
  await page.getByLabel("姓名",{exact:true}).fill("陈宇");
  await page.getByRole("button",{name:"进入球队大厅"}).click();
  await expect(page.getByText("我的球队",{exact:true})).toBeVisible();
});

test("admin deletion asks confirmation, protects captains and removes the selected card on mobile",async ({page})=>{
  const id="11111111-1111-4111-8111-111111111111",cap="22222222-2222-4222-8222-222222222222";
  let players=[{id,name:"删除对象",phone:"13800138888",gender:"女",school:"北京大学",role:"player",teamId:null},{id:cap,name:"保护队长",phone:"13800138889",gender:"男",school:"北京大学",role:"captain",teamId:"33333333-3333-4333-8333-333333333333"}];
  const actions:any[]=[];
  await page.route("**/registration/api/admin",async route=>{
    if(route.request().method()==="POST") {
      const body=route.request().postDataJSON();actions.push(body);
      if(body.action==="delete_player")players=players.filter(p=>p.id!==body.playerId);
      await route.fulfill({json:{ok:true}});
    }else await route.fulfill({json:{players,teams:[],applications:[]}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto("/registration/login");await page.getByRole("button",{name:"管理员登录",exact:true}).click();
  await page.getByRole("button",{name:"球员管理",exact:true}).click();
  const target=page.getByRole("article",{name:"管理球员 删除对象",exact:true});
  await target.locator("summary").click();
  await page.getByRole("article",{name:"管理球员 保护队长",exact:true}).locator("summary").click();
  await expect(page.getByRole("article",{name:"管理球员 保护队长",exact:true}).getByRole("button",{name:"删除选手"})).toBeDisabled();
  page.once("dialog",async d=>{expect(d.message()).toContain("删除对象");await d.dismiss();});
  await target.getByRole("button",{name:"删除选手"}).click();
  expect(actions).toHaveLength(0);await expect(target).toBeVisible();
  page.once("dialog",d=>d.accept());await target.getByRole("button",{name:"删除选手"}).click();
  await expect(target).toHaveCount(0);
  expect(actions).toEqual([{action:"delete_player",playerId:id}]);
  await expect(page.getByText("选手已删除，相关申请和登录会话已清理。",{exact:true})).toBeVisible();
});

test("school is required and appears for free agents and team members",async ({page})=>{
  await page.goto("/registration/register");
  const school=page.getByLabel("学校信息",{exact:true});
  await expect(school).toHaveValue("");
  await expect(school).toHaveAttribute("required","");
  await page.getByLabel("姓名",{exact:true}).fill("学校浏览器选手");
  await page.getByLabel("性别",{exact:true}).selectOption("女");
  await page.getByLabel("手机号",{exact:true}).fill("13900000600");
  await page.getByRole("button",{name:"完成注册"}).click();
  await expect(page.getByRole("button",{name:"完成注册"})).toBeVisible();
  await school.fill("某大学校友");
  await page.getByRole("button",{name:"完成注册"}).click();
  await page.getByRole("button",{name:"前往登录",exact:true}).click();
  await page.getByLabel("姓名",{exact:true}).fill("学校浏览器选手");
  await page.getByRole("button",{name:"进入球队大厅"}).click();
  await expect(page.getByRole("article",{name:"自由球员 学校浏览器选手",exact:true}).getByText("某大学校友",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"点击建队",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"创建球队"});
  await dialog.getByLabel("队伍名称",{exact:true}).fill("学校展示队");
  await dialog.getByRole("button",{name:"确认创建球队"}).click();
  const team=page.getByRole("article",{name:"学校展示队",exact:true});
  await expect(team.getByText("某大学校友",{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(team.getByText("某大学校友",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("self drag exits, switch drag requires confirmation and reason, free drag applies without a reason",async ({browser})=>{
  const prefix="拖拽"+Date.now(),contexts=await Promise.all(Array.from({length:4},()=>browser.newContext()));
  const post=async(i:number,body:any)=>{const r=await contexts[i].request.post("http://127.0.0.1:3101/registration/api/registration",{headers:{Origin:"http://127.0.0.1:3101"},data:body});expect(r.ok()).toBe(true);};
  const snapshot=async(i:number)=>(await (await contexts[i].request.get("http://127.0.0.1:3101/registration/api/registration")).json()).snapshot;
  try {
    for(let i=0;i<4;i++){await post(i,{action:"register",name:prefix+i,gender:"男",school:"北京大学",phone:"1390000070"+i});await post(i,{action:"login",name:prefix+i});}
    const ids=await Promise.all(contexts.map(async(_,i)=>(await snapshot(i)).viewer.id));
    await post(0,{action:"create_team",name:prefix+"甲",memberIds:[ids[2]]});await post(1,{action:"create_team",name:prefix+"乙",memberIds:[]});
    const a=(await snapshot(0)).viewer.teamId,b=(await snapshot(1)).viewer.teamId;
    const page=await contexts[2].newPage();await page.setViewportSize({width:1280,height:2200});await page.goto("http://127.0.0.1:3101/registration/teams");
    const self=()=>page.getByLabel("队员 "+prefix+2,{exact:true});
    await expect(self()).toHaveAttribute("draggable","true");
    await self().dragTo(page.getByRole("region",{name:"自由球员区域"}),{targetPosition:{x:20,y:20}});
    let d=page.getByRole("dialog",{name:"退出球队"});await d.getByRole("button",{name:"取消",exact:true}).click();expect((await snapshot(2)).viewer.teamId).toBe(a);
    await self().dragTo(page.getByRole("region",{name:"自由球员区域"}),{targetPosition:{x:20,y:20}});await page.getByRole("dialog",{name:"退出球队"}).getByRole("button",{name:"确认退出"}).click();
    await expect(page.getByRole("article",{name:"自由球员 "+prefix+2,exact:true})).toBeVisible();
    await post(0,{action:"recruit",teamId:a,playerId:ids[2]});await page.reload();
    await self().dragTo(page.getByRole("article",{name:prefix+"乙",exact:true}),{targetPosition:{x:20,y:20}});
    d=page.getByRole("dialog",{name:"申请加入球队"});await expect(d.getByText(/退出当前球队/)).toBeVisible();await d.getByRole("button",{name:"取消",exact:true}).click();expect((await snapshot(2)).viewer.teamId).toBe(a);
    await page.getByRole("article",{name:prefix+"乙",exact:true}).getByRole("button",{name:"申请加入"}).click();
    d=page.getByRole("dialog",{name:"申请加入球队"});await d.getByLabel("申请理由（选填）",{exact:true}).fill("希望周末一起训练\n<b>这是一段文字</b>");await d.getByRole("button",{name:"退出并提交申请"}).click();
    await expect(page.getByRole("article",{name:"自由球员 "+prefix+2,exact:true})).toBeVisible();
    const data=await snapshot(2),app=data.applications[0];expect(app.reason).toContain("希望周末一起训练");expect(data.viewer.teamId).toBeNull();
    const captain=await contexts[1].newPage();await captain.goto("http://127.0.0.1:3101/registration/teams");await captain.getByRole("button",{name:/查看消息/}).click();await expect(captain.getByText(/<b>这是一段文字<\/b>/)).toBeVisible();await captain.getByRole("button",{name:"批准",exact:true}).click();expect((await snapshot(2)).viewer.teamId).toBe(b);
    await page.reload();await page.getByRole("button",{name:"退出球队",exact:true}).click();await page.getByRole("dialog",{name:"退出球队"}).getByRole("button",{name:"确认退出"}).click();
    const free=await contexts[3].newPage();await free.setViewportSize({width:1280,height:2200});await free.goto("http://127.0.0.1:3101/registration/teams");
    const card=free.getByRole("article",{name:"自由球员 "+prefix+3,exact:true});await expect(card).toHaveAttribute("draggable","true");await expect(free.getByRole("article",{name:"自由球员 "+prefix+2,exact:true})).toHaveAttribute("draggable","false");
    await card.dragTo(free.getByRole("article",{name:prefix+"乙",exact:true}),{targetPosition:{x:20,y:20}});d=free.getByRole("dialog",{name:"申请加入球队"});await expect(d.getByLabel("申请理由（选填）",{exact:true})).toHaveValue("");await d.getByRole("button",{name:"提交申请",exact:true}).click();expect((await snapshot(3)).applications[0].reason).toBe("");
  }finally{for(const c of contexts)await c.close();}
});
