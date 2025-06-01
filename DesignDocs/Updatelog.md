# 更新记录

## 2025 年 6 月 1 日

- chore: 更新版本号
  将版本号从 0.0.5 更新为 0.0.6，以反映最近的代码更改。
- refactor: 移除调试日志以清理代码
  清理多个文件中的调试日志输出，包括 ExecutionEngine、websocket handler、GroupInputNode 以及前端相关的 websocket 和 workflow 执行逻辑。这些调试
  日志在开发阶段有用，但在生产环境中会带来不必要的控制台输出。
  保留关键日志（如 interfaceInputs 检查）和错误日志，仅移除开发调试用的详细输出。将部分重要日志改为 console.debug 级别。
- feat(workflow): 添加工作流接口输入输出支持
  - 在 WorkflowExecutionPayload 中添加 interfaceInputs 和 interfaceOutputs 字段
  - 实现 GroupInputNode 从工作流接口获取输入值的逻辑
  - 完善 outputInterfaceMappings 生成逻辑
  - 添加调试日志用于跟踪接口数据流转
  - 统一 GroupSlotInfo 类型定义到 schemas 模块
- feat(workflow): 添加自定义插槽描述和节点转换逻辑
  - 在 types 包中新增 CustomSlotDescriptionsSchema 用于定义自定义插槽描述
  - 在 WorkflowNodeSchema 中添加 customDescription 和 customSlotDescriptions 字段
  - 重构 useWorkflowManager 中的节点转换逻辑，正确处理自定义描述和默认值
  - 在 workflowTransformer 和 workflowFlattener 中添加调试日志，便于排查问题
    新增功能允许用户为节点和插槽提供自定义描述，会覆盖节点定义中的默认描述。同时改进了节点转换逻辑，确保正确处理输入/输出的默认值和描述信息
    。添加的调试日志有助于排查工作流转换和扁平化过程中的问题。
- fix: 修正工作流数据保存时的日志打印和默认工作流的坐标位置
  - 修改 `useWorkflowData.ts` 文件中保存新工作流和更新工作流时的日志打印，从使用模板字符串改为直接打印对象。
  - 调整 `DefaultWorkflow.json` 文件中默认工作流输入和输出组的坐标位置，使其符合预期布局。
- fix(workflow): 修复对引用工作流的支持
  在 useWorkflowData 和 workflowTransformer 中添加 referencedWorkflows 字段，用于存储和管理被引用的工作流 ID。当节点类型为 NodeGroup 时，会收集其
  用的工作流 ID 并存储在核心工作流数据中。
- refactor(schemas): 重构插槽定义结构并提取公共辅助函数
  将 GroupSlotInfoSchema 重构为继承 SlotDefinitionBase 的结构，提取公共插槽属性到基础接口。创建 useSlotDefinitionHelper 组合式函数统一处
  插槽定义获取逻辑，替代各处的重复代码。
  主要变更：
  - 将 displayName、dataFlowType 等公共属性提取到 SlotDefinitionBase 接口
  - InputDefinition 和 OutputDefinition 现在继承 SlotDefinitionBase
  - 新增 useSlotDefinitionHelper 集中处理节点、组和工作流中的插槽定义获取
  - 更新所有相关组件和工具函数使用新的辅助函数
  - 修复多输入连接排序和类型验证的相关逻辑
    这些改动提高了代码复用性，使插槽定义管理更加集中和一致。
- feat(节点显示): 添加 displayName 字段作为节点显示名称的主要来源
  在节点类型定义和转换逻辑中添加 displayName 字段，作为界面显示名称的主要来源，优先于原有的 label 字段
  同时更新相关转换器、分组逻辑和 API 日志记录，确保 displayName 在整个工作流系统中正确传递和使用
- feat(WorkflowInfoPanel): 添加调试按钮输出工作流 JSON 到控制台
  添加一个调试按钮用于将当前工作流状态以 JSON 格式输出到控制台，方便开发时查看工作流数据。使用 transformVueFlowToCoreWorkflow 函数转换数据格
  ，确保输出内容与核心工作流数据结构一致。
- feat(节点组): 实现节点组动态接口同步与边类型验证
  1. 在节点组组件中动态加载并同步引用工作流的输入输出接口，不再保存静态插槽定义
  2. 增强边类型验证逻辑，支持从节点组接口动态获取类型信息
  3. 改进工作流转换器，异步加载节点组引用工作流并填充接口数据
  4. 优化节点组创建逻辑，正确处理嵌套节点组的接口继承
     重构工作流加载逻辑，确保节点组接口在加载时动态获取。边验证现在会优先检查节点组动态接口，回退到静态定义。移除了阻塞 UI 的 alert 提示，改为日
     志记录。

## 2025 年 5 月 31 日

- feat(节点分组): 为分组节点添加表情前缀并完善清除引用逻辑
  - 在创建和更新分组节点时，为标签添加"📦"表情前缀以增强视觉识别
  - 完善清除分组节点引用时的处理逻辑，包括：
    - 清除接口定义和连接数据
    - 恢复默认标签
    - 移除相关连接边并记录以便撤销操作
- refactor(node): 重构节点组编辑功能并优化代码结构
  - 移除未使用的 nextTick 导入和注释掉的代码
  - 修改节点组类型判断逻辑，简化比较条件
  - 将节点组编辑功能从 useNodeActions 移到 BaseNode 组件
  - 新增 referencedWorkflowId 计算属性和 openReferencedWorkflow 方法
  - 调整节点配置区域的 DOM 结构位置
- refactor(节点连接验证): 优化类型兼容性检查逻辑和代码结构
  - 在 useWorkflowGrouping.ts 中为条件判断添加花括号以提高代码可读性
  - 重构 useNodeGroupConnectionValidation.ts 中的节点定义查找逻辑，支持 GroupOutput 节点的特殊处理
  - 将类型兼容性检查结果存储在变量中，便于调试和日志记录
  - 更新注释和错误提示信息为中文，提高代码可维护性
- refactor(components): 优化状态栏和标签栏的布局和滚动行为
  - 在 StatusBar 中添加 min-w-0 和 flex-shrink-0 防止内容溢出
  - 用 OverlayScrollbarsComponent 替换 TabBar 的自定义滚动条实现
  - 添加水平滚轮滚动支持并优化暗色主题兼容性
  - 移除不再需要的自定义滚动条样式

## 2025 年 5 月 30 日

- fix(输入组件): 将 wheel 事件监听改为 passive 模式
  修改 TextAreaInput 和 JsonInlineViewer 组件中的 wheel 事件处理，将 passive 选项从 false 改为 true。这可以提升滚动性能，因为浏览器不再需要等待事件
  理完成才能执行滚动。
- fix(节点组): 修复节点组连接验证和分组逻辑中的类型处理问题
  改进节点组连接验证逻辑，正确处理带命名空间的节点类型。优化节点组创建流程，添加调试日志并确保类型兼容性检查的准确性。
  重构节点组创建工作流转换逻辑，使用 transformVueFlowToCoreWorkflow 进行格式转换。添加详细的调试日志帮助追踪分组过程中的连接处理情况。
  修复边界情况下节点类型解析问题，确保组输入/输出能正确匹配内部节点的数据流类型。同时改进不兼容连接的用户提示信息。
- feat(节点组): 允许单个节点创建组并更新提示信息
  - 允许用户选择单个节点创建节点组
  - 更新相关提示信息，明确告知用户至少需要选择一个节点
  - 优化节点组创建逻辑，确保在单节点情况下也能正确处理
- docs(架构): 添加应用面板集成方案设计文档
  新增应用面板集成方案设计文档，详细阐述了 ComfyTavern 如何将复杂工作流封装为面向最终用户的交互式应用面板。文档内容包括核心概念、技术选型
  、交互设计、数据流、API 接口、扩展性及未来展望。
- docs:移动已实施计划到 old
  将已完成或部分完成的计划文档（如 action-plan-project-refactor.md, backend-driven-preview-plan.md 等）移动到 DesignDocs/old 目录下，以保持
  档结构的清晰和整洁。
- docs(architecture): 添加 ComfyTavern Agent 架构规划草案文档
  新增 ComfyTavern Agent 架构规划草案文档，初步探讨了 Agent 的核心功能、技术选型、模块设计、交互流程以及与现有系统的集成方案。该文档为后续 A
  ent 功能的详细设计和开发奠定了基础。
- refactor(websocket): 优化 WebSocket 处理器错误处理和消息格式
  - 统一 WebSocket 消息处理器的错误响应格式，使用标准化的错误对象
  - 增加对未知消息类型的处理逻辑，返回明确的错误提示
  - 优化日志记录，包含更详细的错误信息和上下文
  - 移除冗余的 try-catch 块，简化代码结构

## 2025 年 5 月 29 日

- feat(editor): 添加节点搜索面板功能
  - 新增 NodeSearchPanel 组件，支持通过关键词搜索节点
  - 在 EditorContextMenu 中集成搜索面板的触发逻辑
  - 实现节点的模糊匹配和高亮显示
  - 优化搜索结果的展示和交互体验
- feat(编辑器): 实现右键菜单级联节点选择功能
  - 在 EditorContextMenu 中添加级联子菜单，按节点分类展示
  - 支持通过右键菜单快速添加常用节点
  - 优化菜单项的显示名称和排序逻辑
  - 提升节点添加操作的便捷性和效率
- refactor(Canvas): 优化画布组件代码结构并改进全选功能
  - 将事件监听和处理逻辑移至独立的函数或方法
  - 优化全选功能的实现，确保正确选中所有节点和边
  - 移除未使用的变量和导入，清理代码注释
  - 提升代码可读性和可维护性
- fix(上下文菜单): 修复菜单定位和样式问题
  - 修复 EditorContextMenu 在画布边缘点击时可能出现的定位不准确问题
  - 调整菜单项的内边距和行高，优化视觉效果
  - 确保在不同缩放级别下菜单显示正常
  - 提升右键菜单的易用性和美观度
- feat(节点菜单): 优化节点右键菜单功能并自动展开预览面板
  - 在 NodeContextMenu 中添加更多常用操作项，如复制、粘贴、删除等
  - 实现右键点击节点时自动展开右侧预览面板的功能
  - 优化菜单项的图标和文本显示
  - 提升节点操作的便捷性和用户体验
- refactor(RandomNumberNode): 优化客户端脚本逻辑并清理注释
  - 简化 RandomNumberNode 的客户端脚本，移除不必要的 DOM 操作
  - 使用事件委托处理按钮点击，提高性能
  - 清理冗余的注释和调试代码
  - 提升脚本的可读性和可维护性
- feat(GroupIOEdit): 为输入默认值添加建议选项支持
  - 在 GroupIOEdit 组件中为输入接口的默认值字段添加建议选项功能
  - 根据插槽类型提供常见的默认值建议，如布尔型的 true/false，数值型的 0/1 等
  - 优化默认值输入的交互体验，提高配置效率
- feat(节点预览面板): 添加配置项预览区域以显示节点配置详情
  - 在 NodePreviewPanel 组件中新增专门区域用于显示节点的配置项信息
  - 根据节点的 configSchema 动态渲染配置项及其当前值
  - 支持常见数据类型的预览，如字符串、数字、布尔值等
  - 提升节点信息展示的完整性和易用性
- docs:移动部分文档到 old 文件夹
  将部分已过时或已完成的计划文档移动到 DesignDocs/old 文件夹，以保持文档结构的整洁。
- fix(workflow-execution): 优化未连接接口输出的日志处理
  在工作流执行过程中，当遇到未连接的输出接口时，优化相关的日志提示信息，明确指出该输出未被使用，避免引起不必要的困惑。
- fix: 调整保存操作历史记录的顺序，使得保存图标 💾 能够正确显示在“保存工作流”这一历史记录项上。
  通过调整历史记录条目生成和保存操作的执行顺序，确保在记录“保存工作流”这一历史事件时，能够正确关联并显示保存图标 💾。
- fix: 修复分隔符转义字符处理逻辑
  修复了在使用特定分隔符（如反斜杠）时可能出现的转义字符处理不当的问题，确保分隔符能够被正确解析和使用。
- feat(workflow): 添加工作流输出接口映射和组输出预览功能
  - 在 WorkflowLifecycleCoordinator 中实现工作流最终输出接口的映射逻辑
  - 在 NodePreviewPanel 中添加对 GroupOutput 节点输出值的预览支持
  - 优化相关类型定义和数据处理流程
  - 提升工作流输出结果的可观察性和调试效率
- refactor(workflow): 优化工作流交互协调器的代码结构和文档
  - 将部分复杂的逻辑拆分为独立的辅助函数，提高可读性
  - 为核心方法和属性添加详细的 JSDoc 注释
  - 清理未使用的代码和导入
  - 提升 WorkflowInteractionCoordinator 模块的可维护性
- refactor(workflow): 重构工作流交互协调器以优化代码结构
  对 WorkflowInteractionCoordinator 进行重构，主要目标是优化其内部代码结构，提高模块化程度和可读性，为后续功能扩展和维护打下更好基础。
- feat: 优化注释
  优化了代码中的注释，使其更清晰、准确地描述相关逻辑和功能。
- refactor(workflow): 重构节点输入连接顺序更新逻辑
  重构了在多输入插槽中断开连接时更新剩余连接顺序的逻辑，确保操作的原子性和正确性。同时优化了相关代码，提高了可读性和可维护性。
- feat:清理注释
  清理了代码中不再需要或已过时的注释，保持代码库的整洁。
- refactor(workflow-execution): 重构工作流执行逻辑以处理客户端脚本更新
  重构了前端工作流执行相关逻辑，特别是处理节点客户端脚本（client-script）更新的部分。确保在脚本内容或 URL 发生变化时，能够正确地重新加载
  执行新的脚本，同时清理旧脚本可能产生的副作用。
- refactor(workflow-execution): 重构工作流执行逻辑以使用核心数据转换
  在前端工作流执行相关代码中，统一使用`transformCoreWorkflowToVueFlow`和`transformVueFlowToCoreWorkflow`进行核心工作流数据与 VueFlow 数据格式
  的转换，确保数据一致性和处理的标准化。
- refactor(workflow): 重构工作流执行逻辑至独立 composable
  将原先散布在 `workflowStore` 和其他组件中的前端工作流执行相关逻辑（如启动执行、处理执行状态更新、错误处理等）提取并重构到新的 `useWork
lowExecution.ts` composable 中。
  这一改动旨在：
  - **提高模块化**: 将执行相关的逻辑集中管理，降低 `workflowStore` 的复杂度。
  - **增强可维护性**: 独立的 composable 更易于理解、测试和修改。
  - **提升代码复用性**: 如果未来有其他地方需要触点工作流执行，可以复用此 composable。
    相关组件和 store 已更新以使用新的 `useWorkflowExecution`。
- refactor(Utilities/RandomNumberNode): 移除模式切换时的立即数值更新
  移除了 `RandomNumberNode` 在切换“生成模式” (mode) 时立即更新节点输出数值的逻辑。现在数值的更新将仅在执行节点或手动点击按钮（如果适用
  时发生，保持行为一致性。
- feat(node): 添加客户端脚本定义状态检查逻辑
  在 `useNodeClientScript` composable 中添加了对节点客户端脚本定义状态的检查逻辑。现在会比较新旧脚本的 URL 和内容摘要 (如果脚本是内联的
  ，以决定是否需要重新加载和执行脚本。这可以避免不必要的脚本重载，并确保在脚本定义实际发生变化时才进行更新。
- refactor(StatusBar): 调整工作流执行顺序以优化客户端脚本处理
  在状态栏触发工作流执行时，调整了操作顺序：先执行核心逻辑（如发送执行请求到后端），后处理前端相关的副作用（如更新节点客户端脚本）。这样
  可以确保即使客户端脚本执行出现问题，核心的执行流程也已启动。
- feat(节点脚本): 实现工作流执行时的客户端脚本钩子机制
  为节点添加了客户端脚本（client-script）支持。节点定义可以指定一个脚本 URL 或内联脚本内容。在工作流执行前，前端会加载并执行这些脚本。脚
  可以通过特定的 API 与节点实例交互，例如监听按钮点击事件并向后端发送消息。
  主要变更：
  - **类型定义**: `NodeDefinition` 新增 `clientScriptUrl` 和 `clientScriptContent` 字段。
  - **后端**: 添加 `/client-scripts/:namespace/:nodeType.js` 路由，用于提供节点脚本文件。
  - **前端**:
    - `useNodeClientScript.ts`:新的 composable，负责加载、执行和清理节点客户端脚本。
    - `BaseNode.vue`: 集成 `useNodeClientScript`，在节点挂载和更新时处理脚本。
    - `workflowStore.ts` (及相关协调器): 在工作流执行前触发所有节点的客户端脚本加载。
  - **示例节点**: `RandomNumberNode` 更新为使用客户端脚本处理按钮点击。

## 2025 年 5 月 28 日

- feat(RandomNumberNode): 增加随机数节点的增/减模式和后端执行逻辑
  - 为 RandomNumberNode 添加了 "increment" 和 "decrement" 模式。
  - 在后端实现了这些模式的执行逻辑，允许节点根据输入值进行累加或累减。
  - 更新了节点的前端输入组件，以反映新的模式选项。
- refactor(frontend): 优化工作流执行逻辑并清理调试日志
  - 优化了前端触发工作流执行的逻辑，确保状态更新的及时性和准确性。
  - 清理了在调试过程中添加的冗余 `console.log` 语句。
  - 提升了代码的整洁度和可维护性。
- feat(workflow): 添加节点多输入连接顺序支持并增强调试日志
  - 在核心工作流数据结构中为节点输入添加 `connectionOrder` 字段，用于记录多输入连接的顺序。
  - 更新了前端连接处理逻辑，以在建立和断开连接时维护此顺序。
  - 增强了画布、连接和工作流状态管理中的调试日志，方便追踪数据变化和问题排查。
- feat(预览面板): 增强预览面板功能并改进显示内容
  - 预览面板现在可以显示更丰富的节点信息，包括输入输出值、配置参数等。
  - 优化了数据显示格式，提高了可读性。
  - 修复了预览内容更新不及时的问题。
- docs: 添加节点或插槽显示规则说明
  在 `.roo/rules/rules.md` 文件中补充了关于节点或插槽显示名称的规则：优先使用 `displayName`，其次是 `id`。
- fix(websocket): 修复工作流执行时消息关联错误问题
  修复了在工作流执行过程中，前端通过 WebSocket 接收到的执行状态或结果消息可能与错误的节点或执行实例关联的问题。通过改进消息 ID 和上下文
  踪机制，确保消息能够准确地路由到对应的处理逻辑。
- fix(canvas): 修复单输入插槽连接替换逻辑
  修复了当新的连接指向一个已经有连接的单输入插槽时，旧连接未能正确断开和移除的问题。现在会先移除旧连接，再建立新连接，确保单输入插槽只
  一条进入的边。
- feat:更新注释
  更新了代码库中多个文件的注释，使其更准确地反映当前代码逻辑和功能。
- refactor(多输入连接): 重构多输入连接排序和断开逻辑以使用工作流快照
  - 将多输入连接的排序 (`updateNodeInputConnectionOrderAndRecord`) 和断开连接 (`unplugConnectionAndRecord`) 操作重构为使用工作流快照机制
    进行历史记录。
  - 这样可以确保操作的原子性，并简化了撤销/重做逻辑。
  - 移除了旧的基于单个操作记录历史的方式。
- feat:roorules
  添加了 `.roo/rules/rules.md` 文件，其中包含开发要求和项目说明。
- refactor(styles): 优化样式代码并添加新类型颜色定义
  - 重构了部分 CSS/Tailwind 类名，提高了可维护性。
  - 在主题配置中为新的数据流类型（如 `CODE`, `JSON`, `MARKDOWN` 等）添加了对应的颜色定义。
  - 确保了节点和连接线在不同主题下都能正确显示这些新类型的颜色。
- docs: 转移部分已实施的文档到 old 目录
  将 `DesignDocs` 目录下一些已经完成或大部分已实施的计划文档（例如关于节点组、历史记录、执行逻辑的早期规划）转移到 `DesignDocs/old` 目录
  ，以保持主文档区的整洁，使其主要包含当前和未来的设计规划。
- feat(ExecutionEngine): 添加子句柄解析功能并改进多输入处理
  - 在 `ExecutionEngine` 中添加了对子句柄 ID (e.g., `input_slot_name:0`) 的解析功能，以正确处理来自多输入插槽特定连接的数据。
  - 改进了节点执行时对多输入数组的处理逻辑，确保数据能够按照连接顺序正确传递和使用。
  - 更新了相关类型定义以支持子句柄。
- style(ui): 移除 JsonInlineViewer 的 font-family 以继承全局字体
  移除了 `JsonInlineViewer.vue` 组件中硬编码的 `font-family` 样式，使其能够继承应用的全局字体设置，保证了界面字体的一致性。
- refactor(BaseNode): 重构组件代码结构并优化导入组织
  - 将 `BaseNode.vue` 组件内部的逻辑按功能（如 Props 定义、状态管理、事件处理、生命周期钩子、辅助函数等）进行了分组和重新排序，提高了代码
    可读性。
  - 优化了导入语句的组织，将相关的导入组合在一起，并按字母顺序排列（如果适用）。
  - 移除了未使用的导入和变量。
- fix(侧边栏): 修复节点选择和预览面板的渲染问题
  - 修复了在某些情况下，点击侧边栏中的节点项时，画布中对应的节点未能正确高亮或滚动到视图的问题。
  - 修复了节点预览面板在显示复杂节点信息时可能出现的渲染延迟或布局错乱问题。
- fix(nodeStore): 改进节点定义查询逻辑以支持多种格式
  - 优化了 `nodeStore` 中获取节点定义的逻辑，使其能够更灵活地处理不同格式的节点标识符（例如，带命名空间的类型 vs. 不带命名空间的类型，
    者在旧版定义中可能存在的情况）。
  - 确保了即使节点类型的大小写或格式略有不同，也能尽可能正确地匹配到节点定义。
- refactor(useCanvasConnections): 清理未使用的代码和优化连接逻辑
  - 移除了 `useCanvasConnections.ts` composable 中一些未被使用的函数、变量或条件分支。
  - 优化了创建和验证连接的逻辑，简化了代码流程，提高了执行效率。
  - 增强了错误处理和日志记录，使其在连接失败时能提供更明确的反馈。
- refactor: 移除调试日志代码
  移除了在开发和调试过程中添加到多个文件中的 `console.log` 语句，以保持生产代码的整洁。

## 2025 年 5 月 27 日

- feat(节点连接): 添加多输入插槽连接顺序支持并优化连接处理逻辑
  - 为支持多输入的插槽实现了连接顺序的记录和管理。
  - 当多个连接指向同一个多输入插槽时，会根据连接建立的顺序或用户调整的顺序进行记录。
  - 后端执行节点时，可以根据此顺序来处理输入数据。
  - 优化了连接建立和断开时的处理逻辑，确保数据一致性。
  - 更新了 `MergeNode` 等相关节点以利用此功能。
- refactor(多输入连接): 移除未使用的参数并改进多输入槽值数组初始化逻辑
  - 在处理多输入连接的相关函数中，移除了一个未被使用的 `sourceNode` 参数。
  - 改进了当第一个连接到多输入插槽时，其对应的值数组 (e.g., `node.inputs.value[slotIndex]`) 的初始化逻辑，确保其被正确创建为一个包含单个
    素的数组。
- refactor(workflow): 实现多输入连接断开功能并重构相关逻辑
  - 实现了从多输入插槽断开单个连接的功能。当一条边从多输入插槽断开时，会正确更新节点的输入值数组和连接顺序。
  - 重构了 `useCanvasConnections` 和 `workflowStore` 中处理多输入连接的相关逻辑，使其更加健壮和易于维护。
  - 确保了历史记录能够正确记录和回放这些操作。
- refactor(workflow): 重构多输入边移动和重新连接逻辑
  - 重构了当拖动已连接到多输入插槽的边并将其重新连接到相同或其他插槽时的处理逻辑。
  - 确保在移动边时，旧的连接信息被正确清除，新的连接信息被正确建立。
  - 同时更新了相关的连接顺序和节点输入值。
- refactor(workflow): 同步边数据并重构多输入连接处理
  - 在 `workflowStore` 中添加了对 `syncEdgeChanges` 的调用，以确保在多输入连接相关的操作（如排序、断开）后，VueFlow 的边数据与核心工作流
    据保持同步。
  - 重构了 `useMultiInputConnectionActions` 中的部分逻辑，使其与 `workflowStore` 的交互更加清晰。
- fix: 添加调试日志以跟踪连接和更新后的边状态
  在 `useCanvasConnections.ts` 和 `workflowStore.ts` 中与边连接、更新相关的关键位置添加了详细的 `console.log` 输出，用于在开发过程中跟踪
  连接的建立、移除、更新过程，以及操作后 `edges` 数据的状态，帮助诊断多输入连接相关的问题。
- refactor(节点工具): 将 parseSubHandleId 提取为共享工具函数并优化多输入连接处理
  - 将原先在 `BaseNode.vue` 中的 `parseSubHandleId` 函数提取到了 `packages/utils/src/index.ts` (并重新导出到 `apps/frontend-vueflow/src/u
ils/nodeUtils.ts`)，使其成为一个可在项目中共享的工具函数。
  - 优化了 `useMultiInputConnectionActions.ts` 中处理多输入连接（特别是连接到特定子句柄）的逻辑，使用了新的共享工具函数。
- fix(canvas): 修复 CONVERTIBLE_ANY 类型连接功能并优化连接逻辑
  - 修复了当输入插槽类型为 `CONVERTIBLE_ANY` 时，无法正确建立连接的问题。现在这种类型的插槽可以接受来自任何其他类型的连接。
  - 优化了 `isValidConnection` 函数中的类型兼容性检查逻辑，使其更加准确和高效。
  - 更新了相关的调试日志，方便追踪连接验证过程。
- refactor(BaseNode): 移除调试用的 console.log 语句
  清除了 `BaseNode.vue` 组件中在开发和调试多输入插槽功能时添加的 `console.log` 语句。
- fix(connections): 修复多输入连接验证和重排逻辑
  - 修复了在验证到多输入插槽的连接时，可能错误地允许不兼容类型连接的问题。
  - 修复了在断开或重排多输入插槽的连接后，`inputConnectionOrders` 未能正确更新的问题。
  - 更新 handleConstants 中的视觉参数
  - 添加调试日志帮助追踪连接重排过程
- fix(canvas): 修复边重新连接时目标子句柄占用检查逻辑
  修复边重新连接时目标子句柄占用检查的问题，现在会正确处理正在更新的边重新连接到同一子句柄的情况。同时优化多输入连接的处理逻辑，确保边重
  排序时正确更新所有相关边的 targetHandle 和对应的 value 数组。
  主要修改：
  1. 在 isValidConnection 中添加 updatingEdgeId 参数，用于识别正在更新的边
  2. 改进目标子句柄占用检查逻辑，允许同一边的重新连接
  3. 在多输入连接操作中，确保边重新排序时同步更新所有相关边的 targetHandle
  4. 在多输入连接操作中，同步维护 inputs.value 数组的长度与连接数一致
- feat(前端): 优化拖拽交互并增强连接管理功能
  - 在 MergeNode 中调整输入字段顺序，将分隔符移至文本输入之前
  - 重构拖拽逻辑，使用特定 MIME 类型避免冲突，简化数据传输处理
  - 为 InlineConnectionSorter 添加断开连接按钮，改进连接管理体验
  - 优化拖拽动画和样式，提升用户交互视觉效果
- feat(多输入插槽): 添加内联连接排序组件和 vuedraggable 依赖
  实现多输入插槽的连接顺序管理功能，主要变更包括：
  1. 添加 vuedraggable 依赖用于实现拖拽排序
  2. 创建 InlineConnectionSorter 组件用于可视化调整连接顺序
  3. 在 BaseNode 中集成排序组件，根据条件显示
  4. 新增 workflowStore 方法处理连接顺序更新
  5. 优化 Canvas 连接监控逻辑，增加类型检查
  6. 重构交互协调器，将多输入处理逻辑提取到独立 composable
  7. 更新设计文档，描述新功能实现细节
     移除 MergeNode 中多余的 display_only 属性，简化 UI 交互
- feat(多输入插槽): 实现跑道式多子 Handle 交互与连接管理
  本次提交主要实现了多输入插槽的跑道式视觉呈现和交互逻辑改进：
  1. 在 BaseNode.vue 中重构多输入插槽渲染逻辑，使用多个子 Handle 实现视觉融合的跑道式交互区域
  2. 调整 handleConstants.ts 中的间距常量，优化视觉呈现
  3. 在 workflowStore.ts 中新增三个协调器函数，用于处理子 Handle 的连接断开和重连操作
  4. 更新 SortedMultiTargetEdge.vue 中的连接线位置计算逻辑，适配新的子 Handle 结构
  5. 添加新的 CSS 样式实现跑道式多输入插槽的视觉效果
  6. 优化 Canvas.vue 中的边类型注册方式
  7. 更新设计文档，详细说明多子 Handle 实现方案
     这些改进使得多输入插槽的交互更加精确，视觉上更接近 Blender 的风格，同时保持了操作的原子性和历史记录的完整性。
- feat: 添加多输入插槽交互精炼与原子化历史记录计划
- fix(ui): 调整多输入 Handle 的最小高度因子
- feat(节点连接): 实现多输入插槽的动态高度和连接顺序管理
  - 将多输入插槽的样式控制从 CSS 迁移到 JS 动态计算，实现 Blender 风格的跑道形 Handle
  - 新增 handleConstants.ts 集中管理连接线相关常量
  - 为多输入插槽添加连接顺序跟踪功能，确保边连接点位置正确
  - 移除 handleStyles.module.css 中冗余的 border-radius 定义，改由 JS 控制
  - 在 Canvas.vue 中注册 SortedMultiTargetEdge 自定义边类型
  - 更新 BaseNode.vue 中的动态高度计算逻辑，与 handleConstants 保持同步

## 2025 年 5 月 26 日

- feat(节点连接): 实现多输入插槽连接顺序管理和拖拽断开功能
  - 在 WorkflowStorageNode 接口中添加 inputConnectionOrders 属性用于存储输入连接顺序
  - 新增 updateNodeInputConnectionOrderAndRecord 方法管理连接顺序变更
  - 实现 SortedMultiTargetEdge 组件支持多输入插槽的连线排序显示
  - 添加 UnplugConnectionLine 组件支持从输入插槽拖拽断开连接的功能
  - 为多输入插槽添加动态高度调整样式
  - 修改 Canvas 组件配置以支持新的连接交互方式
  - 当前实现了将连线从输入插槽中拖拽拔出来，可以在画布中松开表示断开，也可以插入到新从插槽中。存在一些多次转移时失效的问题需要继续挖掘，
    持多输入的插槽样式还未完善。
    这些改动使得多输入插槽能够正确显示和管理多条连接的顺序（未完成），并支持通过拖拽方式断开连接或重新连接到其他插槽。
- docs: 添加多输入插槽增强计划的详细调查结果与实施计划
- feat(doc): 多输入插槽增强功能实现细节调整
- feat(multi-input-slot): 实现多输入插槽增强功能方案设计

## 2025 年 5 月 25 日

- fix(workflowTransformer): 修正节点输入输出类型属性名从 type 改为 dataFlowType
  将节点输入输出类型检查的属性名从`type`统一改为`dataFlowType`以保持代码一致性，避免潜在的属性名冲突问题。修改涉及 NodeGroup 和普通节点的输
  入输出类型检查逻辑。
- fix(vueflow): 修复接口更新后连接边消失的问题
  重构 useInterfaceWatcher 逻辑，改用细粒度节点数据更新方法替代全量 elements 替换。新增 updateNodeInternalData API 用于精确更新节点内部数
  据，避免因响应式时序问题导致新边丢失。
  移除调试日志和未使用的 Proxy 包装器，优化代码整洁性。

## 2025 年 5 月 24 日

- style: 优化侧边栏样式和主题调整逻辑
- feat(SideBar): 添加亮色主题支持
  在 SideBar 组件中添加了亮色主题的支持，根据 themeStore.isDark 状态动态调整背景色、文本色以及 hover 和 active 状态的样式，以提升用户体验和视觉一
  致性。
- refactor(components): 重构右侧预览面板的展开收起逻辑和样式
  优化了右侧预览面板的展开收起逻辑，使用 `isExpanded` 替代 `isVisible`，并增加了过渡动画。调整了拖拽逻辑，修复了拖拽时可能误触发展开收起
  问题。样式上增加了圆角和过渡效果，提升了用户体验。
- refactor(RightPreviewPanel): 调整预览面板布局并增加顶部拖拽功能
  将预览面板从 EditorView 中移出，使其成为 editor-container 的直接子节点，确保悬浮行为正确。在 RightPreviewPanel 中增加顶部拖拽功能，并优
  化了收起时的图标样式和交互逻辑。
- docs: 更新节点类型系统文档及类型定义文件
  更新了节点类型系统文档，详细描述了新版类型系统的核心概念、插槽定义及连接规则。同时，对 `node.ts` 文件中的类型定义进行了优化和注释补充，
  提升了代码的可读性和维护性。
- feat: 添加节点文件路径支持并优化客户端脚本加载
  - 在 NodeDefinition 中添加 filePath 字段，用于存储节点定义文件的绝对路径
  - 修改客户端脚本路由，支持基于节点命名空间和类型的相对路径加载
  - 更新前端客户端脚本加载逻辑，使用新的 API 路径格式
  - 扩展 ButtonClickPayload，增加工作流 ID、节点类型和显示名称等上下文信息
  - 在 WebSocket 处理程序中添加对 ButtonClickPayload 的日志记录
- style: 将节点操作图标修改为加号并调整样式

## 2025 年 5 月 23 日

- docs: 新增文件管理器系统设计方案文档
  添加了文件管理器系统的详细设计方案文档，涵盖了系统目标、核心概念、后端配置、服务接口、API 端点设计、前端交互、安全性以及未来扩展等内容。
  该文档为后续开发和维护提供了全面的指导。
- docs(architecture): 更新工作流执行计划并添加文件输出管理设计方案
  更新了 `workflow-execution-plan-v2.md` 文件，添加了对文件输出管理的详细设计，并引入了新的 `FileOutputService` 服务。同时，创建了 `file-
utput-management.md` 文件，详细描述了文件输出管理系统的设计目标、核心概念、配置项、服务接口、API 端点设计以及与执行引擎的集成。
- refactor: 移除 History DB 相关代码和设计文档
  移除 AI 擅自添加的 History DB 相关代码和设计文档，避免过度设计
- refactor(侧边栏): 暴露 setActiveTab 方法并优化侧边栏引用管理
  将 setActiveTab 方法暴露给父组件，以便在 WorkflowMenu 中直接调用。同时优化了 SidebarManager 的类型定义和引用管理，确保侧边栏功能的一致
  。
- refactor: 清理代码注释和格式化文件
  移除冗余注释，优化代码格式以提高可读性和维护性。主要修改包括删除不必要的注释、统一代码风格和调整缩进。
- fix(ui): 移除跳过特定目录的逻辑
- feat(Utilities): 移动实用工具到单独目录
- fix(ui): 调整 AboutView.vue 中 padding 值
- feat: 微调关于页的样式
- refactor(ui): 重构 AboutView.vue 增强视觉效果和交互体验

## 2025 年 5 月 22 日

- feat: 在多个视图页面中添加 OverlayScrollbars 组件以改善滚动体验
  为了提升用户体验，在 HomeView、CharacterCardView、ProjectListView 和 AboutView 页面中引入了 OverlayScrollbars 组件。该组件提供了更流畅
  滚动效果，并根据主题动态调整滚动条样式。此外，还统一了各页面的布局结构，确保在不同主题下的一致性。
- refactor(views): 优化代码格式和可读性，统一缩进和换行风格
- refactor(workflow): 统一配置项命名并增强调试日志
  将 `config` 字段统一为 `configValues`，并重构默认值、最小值和最大值的处理逻辑。同时，在 Canvas 和连接逻辑中添加详细的调试日志，便于排查
  连线问题。
- feat(ExecutionEngine): 实现节点绕过机制并生成伪输出
  在 ExecutionEngine 中新增节点绕过处理逻辑，支持'mute'模式和自定义的 passThrough 与 defaults 规则。当节点被绕过时，会根据配置生成伪输出，并通
  WebSocket 通知前端。同时，优化了输入验证和类型兼容性检查，确保工作流执行的稳定性和正确性。
- docs(architecture): 更新设计文档，补充预览机制与错误处理细节
  在 `floating-preview-editor-design.md` 和 `workflow-execution-plan-v2.md` 中新增了关于预览触发机制、状态持久化、错误处理策略以及视觉反
  的详细说明，确保设计文档的完整性和一致性。
- docs: 更新工作流执行计划文档内容
- docs(workflow-execution-plan-v2): 详细描述实时预览机制
- feat: 增加工作流执行系统设计方案 V2

## 2025 年 5 月 21 日

- refactor(node): 将整数类型从 INT 改为 INTEGER 并调整拖拽灵敏度
  将整数类型从旧的 INT 改为 INTEGER，以保持命名一致性。同时降低整数拖拽的默认灵敏度，提升用户体验。
- refactor(types): 移除 GroupSlotInfo 和 InputDefinition 中的 defaultValue 字段
  将 defaultValue 字段从 GroupSlotInfo 和 InputDefinition 接口中移除，统一通过 config 对象中的 default 属性来管理默认值，以简化代码结构和
  提高一致性。
- docs(memory-bank): 更新项目总结和进度日志
  更新了 `project-summary.md` 文件，添加了详细进度日志的链接，并整理了当前状态和主要里程碑。同时，将 `progress-log.md` 的内容归档至 `proj
ct-summary.md`，以简化日志管理。
- fix: 更新任务 4.8 状态及完成备注
- style: 侧边栏图标栏宽度调整
- feat(编辑器): 添加 vscode 搜索插件并优化编辑器样式
  - 引入@rigstech/codemirror-vscodesearch 插件，替换原有的搜索功能
  - 优化编辑器聚焦时的边框样式，保持 1px 宽度
  - 在 TabbedEditorHost 组件中新增标题截断功能，防止过长标题影响布局
- feat: 新增搜索功能并优化移动端 Tooltip 交互
  - 在 EditorContextMenu 中添加搜索功能
  - 优化 Tooltip 组件以支持移动端长按显示
  - 更新 Canvas 组件以启用拖拽和滚动缩放
  - 在 StatusBar 中显示当前项目名称并应用样式
- docs: 更新规则文档并追加新的更新日志
  更新了 `.roo/rules/rules.md` 文件，精简了项目进度记录，并将旧的详细更新日志迁移到新创建的 `DesignDocs/Updatelog.md` 文件中。
- fix(dev): 修复 Vite HMR 及 monorepo 文件监视问题
  - 主要修复了在 Bun 1.2.5 环境下，通过 `server.ts` 脚本启动时 Vite 开发服务器热更新 (HMR) 失效的问题。
  - 关键变更：
    - **`server.ts`**: 修改前端开发服务器的启动方式，从 `bun run dev` (间接调用 `package.json` 中的 `dev` 脚本) 改为直接 `spawn('bun', ['x', 'vite'], ...)`。这解决了 `apps/frontend-vueflow/src` 目录内文件 HMR 失效的核心问题。
    - **`apps/frontend-vueflow/vite.config.ts`**:
      - 调整 `server.watch.ignored` 中针对 `packages/types/src` 的路径模式，使用相对于 Vite 根目录 (`apps/frontend-vueflow`) 的相对路径否定模式，例如 `` `!${path.relative(viteConfigDir, typesSrcDir)}/**` ``。
      - 启用 `server.watch.usePolling: true` 以增强文件监视的稳定性。
      - 这些调整使得 `packages/types/src` 目录下的文件更改能够被 Vite 侦测到并触发页面重新加载。
    - **相关日志清理**: 移除了部分在调试过程中添加的、现已不再需要的 `console.log` 语句。
  - 经过这些修改，当通过 `.\start.bat dev` 启动应用时：
    - `apps/frontend-vueflow/src` 目录内文件的修改会触发正常的 HMR。
    - `packages/types/src` 目录内文件的修改会触发页面重新加载。
    - API 和 WebSocket 代理功能保持正常。
  - 注意：Vite 启动时可能仍会显示关于 `packages/types/src` 文件不在项目目录的警告，但实际测试表明文件监视和更新机制已按预期工作。
- Merge branch 'main' of https://github.com/ComfyTavern/comfytavern
- style(core): 调整输入提示文本的字体大小
- fix: 增加项目目录检查和预览服务器配置，删除默认项目文件
- feat: 增加系统代理检测与设置功能
- refactor(editor): 优化代码编辑器样式和功能，提升用户体验
  - 调整 RichCodeEditor 的代码格式，提高可读性
  - 改进 DockedEditorWrapper 的拖拽和最大化功能
  - 修复 JSON 格式处理逻辑，增强稳定性
  - 优化状态栏的交互和样式，提升视觉一致性

## 2025 年 5 月 20 日

- feat(editor): 为 RichCodeEditor 添加行号配置和代码折叠功能
  - 在 `EditorInstanceConfig` 接口中添加 `lineNumbers` 和 `foldGutter` 配置项，允许用户自定义是否显示行号和代码折叠功能。同时，在 `RichCodeEditor.vue` 中实现右键菜单，支持撤销、重做、剪切、复制、粘贴和全选等操作。
- docs: 更新决策日志，记录节点面板刷新功能优化过程
  - 详细记录了节点面板“重新加载节点”功能的刷新时机与可靠性优化过程，包括问题诊断、修复方案及最终决策。优化了前后端的交互逻辑，确保用户操作后能更可靠地看到节点更新。
- refactor(节点管理): 重构节点加载和重载逻辑，优化 WebSocket 通知处理
  - 重构节点加载逻辑，移除`createNodeRegisterer`，直接导出`definitions`数组
  - 在`NodeManager`中添加`clearNodes`方法，用于清空已注册节点
  - 添加`NODES_RELOADED` WebSocket 消息类型及处理逻辑
  - 优化`NodeLoader`的节点加载过程，增加缓存破坏机制
  - 在`nodeRoutes`中添加`/nodes/reload` API 端点，支持节点重载
  - 更新前端`NodePanel`组件，简化节点重载逻辑，移除冗余代码

## 2025 年 5 月 19 日

- refactor(projectService): 提取并复用文件读取、目录检查和冲突验证逻辑
  - 提取了 `_readAndValidateJsonFile`、`_ensureDirectoryExists` 和 `_checkFileConflict` 三个辅助函数，用于统一处理文件读取、目录创建和文件冲突检查的逻辑，减少了代码重复并提高了可维护性。
- refactor(backend): 重构 projectRoutes 将业务逻辑迁移至服务层
  - 本次提交主要对 `apps/backend/src/routes/projectRoutes.ts` 文件进行了重构，核心目标是提升代码的模块化、可读性和可维护性。
  - 主要重构点：
    1.  **业务逻辑与文件系统操作迁移至服务层:**
        - 将原先在路由处理函数中直接执行的文件系统操作（如读写项目元数据 `project.json`、管理工作流文件等）和核心业务逻辑（如 ID 生成、冲突检查、数据构建等）统一迁移到了 `apps/backend/src/services/projectService.ts`。
        - 路由层 (`projectRoutes.ts`) 现在更专注于 HTTP 请求的接收、参数校验、调用相应的服务层函数以及格式化响应。
    2.  **参数处理逻辑提取与统一:**
        - 针对路由中重复的 `projectId` 和 `workflowId` 参数解码（`decodeURIComponent`）和清理（`sanitizeProjectId`, `sanitizeWorkflowIdFromParam`）逻辑，已提取为可复用的辅助函数（例如，设想中的 `getSafeProjectIdOrErrorResponse` 和 `getSafeWorkflowIdOrErrorResponse` 的功能已内化到服务层或通过更简洁的方式在路由层处理）。
        - 这减少了代码冗余，并使得参数处理更加一致。
    3.  **错误处理结构优化:**
        - 通过将业务逻辑移至服务层，服务函数现在能够抛出更具体的自定义错误类型（如 `ProjectNotFoundError`, `WorkflowConflictError` 等，这些是在后续工作目录更改中进一步完善的，但此阶段的重构为此奠定了基础）。
        - 路由层可以更清晰地捕获这些特定错误，并据此设置恰当的 HTTP 状态码和返回更友好的错误信息。
    4.  **Zod Schema 验证的持续应用:**
        - 继续并推广了使用 Zod Schema ([`CreateProjectBodySchema`](apps/backend/src/routes/projectRoutes.ts:37:1), [`ProjectMetadataUpdateSchema`](apps/backend/src/routes/projectRoutes.ts:34:7), [`CreateWorkflowObjectSchema`](apps/backend/src/routes/projectRoutes.ts:8:3), [`UpdateWorkflowObjectSchema`](apps/backend/src/routes/projectRoutes.ts:9:3))对请求体进行验证，确保了 API 接口数据的健壮性。
  - 通过以上重构，`apps/backend/src/routes/projectRoutes.ts` 文件变得更加简洁、职责更分明，为后续的功能迭代和维护打下了坚实的基础。
- feat(project): 重构项目创建流程并增加输入验证
  - 修改 `createProject` 方法以接受包含项目名称的对象
  - 在 `useProjectManagement` 中添加项目名称的验证逻辑
  - 在 `ProjectListView.vue` 中引入 `promptAndCreateProject` 方法以提示用户输入项目名称
  - 在 `projectRoutes.ts` 中使用 Zod 验证创建项目的请求体，并增加详细的错误处理
- feat: 新增角色卡 API 路由并优化前端服务逻辑
  - 在 backend 中新增角色卡 API 路由，支持获取角色卡列表和图片
  - 优化前端 SillyTavernService，使用后端 API 获取角色卡数据
  - 调整类型定义，统一角色卡数据结构
- refactor(前端): 优化节点预览面板和连接验证逻辑
  - 在 NodePreviewPanel.vue 中将参数类型显示从 `type` 改为 `dataFlowType`
  - 在 useNodeGroupConnectionValidation.ts 中移除未使用的 `reason` 变量，简化代码逻辑
- fix: 更新 estree-walker 版本并调整相关依赖
- refactor: 优化前端和后端的构建及启动脚本
  - 更新了前端和后端的构建脚本，简化了构建流程并优化了启动命令。同时，排除了 .d.ts 文件的加载，并增加了日志输出以便调试。
- chore: 更新 package.json 中的依赖项
  - 将 typescript 版本从^5.0.0 更新为~5.8.0，并添加 npm-run-all2、vite、vue-tsc 和 vitest 到 devDependencies。同时，从 frontend-vueflow 的 package.json 中移除重复的依赖项，以保持依赖管理的一致性。
- build: 使用 bun exec 执行 build 脚本
  - 修改 package.json 中的 build 脚本，使用 bun exec 来执行 run-p 命令，以确保在 Bun 环境下正确运行
- chore: 更新依赖和脚本配置
  - 添加@elysiajs/cors 依赖以支持跨域请求
  - 修改前端开发服务器启动命令为使用 vite
  - 添加 build:frontend 脚本用于构建前端项目
- chore: 在启动脚本中添加依赖安装步骤
  - 在 start.bat 和 start.sh 中添加了依赖安装步骤，以确保在启动应用时自动检查和安装所需的依赖项。这有助于避免因缺少依赖而导致的运行错误。
- feat(editor): 添加暗黑模式支持并优化编辑器主题同步
  - 在 `RichCodeEditor` 和 `TabbedEditorHost` 组件中添加暗黑模式支持
  - 使用 `@uiw/codemirror-theme-vscode` 主题包实现主题切换
  - 优化编辑器与全局主题状态的同步逻辑
  - 移除未使用的常驻按钮相关代码，简化逻辑
- fix(editor): 修复可停靠编辑器标签页内容加载和 JSON 处理问题
  - 修复了可停靠编辑器面板在打开后标签页为空或内容未正确加载的问题，同时解决了编辑 JSON 内容时编辑器报错以及优化了标签页标题的显示。具体修改包括：
    1. 在 `useEditorState.ts` 中引入 `requestedContextToOpen` ref，并在 `EditorView.vue` 中 `watch` 此状态，确保上下文正确传递给 `DockedEditorWrapper.vue` 的 `openEditor` 方法。
    2. 在 `useWorkflowInteractionCoordinator.ts` 中，对 JSON 对象进行 `JSON.stringify` (传递给编辑器前) 和 `JSON.parse` (保存时) 处理。
    3. 在 `DockedEditorWrapper.vue` 中，优先使用从 `EditorOpeningContext` 传入的 `context.title` 作为标签页标题。

## 2025 年 5 月 18 日

- feat: 新增 JSON 内联查看器并改造代码输入组件
  - 新增 `JsonInlineViewer.vue` 组件，用于在节点内显示 JSON 数据的只读预览，并提供编辑按钮以打开可停靠编辑器。
  - 改造 `CodeInput.vue`，移除内部编辑器，改为预览和编辑按钮，简化节点内 UI。
  - 更新 `inputs/index.ts`，添加 `JSON` 和 `OBJECT` 类型的输入组件映射。
  - 在 `TestWidgetsNode.ts` 中新增 `markdown_input` 和 `javascript_code_input`，并调整 `json_input` 的类型为 `OBJECT`。
  - 更新 `MarkdownRenderer.vue`，集成 `highlight.js` 实现代码块语法高亮。
  - 在 `useEditorState.ts` 和 `useWorkflowInteractionCoordinator.ts` 中添加对可停靠编辑器的支持，优化节点输入控件的交互逻辑。
- feat(editor): 添加底部可停靠编辑器面板的空状态提示
  - 在 `TabbedEditorHost.vue` 和 `DockedEditorWrapper.vue` 中添加空状态提示，当没有活动的编辑标签页时，显示提示信息“没有活动的编辑标签页。请从节点输入处打开编辑器。”。同时，为避免样式冲突，为 `TabbedEditorHost.vue` 内部的 CSS 类名添加 `ct-` 前缀。
- feat(editor): 实现可停靠编辑器面板并集成到主视图
  - 将编辑器状态移至模块级单例，新增 `isDockedEditorVisible` 状态和 `toggleDockedEditor` 方法。在状态栏添加控制按钮，并在主视图中集成 `DockedEditorWrapper` 组件。相关组件逻辑和样式已适配，确保编辑器面板与画布布局协调。
- feat(编辑器): 实现可停靠编辑器面板及其核心组件
  - 新增 RichCodeEditor.vue 和 TabbedEditorHost.vue 组件，用于构建可停靠编辑器面板的基础功能。同时添加了 DockedEditorWrapper.vue 作为面板的 UI 管理器和调度器，支持单页和多标签编辑模式，并实现了数据保存和状态持久化功能。
- docs(architecture): 更新编辑器面板设计文档并删除旧文件
  - 将 `floating-text-preview-plan.md` 删除，并新增 `enhanced-editor-panel-design.md`，详细描述增强型编辑器面板的设计方案。同时更新 `floating-preview-editor-design.md`，引用新设计文档并调整相关内容。
- docs: 在规则文档中添加中文注释要求
  - 在开发要求文档中新增一条规则，强调注释也需要使用中文，以确保代码的可读性和一致性
- feat(EditorView): 添加右侧专用预览面板并集成到主视图
  - 在 `EditorView.vue` 中添加了 `RightPreviewPanel` 组件，用于显示预览内容。该面板支持展开/收起、拖拽调整宽度和高度，并通过 `useLocalStorage` 持久化布局状态。同时，优化了 `useDnd.ts` 中的拖拽逻辑，避免与面板调整大小的操作冲突。
- feat: 新增预览目标功能并优化代码编辑器
  - 在 `BaseWorkflowObjectSchema` 中添加 `previewTarget` 字段，用于标记预览目标
  - 在 `useWorkflowManager` 中添加 `setPreviewTarget` 和 `clearPreviewTarget` 方法管理预览状态
  - 在 `CodeInput.vue` 中集成 `@codemirror/lint` 和 `@codemirror/search`，增强代码编辑器功能
  - 在 `BaseNode.vue` 中实现 Alt+Click 事件处理，支持设置和清除预览目标
  - 在 `SlotContextMenu.vue` 中添加右键菜单项，支持设置和取消预览
  - 在 `useCanvasKeyboardShortcuts.ts` 中实现 Alt+Click 快捷键，支持节点输出插槽的循环预览
  - 更新 `handleStyles.module.css`，为预览目标添加视觉反馈样式
- refactor(节点插槽类型系统): 重构节点插槽类型系统，统一使用 DataFlowType 和 matchCategories
  - 本次重构将原有的 SocketType 替换为新的 DataFlowType，并引入 matchCategories 用于连接验证。主要修改包括：
    1. 在 types 包中定义新的 DataFlowType 和 matchCategories 枚举
    2. 更新所有节点定义中的 type 字段为 dataFlowType
    3. 为输入输出定义添加 matchCategories 字段
    4. 修改相关工具函数和组件以适配新的类型系统
    5. 更新前端组件以支持新的类型系统
    6. 修改文档和注释以反映新的类型系统
  - 重构后的类型系统更加清晰，便于扩展和维护，同时提高了类型检查的准确性。

## 2025 年 5 月 17 日

- 创建了 ROO 的记忆库
- docs: 更新节点插槽类型系统设计文档和重构计划
- docs(architecture): 添加新版节点插槽类型系统设计文档

## 2025 年 5 月 16 日

- refactor(前端): 优化历史记录面板的格式化显示

## 2025 年 5 月 7 日

- docs: 添加 MIT 许可证文档
- 提交
- 重构文档分类
- 清理内容
- 初始提交

------ 旧记录 ------

- 创建基本结构
- 添加 LiteGraph.js 的基本画布功能
- 从旧项目中迁移了一些节点过来
- 添加了自动节点加载模块
- 添加了右键菜单功能
- **计划重构为前后端分离的架构。**
- 制作了重构计划文档 `re重构和改进计划.md`
- 开始初始化，把原来的代码分离前后端按照计划进行重构。
- 已完成项目的基础结构创建，包括 apps 目录下的 frontend 和 backend 应用，以及 packages 目录下的 types 和 utils 共享包。前端应用使用 Vue3 + TypeScript 初始化，后端应用使用 Elysia 初始化。共享包已创建 package.json 和 src/index.ts 文件。
- 后端基础架构已经完成：
  实现了类型系统（@comfytavern/types）：
  定义了节点接口和类型
  支持多种输入类型（STRING, BOOLEAN, FLOAT, INT, IMAGE 等）
  实现了 WebSocket 消息类型
  完成了核心功能：
  节点管理器用于注册和管理节点
  HTTP API 用于获取节点定义
  WebSocket 接口用于节点执行
  图像处理工具支持
  实现了基础节点：
  APISettingsNode：处理 API 配置
  OpenAINode：实现 OpenAI 接口调用
- 更新了重构计划文档 `re重构和改进计划.md`的前端部分。
- 计划快速开发一个 `Chat` 组件，用于测试 AI 聊天功能，包括 AIchat 界面的历史消息显示，聊天输入框，发送、重试等功能按钮，并且把对应的界面连接到节点，由节点驱动数据更新。
- 重构了计划文档，现在是`docs/backend计划.md`和`docs/frontend计划.md`两部分，`re重构和改进计划.md`已经废弃为旧计划，因为旧代码已经吸收的差不多了，所以不再是重构而是向前迈进。
- 完成了前端项目的初始化，添加画布组件及状态管理。
- 修复了 TypeScript 路径别名配置问题。
- 修复画布尺寸问题，并添加了画布缩放、适应节点、重置缩放功能。
- 通过 css 样式隐藏了 LiteGraph.js 默认的右键菜单，并添加了自定义的右键菜单功能。
- 优化了 vue 模板样式，使 app 宽度不再受限。
- 将 LiteGraph 库改成 comfyorg/litegraph，这个版本有更好的 TypeScript 支持和一些新的功能，这个和原版的 API 不完全兼容，所以需要修改一些代码。
- 修了画布加载闪烁的问题，修复页面路由为空，添加了主页路由。
- 没修好高 DPI 屏幕下节点编辑器的缩放问题，待修复。
- 修好了节点编辑器的缩放问题。
- 修复了画布缩放、适应节点、重置缩放功能按钮，，现在它们能在新的画布上生效。
- 添加了 sever.ts 文件，用于启动服务器，并添加了启动脚本 start.bat 和 start.sh，添加 dve 参数用于启动开发服务器。
- 已修复项目启动问题：
  修正了 server.ts 中的开发/生产模式判断逻辑
  更新了 start.bat 和 start.sh 脚本以正确传递开发模式参数
  确保了前端和后端服务都能正确启动
  现在可以通过以下方式启动项目：
  开发模式：start.bat dev 或 start.sh dev
  生产模式：start.bat 或 start.sh
- 修复了前端请求后端跨域问题，现在可以正常请求后端接口。
- 添加了右键菜单添加节点的子菜单显示，可以从节点信息中自动生成节点菜单。
- 添加了配置文件，设置了前后端口号，使其不再硬编码。
- 已完成节点系统的改进，主要包括：
  类型系统增强：
  添加 zod 验证支持
  保持原有接口兼容性
  支持更丰富的输入选项
  依赖管理：
  根目录和 types 包添加 zod
  完善类型导出
  确保依赖关系正确
  节点实现：
  更新现有节点实现
  保持向后兼容
  为新节点提供基础
- 节点添加存在一些问题，渲染帧问题，节点样式问题，待修复。
- 优化画布渲染性能，减少了不必要的渲染，支持在没有变化和没有鼠标移动的情况下暂停渲染。
- 完成了画布组件的代码重构，主要改进：
  代码模块化：
  nodeDrawing.ts - 节点绘制逻辑
  nodeDefinition.ts - 节点定义和实现
  canvasUtils.ts - 画布工具函数
  Canvas.vue - 主组件逻辑
  修复了关键问题：
  修正了函数嵌套问题
  正确处理了 WebSocket 连接
  优化了初始化流程
  提升了代码质量：
  更好的代码组织和复用
  清晰的模块划分
  提高了可维护性
  修复了画布初始化顺序问题
  代码现在应该可以正常工作，画布和节点应该能够正确加载和显示。
- 不，并没有修好，不过已添加错误日志节流机制：
  设置了 5 秒的错误输出间隔
  对所有 WebSocket 相关的错误消息进行了节流处理
  保持错误提示的同时避免了控制台刷屏
  虽然 WebSocket 连接问题仍然存在，但现在的错误提示更加友好，不会影响开发体验。后续我们可以继续深入研究连接问题的根本原因。
- 主要是重构了主题系统，直接照搬了 comfyui 的主题配置，并添加相应的处理逻辑。（但是切换主题面板还没做），一些细节：
  核心改进:
  Store 分离与优化:
  创建 canvasStore.ts 专门管理画布 Canvas 相关的状态 (例如 Canvas 实例, 选中元素)。
  优化 graphStore.ts，使其更专注于图形 Graph 和节点 Node 的状态管理 (例如运行节点 ID, 节点错误信息, WebSocket 状态)。
  避免在节点类中重复创建 Store 实例，提升性能并保持 Store 的单例性。
  类型系统增强:
  修复了 colorUtil.ts, canvasStore.ts, Canvas.vue, nodeDefinition.ts 等文件中的 TypeScript 类型错误。
  添加了缺失的类型定义 (例如 LGraphNode 导入)。
  修复了类型不匹配问题，增强了代码的类型安全性。
  代码质量提升:
  清理了 Canvas.vue 中未使用的 watch, useColorPaletteService, useColorPaletteStore, useSettingStore 等导入，以及 canvasRef 变量的重复使用。
  优化了代码组织结构，使文件职责更清晰，代码更易于维护。
  主要文件变更:
  新增文件:
  apps/frontend/src/stores/canvasStore.ts: 画布 Canvas 状态管理 Store。
  apps/frontend/src/utils/colorUtil.ts: 颜色处理工具函数。
  apps/frontend/src/app.ts: 全局应用状态和节点绘制定制。
  修改文件:
  apps/frontend/src/components/graph/Canvas.vue: 画布组件，使用 canvasStore 管理画布状态，并修复类型错误。
  apps/frontend/src/components/graph/nodeDefinition.ts: 节点定义文件，优化 Store 使用方式，修复类型错误。
  apps/frontend/src/stores/graph.ts: 图形 Graph 状态管理 Store，添加缺失属性和方法，优化类型定义。
- 准备尝试修复 ws 连接问题。
- WebSocket 连接问题已成功解决。具体改进包括：
  修正了 WebSocket 初始化时机，确保在画布初始化前建立连接。
  正确实现了状态管理，包括连接状态监控和错误处理。
  优化了组件生命周期管理，包括资源清理。
- 接下来准备完善核心功能（第二阶段）
  实现 workspaceStore 和 uiStore。
  添加工作流操作（保存/加载、撤销/重做）。
  完善节点交互（属性编辑、节点分组）。
- 先把一些旧节点迁移了过来，迁移了`HistoryNode.ts`、`MergeHistoryNode`、`OpenAIChatNode`三个旧节点。
- 更新了`.clinerules`中的代码规范建议。
- 执行`docs\节点显示修复计划.md`失败
- 把右键菜单改成使用原生菜单
- 节点尺寸问题已修复。新添加的节点现在应该能正确计算和设置尺寸了，使用了原生的`computeSize`方法。
- 尝试像 comfyui 一样添加多行文本框组件，因为 litegraph.js 原生没有多行文本框组件，comfyui 是额外添加的多行文本框元素来实现的。
  参考文件：
  z 参考\ComfyUI_frontend\src\composables\widgets\useStringWidget.ts
  z 参考\ComfyUI_frontend\src\scripts\domWidget.ts
  z 参考\ComfyUI_frontend\src\scripts\widgets.ts
  z 参考\ComfyUI_frontend\src\stores\domWidgetStore.ts
  z 参考\ComfyUI_frontend\src\composables\element\useAbsolutePosition.ts
- 成功添加了多行文本框组件，并修复了部分样式问题。
- 正在调查组件间距过大问题，目前的线索是：

1. litegraph.js 原生的组件高度间隔设置较大，导致组件间距过大。
2. comfyui 自定义了负数的高度间隔来覆盖 litegraph.js 的默认间距，使其间距正常。
3. comfyui 使用了 beforeRegisterNodeDef 钩子来设置组件高度，而钩子是在核心扩展里，于是仿照 comfyui 做了扩展系统。

- [WIP]尝试重构，把画布组件中过多的功能转移到 app 中，顺便解决加载顺序导致的扩展钩子问题。（当前提交是存在问题的，无法运行，交给下次修复）
- 重构完了画布和 app 的职责，但是间距问题待修复。
- 修复多行文本框 y 轴偏移及 WebSocket 连接状态更新问题。
- 修复画布的渲染性能问题，优化了画布渲染逻辑。

---

### 前端分支计划

- 尝试使用 vueflow.js 作为画布引擎来解决 LiteGraph.js 的样式问题。详情参考`docs\frontend-vueflow计划.md`内容。
- 完成了 frontend-vueflow 项目的初始化和配置：
  使用 Vue 3 + TypeScript 创建了项目
  安装了必要的依赖：
  @vue-flow/core 及其插件
  @vueuse/core
  tailwindcss 及其依赖
  配置了构建和开发环境：
  设置了正确的路径别名
  配置了开发服务器代理
  配置了 Tailwind CSS
  创建了标准的项目结构：
  apps/frontend-vueflow/src/components/graph/
  apps/frontend-vueflow/src/stores/
  apps/frontend-vueflow/src/api/
  apps/frontend-vueflow/src/types/
  apps/frontend-vueflow/src/utils/
  优化了 TypeScript 配置：
  添加了必要的编译选项
  配置了正确的路径映射
  排除了不需要处理的大型文件夹
- 更新了启动脚本的配置，现在支持以下启动方式：
  默认启动（LiteGraph 前端）:
  Windows: start.bat
  Linux: ./start.sh
  开发模式（LiteGraph 前端）:
  Windows: start.bat dev
  Linux: ./start.sh dev
  Vue Flow 前端:
  Windows: start.bat vueflow
  Linux: ./start.sh vueflow
  Vue Flow 前端开发模式:
  Windows: start.bat dev vueflow
  Linux: ./start.sh dev vueflow
  修改内容包括：
  server.ts：添加了前端类型检测和选择逻辑
  start.bat：添加了 vueflow 参数支持
  start.sh：添加了相同的 vueflow 参数支持
  服务器会根据参数自动选择对应的前端项目目录（apps/frontend 或 apps/frontend-vueflow），并在启动时显示当前使用的前端类型。
- 添加了主页（占位）、编辑页（节点画布）
- 调整了布局，使用侧边 bar 来切换页面内容。
- 修复了 Tailwind CSS 配置问题。
- 修改了角色卡片样式，现在角色卡的样式更加现代化，并添加了测试用的卡片。
- 添加了颜色主题切换功能和暗色模式样式。
- 将 SillyTavern 相关内容从前端资产目录移动到独立的 library 目录，并独立出了加载逻辑。现在系统有了更清晰的结构和更好的可维护性。
- 添加视差效果和侧边栏折叠功能。
- 添加从 PNG 提取角色卡数据的功能，并修复了无图像的 json 角色卡加载问题。
- 抽取了角色卡数据处理函数减少了重复代码，优化角色卡组件样式和侧边栏逻辑。
- 添加在画布和节点的右键菜单功能。
- 添加了节点库侧边栏，支持列出、预览、添加和搜索节点。添加了从后端加载自定义节点的功能，初步添加了节点样式。
- 实现拖拽功能并优化节点添加体验。注意排除浏览器扩展和脚本的影响。
- 去掉了节点背后多余的矩形背景。
- 添加了以下内容：

* 后端测试节点 (TestWidgetsNode.ts):
  实现了包含所有标准输入类型的测试节点
  添加了合适的默认值和配置选项
  实现了简单的 execute 函数用于测试
* 前端输入组件:
  创建了 5 个基础输入组件，支持亮色/暗色模式
  实现了完整的类型定义和错误处理
  添加了合适的样式和交互效果
  创建了统一的组件注册和管理机制
* Canvas 集成:
  实现了动态组件渲染
  添加了输入值状态管理
  实现了连接状态检测和手动输入覆盖功能
  优化了节点参数部分的布局，使输入组件显示在插槽的下一行

- 将节点组件抽离成独立组件，使用更简洁的数据流转方式，优化状态管理。
- 修改 BaseNode.vue，通过添加透明的父元素来扩大侧边拖拽手柄的响应区域，同时保持了手柄的视觉宽度不变。修复了拖拽宽度不跟手的问题，现在会根据画布缩放正确计算宽度变化，移除了所有过渡动画，提升了拖拽的响应速度，消除了迟滞感。
- 为画布和节点添加暗色模式支持。
- 将插槽类型的显示方式从常驻改为悬停在插槽圆点上时显示为提示信息。将输出插槽的文本改成了右对齐。增加了插槽文本的高度，避免文本显示不全。
- 在输入组件的容器上添加了 @mousedown.stop，以防止在输入区域交互（如拖拽调整文本框大小或选择文本）时意外拖动整个节点。对齐了多行文本框的宽度，将单行的组件：单行输入、数值、开关、选项等改成能够和输入插槽在同一行显示，从而使界面更加紧凑。
- 新增 CodeInput 组件，使用 vue-codemirror 实现代码高亮和编辑功能，支持 JavaScript 和 JSON 语言，并添加了`CODE`类型用于启用代码编辑功能。优化部分样式。
- 将 Canvas.vue 中的节点连线逻辑拆分到 useCanvasConnections.ts Composable 中。Canvas.vue 现在使用此 Composable 来创建新的连接边。
- 修复了旧连线在建立新连接时未能正确移除的问题，添加了连线类型判断来拒绝不合法的连接。
- 修复了节点标题不显示的问题，优化了节点自动宽度计算方式。创建了全局的滚动条样式，优化节点组件的滚轮行为。
- 优化了输出槽之间的垂直间距，使其更加紧凑。
- 添加节点输入插槽的类型兼容规则，包括：
  基础兼容：
  相同类型之间兼容
  任何类型与 'any' 类型兼容
  数值类型转换：
  INT -> FLOAT（整数可以转为浮点数）
  转字符串：
  INT -> STRING（整数可以转为字符串）
  FLOAT -> STRING（浮点数可以转为字符串）
  BOOLEAN -> STRING（布尔值可以转为字符串）
  特殊文本类型：
  STRING -> CODE（字符串可以作为代码文本）
  STRING -> COMBO（字符串可以作为选项值）
- 实现多对一输入插槽功能：
  在后端类型定义 (packages/types/src/node.ts) 中添加了 multi: boolean 属性来标记输入是否支持多连接。
  创建了一个后端示例节点 MergeNode (apps/backend/src/nodes/MergeNode.ts)，演示了如何使用 multi: true。
  更新了前端连接逻辑 (useCanvasConnections.ts)，使其能够识别并正确处理 multi: true 的输入插槽，允许多个连接。
  更新了前端基础节点组件 (BaseNode.vue)，以正确显示多输入插槽（包括连接数提示）并保持其输入组件的可用性。
- 创建了新的 TextDisplay 组件，提供了一个专门的只读文本显示界面。
- 调整了节点样式，把输出插槽改成在输入的上方。
- 优化了多对一插槽的类型检查，支持在节点中定义支持的输入类型。
- 修复节点插槽的显示名称问题。现在输入和输出插槽会按 description (描述)-displayName (显示名称)-key (键名) 优先级顺序显示名称。修复了节点缩放时的错误操作代码导致的 vue 报错。
- 添加了节点组框架，等后续实现具体功能，目前仅仅是添加了三个空白的组件。
- 添加了在前端重载后端的功能，用于重载节点库中的自定义节点。
- 修复了节点库面板没有正确显示节点名称和描述的问题。
- 修改了所有节点，统一了 displayName 和 description 的使用方式。并且修复了前端的显示问题。
- 修改 NodePreviewPanel.vue，使其能够根据节点库侧边栏的宽度动态调整自身位置，确保它总是显示在侧边栏旁边，并能适应侧边栏宽度的变化（例如折叠）。
- 添加了 SidebarManager.vue 组件来管理侧边栏的显示和隐藏。
- 重构了前端 EditorView.vue 中的 createDefaultNodes 函数，使其不再硬编码节点信息，而是动态地从 nodeStore 获取 GroupInput 和 GroupOutput 的定义来创建默认节点。
- **重要更新** 添加了工作流保存功能，支持保存和加载工作流 json，支持侧边栏加载工作流。
- 集成 sanitize-filename 库，用于安全地处理包含多国语言字符的工作流名称，并统一了默认时间戳文件名的生成格式。支持导入导出工作流。
- 修复了保存工作流 url 转义的问题。
- 修复了节点 ID 问题，现在使用一个统一的 ID 生成器来生成 ID，确保节点不会错乱，并优化了节点显示支持显示 id。
- 修改 apps/frontend-vueflow/index.html 添加启动画面（splash screen）并在 apps/frontend-vueflow/src/App.vue 中添加逻辑以在应用挂载后隐藏它，解决了 Vue 页面首次加载或刷新时出现的闪白问题。同时，确保了启动画面的背景色与应用主题（亮/暗）一致。
- 添加按钮输入类型到前端节点，并创建了一个使用该按钮的 RandomNumberNode 示例节点。前端现在可以渲染按钮并发送点击事件到后端。后端已更新以识别此事件，但需要进一步实现具体的按钮点击处理逻辑。
- **重要更新** 添加了节点引擎部分实现（未完成）
- **重要更新**主要引入了两个核心功能：标签页系统 和 节点组功能，并进行了一些相关的改进和修复。

1. 标签页功能 (Tab Functionality):
   目的: 允许用户在编辑器界面同时打开和编辑多个工作流。
   实现:
   新增 TabBar.vue 组件用于显示和切换标签页。
   新增 tabStore.ts (Pinia store) 来管理标签页的状态（如当前活动标签、已打开标签列表）。
   修改 EditorView.vue 以集成标签页逻辑，使得画布操作（如添加节点、保存工作流）与当前活动的标签页相关联。
   修改 workflowStore.ts 以支持多标签页状态管理，每个标签页拥有独立的工作流数据（节点、连接、视口、保存状态等）。
   新增 default-workflow.json 文件，作为创建新标签页时的默认工作流模板。
2. 节点组功能 (Node Group Functionality):
   目的: 允许将一组节点封装成一个可复用的单元（节点组），提高工作流的模块化和复用性。
   实现:
   后端 (NodeGroupNode.ts):
   NodeGroupNode 现在支持两种模式：embedded (将组的定义内嵌在主工作流中) 和 referenced (引用一个独立的外部工作流作为组)。
   添加了根据模式加载或访问组定义的逻辑（嵌套执行逻辑待实现）。
   前端:
   新增 EmbeddedGroupSelectorInput.vue 和 ResourceSelectorInput.vue 输入组件，可能用于选择引用的工作流或配置嵌入式组。
   新增 useWorkflowGrouping.ts composable，用于处理节点组相关的逻辑（如创建、编辑、接口同步）。
   修改 BaseNode.vue 以适应节点组的显示和交互。
   修改 workflowStore.ts 以支持在工作流对象中存储 embeddedWorkflows（内嵌的组定义）。
   类型定义 (packages/types):
   在 WorkflowObject 中添加了 embeddedWorkflows 字段。
   新增 NodeGroupData 接口来描述节点组实例的数据结构（模式、ID、接口信息等）。
   新增 GroupInterfaceInfo 和 GroupSlotInfo 来定义节点组的外部输入/输出接口。
   在 NodeDefinition 中添加了 configSchema 和 configValues，为节点（包括节点组）提供更灵活的配置方式。
3. 其他改进和修复:
   键盘快捷键: 将画布的键盘快捷键处理逻辑（如 Ctrl+S 保存）提取到了 useCanvasKeyboardShortcuts.ts composable 中，并使其支持标签页。
   状态栏 (StatusBar.vue): 可能已更新以显示应用版本号或其他与新功能相关的信息。
   依赖管理: 添加了 uuid 库及其类型定义，用于生成唯一标识符（可能用于标签页 ID、节点组 ID 等）。
   构建配置 (vite.config.ts): 添加了在构建时读取根目录 package.json 中的版本号，并将其注入到应用中，方便显示版本信息。
   项目文档 (.clinerules): 更新了项目进度说明，记录了标签页和节点组功能的添加。

- 将 `workflowStore` 中的复杂逻辑拆分到多个专门的 Vue Composables 中，以提高代码的可维护性、可测试性和复用性。
- 将 `BaseNode` 组件进行了重构，将核心逻辑拆分到独立的 Vue Composables 中，以提高代码的可维护性和复用性。同时，引入了共享样式文件。调整了节点组件样式。
- 后端和类型定义已更新为使用 Zod 库进行数据验证，替换了之前使用的 Elysia `t` 函数和手动接口。这包括更新后端 workflow API 以使用 Zod 进行请求体验证。
- 在 `packages/types/src/schemas.ts` 中定义了 Zod Schema，并在 `packages/types/src/index.ts` 中导出，用于工作流对象 (`WorkflowObject`)、节点 (`WorkflowNode`)、边 (`WorkflowEdge`) 和视口 (`WorkflowViewport`) 的类型验证。
- 前端 VueFlow 项目得到了增强，包括：
  - 添加 `useEdgeStyles.ts`，可能用于处理边样式。
  - 修改 `useWorkflowData.ts` 和 `workflowStore.ts`，改进工作流数据的处理和状态管理。
  - 修改 `EditorView.vue` 和 `App.vue`，可能是为了集成新的 composable 或调整应用结构。
  - 修改 `default-workflow.json`，更新默认工作流配置。
- 移除了一些过时的文档文件 (`docs/feature-NodeGroup...md`, `docs/input-components-plan.md`, `docs/re...md`)。
- `package.json` 中的版本号已更新。
- 新增带建议输入和按钮组件及文档说明，修复了一些组件样式和交互问题。
- 实现了节点的客户端逻辑执行功能，允许部分节点行为（如按钮点击）在前端处理。后端新增了 `/client-scripts/*` 路由来提供这些脚本，`NodeDefinition` 类型增加了 `clientScriptUrl` 字段，前端 `BaseNode` 会动态加载并执行这些脚本。`RandomNumberNode` 作为示例进行了更新。
- 优化了前端状态管理，将 `nodeStore` 重构为标准 `Pinia` 写法，并在多个组件和 `Composable` 中使用 `storeToRefs` 确保响应性。
- 允许节点定义指定首选宽度 (width 字段)，并修复了一些前端 UI 和后端 API 的小问题。
- 添加了节点插槽右键菜单来删除单个插槽的连线。调整了 tooltip 样式，现在不随画布缩放而变化。
- **重要更新** 重构了项目结构，引入"工程"（Project）的概念，将资源按照工程划分来保存。
- 通过在 BaseNode.vue 中使用 computed 属性来记忆化（缓存）传递给动态子组件（如 ResourceSelectorInput）的 props 对象，确保了 props 引用的稳定性，从而避免了不必要的子组件更新，打破了导致递归错误的更新循环。
- 更新了 workflowStore.ts、EditorView.vue 和 GroupIOEdit.vue 文件。现在，在工作流接口变化、加载/创建工作流、切换标签页以及侧边栏接收到接口更新后，都会触发一个自定义事件 force-save-interface-changes。GroupIOEdit.vue 组件会监听此事件并执行其 saveChanges 方法，这模拟了手动点击“应用接口更改”按钮的效果，旨在解决潜在的 Vue 响应式更新问题，并确保接口状态在这些关键操作后保持一致和同步。
- **核心重构：节点组与工作流接口** - 借鉴 Blender 几何节点，重构了节点组功能。引入中心化的工作流接口定义（存储在 `WorkflowObject` 的 `interfaceInputs`/`Outputs` 中），侧边栏 (`GroupIOEdit.vue`) 成为接口管理的唯一入口。`GroupInput`/`Output` 节点现在是视觉“幻影”节点，其插槽动态反映中心接口。更新了类型系统，引入 `WILDCARD` 和 `CONVERTIBLE_ANY` 处理动态插槽。重构了连接逻辑 (`useCanvasConnections.ts`) 和插槽计算 (`useGroupIOSlots.ts`)，修复了相关 bug (详见 `docs/fix-groupio-initial-slot-disappearance.md`)。添加了接口同步机制 (`useGroupInterfaceSync.ts` 和相关事件如 `force-save-interface-changes`) 以确保状态一致性。
- **多项目管理与视图重构**: 引入了多项目管理功能，允许用户创建、加载和管理多个工作流项目。新增了项目列表视图 (`ProjectListView`) 和角色卡视图 (`CharacterCardView`)。主页 (`HomeView`) 被重构为概览页面，展示项目和角色卡预览。更新了相关状态管理 (`projectStore`, `tabStore`, `workflowStore`) 和路由以支持新架构。调整了侧边栏导航，移除了旧的工具栏。
- **后端 index.ts 重构**：将节点 API、全局工作流 API、项目 API 和 WebSocket 处理逻辑分别拆分到了 routes/nodeRoutes.ts、routes/workflowRoutes.ts、routes/projectRoutes.ts 和 websocket/handler.ts 模块中。将工作流和项目目录的路径配置集中到了 config.ts 文件。将项目相关的辅助函数提取到了 services/projectService.ts 文件。index.ts 文件现在更加简洁，主要负责初始化、中间件应用和模块挂载。整体代码结构更加清晰，易于维护。
- **URL 加载与状态重构**: 通过 URL 加载工作流，重构核心状态管理 (`workflowStore`)，添加项目元数据更新接口，优化前端视图 (`HomeView`, `EditorView`) 和路由。
- **workflowStore 重构**: 将庞大的 `workflowStore` 拆分为多个职责单一的 Composables (`useWorkflowState`, `useWorkflowCoreLogic`, `useWorkflowViewManagement`, `useWorkflowInterfaceManagement` 等)，将共享类型移至 `types/workflowTypes.ts`，更新了相关 Composables。
- **核心状态管理重构与插件系统规划**: 再次重构 `workflowStore`，引入 `useWorkflowManager` 集中管理核心状态、历史记录和应用逻辑，解决先前拆分导致的同步问题；新增插件系统设计文档，规划了基于 `plugin.json` 的扩展架构；优化了部分 UI 组件（如 `BooleanToggle`）并支持动态输入组件注册；更新和整理了相关文档。
- 修复了历史记录和状态管理相关 bug，修复了快捷键。增加了历史记录侧边面板，允许跳转记录、撤销/重做操作。
- 通过重构 WebSocket 连接管理，将其改为全局单例模式，并解耦节点按钮点击事件的处理，修复了在撤销/重做操作时因节点重建导致大量 WebSocket 连接断开和重连的问题。现在点击历史记录项不再触发异常的 WebSocket 活动。
- 重构了节点操作（添加、移动）与历史记录逻辑，将其集中到 `workflowStore` 中，并优化了节点添加时的定位逻辑；增强了画布和核心状态管理的调试日志。
- 将 `apps/frontend-vueflow/src/views/EditorView.vue` 中的逻辑重构到多个独立的 composable 文件中：`useRouteHandler.ts`, `useCanvasInteraction.ts`, `useTabManagement.ts`, `useInterfaceWatcher.ts`, `useKeyboardShortcuts.ts`, 和 `useEditorState.ts`。这使得 `EditorView.vue` 组件更加简洁，专注于视图渲染和协调，提高了代码的可维护性和可读性。
- 对 apps/frontend-vueflow/src/composables 目录下的模块进行了分组（Canvas、Node、Group、Workflow、Editor），提高可读性。
- **状态与历史重构**: 引入交互与生命周期协调器 (`WorkflowInteractionCoordinator`, `WorkflowLifecycleCoordinator`) 重构 `workflowStore`，统一处理画布交互、生命周期和历史记录；添加 Markdown 支持 (`MarkdownRenderer`) 和相关依赖；改进组 IO 管理 (`useGroupIOActions`, `useGroupIOState`)；优化保存流程 (`promptAndSaveWorkflow`) 和侧边栏交互 (`Tooltip`)。
- 增强工作流组功能(creationMethod, referencedWorkflows), 重构历史记录为结构化对象, 添加节点组件状态存储。
- **状态与历史重构 - 其二**: 引入交互与生命周期协调器，重构历史记录为结构化对象，优化输入组件交互与历史记录触发，添加节点组件状态存储。
- **前端执行准备**: 完善了前端触发工作流执行、处理后端状态/错误消息、可视化节点状态/错误以及处理按钮点击交互的核心功能，为对接后端执行引擎奠定基础。
- **节点交互与样式优化**: 强制更新节点以响应 IO 顺序变化；重构 Handle 样式，支持主题和多类型；增强输入定义（默认值、范围）；修复历史记录中移除保存点时的索引 Bug；新增后端驱动预览方案文档。
- **历史记录重构**: 将历史记录从字符串标签重构为结构化的 `HistoryEntry` 对象，更新相关类型、工具和前端模块。
- **节点配置与组引用重构**: 重构了节点配置更新 (`useWorkflowInteractionCoordinator`) 和节点组引用更新 (`useWorkflowGrouping`) 的逻辑，确保与结构化历史记录 (`HistoryEntry`) 和状态管理 (`setElements`) 正确集成，修复了接口同步、边移除及输入组件更新触发等相关问题。
- **工作流重命名与 NodeGroup 修复**: 实现工作流重命名功能（前后端）；修复 NodeGroup 加载 `referencedWorkflowId` 和过滤 `CONVERTIBLE_ANY` 插槽的 Bug；更新历史记录文档，新增执行计划文档。
- 更新了节点类型文档。
- 更新了浮动文本预览窗口计划并优化后端驱动预览功能文档。添加了节点自环检查，防止节点输出连接到自身的输入上。
- **工作流数据重构:** 重构工作流数据结构，引入 WorkflowStorage* 和 Execution* 类型，优化存储（仅存差异值、Nano ID），统一默认值处理 (getEffectiveDefaultValue)，分离存储与执行关注点，更新相关类型、工具库、前后端适配（执行逻辑暂缓）。版本升至 0.0.5。
