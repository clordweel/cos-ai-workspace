# Matrix 客户端最佳实践（来自开源参考）

从 matrix-js-sdk、Element Web、Matrix 规范等提取的开发实践，供中间层与前端 Matrix 相关实现参考。

---

## 一、限流与 429 处理

### 1.1 错误识别

- HTTP 状态 429 或 `errcode: "M_LIMIT_EXCEEDED"` 表示限流。
- 部分服务器在 429 时可能返回 `errcode: "M_UNKNOWN"`，需结合 `httpStatus === 429` 判断。

### 1.2 等待时间来源（优先级）

1. **`Retry-After` HTTP 头**（MSC4041，推荐）：  
   - 可为秒数（整数）或 HTTP-date。  
   - 秒数时：`parseInt(header) * 1000` 得到毫秒。  
2. **`retry_after_ms` 响应体字段**（已废弃，向后兼容）：  
   - 仅当 `Retry-After` 不存在时使用。  
   - 必须为整数，否则应视为无效。

### 1.3 安全获取等待时间（matrix-js-sdk 实践）

服务器返回的等待时间可能异常（负数、极大值、非整数）。应对其做校验并设上下限：

```typescript
// 参考 matrix-js-sdk safeGetRetryAfterMs（PR #1591）
function safeGetRetryAfterMs(error: unknown, defaultMs: number): number {
  // 1. 从 Retry-After 或 retry_after_ms 解析
  // 2. 校验：必须为正整数，建议 cap 在 60_000–120_000 ms
  // 3. 解析失败时回退 defaultMs（如 1000 * 2^attempts）
  return Math.min(Math.max(parsed, 1000), 120_000) || defaultMs;
}
```

### 1.4 重试策略（matrix-js-sdk calculateRetryBackoff）

- **429**：优先使用服务器建议的 `retry_after_ms` / `Retry-After`，否则用指数退避。
- **其他可重试错误**（如 ConnectionError）：指数退避 `1000 * 2^attempts`（1s、2s、4s、8s…）。
- **最大尝试次数**：建议 4 次，超过则放弃。
- **不重试**：4xx（除 429）、AbortError（客户端超时）、M_TOO_LARGE 等。

```text
建议退避序列：1s → 2s → 4s → 8s（或 16s），总约 15–30s
```

---

## 二、Token 与认证

### 2.1 Token 过期与刷新

- 收到 `M_UNKNOWN_TOKEN`（401）时，若支持 refresh token，应先尝试刷新再重试原请求。
- 若刷新失败，应触发登出或要求重新登录。
- 固定 token（如 MATRIX_ACCESS_TOKEN）无刷新能力时，收到 401 应清除本地缓存并提示重配或重登。

### 2.2 软登出（soft_logout）

- 401 响应中可能有 `soft_logout: true`，表示 token 失效但数据仍可读，可提示用户重新登录而不必清空本地缓存。
- 分支逻辑建议以 `errcode` 为主，`soft_logout` 为辅。

### 2.3 用户 Token 与 Admin Token 区分

- 会话/房间/消息等操作用**用户 token**，不得回退到 admin token。
- Admin token 仅用于 Admin API（用户管理、deactivate 等）。
- 实现上应对「用户级」接口强制要求传入 userToken，缺则抛错，不做隐式回退。

---

## 三、分页

### 3.1 `/rooms/{roomId}/messages` 分页

- `from` 参数：上一页响应的 `end` 或 `prev_batch`，**不是** `event_id`。
- `dir: 'b'`：从新到旧拉取；`dir: 'f'`：从旧到新。
- 响应中的 `end` 作为下一页的 `from`；若无 `end` 表示没有更多数据。

### 3.2 客户端分页约定

- 若抽象为「加载更多」类接口，建议区分：  
  - `fromToken`：Matrix 分页 token（`end` / `prev_batch`）；  
  - `beforeId`：若语义为 event_id，则**不能**直接传给 Matrix 的 `from`。
- 前端/中间层需在文档中明确：Matrix 适配器下 `before_id` 实为 `fromToken`。

---

## 四、3PID 格式（规范要求）

### 4.1 msisdn（电话）

- `medium: "msisdn"`
- `address`：E.164 格式，**不得含前导 `+`**。  
  - 正确：`8613812345678`  
  - 错误：`+8613812345678`

### 4.2 email

- `medium: "email"`
- `address`：小写域名，无 `mailto:`、无尖括号、无真实姓名。  
  - 示例：`strauss@example.com`

---

## 五、登录 Identifier 格式

### 5.1 m.id.user

- `{ type: "m.id.user", user: "<localpart 或完整 MXID>" }`  
- 用于用户名或 MXID 登录。

### 5.2 m.id.thirdparty（邮箱）

- `{ type: "m.id.thirdparty", medium: "email", address: "<email>" }`  
- 邮箱需为规范格式（小写域名等）。

### 5.3 m.id.phone（MSC829）

- `{ type: "m.id.phone", country: "<ISO3166-1 两字母>", phone: "<号码>" }`  
- `country`：如 `"CN"`。  
- `phone`：通常为**国内号码**（不含国家码），具体以服务器实现为准；部分 Synapse 部署不接受带国家码的 phone。

---

## 六、请求超时与取消

### 6.1 超时（matrix-js-sdk timeoutSignal）

- 为所有 Matrix/Synapse/MAS 请求设置合理超时（如 15–30 秒）。
- 使用 `AbortController` + `setTimeout` 或 `AbortSignal.timeout()`（支持时）构造 timeout signal。

### 6.2 取消

- 支持传入 `AbortSignal`，便于页面导航、组件卸载时取消进行中的请求。

---

## 七、错误处理

### 7.1 错误码优先

- 分支逻辑以 `errcode` 为准（如 `M_FORBIDDEN`、`M_UNKNOWN_TOKEN`、`M_LIMIT_EXCEEDED`）。
- `error` 字段用于日志或用户提示，不作为条件判断。

### 7.2 常见 errcode 速查

| errcode | 说明 |
|---------|------|
| `M_FORBIDDEN` | 无权限 |
| `M_UNKNOWN_TOKEN` | token 无效或过期 |
| `M_MISSING_TOKEN` | 未提供 token |
| `M_LIMIT_EXCEEDED` | 限流（429） |
| `M_NOT_FOUND` | 资源不存在 |
| `M_USER_DEACTIVATED` | 用户已停用 |

---

## 八、参考来源

| 来源 | 用途 |
|------|------|
| [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk) | 429 处理、safeGetRetryAfterMs、calculateRetryBackoff、timeout、token 刷新 |
| [Matrix Client-Server API](https://spec.matrix.org/) | 错误格式、分页、3PID、登录 identifier |
| [Element Web](https://github.com/vector-im/element-web) | 分页与时间线、UI 行为 |
| MSC4041 | Retry-After 头替代 retry_after_ms |
| MSC829 | m.id.phone 登录 |

---

## 九、与项目审查报告的对应

本最佳实践与 [MIDDLEWARE_MATRIX_REVIEW.md](./MIDDLEWARE_MATRIX_REVIEW.md) 中的建议对应关系：

- **限流**：见「一、限流与 429 处理」。
- **分页 token**：见「三、分页」。
- **Token 缓存与 401**：见「二、Token 与认证」。
- **3PID msisdn 格式**：见「四、3PID 格式」。
- **m.id.phone**：见「五、登录 Identifier 格式」。
- **请求超时**：见「六、请求超时与取消」。
- **errcode 优先**：见「七、错误处理」。
