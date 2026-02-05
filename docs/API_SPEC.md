# cos App RESTful API 规范（API-First）

> ERPNext v16 自定义 App **cos** 对外暴露的接口定义。  
> 所有接口均需在 Frappe 侧做权限控制（Role/Permission）；中间层调用时携带有效 Token/API Key。

---

## 基础约定

- **Base URL**: `https://<erpnext-host>/api`（或由中间层配置）
- **认证**: Bearer Token 或 Frappe API Key + API Secret
- **Content-Type**: `application/json`
- **响应**: 统一 JSON；错误时返回 `{ "exc": "...", "message": "..." }` 或标准 HTTP 4xx/5xx

---

## 1. 物料参数化助手

### 1.1 预检/草稿（不落库，用于 AI 确认）

生成物料草稿，供前端展示并等待用户确认后再提交。

```http
POST /method/cos.api.material.create_draft
```

**Request Body:**

```json
{
  "module": "模数",
  "material": "材质编码或名称",
  "spec": "规格说明（可选）",
  "quantity": 1,
  "uom": "Nos"
}
```

**Response:**

```json
{
  "draft_id": "MAT-DRAFT-2025-xxx",
  "item_code_suggested": "BALL-MILL-xxx",
  "item_name": "球磨机零件 - 模数x 材质y",
  "params": { "module": "x", "material": "y", "spec": "..." },
  "message": "请确认后提交创建"
}
```

### 1.2 确认创建（写入）

在用户确认且中间层完成权限校验后调用。

```http
POST /method/cos.api.material.create_from_draft
```

**Request Body:**

```json
{
  "draft_id": "MAT-DRAFT-2025-xxx",
  "confirmed_by": "user@example.com"
}
```

**Response:**

```json
{
  "item_code": "BALL-MILL-xxx",
  "item_name": "球磨机零件 - ...",
  "name": "Item/BALL-MILL-xxx"
}
```

### 1.3 根据参数查询是否已存在物料（只读）

供 Dify/中间层在生成草稿前检查，避免重复。

```http
GET /method/cos.api.material.find_by_params?module=2&material=铸铁&spec=...
```

**Response:**

```json
{
  "found": true,
  "item_code": "BALL-MILL-xxx",
  "item_name": "..."
}
```

或 `{ "found": false }`。

---

## 2. 生产辅助（只读）

### 2.1 订单进度

```http
GET /method/cos.api.production.order_status
```

**Query:**

- `order_no`: 销售订单或生产订单编号（可选，不传则返回当前用户/车间相关）
- `limit`: 条数，默认 20

**Response:**

```json
{
  "orders": [
    {
      "name": "SO-xxx",
      "status": "In Progress",
      "progress_percent": 65,
      "delivery_date": "2025-02-10",
      "items_summary": "..."
    }
  ]
}
```

### 2.2 库存状态（球磨机零件 / 指定物料）

```http
GET /method/cos.api.inventory.status
```

**Query:**

- `item_group`: 如 `球磨机零件`
- `item_code`: 可选，指定单个物料
- `warehouse`: 可选

**Response:**

```json
{
  "items": [
    {
      "item_code": "BALL-MILL-xxx",
      "item_name": "...",
      "qty": 100,
      "reserved_qty": 10,
      "warehouse": "Stores - X"
    }
  ]
}
```

### 2.3 BOM 状态

```http
GET /method/cos.api.bom.status
```

**Query:**

- `item_code`: 成品/半成品物料编码
- `bom_no`: 可选，指定 BOM 编号

**Response:**

```json
{
  "item_code": "xxx",
  "bom_no": "BOM-xxx",
  "status": "Active",
  "qty": 1,
  "levels": 2,
  "raw_materials_count": 12
}
```

---

## 3. 安全与权限

- 所有 **GET**：仅允许有对应 DocType 读权限的角色（如 Manufacturing User、Stock User）。
- **create_draft**：允许具备「物料草稿」权限的角色。
- **create_from_draft**：建议仅允许特定角色（如 Item Manager）或经中间层二次校验（如 AI 确认 + 审批流）后再调用；cos 内部可再次校验 `draft_id` 与当前用户/会话。

---

## 4. 实现顺序建议

1. **只读接口**：`find_by_params`、`order_status`、`inventory.status`、`bom.status`  
   → 先支撑 Dify 查询类工具与中间层编排。  
2. **物料草稿**：`create_draft` → 前端/对话中展示确认卡片。  
3. **物料写入**：`create_from_draft` + 权限与确认逻辑。

以上接口命名与路径为建议，实际 Frappe 方法路径需与 cos App 中 `cos/api/` 下定义的方法名一致。
