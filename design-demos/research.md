# 公开赛设计调研 · 2026-10-12

## 北大红：官方证据及差异

- 北京大学标识管理办公室 FAQ：https://vim.pku.edu.cn/cjwt/index.htm
- 官方基础系统手册 A7：https://vim.pku.edu.cn/docs/20240527144814943256.pdf
- 2019 年主站手册副本：https://www.pku.edu.cn/Uploads/Picture/2019/12/04/u5de7ad0c17491.pdf
- 信息公开管理办法：https://xxgk.pku.edu.cn/gksx/jbxx/gzzd/45606.htm

官方列出 CMYK C0 M100 Y100 K45；RGB R139 G0 B18；Web 94070A。RGB 换算为 #8B0012，与官方 Web 值不同。网页采用明确列出的 #94070A，不宣称两者相等。旧界面 #A52432 不再作为品牌基色。

## 真实用球

IFF 2024 器材标准 2.2：重量 23±1 g，直径 72±1 mm，26 孔，孔径 10±1 mm。
https://archive.floorball.sport/cloudfront/2024/06/Material-Regulations-SPCR011_2024_Final.pdf

官方产品原图来自 UNIHOC DYNAMIC WFC white：
https://unihoc.com/eu/en/product/50970-ball-dynamic-wfc-white
https://image.unihoc.com/preset:sharp/resize:fit:2400:0:0/width:2400/quality:100/gravity:sm/plain/https://api.unihoc.com/storage/products-images/50970/1743749012-50970-1.webp

本地 floorball.webp 是官方产品照片，初稿使用原始照片，B 用圆形容器裁切图片背景；未重新绘制或生成球体。仅作为设计研究素材；不表示本赛事使用该型号或接受厂商赞助。原图未发现开放再利用授权说明。

## 国际赛事参考与读取范围

Roland-Garros：https://www.rolandgarros.com/en-us/
实际读取 HTML、Jina 内容和浏览器首屏（有 cookie 浮层）。实际 body 字体 rg_text。观察：白色协会导航、赛事标识、全宽真实赛事影像、粗体短标题、明确 See more 操作、下方报道选择区。C 迁移摄影和独立功能条；没有复制其品牌字体或照片。

Wimbledon：https://www.wimbledon.com/
Jina 成功读取，浏览器出现 HTTP2 错误；不声称已完整视觉验收。栏目包括 Championships、Tickets、News、Visit、Shop，赛事身份与永久组织功能分层。A 保留协会站导航，把赛事入口设为站内栏目。

World Athletics Tokyo 25：https://worldathletics.org/competitions/world-athletics-championships/tokyo25-7190593
Jina 内容成功读取，body 字体 World Athletics；首次浏览器截图空白，不能据此声称完整视觉分析。该站仅作为赛事品牌与组织门户并存的信息结构参考，B 的红色用球构图是为本协会单独设计。

## 中文字体依据与建议

没有发现“中国体育赛事统一使用某字体”的权威依据。杭州亚运的薪火、湖山、江南忆等字体是依照各自文化与造型定制的标题设计，不能当成通用网页字体：
http://www.qxzh.zj.cn/art/2024/1/23/art_1229721773_58927223.html

阿里巴巴官方普惠体介绍：现代简洁笔画、偏瘦长、提高重心，免费商用正文字体，有多字重；适合作为年轻方案的候选，但初稿未假装加载该字体。
https://supplier.alibaba.com/us/news/PX909446.htm
https://fonts.alibabagroup.com/

初稿实际加载 Google Fonts 的 Noto Sans SC（思源黑体体系）中文子集：正文 400、按钮 700、赛事标题 900；拉丁 Oswald 与主站已配置的 Oswald 连贯。字体保存在 assets 下，避免字体接口失败后整页退成宋体。标题字不要替换为书法、普通宋体或斜体中文；表单必须优先识别与易读。后续可替换为授权普惠体 3.0，但须实际安装并重新看字形。

## 主站连贯性

导航沿用主站主页/关于/校队/社团/赛事/图集/新闻/联系。使用现有协会会徽，不擅自增加学校校徽。页脚沿用背景 quote-bg02.png、协会说明、快速访问、校队社团和联系方式；训练时间和场馆沿用主站现有信息，未当作公开赛时间地点。版权年份沿用现有主站，后续适合两站共同更新。

C 的 match.png 复用主站 bg1.png，是球队冠军合影，不是本次公开赛现场照；这是方案素材，在正式接入时可更换用户指定的比赛动作照片。

## 初稿边界与已执行约束

移除旧首页大段营销文案、迷你头像、场地图案、悬浮装饰卡片和三步宣传区；保留注册、登录两个功能入口。页面名称仅为公开赛，没有虚构日期、参赛者数量、地点或报名状态。

A 白底用球 / B 红色主场 / C 真实运动照片；三版导航和页脚一致，布局不同。手机 390px 和桌面 1440px 已渲染，无横向溢出，图片加载成功。注册登录是本地表单预览，不调用生产 API，不保存数据。

## B 方案第二版
用户已选择 B。英文实际本地加载 Google Sans Flex，接近 Gemini / Google 的圆润几何无衬线气质；不声称所有 Gemini 界面精确使用同一款字体。官方来源：
https://fonts.google.com/specimen/Google+Sans+Flex
https://design.google/library/google-sans-flex-font
标题改为 PKU / Floorball.，采用较轻字重和倾斜基线，操作按钮改为胶囊，真实球图片采用侧向布局和轻位移。支持减少动态偏好。

## 中文体育字体补充证据
方正字库官方冬奥案例：方正悠黑是北京2022冬奥场馆引导标识中文专用字体；另列媒体宣传中的锐正黑、兰亭黑等，应区别导视与宣传。
https://www.foundertype.com/index.php/News/newsdetails/id/93.html
方正速黑官方：源于张家口2021国际雪联自由式滑雪和单板滑雪世锦赛会徽专用字体，几何笔画、留白断笔、较高重心。
https://www.foundertype.com/index.php/FontInfo/ductdetail/id/5850
这些是具体体育使用案例，不表示所有体育网页都采用同一字体。当前没有这些商业字体的授权文件，部署版实际中文仍为开源 Noto Sans SC，标题加重至900；未把开源字体冒称为悠黑/速黑。
