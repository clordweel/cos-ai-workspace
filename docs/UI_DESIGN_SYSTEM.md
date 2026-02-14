# 前端统一视觉与 UI 设计规范

本文档是**前端组件与样式的单一事实来源**，供人工与 Agent 开发时遵循，避免按钮、输入框、圆角、颜色等散乱不一。

- **目标**：统一视觉语言，便于全局调整主题与无障碍；新组件与改版时按规范实现。
- **与现有文档关系**：布局与状态见 `FRONTEND_SPEC.md`、`frontend-spec.mdc`；本文档专注**视觉与原子组件使用约定**。

---

## 一、设计令牌（Design Tokens）

### 1.1 色彩

| 用途 | 浅色 | 深色 | 说明 |
|------|------|------|------|
| 页面背景 | `bg-zinc-50` | `dark:bg-zinc-900` | 主背景 |
| 卡片/面板背景 | `bg-white` | `dark:bg-zinc-800` | 浮层、对话框、输入区 |
| 边框（中性） | `border-zinc-200` | `dark:border-zinc-600` / `dark:border-zinc-700` | 分割线、输入框、卡片描边 |
| 主色（强调/主按钮） | `primary`（见 tailwind.css） | 同左，由 theme 定义 | 主操作、发送、当前选中 |
| 正文 | `text-zinc-800` | `dark:text-zinc-200` | 标题、正文 |
| 次要文案 | `text-zinc-500` / `text-zinc-600` | `dark:text-zinc-400` | 说明、占位、时间戳 |
| 置顶/高亮区 | `amber` 系 | `dark:amber-*` | 置顶列表、Mock 区等 |
| 当前选中/成功 | `emerald` 系 | `dark:emerald-*` | 当前会话高亮、成功态 |
| 危险/删除 | `red` 系 | `dark:red-*` | 删除、错误 |

主色在 `frontend/assets/css/tailwind.css` 的 `@theme` 中定义（如 `--color-primary-600`），组件中优先使用 `primary` / `primary-foreground` 语义类，避免硬编码 hex。

### 1.2 圆角

| 场景 | 类名 | 说明 |
|------|------|------|
| 按钮、标签、小控件 | `rounded-md` | 与 shadcn Button 默认一致 |
| 输入框、芯片、中等块 | `rounded-lg` | 表单控件、工具栏芯片 |
| 卡片、对话框、大块容器 | `rounded-xl` | 会话卡片、Dialog、应用区 |
| 页面级大容器 | `rounded-2xl` | 应用区外框、workspace 主块 |

**约定**：同一层级尽量统一（如所有「卡片」用 `rounded-xl`），不混用多种圆角。

### 1.3 阴影与边框

- 卡片/浮层：`shadow-sm` 或 `shadow-lg` / `shadow-xl`（对话框）；可与 `border border-zinc-200 dark:border-zinc-600` 搭配。
- 输入框：以边框为主，少用重阴影；可 `shadow-xs`（若设计系统有）。

---

## 二、原子组件使用约定

### 2.1 按钮（Button）

- **必须**使用 `~/components/ui/button` 的 **Button** 组件，通过 **variant** / **size** 控制样式，**禁止**手写一整套按钮类名（如长串 `rounded-lg px-3 py-2 ...`）以实现「普通按钮」或「次要按钮」。
- **变体与场景**：
  - **default**：主操作（确定、发送、创建）。
  - **outline**：次要操作（取消、跳过），与主按钮并排时使用；浅色纯底 + 浅色边框，避免黑边。
  - **ghost**：列表项、工具栏图标按钮等无边框场景。
  - **secondary**：需要比 outline 更弱的中性按钮。
  - **destructive**：删除、不可逆操作。
  - **link**：仅文字链接样式。
- **尺寸**：`default`、`sm`、`lg`、`icon`、`icon-sm`、`icon-lg`；列表/工具栏常用 `sm` 或 `icon`。
- **覆盖样式**：仅允许在**不改写整体视觉**的前提下用 `class` 做微调（如 `min-w-[4.5rem]`），**禁止**用 `class` 覆盖背景/边框/圆角等核心样式。
- **例外**：具有**强语义的区块**（如「置顶」折叠标题、带 amber 背景的 section 标题按钮）可继续用原生 `<button>` + Tailwind，但需保持 `focus-visible`、`disabled` 等可访问性，且尽量抽成可复用 class 或组件。

### 2.2 输入框（Input）

- **表单单行文本**（如重命名会话、设置项）**必须**使用 `~/components/ui/input` 的 **Input** 组件。
- **不要**在业务组件里手写 `<input class="...">` 一整套样式；若需扩展（如带图标、前后缀），在 Input 外再包一层布局，或与设计系统协商扩展 Input 的 slot/变体。
- 占位符、禁用态、错误态：优先用 Input 已有能力；颜色遵循 1.1（如 placeholder `text-zinc-500` / `dark:text-zinc-400`）。

### 2.3 对话框（Dialog）

- 使用 `~/components/ui/dialog`（Dialog、DialogContent、DialogHeader、DialogTitle、DialogFooter 等）。
- 内容区结构：标题区（可 `border-b`）→ 正文（`px-5 py-5` 等）→ 底部操作（`border-t` + DialogFooter）。
- 圆角与阴影：DialogContent 可用 `rounded-xl`、`shadow-xl`，与 1.2、1.3 一致；宽度用 `max-w-sm` / `max-w-md` 等控制。

### 2.4 其它 UI 组件

- **Select、Checkbox、Dropdown、Tooltip、Empty** 等：一律使用 `~/components/ui/` 下已有组件；**禁止**从文档或其它项目复制一份到 `components/ui`，仅通过 **shadcn-vue CLI** 安装（见 `frontend-spec.mdc`）。

---

## 三、排版与间距

- **标题层级**：对话框标题 `text-base font-semibold`；区块标题 `text-sm font-medium` 或 `font-semibold`；小标签 `text-xs`。
- **表单项**：标签与输入框间距统一（如 `mb-2` + `mt-1.5`）；表单项之间 `gap-4` 或 `py-4`。
- **按钮组**：Footer 内按钮 `gap-3`，与内容区 `px-5 py-4` 对齐。

---

## 四、当前不一致与迁移建议

- **按钮**：多处仍使用原生 `<button>` + 长 class（如 SessionListContent 置顶区、CreateSessionDialog 选项、ChatInputPanel 工具栏）。建议：  
  - 新功能一律用 **Button** 组件；  
  - 老代码在修改时顺带替换为 Button（variant/size 对应上表）。
- **输入框**：仅重命名对话框等少数处使用 **Input**；其它表单（若有）应逐步统一为 Input。
- **圆角**：已存在 `rounded-md` / `rounded-lg` / `rounded-xl` 混用；新代码按 1.2 表选择，老代码在改动时顺带统一层级。
- **颜色**：中性色已以 zinc 为主；注意新增区块不要引入未在 1.1 中约定的色系，主操作优先用 `primary`。

---

## 五、Agent 与开发者检查清单

开发或评审前端 UI 时可按此自检：

1. **按钮**：是否用了 `Button` 组件？若用原生 button，是否属于 2.1 的「例外」且保留了可访问性？
2. **单行文本输入**：是否用了 `Input` 组件？
3. **圆角**：新加容器是否按 1.2 选择 `rounded-*`？
4. **颜色**：是否使用了 1.1 中的 token（zinc/primary/amber/emerald/red），有无未约定色？
5. **对话框**：是否使用 `ui/dialog`，结构是否符合 2.3？
6. **新组件**：是否放在 `components/ui` 且通过 shadcn-vue CLI 安装，而不是手写或复制？

---

## 六、参考文件

- 主题与主色：`frontend/assets/css/tailwind.css`
- 按钮变体定义：`frontend/components/ui/button/index.ts`（`buttonVariants`）
- 布局与状态：`docs/FRONTEND_SPEC.md`、`.cursor/rules/frontend-spec.mdc`
- 组件安装约束：`.cursor/rules/shadcn-vue-cli.mdc`
