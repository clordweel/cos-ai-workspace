# 实现计划目录

本目录用于存放 **Plan Mode**（Shift+Tab）产出的实现计划，便于：

- 大功能/多文件改动前先规划再编码，减少返工
- 团队共享与复用手写或 Agent 生成的计划
- 新会话时通过「按某计划继续」接棒

## 使用方式

1. 在 Cursor 中开启 Plan Mode，让 Agent 调研代码库并生成计划。
2. 将计划保存到此目录，例如 `feature-xxx.md` 或 `refactor-auth-2026-02.md`。
3. 后续会话可引用：如「按 `.cursor/plans/feature-xxx.md` 继续实现」。

计划文件建议包含：目标、涉及模块/文件、步骤顺序、验收要点。无需与本 README 同格式，便于人工与 Agent 阅读即可。
