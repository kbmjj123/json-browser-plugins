# 调整文档：将 Popup 配置能力融入预览视图

> ⚠️ **历史文档，已过时。** 本文写于移除 action popup 的设计评审阶段（原文即注明「本阶段只做设计与评审，不编码」）。当前实现已走整体 Vue 化路径：两个视图共用 `src/components/ViewerShell.vue` + `ViewerSettings.vue`，配置统一走 `utils/options.ts`；文中提到的 `entrypoints/popup/`、`ViewerPage.vue`、`src/utils/support.ts` 以及 §2「现状」均已不成立。请以 `README.md` 与源码为准，保留本文仅作重构决策记录。

> 目标：移除 action popup 后（popup 与 `action.onClicked` 互斥，必须去掉才能点击图标直接开新标签页），把原 popup 里的**配置能力**融入两个既有的预览视图中——网页内 overlay（content 注入的全屏浮层）与 `lastPreview` 独立标签页页面。本阶段只做设计与评审，不编码。

---

## 1. 背景与目标

### 1.1 为什么要做
- 点击工具栏图标需要"直接新开标签页看最近预览"，这要求**不能有 action popup**（两者互斥）。popup 已删除。
- 删除 popup 后，原 popup 承载的**用户配置入口**（主题 / 缩进 / 默认视图 / 语言 / 图片预览 / 自动美化开关）没了去处。
- 用户希望这些配置能力继续可用，且就放在"预览视图"里，而不是另开一个 options 页。

### 1.2 目标
1. 两个预览视图（overlay + lastPreview 页）都能修改全部配置项，并**实时生效、持久化**。
2. 配置行为在两个视图保持一致。
3. 复用现有配置数据层（`utils/options.ts`），不引入新的状态源。
4. 保留并统一"支持/赞赏"与"隐私说明"等原有 popup 附属内容。

### 1.3 非目标
- 不改变"点击图标开新标签页"的核心行为。
- 不重构 JsonEditor 本身。
- 不新增 options 字段（除非后续明确需要）。

---

## 2. 现状梳理

### 2.1 配置数据层（已存在，无需新建）
`utils/options.ts`：
- `ExtensionOptions`：`indent(2|4|tab)`、`theme(light|dark|auto)`、`locale(en|zh)`、`view(editor|tree|both|table)`、`auto(boolean)`、`imagePreview(boolean)`。
- `DEFAULT_OPTIONS`：全部默认开启（`auto:true`、`imagePreview:true`）。
- `getOptions()` / `setOptions()` / `STORAGE_KEY('jsontb:options:v1')`。
- `resolveDark(theme)`：把 `auto` 解析成具体明暗。

这是**单一真相源**，所有视图读写都走它。

### 2.2 原 Popup 构成（从 `App.vue` 还原，文件未提交已被删）
```
App.vue
 ├─ PopupHeader       顶部署名/标题
 ├─ ConfigSection     6 项配置控件（核心）
 ├─ PopularTools      跳回站点 jsontoolbox.cc 的工具/链接
 └─ PrivacyFooter     隐私说明（不收集数据等）
```
由 `useExtensionOptions` 负责挂载时应用主题+locale、读写 storage。配置项的字段就是 §2.1 的 6 项，**没有别的**。

### 2.3 两个预览视图现状
| 视图 | 实现方式 | 配置相关现状 |
|---|---|---|
| 网页 overlay | `utils/detectAndMount.ts`：vanilla DOM 外壳 + 嵌套 Vue（JsonEditor），挂在 `fixed` 全屏浮层 | 配置**写死**：`view:'both'`、`theme/imagePreview/indent/locale` 已从 `options` 传入；**无设置入口**；已有 raw/tree 切换、site 链接、kofi/二维码 |
| lastPreview 页 | `entrypoints/lastPreview/main.ts`：直接 `defineJsonEditor` 挂载，非 Vue 页面 | 配置取 `getOptions()` 但 `view:'both'` 写死；**无设置入口**；空数据也渲染空编辑器（已改） |

### 2.4 已具备的"实时生效"能力
`content.ts` 的 `ensure()`：
- 已根据 `opts.auto` 决定挂载/卸载 viewer（`auto:false` → 不挂载，保留原生 `<pre>`）。
- 已监听 `browser.storage.onChanged`（`area==='local'` 且 `STORAGE_KEY` 变更）→ 合并新值 → `ensure()` → 要么 `controller.apply(opts, labels)` 即时刷新，要么重新挂载/卸载。
- 即：**只要设置面板调用 `setOptions()`，overlay 会自动实时更新，无需额外接线。**

lastPreview 页当前**没有** `storage.onChanged` 监听，需要补上。

### 2.5 支持/赞赏入口（已在 overlay 实现，等价 popup 的 PopularTools 支持部分）
`detectAndMount.ts` 中：
- 右上角常驻 `site` 链接（jsontoolbox.cc）+ `kofi` 链接（☕ Buy me a coffee）。
- 中文 locale 点击 kofi → 弹出微信/支付宝赞赏二维码（`/qr/wechat-pay.png`、`/qr/alipay.png`）。
- 这部分**已覆盖** popup 的支持诉求，融合时保留即可，并考虑在 lastPreview 页也补一份。

---

## 3. 设计原则
1. **单一真相源**：配置只来自 `utils/options.ts`，UI 只负责读写它。
2. **UI 复用**：抽一个共享的 `ViewerSettings.vue`，overlay 与 lastPreview 共用，避免两套不一致的实现。
3. **实时生效、幂等**：设置变更 → `setOptions()` 写 storage → `storage.onChanged` 驱动各 viewer 的 `apply`/`setOptions`，apply 必须是幂等的（重复调用无副作用）。
4. **尊重用户偏好**：overlay/lastPreview 的初始视图应取 `options.view`（而非硬编码 `both`）；`auto` 开关控制是否自动美化。
5. **最小侵入**：优先在不重写 detectAndMount 的前提下加设置入口；统一架构（把 overlay 也 Vue 化）作为可选演进路径。

---

## 4. 方案设计

### 4.1 共享组件 `src/components/ViewerSettings.vue`（新建，核心）
职责：渲染全部配置控件，任何变更调用 `setOptions()` 持久化，并 `emit('change', nextOptions)` 供宿主即时响应。

**控件清单（对应 ExtensionOptions）**
| 控件 | 选项 | 备注 |
|---|---|---|
| 主题 theme | Light / Dark / Auto | Auto 走 `resolveDark` |
| 缩进 indent | 2 空格 / 4 空格 / Tab | |
| 默认视图 view | Editor / Tree / Both / Table | **Table 仅对数组根有意义**，对象/标量根禁用该选项（与现有 `allowedViews` 逻辑一致） |
| 语言 locale | English / 中文 | 切换后文案即时变 |
| 图片预览 imagePreview | 开/关 | 仅影响远程媒体，本地 base64 始终渲染 |
| 自动美化 auto | 开/关 | 关闭后网页不再自动挂载预览（需刷新页面 / 由 `storage.onChanged` 动态卸载） |

**文案**：内置轻量 `t(key)`（接收 `locale` prop，内部中英文典），与 JsonEditor 做法一致，**不引入 vue-i18n**（popup 的 vue-i18n 可弃用）。

**可附加内容**（来自原 popup 的 PopularTools / PrivacyFooter）：
- 一个"访问 jsontoolbox.cc ↗"链接（overlay 已有 site 链接，lastPreview 可补）。
- 隐私说明一行："本扩展不收集任何数据，所有设置仅存于本地。"（可放面板底部）。

**对外接口**
```ts
defineProps<{ locale: AppLocale }>()
defineEmits<{ change: [options: ExtensionOptions] }>()
// 内部：读取 getOptions() 初始化各控件；变更时 setOptions(patch) 并 emit('change', merged)
```

### 4.2 网页 overlay 融合（`utils/detectAndMount.ts`）
**入口**：在 `.bar`（标题栏）右侧增加一个 ⚙ 设置按钮（vanilla，与现有 `barToggle` 同风格）。
**面板**：点击 ⚙ → 展开一个设置面板。两种实现选型：
- **推荐 A（复用组件）**：在 overlay 的 root shadow 内放一个 `#settings` 容器，`detectAndMount` 用 `createApp(ViewerSettings)` 挂载一个**轻量 Vue 子 app**（与 JsonEditor 同机制，独立实例、互不干扰），⚙ 按钮 toggle 该容器显隐。
- 选型 B（纯 vanilla）：用原生 DOM 在 overlay 里手搓同样的控件。不推荐——与 lastPreview 重复且易不一致。

**实时生效**：ViewerSettings `emit('change')` → 调 `controller.apply(opts, labels)`（overlay 内部已有 `apply`，会 `editor.setOptions` + `paint` + `updateLabels`）；同时 `setOptions` 写 storage → 触发 `content.ts` 的 `storage.onChanged` → `ensure()` 再次 `apply`（幂等，无副作用）。两条路径最终一致。

**尊重偏好**：
- `editorOptions()` 的初始 `view` 由硬编码 `'both'` 改为 `next.view ?? 'both'`（受 `auto` 与可能的 URL `?view=` 覆盖影响；URL 覆盖逻辑若已有则保留，无则不加）。
- `allowedViews` 仍按数组根判断（对象/标量根隐藏切换，见表单约束）。

**auto 开关**：overlay 自身无需额外处理——`content.ts` 已在 `auto:false` 时 `controller?.destroy()` 不挂载。设置面板改 `auto` 后，`storage.onChanged` 会触发 `ensure()` 动态卸载/挂载。

### 4.3 lastPreview 页融合（`entrypoints/lastPreview/`）
**推荐**：把该页改成**标准 Vue 页面**——`main.ts` 用 `createApp(ViewerPage)` 挂载一个顶层组件 `ViewerPage.vue`，内含：
- 顶部栏（可常驻显示 `ViewerSettings`，或同样用 ⚙ 折叠）；
- 主体 `defineJsonEditor` 渲染区（沿用现有 shadow + 高度链修复）。

**复用**：`ViewerPage.vue` 直接 `<ViewerSettings :locale="opts.locale" @change="onSettingsChange" />`，与 overlay 同一组件，UI 完全一致。

**实时生效**：`main.ts`/`ViewerPage` 监听 `browser.storage.onChanged`（`STORAGE_KEY`）→ 合并新值 → 调 `editor.setOptions(editorOptions(next))`（或重建 viewer）。`setOptions` 已持久化，监听只用于把"外部/其他视图改的配置"同步回本页。

**空数据**：即使 `value===''`，设置面板照常可用（用户可先改配置，再粘贴 JSON）。

**支持/赞赏**：在页脚补一个 `site` 链接 + kofi/二维码入口（复用 overlay 已有的二维码逻辑，或抽成共享函数 `openSupportQr()`）。

### 4.4 支持 / 赞赏 / 隐私（统一）
- 抽一个共享工具 `src/utils/support.ts`：`openSupportQr(locale)`（zh 弹微信/支付宝二维码，其他跳 kofi）。overlay 与 lastPreview 共用，避免代码重复。
- 隐私说明置于 `ViewerSettings` 面板底部（一处即可，两个视图都看得到）。

---

## 5. 数据流与实时生效（汇总）
```
用户改设置 → ViewerSettings 调 setOptions(patch)
        → browser.storage.local.set(STORAGE_KEY)
        → storage.onChanged 广播（所有视图的内容脚本 + lastPreview 页收到）
              ├─ overlay（content.ts）：合并 → ensure() → controller.apply() 即时刷新（或挂载/卸载）
              └─ lastPreview 页：合并 → editor.setOptions() 即时刷新
        ↘ ViewerSettings emit('change') → 本视图宿主同步 apply（overlay 内，双保险）
```
幂等要求：`apply` / `setOptions` 重复调用不产生副作用（当前 `editor.setOptions` 与 `paint` 满足）。

---

## 6. 配置项逐项作用映射
| 字段 | UI 控件 | 对 overlay 的作用 | 对 lastPreview 的作用 |
|---|---|---|---|
| theme | 主题 | `resolveDark` → 明暗；`apply` 重绘 bar/背景 | 同左 |
| indent | 缩进 | `editor.setOptions({indent})` 重新格式化 | 同左 |
| locale | 语言 | 文案（raw/tree/支持等）；kofi 文案切中/英 | 同左 + ViewerSettings 文案 |
| view | 默认视图 | 初始视图（非数组根时禁用 Table） | 同左 |
| auto | 自动美化 | `false` 时不挂载 viewer（保留原生 `<pre>`） | 仅 overlay 适用（lastPreview 始终展示） |
| imagePreview | 图片预览 | 远程图片/音视频/PDF 是否加载 | 同左 |

---

## 7. 文件改动清单（待编码阶段）
**新建**
- `src/components/ViewerSettings.vue` —— 共享配置面板（6 项控件 + 支持链接 + 隐私说明 + 内置中英字典）。
- `src/utils/support.ts` —— `openSupportQr(locale)` 共享（抽自 overlay 现有二维码逻辑）。
- `entrypoints/lastPreview/ViewerPage.vue` —— lastPreview 顶层 Vue 组件（设置栏 + 编辑器区）。
- `entrypoints/lastPreview/main.ts` —— 改为 `createApp(ViewerPage).mount('#app')`（并加 `storage.onChanged` 监听）。

**修改**
- `utils/detectAndMount.ts`：`.bar` 加 ⚙ 按钮；挂载 `ViewerSettings` 子 app 到 `#settings` 容器；`editorOptions()` 初始 `view` 改用 `next.view`；保留 `apply` 幂等。
- `entrypoints/content.ts`：基本无需改（已支持 `auto` + `onChanged`）；仅确认 `auto:false` 时 `ensure()` 不挂载（已具备）。
- `utils/options.ts`：无需改（除非要加新字段）。

**删除/弃用**
- popup 私有的 `i18n`（vue-i18n）依赖可移除（ViewerSettings 用内置字典）。
- 原 `entrypoints/popup/` 已删，无需处理。

---

## 8. 风险与权衡
1. **overlay 内嵌 Vue 设置面板 vs 纯 vanilla 面板**
   - 推荐嵌 Vue 子 app（复用 `ViewerSettings`，UI 一致）。代价：overlay 多一个独立 Vue 实例（与 JsonEditor 实例并列，互不影响）。
   - 若担心多实例/体积，可降级为 vanilla 面板（但需维护两套 UI）。
2. **是否把 overlay 整体 Vue 化（路径 2）**
   - 更彻底一致：把整个 overlay 也写成 `ViewerOverlay.vue`（含 bar + JsonEditor + settings），detectAndMount 改为挂载该组件。工作量更大、回归风险更高。
   - 本阶段推荐**路径 1（最小改动）**：overlay 外壳保持 vanilla，仅内嵌设置面板。路径 2 留作后续演进。
3. **auto 关闭后的生效时机**：overlay 由 `storage.onChanged` 动态卸载（已支持）；但"已卸载后用户又开 auto"也能自动重新挂载（ensure 处理）。无需刷新。
4. **view:'table' 对对象根无意义**：UI 层在对象/标量根时禁用 Table 选项，避免用户选了不生效的困惑。
5. **多实例同步**：同一页面只有一份 JSON 预览，不存在多 viewer 冲突；`storage.onChanged` 在所有标签页广播，`ensure()` 各自幂等处理。

---

## 9. 验证清单（编码后）
- [ ] overlay：⚙ 打开设置面板，能改 6 项配置。
- [ ] overlay：改主题 → 浮层明暗即时切换；改缩进 → 重新格式化；改语言 → 文案切换；改 imagePreview → 远程图片加载/不加载。
- [ ] overlay：改 `auto` 为关 → 刷新后不再自动美化（保留原生 `<pre>`）；改回开 → 自动恢复。
- [ ] overlay：改 `view` → 下次新开/刷新以该视图为初始（对象根时 Table 选项禁用）。
- [ ] lastPreview 页：同样能改 6 项配置并即时生效；空数据下也能改。
- [ ] 跨视图一致：在 overlay 改配置后，打开 lastPreview 页也反映新配置（反之亦然），均由 storage 同步。
- [ ] 支持/赞赏：overlay 与 lastPreview 页均有入口，中文弹二维码、其他跳 kofi。
- [ ] 隐私说明在两个视图可见。

---

## 10. 待确认问题（评审时定）
1. overlay 设置面板用**内嵌 Vue 子 app**（推荐）还是 **vanilla 面板**？
2. 是否接受把 lastPreview 改成标准 Vue 页面（推荐，便于复用 `ViewerSettings`）？
3. 是否要把 overlay 整体重构为 Vue 组件（路径 2），还是本阶段只做最小改动（路径 1）？
4. `ViewerSettings` 放在 `.bar` 内的 ⚙ 折叠面板，还是常驻侧边栏 / 顶部条？（推荐 ⚙ 折叠，节省空间）
5. 是否需要把 `view` 的初始值也支持 URL `?view=` 覆盖（当前 overlay 是否有此逻辑需先确认）？
