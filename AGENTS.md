# AGENTS.md

## 项目概览

售后数据看板 — 支持按日期导入 JSON 格式的售后产品数据，自动记录所有日期数据，并提供周趋势统计与可视化分析。支持登录和数据分享功能。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Charts**: ECharts (echarts + echarts-for-react)
- **Auth**: Supabase Auth (邮箱密码登录)
- **Database**: Supabase PostgreSQL (shared_records + user_records 表)

## 目录结构

```
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 根布局（含 SupabaseConfigProvider）
│   │   ├── page.tsx            # 主页面（数据看板，需登录）
│   │   ├── globals.css         # 全局样式与主题变量
│   │   ├── (auth)/login/page.tsx     # 登录/注册页面
│   │   ├── share/[code]/page.tsx     # 分享数据访问页面
│   │   └── api/
│   │       ├── supabase-config/route.ts  # Supabase 配置 API
│   │       ├── share/route.ts            # 分享 CRUD API（需认证：GET/POST/PUT/PATCH/DELETE，含重新生成分享码）
│   │       ├── share-access/route.ts     # 分享访问 API（密码验证）
│   │       └── user-records/sync/route.ts # 用户数据同步 API（需认证）
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 组件库
│   │   ├── data-import-dialog.tsx   # 数据导入弹窗
│   │   ├── date-records-panel.tsx    # 左侧日历选择面板（可切换月、JSON编辑）
│   │   ├── day-overview.tsx          # 单日数据概览卡片
│   │   ├── product-analysis.tsx      # 产品维度分析（玫瑰图/漏斗图/柱状图等可切换）
│   │   ├── weekly-trend-chart.tsx    # 每日趋势图表（当周/全部模式、关键词+件数筛选）
│   │   ├── share-dialog.tsx          # 数据分享弹窗（创建/管理分享，密码掩码显示，刷新数据，重新生成链接）
│   │   ├── change-password-dialog.tsx # 修改密码弹窗
│   │   ├── region-distribution.tsx   # 地域分布图表（趋势视图支持省份筛选）
│   │   └── shop-distribution.tsx     # 店铺分布图表（趋势视图支持地域筛选）
│   ├── lib/
│   │   ├── types.ts            # 类型定义
│   │   ├── store.ts            # localStorage 存储与数据处理逻辑 + 云端同步（按用户隔离 key）
│   │   ├── utils.ts            # 通用工具函数 (cn)
│   │   ├── auth.ts             # Auth Hook (useAuth) 和 Token 工具
│   │   ├── supabase-config-inject.tsx  # Supabase 配置 Provider
│   │   └── supabase-browser.ts        # Supabase 浏览器端客户端
│   └── storage/database/
│       ├── supabase-client.ts          # Supabase 服务端客户端
│       └── shared/schema.ts            # Drizzle 数据库 Schema (shared_records + user_records)
```

## 包管理规范

**仅允许使用 pnpm** 作为包管理器。

## 开发规范

### 编码规范

- TypeScript strict 模式，禁止隐式 any
- 函数参数、返回值必须有类型标注
- 使用语义化主题变量（bg-primary, text-foreground），禁止硬编码颜色
- 圆角使用 rounded-md/rounded-lg 等语义化类名
- API 路由字段名使用 snake_case

### 数据存储

- 本地数据：localStorage，键名 `after-sales-records:${userId}`、`after-sales-aliases:${userId}`（按用户隔离，切换用户时清理旧数据）
- 云端数据：Supabase `user_records` 表（按 owner_id + record_date 去重），登录后自动双向同步
- 分享数据：Supabase `shared_records` 表，RLS 策略（用户私有 + share_code 公开只读），密码 SHA-256 哈希存储
- 数据库字段：snake_case，主键 varchar UUID

### 认证规范

- 前端配置通过 `/api/supabase-config` 获取，禁止硬编码
- 需认证的 API 必须在 Header 携带 `x-session`（值为 access_token）
- 后端验证通过 `getSupabaseClient(token)` + `client.auth.getUser()`
- 未登录用户访问首页自动跳转 `/login`
- 修改密码：验证当前密码后调用 `supabase.auth.updateUser({ password })` 更新
- 分享密码：SHA-256 哈希存储，创建后默认掩码显示（点击眼睛可查看），API 不返回密码哈希

### 关键业务逻辑

- **数据导入**: 支持粘贴 JSON 和上传 .json 文件，必须选择日期；支持新 JSON 格式（数量分类/客服备注分类按旗子颜色分组）
- **每日趋势**: 支持当周模式（选中日期所在 ISO 周 周一~周日）、当月模式（选中日期所在月份）和全部日期模式；聚合搜索与异常归因仅显示 Top 8；异常归因跟随当前筛选数据（产品/关键词）变化
- **产品趋势**: 单产品选择 + Top 8 产品每日趋势
- **产品分析**: 数量分类仅显示红色旗子数据；玫瑰图/饼图/柱状图/矩形树图 + 漏斗图/饼图/柱状图/雷达图 可切换；客服备注分类支持旗子类型下拉切换；"其他"备注明细表格在下方展示并支持分页
- **产品改名**: 支持为产品设置别名和备注，全局生效
- **产品排名**: ECharts 可缩放横向柱状图，支持 dataZoom
- **日历选择**: 左侧面板日历视图，可切换月份，有数据日期标记
- **JSON编辑**: 每条记录支持编辑原始 JSON 数据
- **异常归因**: 按周汇总红色旗子客服备注，堆叠柱状图展示
- **数据总览**: 支持年/月/周/日时间维度切换 + 自定义日期范围；产品品类下拉筛选；环比变化（与上一时段对比）
- **登录**: 邮箱+密码，Supabase Auth，注册后自动确认
- **修改密码**: 验证当前密码 + 设置新密码，通过 Supabase Auth API 更新
- **地域分布**: 支持时间段累计统计（当周/当月/自定义日历范围），可切换分布/趋势视图；趋势视图支持省份筛选
- **店铺分布**: 支持时间段累计统计（当日/当周/当月），可切换分布/趋势视图；趋势视图支持店铺筛选
- **数据分享**: 创建密码保护的分享链接，他人输入密码只读查看数据（不可导入）
- **分享页面**: 完整看板视图（数据总览/每日趋势/产品分析/地域分布/店铺分布），只读不可修改/删除，产品别名从分享数据中恢复
- **分享管理**: 查看/删除已创建的分享
- **分享更新**: 支持更新已有分享的数据（保留原密码），点击刷新图标即可将最新数据同步到分享
- **重新生成分享链接**: 支持重新生成 share_code（保留原密码和数据），旧链接失效
- **数据同步**: 登录后自动同步 localStorage 数据到云端 user_records 表，实现跨设备数据可见；删除数据时同步清理云端记录
- **数据隔离**: 账号切换时清理旧用户 localStorage 和内存状态，防止数据泄露；登录表单添加 autoComplete="off" 防止浏览器自动填充
- **分享更新**: 支持更新已有分享的数据（保留原密码），点击刷新图标即可将最新数据同步到分享

### Hydration 注意

- 页面使用 'use client'，通过 useEffect + useState 确保客户端挂载后才读取 localStorage
- mounted 状态标志防止服务端渲染时访问 window/localStorage
