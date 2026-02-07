# cos — Frappe 自定义 App（ERPNext v16）

本目录为 **cos** App 的说明与占位。cos 运行在 **ERPNext v16** 的 bench 环境中，不在此工作区直接运行。

## 职责

- 物料参数化：`create_draft`、`create_from_draft`、`find_by_params`
- 生产辅助只读：订单进度、库存状态、BOM 状态

## API 规范

完整接口定义见 [../docs/API_SPEC.md](../docs/API_SPEC.md)。

## 开发方式

1. **在 bench 中创建 App**（若尚未存在）：
   ```bash
   cd ~/frappe-bench
   bench new-app cos
   bench --site your-site install-app cos
   ```
2. **实现 API**：在 cos 中新增 `cos/api/` 下对应 Python 方法，并通过 Frappe 的 `@frappe.whitelist()` 暴露为 `POST/GET /api/method/...`。
3. **权限**：在 DocType 与 Role 中配置读/写权限；写入接口建议校验 draft 与当前用户。

## 与本工作区联调

- 中间层（middleware）通过环境变量 `COS_ERP_BASE`、`COS_ERP_API_KEY`（及可选的 `COS_ERP_API_SECRET`、`COS_ERP_TIMEOUT_MS`）调用 cos 接口，见根目录 `.env.example`。
- 可将 cos 源码通过 git submodule 或复制方式放到本目录下，便于与 frontend、middleware 同仓管理。
