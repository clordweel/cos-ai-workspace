# 已移除包说明

以下目录为历史实现，**已从本仓库移除**（见分支 `chore/remove-deprecated` 及后续合并）。

| 原目录 | 替代 |
|--------|------|
| **frontend/** | **apps/web/**（React + Webpack） |
| **middleware/** | **apps/api/**（Fastify + TypeScript） |

当前开发与运行仅使用 **apps/api**、**apps/web** 及 **packages/**。详见 `docs/REFACTOR_PLAN.md`、`docs/MONOREPO_APPS_PACKAGES.md`。
