# my-schema-flow-dev 历史记录系统分析报告

本文档分析了 `z参考/my-schema-flow-dev/src/renderer` 目录下的历史记录系统（撤销/重做）的实现机制。

## 目录结构

index.html
src/
src/App.vue
src/env.d.ts
src/main.ts
src/assets/
src/assets/css/
src/assets/css/fonts.css
src/assets/css/nprogress.css
src/assets/css/scrollbar.css
src/assets/css/tailwind.css
src/assets/css/vueflow.css
src/assets/fonts/
src/assets/fonts/Inter-Black.ttf
src/assets/fonts/Inter-Bold.ttf
src/assets/fonts/Inter-ExtraBold.ttf
src/assets/fonts/Inter-ExtraLight.ttf
src/assets/fonts/Inter-Light.ttf
src/assets/fonts/Inter-Medium.ttf
src/assets/fonts/Inter-Regular.ttf
src/assets/fonts/Inter-SemiBold.ttf
src/assets/fonts/Inter-Thin.ttf
src/assets/fonts/MonaspaceNeon-Bold.otf
src/assets/fonts/MonaspaceNeon-BoldItalic.otf
src/assets/fonts/MonaspaceNeon-ExtraBold.otf
src/assets/fonts/MonaspaceNeon-ExtraBoldItalic.otf
src/assets/fonts/MonaspaceNeon-ExtraLight.otf
src/assets/fonts/MonaspaceNeon-ExtraLightItalic.otf
src/assets/fonts/MonaspaceNeon-Italic.otf
src/assets/fonts/MonaspaceNeon-Light.otf
src/assets/fonts/MonaspaceNeon-LightItalic.otf
src/assets/fonts/MonaspaceNeon-Medium.otf
src/assets/fonts/MonaspaceNeon-MediumItalic.otf
src/assets/fonts/MonaspaceNeon-Regular.otf
src/assets/fonts/MonaspaceNeon-SemiBold.otf
src/assets/fonts/MonaspaceNeon-SemiBoldItalic.otf
src/autocomplete/
src/autocomplete/SQLAutocomplete.ts
src/components/
src/components/Base/
src/components/Base/Alerts/
src/components/Base/Alerts/VAlert.vue
src/components/Base/Alerts/VAlertList.vue
src/components/Base/ButtonIcons/
src/components/Base/ButtonIcons/VCanvasControlButtonIcon.vue
src/components/Base/ButtonIcons/VHelperButtonIcon.vue
src/components/Base/ButtonIcons/VNodeToolbarButtonIcon.vue
src/components/Base/ButtonIcons/VPanelButtonIcon.vue
src/components/Base/ButtonIcons/VPlaygroundButtonIcon.vue
src/components/Base/ButtonIcons/VToolbarButtonIcon.vue
src/components/Base/Buttons/
src/components/Base/Buttons/VDatabaseWithDescriptionButton.vue
src/components/Base/Buttons/VPanelActionButton.vue
src/components/Base/Buttons/VPanelColumnButton.vue
src/components/Base/Buttons/VPanelRelationButton.vue
src/components/Base/Buttons/VPanelSelectButton.vue
src/components/Base/Buttons/VSettingsTabButton.vue
src/components/Base/Buttons/VTableNavigateButton.vue
src/components/Base/Buttons/VTableNodeButton.vue
src/components/Base/Buttons/VTitleBarButtonIcon.vue
src/components/Base/Buttons/VUniversalButton.vue
src/components/Base/CustomNodeHandles/
src/components/Base/CustomNodeHandles/VCircleHandle.vue
src/components/Base/CustomTableNodes/
src/components/Base/CustomTableNodes/VPrimaryTableNode.vue
src/components/Base/Dropdowns/
src/components/Base/Dropdowns/VToolbarButtonDropdown.vue
src/components/Base/Dropdowns/VToolbarButtonDropdownItem.vue
src/components/Base/Floaters/
src/components/Base/Floaters/VFloatingLayout.vue
src/components/Base/Floaters/VTooltip.vue
src/components/Base/Forms/
src/components/Base/Forms/VPanelAutoComplete.vue
src/components/Base/Forms/VPanelAutoCompleteWrapper.vue
src/components/Base/Forms/VPanelCheckboxButton.vue
src/components/Base/Forms/VPanelDropdown.vue
src/components/Base/Forms/VPanelDropdownItem.vue
src/components/Base/Forms/VPanelDropdownItemDisable.vue
src/components/Base/Forms/VPanelTextInput.vue
src/components/Base/Forms/VPlaygroundDropdown.vue
src/components/Base/Forms/VPlaygroundTextInput.vue
src/components/Base/Forms/VSettingsDropdown.vue
src/components/Base/Forms/VSettingsDropdownItem.vue
src/components/Base/Forms/VSwitchCheckbox.vue
src/components/Base/Forms/VSwitchForm.vue
src/components/Base/Loaders/
src/components/Base/Loaders/CircleLoader.vue
src/components/Base/Modals/
src/components/Base/Modals/VBlurredModal.vue
src/components/Base/Modals/VFullScreenModal.vue
src/components/Base/Texts/
src/components/Base/Texts/VFormKeyboardHelper.vue
src/components/Base/Texts/VTooltipKeyboardText.vue
src/components/Base/Wrappers/
src/components/Base/Wrappers/VPanelSectionWrapper.vue
src/components/Base/Wrappers/VPanelWrapper.vue
src/components/Modules/
src/components/Modules/Canvas/
src/components/Modules/Canvas/Canvas.vue
src/components/Modules/Canvas/Partials/
src/components/Modules/DiagramModalLoader/
src/components/Modules/DiagramModalLoader/DiagramModalLoader.vue
src/components/Modules/HistorySection/
src/components/Modules/HistorySection/HistorySection.vue
src/components/Modules/Playground/
src/components/Modules/Playground/Playground.vue
src/components/Modules/Playground/Partials/
src/components/Modules/Settings/
src/components/Modules/Settings/Settings.vue
src/components/Modules/Settings/Partials/
src/components/Modules/TableIndexes/
src/components/Modules/TableIndexes/TableIndexes.vue
src/components/Modules/TableIndexes/Partials/
src/components/Modules/TableInformationSection/
src/components/Modules/TableInformationSection/TableInformationSection.vue
src/components/Modules/TableInformationSection/Partials/
src/components/Modules/TableRelations/
src/components/Modules/Tables/
src/components/Modules/TitleBar/
src/components/Modules/Toolbar/
src/components/Shared/
src/components/Shared/Buttons/
src/components/Shared/EmptyStates/
src/components/Shared/Forms/
src/components/Shared/Icons/
src/components/Shared/Logos/
src/composables/
src/composables/Animations/
src/composables/Animations/useChevronAnimation.ts
src/composables/Animations/useTooltipSlideUpAnimation.ts
src/composables/Canvas/
src/composables/Canvas/useCanvasControls.ts
src/composables/Canvas/useMinimap.ts
src/composables/Canvas/usePaneDoubleClick.ts
src/composables/Canvas/usePlaceholder.ts
src/composables/Canvas/useSaveCanvas.ts
src/composables/Edges/
src/composables/Edges/useEdgeEvent.ts
src/composables/Edges/useEdgePositionCalculator.ts
src/composables/Edges/useHighlightColumnRelationship.ts
src/composables/Edges/useUpdateEdgeData.ts
src/composables/History/
src/composables/History/useHistoryActions.ts
src/composables/History/useTrackChange.ts
src/composables/Miscellaneous/
src/composables/Miscellaneous/useDarkMode.ts
src/composables/Miscellaneous/useDropdownFloatingLayout.ts
src/composables/Miscellaneous/useFileImportHelper.ts
src/composables/Miscellaneous/useKeyboardShortcuts.ts
src/composables/Miscellaneous/useScrollbar.ts
src/composables/Miscellaneous/useSearchMySQLDataTypes.ts
src/composables/Nodes/
src/composables/Nodes/useAutoLayout.ts
src/composables/Nodes/useNodeActions.ts
src/composables/Nodes/useNodeDragEvent.ts
src/composables/Nodes/useNodeStateHandler.ts
src/composables/Table/
src/composables/Table/useColumnData.ts
src/composables/Table/useSortTableColumns.ts
src/composables/Table/useTableRelationActions.ts
src/composables/Table/useTableRelationList.ts
src/composables/TextEditor/
src/composables/TextEditor/useSqlAutoComplete.ts
src/composables/TextEditor/useSQLLanguage.ts
src/composables/TextEditor/useTrackEditorTheme.ts
src/directives/
src/directives/TextInputDirectives.ts
src/dummy/
src/dummy/CanvasDummy.ts
src/dummy/EdgesDummy.ts
src/dummy/NodeDummy.ts
src/lottie/
src/lottie/CircleLoader.json
src/stores/
src/stores/Canvas.ts
src/stores/File.ts
src/stores/History.ts
src/stores/Modal.ts
src/stores/Playground.ts
src/stores/Settings.ts
src/symbols/
src/symbols/Canvas.ts
src/symbols/VueFlow.ts
src/utilities/
src/utilities/AnimateHelper.ts
src/utilities/CanvasHelper.ts
src/utilities/DatabaseHelper.ts
src/utilities/DownloadHelper.ts
src/utilities/ExportHelper.ts
src/utilities/FormTableHelper.ts
src/utilities/GenerateCanvasDataHelper.ts
src/utilities/ImportHelper.ts
src/utilities/MySQLHelper.ts
src/utilities/SQLScriptHelper.ts
src/utilities/TableHelper.ts
src/utilities/Editor/
src/utilities/Editor/DarkTheme.ts
src/utilities/Editor/LightTheme.ts
src/utilities/Editor/LineValidatorHelper.ts
src/utilities/Editor/TextEditorHelper.ts

## 核心机制

1.  **状态管理**: 使用 Pinia store (`src/stores/History.ts`) 维护一个历史记录条目数组 (`items`) 和一个指向当前状态的索引 (`currentIndex`)。
2.  **快照存储**: 每个历史记录条目 (`TItem`) 包含一个描述性标签 (`label`) 和一个有效载荷 (`payload`)。`payload` 是当时画布状态（节点 `nodes` 和边 `edges`）的完整深拷贝快照（使用 `klona`）。节点和边的激活状态在存储前会被清除。
3.  **记录触发**: `src/composables/History/useHistoryActions.ts` 中的 `createHistory(label)` 函数负责获取当前画布状态、清理并调用 `historyStore.addItem()` 来添加新的历史快照。此函数在特定用户操作完成后被调用。
4.  **撤销/重做**:
    *   `historyStore` 中的 `undo()` 和 `redo()` 方法仅负责移动 `currentIndex`。
    *   `useHistoryActions.ts` 中的 `undoHistory()` 和 `redoHistory()` 调用 store 的方法，然后调用内部的 `_applyChanges()` 函数。
    *   `_applyChanges()` 从 `historyStore.currentValue` 获取目标状态快照，并将其应用回 Vue Flow 画布，方法是先清空画布 (`setNodes([])`, `setEdges([])`)，然后用快照中的节点和边完全替换。
5.  **限制**: 历史记录最多保存 50 项。

## 触发历史记录的操作

以下操作会触发 `createHistory` 并创建一个新的历史快照：

*   **画布**: 初始加载完成时 (`Canvas.vue`)。
*   **节点 (Table)**:
    *   添加新表 (`useNodeActions.ts`)
    *   删除表 (`useNodeActions.ts`)
    *   移动表 (`useNodeDragEvent.ts`)
        *   **实现细节**: 使用 `@vue-flow/core` 的 `onNodeDragStart` 记录初始位置，`onNodeDragStop` 获取结束位置。只有当位置实际发生改变时，才会调用 `createHistory("Moved Table: '节点名称'")` 来记录快照。
    *   克隆表 (`useNodeActions.ts`)
    *   重命名表 (`TableInformationSection/Partials/DefaultContent.vue`, 带防抖)
*   **列 (Column)**:
    *   添加新列 (`TableInformationSection/Partials/AddForm.vue`)
    *   删除列 (`TableInformationSection/Partials/DefaultContent.vue`)
    *   克隆列 (`TableInformationSection/Partials/DefaultContent.vue`)
    *   交换列顺序 (`TableInformationSection/Partials/DefaultContent.vue`)
*   **关系 (Edge)**:
    *   添加新关系 (`TableRelations/Partials/AddForm.vue`)
    *   更新现有关系 (`TableRelations/Partials/EditForm.vue`)
    *   删除关系 (`TableRelations/Partials/EditForm.vue`)
*   **全局**:
    *   应用自动布局 (`Toolbar/Partials/AutoLayoutButton.vue`)
    *   从 SQL 生成图表 (`useFileImportHelper.ts`)
    *   从文件导入图表 (`useFileImportHelper.ts`)

## 未触发历史记录的操作

以下操作**不会**创建历史快照，因此无法通过撤销/重做来回退：

*   **修改现有列的属性** (名称、类型、约束等) (`TableInformationSection/Partials/EditForm.vue`)。
*   直接在画布上操作边 (点击、悬停) (`useEdgeEvent.ts`)。
*   画布视图操作 (缩放、平移)。
*   选择/取消选择元素。

## 流程图

```mermaid
graph TD
    subgraph User Actions
        A[用户操作: 添加节点/边, 移动节点, 修改表名/列/关系等]
    end

    subgraph History Recording
        B{操作是否应记录?}
        C[调用 useHistoryActions.createHistory(label)]
        D[获取当前 VueFlow 节点/边]
        E[清理节点/边状态 (移除激活状态)]
        F[深拷贝 (klona) 节点/边]
        G[调用 HistoryStore.addItem(快照)]
        H[HistoryStore: 处理分支, 添加快照到 items, 更新 currentIndex]
    end

    subgraph Undo/Redo Actions
        I[用户点击 Undo/Redo]
        J[调用 useHistoryActions.undoHistory/redoHistory]
        K[调用 HistoryStore.undo/redo]
        L[HistoryStore: 更新 currentIndex]
        M[useHistoryActions: 调用 _applyChanges]
        N[获取 HistoryStore.currentValue (目标快照)]
        O[深拷贝 (klona) 目标快照]
        P[清空 VueFlow 画布 (setNodes/setEdges to [])]
        Q[将目标快照的节点/边应用到 VueFlow 画布]
    end

    A -- Yes --> B
    B -- 是 --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H

    I --> J
    J --> K
    K --> L
    L --> M
    M --> N
    N --> O
    O --> P
    P --> Q

    style H fill:#f9f,stroke:#333,stroke-width:2px
    style L fill:#f9f,stroke:#333,stroke-width:2px