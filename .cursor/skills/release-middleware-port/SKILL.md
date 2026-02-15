---
name: release-middleware-port
description: 释放中间层（middleware）意外退出后占用的端口，使服务可重新启动。在出现 EADDRINUSE、middleware 无法启动、或用户要求释放/占用端口时使用。
---

# 释放 Middleware 端口

当 middleware 因终端断联、崩溃等未正常退出时，端口可能仍被占用，导致再次启动报 `EADDRINUSE`。按下列方式释放端口。

## 优先方式：使用项目脚本

在**仓库根目录**或 **middleware 目录**下执行：

```bash
cd middleware && pnpm run release-port
```

或从根目录一步执行：

```bash
pnpm --filter ai-workbench-middleware run release-port
```

脚本会读取 `.env` 中的 `PORT`（缺省 3000），对该端口执行 `lsof -ti :PORT` 并终止占用进程。脚本路径：`middleware/scripts/release-port.ts`。

## 手动释放

当无法使用 pnpm 或脚本失败时：

1. **查占用**（端口默认 3000，若已改 `PORT` 则替换）：
   ```bash
   lsof -i :3000
   ```
   记下输出中的 PID。

2. **终止进程**：
   ```bash
   kill <PID>
   ```
   若进程不退出，可使用 `kill -9 <PID>`。

3. **确认**：再次执行 `lsof -i :3000`，无输出即表示端口已释放；或直接重新启动 middleware。

## 说明

- 中间层端口由 `middleware/src/config.ts` 的 `config.port` 决定，来源于 `process.env.PORT` 或默认 3000。
- `middleware/package.json` 的 `predev` 会在 `pnpm dev` 前自动执行 `release-port`，若仍遇占用，多为上次进程未完全退出或非通过 predev 启动，可按上文手动释放。
