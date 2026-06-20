# 售后数据分析看板

基于 **Next.js 16** + **Supabase** + **shadcn/ui** 的售后数据分析看板。支持按日期导入 JSON 格式的售后产品数据，自动记录所有日期数据，并提供周趋势统计与可视化分析。支持用户登录和数据分享功能。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5 |
| UI | shadcn/ui (Radix UI) + Tailwind CSS 4 |
| 图表 | ECharts |
| 认证 | Supabase Auth (邮箱密码) |
| 数据库 | Supabase PostgreSQL |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

> 本项目仅支持 pnpm，禁止使用 npm 或 yarn。

### 2. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
COZE_SUPABASE_URL=https://your-project.supabase.co
COZE_SUPABASE_ANON_KEY=your-anon-key-here
COZE_PROJECT_ENV=DEV
PORT=5000
```

- `COZE_SUPABASE_URL` — 你的 Supabase 项目 URL
- `COZE_SUPABASE_ANON_KEY` — Supabase 匿名密钥（在 Supabase 控制台 Settings → API 中获取）
- `COZE_PROJECT_ENV` — `DEV`（开发环境）或 `PROD`（生产环境）
- `PORT` — 服务端口，默认 5000

### 3. 初始化数据库（Supabase）

在 Supabase SQL 编辑器中执行以下 SQL：

<details>
<summary>点击展开 SQL 脚本</summary>

```sql
-- shared_records 表（分享数据）
CREATE TABLE IF NOT EXISTS shared_records (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id VARCHAR(36) NOT NULL,
  share_code VARCHAR(32) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  title VARCHAR(200) NOT NULL,
  data JSONB NOT NULL,
  aliases JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_records_owner_id_idx ON shared_records(owner_id);
CREATE INDEX IF NOT EXISTS shared_records_share_code_idx ON shared_records(share_code);

-- user_records 表（用户数据记录）
CREATE TABLE IF NOT EXISTS user_records (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id VARCHAR(36) NOT NULL,
  record_date VARCHAR(10) NOT NULL,
  data JSONB NOT NULL,
  imported_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_records_owner_id_idx ON user_records(owner_id);
CREATE INDEX IF NOT EXISTS user_records_record_date_idx ON user_records(record_date);

-- 唯一约束：每个用户每天只能有一条记录
ALTER TABLE user_records ADD CONSTRAINT user_records_owner_date_unique UNIQUE (owner_id, record_date);

-- RLS 行级安全策略
ALTER TABLE shared_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_records ENABLE ROW LEVEL SECURITY;

-- shared_records 策略：用户只能管理自己的分享，但任何人都可通过 share_code 读取
CREATE POLICY "shared_records_select" ON shared_records FOR SELECT USING (true);
CREATE POLICY "shared_records_insert" ON shared_records FOR INSERT WITH CHECK (owner_id = auth.uid()::text);
CREATE POLICY "shared_records_update" ON shared_records FOR UPDATE USING (owner_id = auth.uid()::text);
CREATE POLICY "shared_records_delete" ON shared_records FOR DELETE USING (owner_id = auth.uid()::text);

-- user_records 策略：用户只能管理自己的数据
CREATE POLICY "user_records_select" ON user_records FOR SELECT USING (owner_id = auth.uid()::text);
CREATE POLICY "user_records_insert" ON user_records FOR INSERT WITH CHECK (owner_id = auth.uid()::text);
CREATE POLICY "user_records_update" ON user_records FOR UPDATE USING (owner_id = auth.uid()::text);
CREATE POLICY "user_records_delete" ON user_records FOR DELETE USING (owner_id = auth.uid()::text);
```

</details>

### 4. 启动开发服务器

```bash
pnpm dev
```

启动后浏览器访问 [http://localhost:5000](http://localhost:5000)。

## 数据结构与导入说明

### JSON 数据格式

导入的 JSON 是一个对象，**key 为产品名称**，**value 为产品数据**：

```json
{
  "产品A": {
    "total": 50,
    "标记分类": {
      "红色旗子": 10,
      "绿色旗子": 30,
      "灰色旗子": 10
    },
    "数量分类": {
      "红色旗子": {
        "1-5件": 4,
        "6-10件": 3,
        "11-20件": 2,
        "21件以上": 1
      },
      "绿色旗子": { "1-5件": 20, "6-10件": 10 },
      "灰色旗子": { "1-5件": 8, "6-10件": 2 }
    },
    "客服备注分类": {
      "红色旗子": {
        "质量问题": 5,
        "物流延误": 3,
        "其他": {
          "订单数": 2,
          "明细": [
            { "订单号": "ORD001", "品类": "A", "客服备注": "客户投诉包装破损" },
            { "订单号": "ORD002", "品类": "B", "客服备注": "发错颜色" }
          ]
        }
      },
      "绿色旗子": { "满意": 30 },
      "灰色旗子": { "已退款": 8, "待处理": 2 }
    },
    "省份分类": {
      "红色旗子": { "广东省": { "count": 4, "town_village": 1 }, "浙江省": { "count": 3, "town_village": 0 } },
      "绿色旗子": { "广东省": { "count": 15, "town_village": 2 } },
      "灰色旗子": { "广东省": { "count": 5, "town_village": 0 } }
    },
    "店铺分类": {
      "红色旗子": { "天猫旗舰店": { "count": 6, "数量分布": { "1-5件": 4, "6-10件": 2 }, "客服备注分类": { "红色旗子": { "质量问题": 4 } } }, "京东专卖店": { "count": 4, "数量分布": { "1-5件": 3 }, "客服备注分类": {} } },
      "绿色旗子": { "天猫旗舰店": { "count": 20, "数量分布": {}, "客服备注分类": {} } },
      "灰色旗子": { "天猫旗舰店": { "count": 6, "数量分布": {}, "客服备注分类": {} } }
    }
  },
  "产品B": {
    "total": 30,
    "标记分类": { "红色旗子": 5, "绿色旗子": 20, "灰色旗子": 5 },
    "数量分类": {},
    "客服备注分类": {},
    "省份分类": {},
    "店铺分类": {}
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `total` | number | 是 | 该产品总单数 |
| `标记分类` | object | 是 | 按旗子颜色分类的总数（"红色旗子"/"绿色旗子"/"灰色旗子"） |
| `数量分类` | object | 否 | 按旗子颜色分组的购买件数分布 |
| `客服备注分类` | object | 否 | 按旗子颜色分组的客服备注归类 |
| `省份分类` | object | 否 | 按旗子颜色分组的地域分布 |
| `店铺分类` | object | 否 | 按旗子颜色分组的店铺分布 |

### 客服备注"其他"格式

当某个备注分类的明细需要展开时，使用对象格式：

```json
"其他": {
  "订单数": 5,
  "明细": [
    { "订单号": "ORD001", "品类": "A", "客服备注": "具体说明" }
  ]
}
```

### 导入方式

登录系统后，点击页面上的导入按钮：

1. **选择日期** — 数据所属的日期
2. **粘贴 JSON** — 直接粘贴上述格式的 JSON 文本
3. **上传文件** — 上传 `.json` 文件

系统会自动校验并保存，支持多天数据累加和趋势分析。

## 部署

### Railway (推荐)

1. 将代码推送到 GitHub
2. 在 [Railway](https://railway.app) 中 New Project → Deploy from GitHub repo
3. 在 Railway 项目 Settings → Variables 中设置环境变量：
   - `COZE_SUPABASE_URL`
   - `COZE_SUPABASE_ANON_KEY`
   - `COZE_PROJECT_ENV=PROD`
   - `PORT=5000`
4. Railway 会自动检测 Next.js 项目并构建部署

### Vercel

本项目包含 `vercel.json` 配置文件，可直接部署到 Vercel。

### 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `COZE_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `COZE_SUPABASE_ANON_KEY` | 是 | Supabase 匿名密钥 |
| `COZE_PROJECT_ENV` | 否 | 环境标识：`DEV` 或 `PROD` |
| `PORT` | 否 | 服务端口，默认 5000 |

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 数据看板主页（需登录）
│   ├── globals.css             # 全局样式
│   ├── (auth)/login/page.tsx   # 登录/注册页面
│   ├── share/[code]/page.tsx   # 数据分享页面
│   └── api/                    # API 路由
├── components/                 # React 组件
│   ├── ui/                     # shadcn/ui 基础组件
│   ├── data-import-dialog.tsx  # 数据导入弹窗
│   ├── date-records-panel.tsx  # 日历选择面板
│   ├── day-overview.tsx        # 单日数据概览
│   ├── product-analysis.tsx    # 产品维度分析
│   ├── weekly-trend-chart.tsx  # 每日趋势图表
│   ├── share-dialog.tsx        # 数据分享管理
│   ├── region-distribution.tsx # 地域分布
│   └── shop-distribution.tsx   # 店铺分布
├── lib/
│   ├── types.ts                # 类型定义
│   ├── store.ts                # 数据存储与处理逻辑
│   ├── auth.ts                 # 认证 Hook
│   └── supabase-browser.ts     # Supabase 浏览器端客户端
└── storage/database/           # 数据库 Schema
```

## 功能概览

- **数据导入** — 支持粘贴 JSON 和上传 .json 文件，按日期导入
- **日历面板** — 左侧日历浏览已导入数据，支持切换月份
- **数据总览** — 年/月/周/日维度切换，品类筛选，环比变化
- **每日趋势** — 当周/当月/全部日期模式，产品筛选
- **产品分析** — 玫瑰图/饼图/柱状图/矩形树图/雷达图等可切换
- **地域分布** — 按省份统计，支持趋势视图
- **店铺分布** — 按店铺统计，支持趋势视图
- **数据分享** — 创建密码保护的分享链接
- **云端同步** — 登录后自动同步数据到 Supabase（跨设备可用）
