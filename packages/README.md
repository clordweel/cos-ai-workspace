# packages/

标准 monorepo 下的**共享包**目录，参考 Element 等成熟项目的约定。

- **用途**：可放置多应用共用的包，例如：
  - 共享 TypeScript 配置（`tsconfig-base`）
  - 共享 ESLint / 代码风格配置
  - 共享类型定义或工具函数（供 frontend、middleware、apps/* 使用）
- **引用**：在各应用的 `package.json` 中通过 `workspace:*` 引用，例如 `"@cosai/tsconfig-base": "workspace:*"`。
