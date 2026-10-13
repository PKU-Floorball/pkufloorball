# 33 browser annotations

This list is an implementation checklist. Production database migration status is listed separately from UI completion.

| Annotation | Requested change | Implementation |
|---|---|---|
| A1 | Same main navigation and destinations | Original `_includes/header-primary.html` template, local Bootstrap, desktop dropdowns and mobile offcanvas |
| A2 | Remove breadcrumbs | No `.race-crumb` rendered |
| A3 | Lighter realistic ball; remove ring feedback | Thin white plastic shell/rims, soft light, bounce and short glint; no feedback circle |
| A4 | Replace register arrow | Lucide SVG with hover/press feedback |
| A5 | Replace login arrow | Lucide SVG with hover/press feedback |
| A6 | Red first viewport; footer below fold | Dynamic viewport height measured below navigation; responsive desktop/mobile layout |
| A7 | Larger back label, 返回 | 16px back button, existing home destination |
| A8 | Remove JOIN THE GAME | Eyebrow removed |
| A9 | 报名参赛 / 您就是下一个冠军！ | Tilted bold Chinese title, red/white banner and shadows |
| A10 | Remove intro and 无需密码 · 简单报名 block | Register intro and auth-note removed |
| A11 | Remove registration subtitle | Form has no subtitle |
| A12 | Four genders | Form, two admin selectors, Gender type, parser and migration 011 |
| A13 | Remove phone placeholder | No registration phone placeholder |
| A14 | Exact requested privacy sentence | 报名后先作为自由球员。创建球队后队长将联系您加入球队~ |
| B1 | Remove login subtitle | Login form subtitle removed |
| B2 | 参赛选手登陆 | Exact requested label |
| B3 | Remove password/name hint block | No login-hint |
| B4 | Remove THE TEAM BOARD | Eyebrow removed |
| B5 | Remove 一起集结，准备上场。 | Board subtitle removed; title and functioning inbox action remain |
| B6 | Remove TEAM INBOX | Inbox eyebrow removed |
| B7 | Remove 查看队长的处理结果。 | Inbox explanatory caption removed |
| B8 | Remove 15 second sync text | Technical caption removed; polling behavior retained |
| B9 | Two-line creation caption | 拖入您的自由球员卡片！ / 创建您自己的球队！ |
| B10 | Animated create icon | Plus SVG hops and rotates; reduced motion respected |
| B11 | Requested drag instructions | 您可以拖动您的球员卡片到已有球队的空白处申请加入，或是创建属于您的球队~ |
| B12 | Bigger logged-in name | 18px desktop / 17px mobile |
| B13 | Requested team-name placeholder | 快来给您的球队起名吧！ |
| B14 | Requested member-picker copy | 请组建属于您的队伍！后续也可以再招募队友喔~ |
| B15 | Requested captain-phone copy | 您的手机号将作为队长手机号展示~ |
| B16 | Consistent transfer dialog font | Shared Google Sans Flex / Noto Sans SC family |
| B17 | Short transfer prompt | 请选择接任队长 |
| B18 | Remove visible 接任队长 label | Visually hidden accessible label preserved |
| B19 | Keep creation area recognizable; multiple-team layout | Creation tile remains with disabled action for existing members; responsive grid, mobile stack; original membership permissions retained |

All tournament text uses 您. Main association navigation keeps the main site's typography; tournament UI, controls and dialogs share the homepage fonts and red/white palette.

## External prerequisite

Run `supabase/011_gender_options.sql` in the existing Supabase project to allow the two added gender values in production. No database administrator credential is available in this workspace, and completion of the manual SQL execution has not been confirmed. Do not mistake main deployment success for a successful database migration.
