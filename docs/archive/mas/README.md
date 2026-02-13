# MAS 相关文档归档

本目录为 **Matrix Authentication Service (MAS)** 的调研与根因分析文档，已从主文档树归档，避免进入 Agent 常规上下文。

- **主流程**：推荐使用 **Synapse 单机** 部署（`deploy/matrix/bootstrap.sh`），Token 通过 Synapse Admin 设密 + 登录获取。
- **可选**：若需 MAS 部署，见 `deploy/matrix/` 内 `bootstrap-mas.sh`、`docker-compose.mas.yml`、`nginx-mas.conf`；中间层在配置 `MAS_ADMIN_CLIENT_ID` / `MAS_ADMIN_CLIENT_SECRET` 时会启用 MAS 相关逻辑（`masAdminApi.ts`）。

归档文件：
- `MAS_AND_AS_RESEARCH.md` — MAS/AS 对 token 获取的可行性调研
- `MAS_ALTERNATIVES_RESEARCH.md` — MAS 替代方案与禁用回退
- `MAS_LOGTO_ROOT_CAUSE_ANALYSIS.md` — MAS 与 Logto 整合根因分析
