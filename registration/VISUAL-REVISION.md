# 公开赛外观分支

原站仓库：PKU-Floorball/pkufloorball；基线 680eac4。

- 主应用：registration/，入口 /registration，注册 /registration/register，登录 /registration/login，球队 /registration/teams。
- 风格探索与旧稿：design-demos/。
- 已上线的独立三维预览：visual-release-v3/。
- 改版前组件与 CSS：visual-backups/2026-10-13/。

本分支仅处理展示、字体、响应式与装饰互动。API、数据库、业务字段、登录规则和审批流程未修改。

当前主应用采用 CSS 球体视觉；完整 WebGL 26孔模型仍位于独立预览。原站主导航和多栏页脚的完整统一、WebGL模型接入仍需继续完成，不能将当前分支视为全部视觉要求已经实现。

字体实际文件来自 Google Fonts，文件扩展名为 .woff2，内容实际为 TrueType，CSS 按实际格式加载。中文文件为初稿字符子集，未覆盖的汉字由系统黑体补齐。

此前 TypeScript 检查通过、只读浏览器查看首页/注册/登录无前端异常。生产构建曾在 Next.js 读取 TypeScript --showConfig 阶段失败，因此尚不能称完整构建通过。原 Vercel 项目权限未就绪，未发布原地址。

2026-10-13：首页接入独立预览原版 Three.js 26孔模型、灯光与互动，以同源透明场景呈现；同步布局、主站导航、协会会徽、多栏页脚。注册/登录继续调用原 go 函数，无业务规则修改。生产构建与 TypeScript 检查通过，1440px/390px 只读渲染无前端错误或横向溢出。

## Tournament flow revision (2026-10-13)
- Main association navigation now comes directly from `_includes/header-primary.html`, including the original dropdowns, mobile offcanvas, local fonts and Bootstrap script. Build-generated CSS is scoped to the header so it does not recolor the application. No main-site page was restyled.
- Tournament hero fills the viewport beneath the measured header; breadcrumb removed. Existing register/login destinations retained, with SVG button icons.
- Three.js ball retains its 26-hole geometry and input behavior, with thinner rims, brighter inner plastic, softer lighting and restrained spark/bounce feedback instead of a circular overlay.
- Registration, login, team board, member picker, captain dialogs and admin surface share Google Sans Flex/Noto Sans SC and PKU red/white. Registration uses the approved expressive shadowed title; requested explanatory captions removed. All interface second-person references use 您.
- Team creation remains available only to free players, exactly as before. Existing members see an explanatory tile, and teams retain the responsive grid. Polling still runs every 15 seconds; its visible technical caption was removed.
- The four-gender extension is prepared but not enabled in this visual release until the organizer confirms the production SQL migration. Apply `supabase/011_gender_options.sql` to production before publishing the matching form options. It preserves existing rows, function permissions and registration/membership logic.
- `npm run test:visual` covers Chromium, Firefox, WebKit, Android and iPhone emulation. Device emulation is not a claim of testing all physical devices or operating systems. Existing `npm run test:e2e` checks core flows in the local demo, without production writes.

## Complete browser annotation follow-up
- All 14 registration/home annotations and all 19 login/team annotations are tracked in `ANNOTATION-AUDIT.md`.
- Register form copy now exactly matches the supplied sentence (with 您). This is display copy; the existing creator-becomes-captain behavior is preserved.
- The creation area remains visible after joining or creating a team, with a disabled button and explanation of the existing membership rule. It does not grant an extra team creation permission.
- The four gender options are now included in registration and both administrator selectors, along with server parsing and migration tests. Production SQL migration `011_gender_options.sql` remains an external database prerequisite; a Git push cannot apply it.
