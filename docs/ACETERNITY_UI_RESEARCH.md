# Aceternity UI 接入调研

## 概述

[Aceternity UI](https://ui.aceternity.com/) 是一套基于 **Tailwind CSS** 与 **Framer Motion** 的 React/Next.js 组件库，以 copy-paste 方式提供 200+ 动效组件（Hero、Bento Grid、卡片、背景等），风格偏 landing 与营销页。

## 技术栈与兼容性

| 项目 | 说明 |
|------|------|
| **运行时** | React / Next.js，与当前 apps/web（React + Webpack）兼容 |
| **样式** | Tailwind CSS；官方已支持 **Tailwind v4**（`@tailwindcss/postcss`、`@theme inline`），与现有配置一致 |
| **动效** | **Framer Motion**（或新包 `motion`）；多数组件依赖该库，需单独安装 |
| **UI 基础** | 官方与 shadcn 生态兼容；本仓库使用 **Coss UI（Base UI）**，非 shadcn，故不能直接使用 `npx shadcn@latest add @aceternity/xxx`，需手动复制或仿写组件并替换 Card/Button 等为现有 Coss 组件 |

## 适合「用户管理工作区」的组件

- **Card Hover Effect**（[组件页](https://ui.aceternity.com/components/card-hover-effect)）：悬停时高亮/光效滑动到当前卡片，适合「选择工作区」的多个入口卡片。
- **Bento Grid**：不规则网格布局，适合工作区/应用入口的模块化展示。
- **Focus Cards**：悬停聚焦、其余模糊，适合少量选项的聚焦选择。
- **Cards（free）**：多种卡片样式（Feature、Background Overlay、Content），可按需选用一种作为工作区卡片样式。

推荐优先采用 **Card Hover Effect** 的交互模式（悬停滑动高亮）用于工作区入口的三张卡片。

## 接入方式建议

1. **安装 Framer Motion**：在 `apps/web` 中执行 `pnpm add framer-motion`，以满足依赖动效的组件。
2. **不通过 shadcn CLI**：因项目使用 Coss UI，避免 `npx shadcn@latest add @aceternity/...`，以免引入另一套 Card/Button 体系。
3. **手动实现或移植**：从 Aceternity 文档/预览页或 [shadcn registry](https://shadcnregistry.com/aceternity/card-hover-effect) 获取目标组件的 JSX/TSX 与样式，在本仓内新建组件（如 `CardHoverEffect`），用现有 Coss 的 Button、卡片容器等替换其中的 shadcn 组件，并保证 Tailwind 类名与 v4 兼容（必要时将 v3 的 `theme.extend` 改为 v4 的 `@theme` 或已有 design tokens）。
4. **仅借鉴交互/样式**：若希望零额外依赖，可用纯 CSS + 状态（如 `hoveredIndex`）实现「悬停滑动高亮」的视觉效果，不引入 Framer Motion。

## 本次采用方案

- 在 apps/web 中安装 **framer-motion**，并实现一个 **CardHoverEffect** 风格的工作区卡片列表：悬停时滑动高亮到当前卡片，用于首页「选择工作区」的三种入口（组织、个人工作区、公开工作区）。
- 组件为自实现，接口与 Coss UI 一致，不依赖 shadcn 或 Aceternity 的 npm 包。
- **Expandable Card**：已接入 Aceternity 风格的可展开卡片（`components/ui/expandable-card.tsx`），点击列表项展开为模态卡片，支持 `layoutId` 共享布局动画；工作区入口（`WorkspaceEntry`）已改为使用该组件展示「组织 / 个人工作区 / 公开工作区」列表。演示数据见 `components/ui/expandable-card-demo-standard.tsx`。

## 参考链接

- [Aceternity UI 官网](https://ui.aceternity.com/)
- [Card Hover Effect](https://ui.aceternity.com/components/card-hover-effect)
- [Tailwind v4 安装说明](https://ui.aceternity.com/docs/install-tailwindcss)
- [shadcn registry - card-hover-effect](https://shadcnregistry.com/aceternity/card-hover-effect)
