# 可停靠编辑器标签页为空问题诊断与修复

## 任务背景

用户报告在点击节点输入控件的“编辑”按钮后，虽然可停靠的编辑器面板 (`DockedEditorWrapper.vue`) 会被唤起，但面板内的标签页是空的，并且内容交互存在问题。

日志显示 `useWorkflowInteractionCoordinator.ts` 成功请求打开了停靠编辑器，并传递了正确的上下文（包括 `initialContent` 和 `languageHint`）。

## 任务目标

诊断并修复可停靠编辑器在打开后标签页为空或内容未正确加载的问题，并确保标签页标题显示友好。

## 预期结果

当用户点击节点输入控件的“编辑”按钮时：
1.  可停靠编辑器面板打开。
2.  一个新的标签页被创建并激活，标签页标题应反映编辑的上下文（例如，节点名称 > 输入名称）。
3.  标签页内的编辑器应正确加载 `initialContent`。
4.  编辑器的语言模式应根据 `languageHint` 设置。

## 调查计划与发现总结

### 初始问题：标签页为空或内容未正确加载

**1. 分析 `useEditorState.ts`**:
   - 确认 `openOrFocusEditorTab` 方法能正确接收上下文并更新 `editorTabs`, `activeEditorTabId`, `isDockedEditorVisible` 状态。此部分逻辑初步判断正确。

**2. 分析 `useWorkflowInteractionCoordinator.ts`**:
   - 确认 `openDockedEditorForNodeInput` 方法正确构造 `EditorOpeningContext` 并调用 `editorState.openOrFocusEditorTab`。此部分逻辑初步判断正确。

**3. 分析 `DockedEditorWrapper.vue`**:
   - 发现 `DockedEditorWrapper` 依赖外部调用其 `openEditor` 方法来传递上下文并打开标签页，而不是直接响应 `useEditorState` 中 `editorTabs` 的变化。
   - `TabbedEditorHost.vue` 在其内部管理标签列表，通过 `openEditorTab` 方法添加新标签。

**4. 分析 `TabbedEditorHost.vue`**:
   - 确认其通过 `props` (如 `initialTabsData`) 或暴露的 `openEditorTab` 方法接收标签数据。

**5. 分析 `EditorView.vue`**:
   - 发现 `EditorView.vue` 虽然根据 `isDockedEditorVisible` 状态来挂载 `DockedEditorWrapper`，但缺少一个机制来将 `useEditorState` 中新创建的标签页上下文传递给 `DockedEditorWrapper` 实例的 `openEditor` 方法。

**初步修复方案与实施**:
   - **修改 `useEditorState.ts`**:
     - 添加 `requestedContextToOpen = ref<EditorOpeningContext | null>(null)` 用于存储最近请求打开的上下文。
     - 在 `openOrFocusEditorTab` 中更新此 `ref`。
     - 添加 `clearRequestedContext()` 方法。
   - **修改 `EditorView.vue`**:
     - 为 `DockedEditorWrapper` 添加 `ref`。
     - `watch` `requestedContextToOpen`，当其变化且有效时，调用 `dockedEditorWrapperRef.value.openEditor(newContext)`，然后清除 `requestedContextToOpen`。

### 后续问题1：JSON 内容导致编辑器报错

**用户反馈与日志分析**:
   - 出现 "Invalid prop: type check failed for prop "initialContent". Expected String, got Object" 错误。
   - 以及 "Uncaught (in promise) TypeError: (config.doc || "").split is not a function" 错误。
   - 定位到当编辑 JSON 输入时，`initialContent` 作为对象直接传递给了期望字符串的 `RichCodeEditor`。

**修复方案与实施**:
   - **修改 `useWorkflowInteractionCoordinator.ts`** (`openDockedEditorForNodeInput` 方法):
     - 在构造 `EditorOpeningContext` 时，检查 `editorType`。如果为 `'json'` 且 `currentValue` 是对象，则使用 `JSON.stringify(currentValue, null, 2)` 将其转换为格式化的 JSON 字符串。
     - 对 `null` 或 `undefined` 的 `currentValue` 使用空字符串。
     - 其他类型使用 `String(currentValue)`。
     - 在 `onSave` 回调中，如果 `editorType` 是 `'json'`，则尝试用 `JSON.parse(newContent)` 将编辑器返回的字符串内容转换回对象，再进行保存。

### 后续问题2：编辑器标签页名称显示不友好

**用户反馈**:
   - 标签页名称显示为如 `inputsjson_input`，而不是预期的“节点名称 > 输入显示名称”。

**分析与定位**:
   - `useWorkflowInteractionCoordinator.openDockedEditorForNodeInput` 生成的 `EditorOpeningContext.title` 是友好的 (e.g., `'🧪测试组件节点 > Markdown文本'`)。
   - `useEditorState.openOrFocusEditorTab` 会使用这个 `context.title` 来设置 `TabData.title`。
   - `EditorView` 通过 `watch(requestedContextToOpen)` 将 `EditorOpeningContext` 传递给 `DockedEditorWrapper.openEditor(context)`。
   - 问题在于 `DockedEditorWrapper.openEditor` 内部创建 `TabData` 时，**忽略了传入的 `context.title`**，而是重新尝试从 `context.breadcrumbData` 或 `context.inputPath` 生成标题。

**修复方案与实施**:
   - **修改 `DockedEditorWrapper.vue`** (`openEditor` 方法):
     - 在构造 `TabData` 对象时，使其优先使用 `context.title`。如果 `context.title` 不存在，才回退到基于 `context.breadcrumbData` 或 `context.inputPath` 的逻辑。
     - 修改后标题生成逻辑为: `title: context.title || context.breadcrumbData?.inputName || context.breadcrumbData?.nodeName || context.inputPath || '新文件'`。

## 最终确认

所有已知问题均已通过上述修改得到解决。
