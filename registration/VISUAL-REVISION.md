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
