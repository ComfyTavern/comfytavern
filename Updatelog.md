# 更新记录

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
支持多种输入类型（STRING, BOOLEAN, FLOAT, INT, IMAGE等）
实现了WebSocket消息类型
完成了核心功能：
节点管理器用于注册和管理节点
HTTP API用于获取节点定义
WebSocket接口用于节点执行
图像处理工具支持
实现了基础节点：
APISettingsNode：处理API配置
OpenAINode：实现OpenAI接口调用

- 更新了重构计划文档 `re重构和改进计划.md`的前端部分。
- 计划快速开发一个 `Chat` 组件，用于测试 AI 聊天功能，包括AIchat界面的历史消息显示，聊天输入框，发送、重试等功能按钮，并且把对应的界面连接到节点，由节点驱动数据更新。

- 重构了计划文档，现在是`docs/backend计划.md`和`docs/frontend计划.md`两部分，`re重构和改进计划.md`已经废弃为旧计划，因为旧代码已经吸收的差不多了，所以不再是重构而是向前迈进。

- 完成了前端项目的初始化，添加画布组件及状态管理。
- 修复了 TypeScript 路径别名配置问题。
- 修复画布尺寸问题，并添加了画布缩放、适应节点、重置缩放功能。
- 通过css样式隐藏了LiteGraph.js默认的右键菜单，并添加了自定义的右键菜单功能。
- 优化了vue模板样式，使app宽度不再受限。

- 将LiteGraph库改成comfyorg/litegraph，这个版本有更好的TypeScript支持和一些新的功能，这个和原版的API不完全兼容，所以需要修改一些代码。
- 修了画布加载闪烁的问题，修复页面路由为空，添加了主页路由。
- 没修好高DPI屏幕下节点编辑器的缩放问题，待修复。
- 修好了节点编辑器的缩放问题。
- 修复了画布缩放、适应节点、重置缩放功能按钮，，现在它们能在新的画布上生效。

- 添加了sever.ts文件，用于启动服务器，并添加了启动脚本start.bat和start.sh，添加dve参数用于启动开发服务器。
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
添加zod验证支持
保持原有接口兼容性
支持更丰富的输入选项
依赖管理：
根目录和types包添加zod
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
设置了5秒的错误输出间隔
对所有WebSocket相关的错误消息进行了节流处理
保持错误提示的同时避免了控制台刷屏
虽然WebSocket连接问题仍然存在，但现在的错误提示更加友好，不会影响开发体验。后续我们可以继续深入研究连接问题的根本原因。

- 主要是重构了主题系统，直接照搬了comfyui的主题配置，并添加相应的处理逻辑。（但是切换主题面板还没做），一些细节：
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

- 准备尝试修复ws连接问题。
- WebSocket 连接问题已成功解决。具体改进包括：
修正了 WebSocket 初始化时机，确保在画布初始化前建立连接。
正确实现了状态管理，包括连接状态监控和错误处理。
优化了组件生命周期管理，包括资源清理。

- 接下来准备完善核心功能（第二阶段）
实现workspaceStore和uiStore。
添加工作流操作（保存/加载、撤销/重做）。
完善节点交互（属性编辑、节点分组）。

- 先把一些旧节点迁移了过来，迁移了`HistoryNode.ts`、`MergeHistoryNode`、`OpenAIChatNode`三个旧节点。
- 更新了`.clinerules`中的代码规范建议。
- 执行`docs\节点显示修复计划.md`失败
- 把右键菜单改成使用原生菜单
- 节点尺寸问题已修复。新添加的节点现在应该能正确计算和设置尺寸了，使用了原生的`computeSize`方法。
- 尝试像comfyui一样添加多行文本框组件，因为litegraph.js原生没有多行文本框组件，comfyui是额外添加的多行文本框元素来实现的。
参考文件：
z参考\ComfyUI_frontend\src\composables\widgets\useStringWidget.ts
z参考\ComfyUI_frontend\src\scripts\domWidget.ts
z参考\ComfyUI_frontend\src\scripts\widgets.ts
z参考\ComfyUI_frontend\src\stores\domWidgetStore.ts
z参考\ComfyUI_frontend\src\composables\element\useAbsolutePosition.ts
- 成功添加了多行文本框组件，并修复了部分样式问题。
- 正在调查组件间距过大问题，目前的线索是：
1. litegraph.js原生的组件高度间隔设置较大，导致组件间距过大。
2. comfyui自定义了负数的高度间隔来覆盖litegraph.js的默认间距，使其间距正常。
3. comfyui使用了beforeRegisterNodeDef钩子来设置组件高度，而钩子是在核心扩展里，于是仿照comfyui做了扩展系统。
- [WIP]尝试重构，把画布组件中过多的功能转移到app中，顺便解决加载顺序导致的扩展钩子问题。（当前提交是存在问题的，无法运行，交给下次修复）
- 重构完了画布和app的职责，但是间距问题待修复。
- 修复多行文本框y轴偏移及WebSocket连接状态更新问题。
- 修复画布的渲染性能问题，优化了画布渲染逻辑。


---

### 前端分支计划

- 尝试使用vueflow.js作为画布引擎来解决LiteGraph.js的样式问题。详情参考`docs\frontend-vueflow计划.md`内容。
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

默认启动（LiteGraph前端）:
Windows: start.bat
Linux: ./start.sh
开发模式（LiteGraph前端）:
Windows: start.bat dev
Linux: ./start.sh dev
Vue Flow前端:
Windows: start.bat vueflow
Linux: ./start.sh vueflow
Vue Flow前端开发模式:
Windows: start.bat dev vueflow
Linux: ./start.sh dev vueflow
修改内容包括：
server.ts：添加了前端类型检测和选择逻辑
start.bat：添加了vueflow参数支持
start.sh：添加了相同的vueflow参数支持
服务器会根据参数自动选择对应的前端项目目录（apps/frontend 或 apps/frontend-vueflow），并在启动时显示当前使用的前端类型。

- 添加了主页（占位）、编辑页（节点画布）
- 调整了布局，使用侧边bar来切换页面内容。
- 修复了Tailwind CSS配置问题。
- 修改了角色卡片样式，现在角色卡的样式更加现代化，并添加了测试用的卡片。
- 添加了颜色主题切换功能和暗色模式样式。
- 将 SillyTavern 相关内容从前端资产目录移动到独立的 library 目录，并独立出了加载逻辑。现在系统有了更清晰的结构和更好的可维护性。
- 添加视差效果和侧边栏折叠功能。
- 添加从PNG提取角色卡数据的功能，并修复了无图像的json角色卡加载问题。
- 抽取了角色卡数据处理函数减少了重复代码，优化角色卡组件样式和侧边栏逻辑。
- 添加在画布和节点的右键菜单功能。
- 添加了节点库侧边栏，支持列出、预览、添加和搜索节点。添加了从后端加载自定义节点的功能，初步添加了节点样式。
- 实现拖拽功能并优化节点添加体验。注意排除浏览器扩展和脚本的影响。
- 去掉了节点背后多余的矩形背景。

- 添加了以下内容：
* 后端测试节点 (TestWidgetsNode.ts):
实现了包含所有标准输入类型的测试节点
添加了合适的默认值和配置选项
实现了简单的execute函数用于测试
* 前端输入组件:
创建了5个基础输入组件，支持亮色/暗色模式
实现了完整的类型定义和错误处理
添加了合适的样式和交互效果
创建了统一的组件注册和管理机制
* Canvas集成:
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

- 创建了新的TextDisplay组件，提供了一个专门的只读文本显示界面。
- 调整了节点样式，把输出插槽改成在输入的上方。
- 优化了多对一插槽的类型检查，支持在节点中定义支持的输入类型。
- 修复节点插槽的显示名称问题。现在输入和输出插槽会按 description (描述)-displayName (显示名称)-key (键名) 优先级顺序显示名称。修复了节点缩放时的错误操作代码导致的vue报错。
- 添加了节点组框架，等后续实现具体功能，目前仅仅是添加了三个空白的组件。
- 添加了在前端重载后端的功能，用于重载节点库中的自定义节点。
- 修复了节点库面板没有正确显示节点名称和描述的问题。
- 修改了所有节点，统一了 displayName 和 description 的使用方式。并且修复了前端的显示问题。
- 修改 NodePreviewPanel.vue，使其能够根据节点库侧边栏的宽度动态调整自身位置，确保它总是显示在侧边栏旁边，并能适应侧边栏宽度的变化（例如折叠）。
- 添加了 SidebarManager.vue 组件来管理侧边栏的显示和隐藏。
- 重构了前端 EditorView.vue 中的 createDefaultNodes 函数，使其不再硬编码节点信息，而是动态地从 nodeStore 获取 GroupInput 和 GroupOutput 的定义来创建默认节点。

- **重要更新** 添加了工作流保存功能，支持保存和加载工作流json，支持侧边栏加载工作流。
- 集成 sanitize-filename 库，用于安全地处理包含多国语言字符的工作流名称，并统一了默认时间戳文件名的生成格式。支持导入导出工作流。
- 修复了保存工作流url转义的问题。
- 修复了节点ID问题，现在使用一个统一的ID生成器来生成ID，确保节点不会错乱，并优化了节点显示支持显示id。
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
- 添加了节点插槽右键菜单来删除单个插槽的连线。调整了tooltip样式，现在不随画布缩放而变化。

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