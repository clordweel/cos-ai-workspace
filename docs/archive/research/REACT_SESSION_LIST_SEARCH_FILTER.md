# React 生态会话列表搜索/过滤组件调研

## 场景

- **位置**：会话列表顶栏（`SessionListHeader`）
- **交互**：单行输入框，输入关键词后**就地过滤**下方会话列表（无下拉建议、无选一项）
- **现状**：`apps/web` 使用原生 `<input>` 受控 + 父组件 `searchQuery` 与 `filteredSessions = list.filter(s => s.title.toLowerCase().includes(q))`

## 需求拆解

| 维度 | 说明 |
|------|------|
| 输入控件 | 占位、清空、可选防抖、无障碍 |
| 过滤逻辑 | 子串匹配即可；可选模糊/多字段/排序 |
| 与现有栈一致 | 已用 Radix、Base UI、Tailwind，尽量不引入重型新 UI 库 |

---

## 一、输入层：搜索框 UI

### 1. 保持现状（推荐）

- 继续使用**受控原生 input** 或项目内 `Input`，顶栏仅需「搜索会话」单行。
- 可选增强：右侧**清空按钮**（有内容时显示）、`aria-label`、可选 `useDebounce` 降低过滤频率。

### 2. 通用搜索/组合框组件（偏重，慎选）

| 库 | 特点 | 与当前场景匹配度 |
|----|------|------------------|
| **react-select-search** | 带搜索的下拉选择，键盘、分组、headless | 偏「选一项」场景，列表过滤会过重 |
| **react-bootstrap-typeahead** | Typeahead + 多选，Bootstrap 风格 | 需 Bootstrap，且为下拉选择，非就地过滤 |
| **React Aria `useSearchAutocomplete`** | 无样式、可访问、支持异步/虚拟列表 | 更适合「搜索 + 下拉建议」，可用来做自定义搜索框 + 下拉，当前仅过滤列表不必上 |
| **Ariakit Combobox + Radix** | 组合框 + 过滤示例（match-sorter） | 同上，适合「输入 + 弹出列表选一项」 |

**结论**：当前是「输入 → 过滤下方列表」，不是「输入 → 弹出列表选一项」。不引入完整 Combobox/Autocomplete 组件，用**轻量输入 + 过滤算法**即可。

---

## 二、过滤逻辑层：算法与工具库

### 1. match-sorter（推荐）

- **npm**: `match-sorter`
- **作者**: Kent C. Dodds，生态常用
- **用途**: 对数组做**智能排序 + 过滤**，按匹配质量分级（精确 → 开头 → 包含 → 首字母等）。
- **特点**: 无 UI、无 React 耦合；支持多键、自定义 `keys`；2.6M+ 周下载。
- **会话列表示例**:

```ts
import { matchSorter } from 'match-sorter';

const filtered = matchSorter(sessions, searchQuery.trim(), {
  keys: ['title'],
  threshold: matchSorter.rankings.CONTAINS, // 或默认排序
});
```

- **适配点**: 会话项为对象时用 `keys: ['title']`，若需匹配多字段可 `keys: ['title', 'participantsNames']` 等。

### 2. fast-fuzzy

- **npm**: `fast-fuzzy`
- **特点**: 模糊匹配（Levenshtein），支持 Unicode；有 `Searcher` 类可缓存，适合**同一列表多次过滤**（如输入时连续过滤）。
- **会话列表示例**:

```ts
import { Searcher } from 'fast-fuzzy';

const searcher = new Searcher(sessions, { keySelector: (s) => s.title });
const filtered = searcher.search(searchQuery);
```

- **适用**: 需要「容错、拼音首字母」等模糊体验时考虑；否则 match-sorter 更简单。

### 3. 其它

- **react-search-input**: 自带 `createFilter` + 节流，偏向「输入 + 过滤」一体化，但项目已有 Input，仅用其思路（防抖/节流）即可。
- **Fuse.js**: 功能强、可配置多，若未来做「高亮、多字段、权重」可考虑；对当前简单标题过滤略重。

---

## 三、防抖（可选）

- **use-debounce**（`use-debounce`）或 **@uidotdev/usehooks** 的 `useDebounce`：将 `searchQuery` 或「提交给过滤的 query」防抖 200–300ms，减少输入过程中的计算/重渲染。
- 会话数量不大时可直接用即时过滤，不必强求防抖。

---

## 四、与现有代码的整合方式

### 方案 A：最小改动（推荐）

- **输入**: 保持 `SessionListHeader` 内现有 input；可选在右侧加「有内容时显示」的清空按钮。
- **过滤**: 在 `Space.tsx`（或数据层）用 `matchSorter(sessions, query, { keys: ['title'] })` 替代手写 `filter(...includes(...))`，排序更合理。
- **依赖**: 仅新增 `match-sorter`，无新 UI 组件。

### 方案 B：增强输入 UX

- 使用项目内 `Input` 组件（若样式统一），并加清空按钮、`aria-label`。
- 仍由父组件受控，过滤逻辑同方案 A。

### 方案 C：需要模糊/容错时

- 引入 `fast-fuzzy`，用 `Searcher` 对会话列表做模糊匹配；输入层仍为方案 A/B。

---

## 五、推荐结论

| 项目 | 建议 |
|------|------|
| **输入组件** | 保持现有顶栏单行 input（或统一用 `Input` + 清空），不引入 Combobox/Autocomplete。 |
| **过滤算法** | 引入 **match-sorter**，替换当前 `filter + includes`，获得更好排序与可扩展键。 |
| **防抖** | 可选；列表规模大时再考虑 `useDebounce`。 |
| **模糊匹配** | 当前用 match-sorter 即可；若有「拼音/ typo 容错」需求再考虑 **fast-fuzzy**。 |

文档与示例可参考：

- match-sorter: https://github.com/kentcdodds/match-sorter  
- fast-fuzzy: https://github.com/EthanRutherford/fast-fuzzy  
- React Aria useSearchAutocomplete（若未来做带下拉的搜索）: React Aria 文档
