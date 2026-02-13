# MAS 文档归档

**Matrix Authentication Service (MAS)** 调研与根因文档，已归档以减轻主文档与 Agent 上下文。

- **主流程**：Synapse 单机（`deploy/matrix/bootstrap.sh`），Token 经 Admin 设密 + 登录获取。
- **可选 MAS**：`deploy/matrix/` 内 `bootstrap-mas.sh`、`docker-compose.mas.yml`；中间层配置 `MAS_ADMIN_CLIENT_ID`/`MAS_ADMIN_CLIENT_SECRET` 时走 `masAdminApi.ts`。

本目录：`MAS_AND_AS_RESEARCH.md`、`MAS_ALTERNATIVES_RESEARCH.md`、`MAS_LOGTO_ROOT_CAUSE_ANALYSIS.md`。
