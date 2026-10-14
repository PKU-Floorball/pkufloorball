# 球队报名系统

独立的 Next.js 报名站，使用 Vercel 部署网页和接口，Supabase PostgreSQL 保存共享数据。

## 当前报名流程

- 注册只填写姓名、性别、学校、手机号，不区分队长/队员，不选择球队。每位新报名者都是自由球员。性别默认空白，提交前必须选择。
- 姓名登录，无需密码；重名时补充手机号。
- 自由球员可将自己的卡片拖到球队名单区域的空白处打开建队弹窗；填写队名、选择队员并确认后创建。取消不会更改名单。空大厅也有建队区域，手机可使用“点击建队”按钮。拖到已有球队仍是申请加入。
- 自由球员在大厅点击“点击建队”，填写唯一队名、勾选其他自由球员；创建者成为队长，所选队员直接入队。可以不选队员，先创建后招募。
- 每人只能属于一支球队。已经入队的成员需先被移出，才能自己建队；现任队长不能重复创建球队。
- 自由球员也能申请加入已有球队。队长批准/拒绝申请，或拖入/点击招募自由球员。
- 队长可以确认移出本队普通队员，该成员保留报名信息和身份并返回自由球员区。
- 建队、招募、申请审批、管理员调配使用同一数据库锁定规则。所选球员被其他球队占用时，整次建队回滚；不会留下空队或错误队长。加入球队或成为队长会取消其他待处理申请。

## 管理员

登录页选择“管理员登录”，输入组织者配置的密码。服务端环境变量 `REGISTRATION_ADMIN_PASSWORD` 保存密码，客户端没有硬编码密码；管理员会话独立于报名身份，8 小时后过期，退出立即撤销。

管理员新增报名者也只填写个人信息，统一进入自由球员区。管理员仍可新建/重命名/删除球队，更换队长，编辑个人信息，跨队调配或转为自由球员，处理所有申请。更换队长将原队长转为普通队员；删除球队保留所有人的报名信息并转为自由球员。调配现任队长前需先选定原球队的新队长。

## 本地运行

```bash
cd registration
npm ci
npm run dev
```

按 `.env.example` 创建 `.env.local`，配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`REGISTRATION_ADMIN_PASSWORD`。

独立的本地演示可运行：

```bash
REGISTRATION_DEMO=true npm run dev
```

演示仅存服务进程内存，重启会重置。预置已有球队和自由球员，可用队长“陈宇”或自由球员“林夏”体验；新注册者统一为自由球员。管理员功能需要真实 Supabase 配置。生产环境不要开启演示模式。

## Supabase 配置与升级

新项目按顺序执行 `supabase/001_registration.sql` 至 `supabase/010_member_exit_and_application_reasons.sql`。初始建库脚本只执行一次。已经执行前九份迁移的项目，只需执行第十份；它保留原数据，增加普通队员自助退出、退出并申请其他球队及可选申请理由。原五参数 SQL 调用仍由新函数的默认参数支持。

`SUPABASE_SERVICE_ROLE_KEY` 只在服务端使用，不要设置 `NEXT_PUBLIC_` 前缀、提交 Git 或发到聊天。数据表开启 RLS，浏览器不能直接访问表或数据库函数；浏览器通过同源 API 操作。管理员和普通用户的权限都由服务端验证。

姓名登录只用于选择报名身份，不验证本人；这是用户要求的简单无密码方案。队长手机号供已登录人员联系，普通成员手机号只供管理员管理和重名区分。站内消息每 15 秒刷新，不包含手机离线推送。普通会话保存 7 天，退出后在服务端撤销。免费 Supabase 项目长时间不活跃可能暂停，报名开启前应检查并定期导出备份。

## Vercel 部署

直接招募通知：执行 `supabase/012_recruitment_notifications.sql`，新增仅收件球员可读取的站内通知，记录操作队长和当时的球队名称。直接招募不会生成已批准申请；真正的申请审批仍显示申请状态。迁移可重复执行，保留现有数据，不追溯补发历史招募通知。已有站点需先执行数据库迁移，再发布前端。

生产地址：https://pkufloorball.site/registration

- Vercel 项目：`xhhwyh/pkufloorball`
- 已连接 GitHub 仓库 `PKU-Floorball/pkufloorball`，生产分支为 `main`。推送到 `main` 后，Vercel 自动构建，成功后更新 `https://pkufloorball.site/` 和 `/registration`；构建失败时保留此前上线的版本。
- Git 构建的 Root Directory 为 `registration`，Framework 为 Next.js，并开启 Include source files outside of the Root Directory，使构建能读取仓库根目录的协会主页模板和资源。日常发布只需提交并推送 GitHub，无需手动执行 Vercel CLI。
- Supabase 项目：`egeledpcdsjxqupvqupa`，新加坡区域。
- Supabase 控制台：https://supabase.com/dashboard/project/egeledpcdsjxqupvqupa
- 使用完整仓库执行下方 CLI 部署命令，先打包原站源码；Framework 为 Next.js，Node.js 22 或更高。
- 生产环境配置上述三个服务端环境变量，禁止启用 `REGISTRATION_DEMO`。

需要手动发布时可使用本地 CLI：

```bash
cd registration
npm exec --yes --package=vercel -- vercel login
npm exec --yes --package=vercel -- vercel link --project pkufloorball --scope xhhwyh --yes
npm run prepare:association
npm exec --yes --package=vercel -- vercel deploy --prod --yes
```

无需先推送当前源码到 GitHub。没有数据库配置时会显示提示，不会自动使用假报名数据。

## 验证

```bash
npm test
npm run typecheck
npm run build
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

数据库测试使用 PGlite 执行真实 SQL，覆盖权限、事务回滚、会话、报名、建队、招募、申请和成员移出；浏览器测试覆盖统一报名、队员勾选建队、申请审批、招募、移出、手机布局和竞争选人。真实 PostgreSQL 的管理员更换队长并发回归可在已迁移的测试项目手动运行：

```bash
SUPABASE_TEST_PROJECT_REF=YOUR_TEST_PROJECT_REF python3 tests/manual/admin-concurrency.py
```

需要已授权的 Supabase CLI；检查创建独立的随机测试记录并清理自己的数据。

当前流程已通过 44 项单元/数据库测试、12 项浏览器测试及生产构建。生产真实浏览器验收覆盖统一普通/管理员注册、勾选建队、手机布局、无效选人事务回滚、真实 Supabase 并发选人和已入队身份的建队限制。测试记录已清理。

## 队长自助管理

队长可将权限转让给本队普通队员，自己留队；也可选择接任者后交接并退出，成为自由球员。两项交接在同一事务内保存，原队长立即失去管理权限。只有队长一人的球队不能转让或退出，可先招募队员或确认解散。解散后所有成员成为自由球员，个人报名和登录会话保留，该球队的入队申请移除。确认弹窗固定目标球队；用户被管理员调整后，失去目标球队队长权限时自动关闭弹窗。

生产验收已验证转让、即时权限变化、交接退出、单人解散、申请清理及手机布局，测试报名者已清理。

## 重复报名与删除选手

姓名和手机号均匹配已有报名时，提示已注册并提供登录入口，不修改原信息。手机号存在但姓名不同时提示检查姓名或联系管理员。管理员在球员管理中可以确认删除普通队员或自由球员；删除会清除报名记录、相关申请及所有普通登录会话。队长需先交接或解散球队才能删除，数据库也会验证这一限制。删除后可使用原姓名和手机号重新注册，旧会话不能恢复。

真实 PostgreSQL 删除与并发登录检查：

```bash
SUPABASE_TEST_PROJECT_REF=YOUR_TEST_PROJECT_REF python3 tests/manual/deletion-concurrency.py
```

本次生产验收已验证重复报名引导、原信息保持、管理员取消/确认删除、普通队员及自由球员删除、队长及越权保护、旧会话失效和重新注册；真实 PostgreSQL 并发登录检查通过。独立测试报名与球队已删除。

## 学校信息

注册必须填写学校信息（1–80 字），提示填写就读学校或注明某学校校友。大厅球队中的队长、队员及自由球员卡片展示学校；建队选人也显示学校。管理员新增和编辑选手时填写学校，并可通过学校搜索。

学校功能已完成生产浏览器验收（普通注册、队长/队员/自由球员学校展示、管理员新增/编辑/学校搜索、手机布局）。按用户明确要求于 2026-10-08 执行一次性清空：所有报名者、球队、申请及普通登录会话已删除，数据库验证四项计数均为 0；管理员访问保留。这项清空不是可重复执行的数据库迁移。

## 队员自助退出与申请理由

普通队员可点击退出，或拖自己的名字到自由球员区域后确认退出。拖到另一球队或点击其申请按钮，会打开申请窗口；确认后原子退出原队并发送申请，等待目标队长批准。自由球员可拖自己的卡片到目标球队申请。队长仍需交接才能退出；队长拖其他自由球员到自己球队继续使用直接招募流程。手机保留按钮操作。

申请理由选填，最多 500 字；队长和管理员消息中可查看，内容按文本显示。确认窗口固定原球队与目标球队，名单变化时自动关闭；后端也会核对原队，防止管理员调配后误退出新队。

生产浏览器验收已验证本人拖拽退出、换队取消不退出、原子退出并申请、可选理由、队长审批、管理员查看理由及手机退出按钮。验收期间只创建并清理独立测试球队与选手，未清空正式报名数据。

## Unified Vercel deployment

Homepage: https://pkufloorball.site/
Registration: https://pkufloorball.site/registration

The Next.js routes and APIs now live under `/registration`, including `/registration/api/registration` and `/registration/api/admin`. Original association pages and assets keep `/htmls/...` and `/assets/...` paths.

Run `npm run prepare:association` from the full repository before deploying with the Vercel CLI. This stages the original templates and resources into association-source for the remote build. Do not exclude association-source from Vercel uploads. Public pages are regenerated during the remote build. The existing Vercel project ID, environment settings and Supabase data are reused; migration does not reset registration data.

## 访问速度优化

协会页面的 Bootstrap、Swiper、图标和字体从本站 assets/vendor 加载；原图保留，构建时生成带内容哈希的 WebP 首页图片，并为屏幕外图片添加懒加载和尺寸。图库在图片加载后重新布局。构建不依赖外部资源下载。

Vercel Functions 使用 sin1（新加坡），与现有 Supabase 数据库同区。长期缓存仅用于静态资源，报名及管理员接口继续禁止缓存。

队长编辑球队：执行 `supabase/013_captain_team_name.sql` 后发布前端，支持当前队长修改本人球队名称，校验 1–40 字和名称唯一性。

管理员组队变更通知：先执行 `supabase/014_admin_roster_notifications.sql`，再发布前端。管理员调队、移出、更换队长、建队及删除球队造成的实际成员变化，会在同一事务中通知受影响球员和新旧队长。无变化或失败不通知；历史直接招募通知继续显示，通知仅收件人可见。迁移可重复执行，不补发历史通知。

消息已读同步：执行 `supabase/015_message_read_receipts.sql`，已读状态按球员账号及消息 ID/申请状态存储。不同浏览器登录同一账号可读取相同状态；新审批状态仍提示未读。历史标签页已读记录会在打开原标签页后同步；未同步的旧消息需查看一次。
