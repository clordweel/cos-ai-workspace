# 已废弃包说明

以下目录为历史实现，**已废弃**，新开发与 Agent **不得修改或引用**其代码。

| 目录 | 替代 | 说明 |
|------|------|------|
| **frontend/** | **apps/web/** | 原 Nuxt 3 + Vue 3 前端；当前前端为 apps/web（React + Webpack），不直连 Frappe/Dify，经 apps/api。 |
| **middleware/** | **apps/api/** | 原根目录 Fastify 中间层；当前中间层为 apps/api，SSE 流式、鉴权、Matrix 适配器、cos/物料 API 等均在此实现。 |

## 约定

- **禁止**在 apps/web、apps/api、packages、文档或脚本中 **import/require** frontend 或 middleware 下的任何模块。
- **禁止**直接修改 frontend/、middleware/ 内文件；两包仅作迁移对照与历史参考。
- 新功能与修复均在 **apps/web**、**apps/api** 及 **packages/** 下完成。

详见 `docs/REFACTOR_PLAN.md`、`docs/MONOREPO_APPS_PACKAGES.md`。
