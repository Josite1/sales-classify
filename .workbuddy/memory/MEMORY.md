# Project Memory — classify_sales

## 架构原则
- **前后端分离**：所有业务逻辑（数据处理、验证、计算、聚合）位于 `backend/services/compute.py`，通过 `backend/routers/compute.py` 的 29 个 API 端点暴露
- 前端（`src/`）仅负责 UI 渲染与用户交互，不包含任何业务逻辑计算
- 前端通过 `src/lib/api.ts` 调用后端 API，`src/lib/compute-service.ts` 作为 async wrapper
- localStorage 用于客户端持久化（`src/lib/storage.ts`），云同步通过 `src/lib/records-service.ts`
- 后端使用 FastAPI（Python），前端使用 Next.js 15（TypeScript）

## 关键模块
- `backend/services/compute.py` — 核心计算服务（所有业务逻辑）
- `backend/routers/compute.py` — 计算 API 路由（29 个端点）
- `src/lib/api.ts` — 前端 API 客户端（所有后端交互）
- `src/components/*.tsx` — 纯 UI 组件（无业务逻辑）

## 组件设计模式
每个组件的计算流程：useEffect + useState → API 调用 → 渲染
- 日期范围计算保留为同步 UI 工具函数（getISOWeekRange 等）
- 所有数据聚合、过滤、统计通过后端 API 完成
