# 更新记录

## 2025 年 7 月 10 日

- docs: 添加集成创作环境设计草案
  - 集成创作环境 (Integrated Creation Environment, ICE) 设计草案（BETA）详细描述了集成创作环境的愿景、核心目标、架构与界面布局、核心工作流程、创作助手 Agent 的能力与知识来源，以及技术实现细节。
  - 愿景与核心目标：描述了 ICE 的核心愿景和目标，包括降低创作门槛、提升开发效率、统一开发流程、确保技术一致性、促进迭代优化。
  - 交互范式：介绍了对话驱动开发 (Chat-Driven Development) 的概念及其在 ICE 中的应用。
  - 三栏式布局：定义了 ICE 的三栏式布局，包括智能对话面板、文件与代码编辑区、实时预览面板的功能定位和核心特性。
  - 核心工作流程：展示了从用户需求表达到功能完整的应用面板生成的全过程，并分析了关键交互点。
  - 创作助手 Agent：详细描述了创作助手 Agent 的扩展能力和知识来源，包括意图识别、全栈代码生成、文件系统工具调用。
  - 技术实现细节：描述了后端文件服务的设计、`iframe` 沙箱与通信机制、以及实时同步机制的具体实现。
  - 结论与后续步骤：总结了 ICE 的核心价值，并提出了后续开发步骤和潜在挑战的解决思路。

## 2025 年 7 月 1 日

- feat(panel): 实现面板文件系统 API 及相关功能
  - 在架构文档中添加面板数据存储路径规范
  - 实现 FileManagerService 的 stat 方法用于获取文件元数据
  - 定义 PanelFile 类型和 PanelApiHost 接口
  - 实现前端面板 API 宿主文件系统相关方法
  - 添加后端面板文件系统路由处理逻辑
- docs: 将许可证从 MIT 更改为 AGPLv3 并添加双重授权说明
  - 更新 README.md 和 LICENSE 文件，将项目许可证从 MIT 更改为 GNU AGPLv3。同时添加了双重授权模式的详细说明，包括开源 AGPLv3 许可证的适用范围和商业许可证的获取方式。
- feat(panel): 增强日志面板功能并添加时间戳
  - 为日志条目添加时间戳记录
  - 改进日志面板 UI，添加清空日志和复制功能
  - 实现日志自动滚动到底部
  - 优化日志显示格式和时间戳格式化
- feat(panel): 添加主题同步功能到面板 API 宿主
  - 添加主题同步功能，当主题变化时自动更新面板。废弃旧的 getSettings 方法，改用专用消息类型推送主题和语言设置。引入 themeStore 来管理主题状态，并添加 sendThemeToPanel 函数处理主题更新逻辑。

## 2025 年 6 月 30 日

- docs(architecture): 更新架构文档并新增统一应用模板架构方案
  - 完善场景架构文档中关联面板的字段注释
  - 在统一文件资产管理文档中新增 templates 目录结构
  - 更新项目架构文档中的面板定义和默认场景/面板字段
  - 新增统一应用模板架构方案文档，详细说明项目模板系统设计
- Merge branch 'main' of https://github.com/ComfyTavern/comfytavern
- docs: 更新 llm-adapter-architecture-plan.md 以增强 key_selection_strategy 的描述
  - 当 `api_key` 是数组时，详细说明了 `key_selection_strategy` 的各种策略及其用途，并添加了新的 `least-used` 和 `lowest-latency` 策略。
  - `key_selection_strategy` 字段现在支持 `round-robin`、`random`、`least-used`、`lowest-latency` 和 `scoring` 策略。
  - 添加了 `scoring_config` 字段以允许用户定义评分权重，从而根据自己的偏好定制 Key 的选择行为。
  - 将 `RetryHandler` 中选择 Key 的逻辑描述为策略化，说明 `RetryHandler` 会根据 `key_selection_strategy` 字段实例化一个对应的 Key 选择策略，并调用该策略的 `selectKey()` 方法来获取具体的 API Key。这一步将决策逻辑与执行完全解耦。
- style(components): 为输入组件统一添加 node-input 类名
  - 为所有输入组件（SelectInput、TextAreaInput、StringInput、NumberInput）添加 node-input 类名，并更新基础样式以排除这些组件
- fix(workflow): 修复工作流执行时输入值处理逻辑
  - 确保正确处理外部覆盖输入并保持 GroupSlotInfo 结构完整。当提供覆盖输入时，更新对应接口定义的 config.default 值，而不是简单合并对象。同时添加对未匹配接口定义的警告日志。
- fix(workflow): 修复工作流执行时输入参数默认值处理问题
  - 从接口定义中提取默认输入值并用覆盖输入合并，确保执行时使用处理过的干净输入键值对
- fix(workflow): 修复保存模式下 outputInterfaceMappings 未构建的问题
  - 在 WorkflowInvocationService 中修复了保存模式下 outputInterfaceMappings 未构建的问题
  - 重构 usePanelApiHost 中的状态监听，从监听多个状态改为仅监听 workflowStatus
  - 当状态变为 COMPLETE 或 ERROR 时再从 store 获取最新完整状态
- refactor(services): 将 WorkflowInvocationService 和 ApiAdapterManager 转换为 composable 函数
  - 重构 WorkflowInvocationService 和 ApiAdapterManager 为 composable 函数，提升代码复用性和可维护性
  - 优化 usePanelApiHost 中的状态监听逻辑，减少不必要的重复计算
- refactor(panel): 重构面板 API 宿主逻辑和类型定义
  - 移除 InvocationRequestSchema 中的 alias 字段，简化调用模式验证
  - 将 usePanelApiHost 改为响应式实现，自动处理 projectId 和 panelId 变化
  - 优化脚本注入方式，使用更可靠的消息传递机制
  - 在 PanelContainer 中简化 API 宿主初始化逻辑

## 2025 年 6 月 29 日

- refactor(icons): 移除本地图标组件并迁移至 heroicons
  - 删除所有本地图标组件文件，替换为从@heroicons/vue 导入的图标
  - 更新相关组件中的图标引用以使用 heroicons
  - 在文档中更新图标使用规范
- refactor(frontend): 移除 DaisyUI 依赖并重构按钮样式为 Tailwind 原子类
  - 更新文档说明禁止使用 DaisyUI 并解释原因
  - 将 AvatarEditorModal 中的按钮样式从 DaisyUI 类替换为 Tailwind 原子类
  - 重构 SettingItemRow 的 avatar 控件，添加编辑图标悬停效果
  - 移除遗留的 DaisyUI 相关样式代码
- feat(文件管理): 添加直接写入 JSON 文件的 API 接口
  - 在文件管理 API 中添加 writeJsonFile 方法，简化 JSON 文件的写入操作
  - 后端新增/write-json 接口处理 JSON 内容写入
  - 前端面板存储改用新 API 写入 panel.json 文件
- style(frontend): 调整面板设置页面的样式和文案
  - 将"面板的版本号"修改为"应用面板的版本号"以更准确描述
  - 统一按钮悬停效果为 primary/30 颜色
  - 移除主体内容区多余的背景色
  - 调整保存按钮的禁用状态样式
- style(ui): 统一表单输入框背景色为背景表面色
  - 修改 PanelGeneralSettings 组件中所有输入框的背景色，从 background-input 变为 background-surface 以保持 UI 一致性
  - 同时在 base.css 中添加主题化表单控件样式，确保所有表单元素使用统一的设计规范
- feat(面板设置): 新增面板设置视图及组件
  - 实现面板设置的完整功能，包括：
    1. 添加通用设置、工作流绑定和内容管理三个标签页
    2. 创建 PanelGeneralSettings 组件处理面板基本信息配置
    3. 开发 PanelWorkflowBinder 组件实现工作流绑定管理
    4. 添加 PanelContentManager 组件占位内容管理功能
    5. 完善保存和返回功能
  - 重构面板设置视图结构，提升用户体验和可维护性
- docs(CT 项目说明): 移除本地化(i18n)相关规则内容
  - 本地化规则已迁移至专门文档，此处不再重复维护
- feat(WorkflowBinder): 添加返回按钮并优化代码格式
  - 在 WorkflowBinder 组件中添加返回按钮功能，允许用户返回上一页
  - 同时调整代码格式以提高可读性，包括长属性换行和缩进优化
- docs(架构): 简化面板工作流绑定规范说明
  - 移除冗余的 displayName 和 isDefault 字段，明确 workflowId 作为唯一关联方式的说明
- feat(workflow-binder): 重构工作流绑定界面并添加 API 代码生成功能
  - 使用 CollapsibleSection 组件重构界面布局，提升用户体验
  - 移除不必要的 alias 和 description 字段，简化绑定数据结构
  - 添加 API 调用代码生成和复制功能
  - 优化工作流 IO 详情展示为可折叠面板
  - 新增 IconChevronDown 和 IconCopy 图标组件
  - 调整 PanelSettingsView 布局以适应新设计
- style(FrameNode): 为框架节点添加阴影效果以增强视觉层次
- docs: 更新项目文档中的格式和本地化规范
  - 统一文档中的引号格式为双引号
  - 修复空格和标点符号的格式问题
  - 明确 i18n 规范要求优先使用中文
  - 更新本地化规则，强调必须使用$t 函数和中文基准
- feat(i18n): 改进国际化扫描脚本并添加扩展语言支持
  - 重构 i18n 扫描脚本，支持处理内置和扩展语言包
  - 新增扩展语言目录(locales-extensions)用于用户自定义语言包
  - 更新.gitignore 忽略扩展语言目录中的临时文件
  - 添加 README.md 说明扩展语言包的使用方法
  - 更新文档说明新的语言包处理流程
- chore: 删除脚本产生的临时本地化文件
  - 移除 scripts/merged_locales 目录下的本地化文件，这些文件不再需要通过 git 同步。同时更新 .gitignore 文件以忽略 scripts/merged_locales 目录。
- feat(本地化): 为历史面板添加状态翻译键并优化状态显示逻辑
  - 添加了状态相关的翻译键(statusCurrent/statusPast/statusFuture)到各语言文件
  - 优化 HistoryPanel 组件中状态显示逻辑，直接获取翻译文本而非键名
- style(FrameNode): 隐藏不需要的节点调整控制点以简化界面
  - 只保留右、下和右下角的控制点，移除其他方向的调整控制点，使界面更加简洁
- style(FrameNode): 更新节点样式和调整手柄交互区域
  - 将背景色和边框颜色更新为使用 CSS 变量
  - 调整边框圆角从 12px 减少到 6px
  - 为节点调整手柄添加样式覆盖，包括角落手柄和边缘手柄
  - 扩大边缘手柄的交互热区，提升用户体验
- feat(节点分组): 实现节点分组功能并完善相关交互
  - 添加节点分组功能，包括父节点字段支持、拖拽交互处理和状态管理
  - 在类型定义和序列化逻辑中添加 parentNode 字段支持
  - 实现节点拖拽时的父子关系变更检测和位置计算
  - 新增 updateNodeParentAndRecord 方法处理分组变更
  - 优化拖拽事件处理逻辑，区分普通移动和分组变更
- feat(ui): 新增分组框节点支持并优化节点管理
  - 在 NodeDefinition 接口中添加 isUiNode 标志以区分纯 UI 节点
  - 实现 FrameNode 组件，支持调整大小和重命名
  - 修改工作流转换逻辑以保留 UI 节点用于布局持久化
  - 添加 @vue-flow/node-resizer 依赖支持节点调整
  - 扩展工作流交互协调器以支持分组框操作
  - 更新节点存储逻辑自动合并 FrameNode 定义
  - 添加相关 CSS 样式确保分组框显示在背景层

## 2025 年 6 月 28 日

- refactor(workflow): 集中管理工作流状态判断逻辑
  - 将分散在各处的 isPersisted 状态判断逻辑统一到 workflowManager 中
  - 新增 isCurrentWorkflowNew 和 isWorkflowNew 方法供组件调用
- feat(workflow): 实现工作流持久化状态管理和 ID 一致性
  - 引入 isPersisted 状态标记工作流是否已保存至后端
  - 使用持久化 UUID 作为工作流 ID 确保前后端一致性
  - 重构工作流创建、更新和查找逻辑以支持新机制
  - 优化 listWorkflows 和 getWorkflow 等后端服务接口
- docs(architecture): 更新统一架构文档中的格式和内容细节
  - 规范 markdown 列表格式，使用统一符号
  - 细化共享空间目录结构，区分版本控制策略
  - 为面板定义添加 source 字段说明
  - 补充交互模板的详细说明和使用场景
  - 优化文档结构和措辞，提升可读性
- feat(数学运算节点): 为数学运算节点添加详细的结果描述
  - 为每个数学运算模式的结果输出添加描述性文本，明确说明计算结果的含义，提升用户体验
- feat(数学): 添加矩阵运算节点支持
  - 新增 MatrixOperationNode 实现矩阵加减乘、转置、求逆和行列式计算功能
  - 添加 mathjs 依赖并更新相关文档和类型定义
- docs(node-types): 更新 ComboOption 的说明以明确其用途
  - 明确 ComboOption 仅用于标记仅支持下拉选择而不支持自定义输入的值，与默认行为进行区分
- refactor(MathOperationNode): 将实例方法改为静态方法以提升可维护性
  - 修改执行映射中的方法引用，从实例方法改为静态方法，使代码更清晰且减少不必要的实例绑定
- feat(节点处理器): 为数学运算节点添加可搜索配置选项
- feat(数学运算节点): 添加多种数学运算功能并实现结果钳制
  - 新增对数、三角函数、比较运算等 25 种数学运算模式
  - 使用执行映射表优化分发逻辑
  - 添加结果钳制功能可将输出限制在 0-1 范围
  - 统一输入输出定义格式提升可维护性
- fix(ui): 替换 console.log 为 console.debug
  - 将 SelectInput.vue 文件中调试信息的输出方式从 `console.log` 更改为 `console.debug`，以符合更好的调试信息控制策略。
- refactor(输入组件): 统一建议选择处理逻辑并支持搜索功能
  - 修改输入组件处理建议选择的方式，从直接传递值改为传递选项对象
  - 为下拉建议组件添加搜索功能并统一选项格式处理
- feat(节点配置): 统一建议选项格式为对象并更新相关文档
  - 将节点配置中的建议选项从字符串/数字数组统一改为{value, label}对象格式，增强可读性和灵活性
  - 更新所有相关节点实现和文档示例，确保前后端类型定义一致
  - 修复 SelectInput 组件对建议选项的解析逻辑，支持多种输入格式
  - 优化 BaseNode 组件对 GroupInput/GroupOutput 节点的插槽处理
- feat(节点): 实现多模式节点功能并添加数学运算节点
  - 新增多模式节点支持，允许节点根据配置切换不同操作模式，每种模式可定义不同的输入/输出和执行逻辑。添加数学运算节点作为示例实现，支持加、减、乘、除、幂和平方根六种运算模式。
  - 在类型定义中扩展节点接口，支持多模式配置
  - 新增 useNodeModeSlots composable 处理模式切换逻辑
  - 修改执行引擎以支持多模式节点的输入/输出动态切换
  - 实现数学运算节点展示多模式功能
  - 添加节点模式切换的历史记录支持
- feat(面板): 添加共享模板面板支持并重构面板发现逻辑
  - 新增模板目录支持，添加示例聊天面板模板
  - 扩展文件管理器服务以支持模板路径解析
  - 重构面板发现逻辑，支持同时扫描用户和共享模板目录
  - 在面板定义中添加来源标识并在前端显示内置标记
  - 更新类型定义以包含面板来源字段
- fix: WebSocket URL 动态获取并更新代理配置
  - WebSocket URL 现在会在 `_connect` 方法内部通过 `getWebSocketUrl()` 函数动态获取，不再硬编码。
  - 更新了 `vite.config.ts` 文件中的代理配置，使其从配置文件中动态读取后端端口，并将 `/api` 和 `/ws` 的代理目标更新为从配置文件中获取的地址。
- refactor(frontend): 替换 DaisyUI 按钮为原子类并更新样式指南
  - 将 PanelListView 中的 DaisyUI 按钮组件替换为直接使用 Tailwind CSS 原子类
  - 更新前端样式指南，明确采用原子类优先策略并移除 DaisyUI 相关内容

## 2025 年 6 月 27 日

- feat(国际化): 添加测试面板的 DaisyUI 组件展示及多语言支持
  - 在测试面板视图中新增 DaisyUI 组件展示区，包含按钮、警告框、徽章和卡片组件
  - 为所有 UI 组件添加多语言支持，更新中、英、日、俄及文言文翻译
  - 在本地化模板和合并文件中添加新的翻译键
  - 更新国际化扫描脚本，改进语言文件对比报告
  - 在样式指南文档中添加测试面板实践范例说明
- refactor(theme): 重构主题系统以简化 DaisyUI 集成
  - 使用标准 light/dark 主题替代自定义主题名称
  - 通过 CSS 变量覆盖实现 DaisyUI 主题动态化
  - 添加品牌组件类(btn-brand-primary 等)统一 UI 样式
  - 更新文档说明新的样式使用规范
  - 在测试页面添加 DaisyUI 组件展示区
- feat(theme): 添加 DaisyUI 派生颜色变量并完善主题配置
- feat(WorkflowBinder): 添加工作流输入输出接口显示功能
  - 在 WorkflowBinder 组件中新增工作流输入输出接口的展示区域，包括接口名称、数据类型和可视化标识。同时添加相关数据处理逻辑和样式，提升工作流绑定的可视化效果。
- feat(icons): 添加常用图标组件并更新相关视图样式
  - 新增 5 个常用 SVG 图标组件(Spinner, Add, Open, Delete, Settings)
  - 更新 PanelListView 和 WorkflowBinder 组件样式，使用新图标
  - 优化按钮和卡片交互样式，统一视觉风格
- refactor(views): 将视图文件根据其功能和所属布局（全局、项目、设置）分别归类到 `views/home`、`views/project` 和 `views/settings` 目录中。
  - 更新了 `router/index.ts` 中的所有视图组件导入路径，以匹配新的目录结构。
- feat(面板): 添加面板工作流绑定配置功能
  - 实现面板工作流绑定管理界面，支持通过别名调用工作流
  - 重构面板 API 调用逻辑以支持别名模式
  - 添加面板设置页面路由和组件
  - 优化面板列表 UI 并添加配置入口
  - 更新类型定义以支持工作流绑定配置

## 2025 年 6 月 26 日

- chore(适配器): 添加 API 适配器管理界面的前端脚手架
  - 为 API 适配器功能搭建了基础的前端框架，目前阶段**不包含**实际的后端调用与转换逻辑。
  - 已完成部分：
    1. 在 `packages/types` 中定义了 `ApiAdapter` 的核心数据结构。
    2. 创建了适配器管理界面 (`ApiAdapterSettings.vue`) 和编辑器模态框 (`ApiAdapterEditor.vue`) 的基本组件。
    3. 在项目仪表盘中添加了适配器管理的入口 (`ApiAdaptersView.vue`) 及相应路由。
  - **注意**: 当前仅为 UI 实现，核心的适配器执行、请求转换等后端功能尚未开发。
- docs(api): 更新前端 API 文档以反映 invoke 接口变更
  - 将 executeWorkflow 重命名为 invoke 并更新相关类型定义
  - 统一执行流程描述，明确 WorkflowInvocationService 的作用
  - 更新 panel-api-specification 中的接口规范
- refactor(workflow): 重构工作流调用逻辑并引入统一服务
  - 将工作流调用逻辑从 workflowStore 解耦，创建新的 WorkflowInvocationService 作为统一入口
  - 实现面板调用的实时预览功能，支持从编辑器或已保存工作流执行
  - 更新 usePanelApiHost 以适配新服务并优化事件订阅机制
  - 添加设计文档说明重构计划和架构设计
- fix(workflow): 修复前端预览输出映射支持
  - 添加 outputInterfaceMappings 参数以支持前端预览功能，移除不再使用的 groupPreviewData 计算属性
- fix(websocket): 改进执行清理逻辑防止重复处理
  - 添加延迟清理机制和待处理任务跟踪，防止执行 ID 被重复处理
  - 取消已存在的清理任务当执行 ID 被重用
  - 立即清理旧映射当设置新的发起执行
- feat(workflow): 添加预览目标字段并优化执行逻辑
  - 在 WorkflowStorageObjectSchema 中添加 previewTarget 可选字段
  - 优化 transformStorageToExecutionPayload 以支持 interfaceInputs/Outputs
  - 在 useWorkflowExecution 中正确处理接口输入输出
  - 为 ExecutionEngine 添加非流式节点的处理逻辑
  - 更新文档中的引号格式和架构概念说明
  - 移除调试日志输出

## 2025 年 6 月 25 日

- refactor(llm): 将单条消息输出改为消息数组格式以支持聊天历史

  - 修改 GenericLlmRequestNode 的消息输出格式，从单条消息对象改为包含单条消息的数组
  - 更新 ExecutionEngine 的上游节点就绪条件检查，增加对 Promise 输出的支持

- feat(i18n): 添加缺失节点相关翻译和 UI 控件显示配置

  - docs: 更新自定义 UI 语言文档中的脚本命令
  - refactor: 优化模型预设数据结构避免 i18n 扫描误判
  - build: 添加语言文件拷贝脚本

- feat(workflow): 添加缺失节点处理逻辑和 UI 显示

  - 在 WorkflowNodeDataSchema 中添加 isMissing 和 originalNodeData 字段
  - 实现缺失节点的转换逻辑，保留原始数据和连接信息
  - 添加缺失节点的 UI 显示，包括警告图标和详细提示
  - 添加中英文翻译支持
  - 为缺失节点添加特殊样式

- feat(workflow): 使用 Zod schema 验证工作流数据

  - refactor(types): 将 WorkflowStorageObject 重构为 Zod schema
  - refactor(utils): 使用 Zod 验证工作流转换逻辑
  - refactor(frontend): 替换手动类型适配为 Zod 验证
  - feat(backend): 新增 WorkflowManager 服务处理工作流加载和验证
  - 确保工作流数据在存储、加载和转换过程中的类型安全，替换原有的手动类型适配和断言，统一使用 Zod schema 进行验证和解析

- feat(websocket): 实现场景订阅机制和状态管理服务

  - 新增 WorldStateService 提供场景状态原子性读写功能
  - 在 WebSocketManager 中添加场景订阅管理逻辑，包括订阅/取消订阅和场景事件发布

- docs: 添加 Agent 配置与运行时交互指南文档
  - 新增 ComfyTavern 平台的 Agent 配置与运行时交互指南文档，详细说明 Agent 静态定义(agent_profile.json)和运行时实例化(scene.json)的配置方法，并阐述以 GM Agent 为核心的运行时交互模型

## 2025 年 6 月 24 日

- docs(architecture): 添加聊天历史树图编辑与分支管理设计文档

  - 添加详细的设计文档，描述聊天历史树状结构的愿景、核心概念、用户工作流、关键操作和数据结构设计

- docs(architecture): 更新架构文档以反映 Agent 与用户交互的新模型

  - 将"交互式执行流"概念更新为"多轮次审议循环驱动"的交互模型
  - 统一 PanelInteractionToolNode 为 RequestUserInteractionTool
  - 修改前端交互协调流程，强调用户输入触发新一轮 Agent 审议
  - 更新 Tauri 集成部分以对齐新的交互模型

- docs(架构设计): 添加通过 Tauri 扩展实现原生能力集成的设计文档

- docs(architecture): 在接口规范中添加描述字段

  - 为 WorkflowInterface 和 SlotDefinition 接口添加可选描述字段，以提供更详细的文档说明

- docs(架构): 新增面板 API 规范和阶段 0 实施方案文档
  - 添加面板 API 规范文档，定义统一接口和通信机制
  - 添加阶段 0 实施方案文档，包含 WorldStateService 和 WebSocketManager 扩展实现

## 2025 年 6 月 23 日

- fix(ui): 增加工作流删除确认对话

  - 在处理工作流删除功能时，增加了确认对话框以防止误操作。具体实现如下：
  - 在 `handleDelete` 函数中，首先查找要删除的工作流对象。如果未找到，则输出错误信息并显示错误对话框。
  - 使用 `dialogService.showConfirm` 显示确认对话框，对话框内容从国际化文件中获取，包括标题、消息、确认按钮和取消按钮的文本。
  - 如果用户确认删除，则调用 `workflowStore.deleteWorkflow` 执行删除操作。
  - 更新了国际化文件 `en-US.json` 和 `zh-CN.json`，增加了删除确认对话框和未找到工作流的错误提示信息：
  - 在 `workflowPanel` 中增加了 `confirmDelete` 对象，包含确认对话框的标题、消息、确认按钮和取消按钮的文本。
  - 在 `errors` 中新增了 `deleteNotFound` 错误提示信息。

- fix(文件工具): 处理 Windows 路径中的非 ASCII 字符解码问题

  - 在 Windows 平台上，当路径包含非 ASCII 字符（如中文）时，URL.pathname 返回的路径需要进行解码。修改 getProjectRootDir 函数，对所有路径进行 decodeURIComponent 处理。
  - fix(数据库检查): 增加对空数据库文件的检测和处理
  - 当数据库文件存在但为空时，删除该文件并重新执行数据库设置流程，避免使用无效的数据库文件。

- refactor(类型系统): 将流式特性从 DataFlowType 解耦为独立 isStream 字段

  - 重构类型系统，移除 DataFlowType.STREAM 类型，改为使用独立的 isStream 布尔字段标记流式插槽。同时更新相关节点定义、文档和执行引擎逻辑以适配新设计。
  - 主要变更包括：
  - 移除 DataFlowType.STREAM 枚举值
  - 在 SlotDefinitionBase 中新增 isStream 可选字段
  - 更新所有使用 STREAM 类型的节点定义
  - 修改执行引擎的流处理逻辑
  - 更新相关文档说明流式特性的新实现方式

- fix: 修正 useWorkflowManager 中的 mockLoadWorkflowFunc 参数

  - 在 useWorkflowManager 中，mockLoadWorkflowFunc 函数的参数进行了调整，移除了 \_pId 参数，并将其位置与 wfId 参数进行了交换。这不会影响函数的功能，但需要确保调用该函数时传递的参数顺序正确。
  - fix: 修正 bun.lock 中 postcss 版本不一致的问题
  - 在 bun.lock 文件中，postcss 的版本号在不同依赖路径下存在不一致的情况。已经将所有引用的 postcss 版本统一为 8.5.6，以避免潜在的冲突和问题。
  - refactor: 移除 workflow-preparer 中未使用的导入
  - 在 workflow-preparer 文件中，移除了未使用的 InputDefinition 和 OutputDefinition 导入，使代码更加简洁和易读。
  - feat: 添加 ensureProjectReady 中的配置检查和合并功能
  - 在 ensureProjectReady 函数中，添加了对配置文件的检查和合并功能。通过引入 checkAndMergeConfigs 函数，确保在项目准备阶段能够正确处理配置文件的合并和一致性检查。

- docs: 重构 README 以提升可读性和信息密度

  - 精简项目描述，突出核心价值主张
  - 重新组织核心特性章节，采用更清晰的三支柱结构
  - 优化路线图表述，聚焦关键里程碑
  - 简化安装和使用指南，移除冗余步骤
  - 统一格式和排版，提升整体可读性

- docs(架构): 添加统一应用面板与 Agent 实施计划文档

  - 添加详细的技术实施计划文档，描述 ComfyTavern 平台统一应用面板与 Agent 的架构设计和分阶段实现方案

- docs(architecture): 更新统一架构文档中的工作流准备说明

  - 修改文档以更清晰地描述同构工作流准备的实现原则，强调共享包的作用和行为一致性

- docs(architecture): 添加统一架构总览文档

  - 添加 ComfyTavern 平台统一架构总览文档，阐明核心概念关系和设计原则

- docs(architecture): 移动项目改造计划文档至旧目录并更新内容

  - 将原架构目录下的项目改造计划文档移至 old 目录，并更新文档内容为最新版本 v3

- feat(workflow): 实现工作流工具同构化重构
  - 将工作流扁平化和转换逻辑从前端迁移至共享包，支持前后端复用
  - 添加 waitForVueFlowInstance 函数处理异步实例获取
  - 重构 workflowFlattener 作为适配层调用核心工具
  - 更新相关组件以适配新的工具函数

## 2025 年 6 月 22 日

- fix(workflow): 修复另存为后标签页和工作流状态不同步问题

  - 更新标签页和工作流存储状态以反映另存为操作后的新工作流数据，避免状态不一致

- feat(project): 实现项目导航架构重构和状态持久化

  - 重构项目导航架构，引入新的项目布局容器和仪表盘视图
  - 添加 pinia-plugin-persistedstate 实现状态持久化
  - 重构路由结构，将编辑器作为子路由
  - 优化标签页与 URL 同步逻辑，新增工作流加载功能

- docs(architecture): 添加项目改造实施计划文档

  - 新增项目改造实施计划文档，详细说明重构项目入口、状态恢复与同步、会话持久化等核心目标及分阶段实施方案。包含路由改造、组件创建、状态管理增强等具体技术方案。

- feat(llm): 为 LLM 适配器添加流式请求支持

  - 实现 LLM 适配器的流式请求功能，包括：
  - 1. 在 ILlmApiAdapter 接口中添加 executeStream 方法
  - 2. 在 OpenAIAdapter 中实现流式请求处理
  - 3. 修改 GenericLlmRequestNode 以支持流式输出
  - 4. 添加相关类型定义和文档

- docs(node-types): 更新多媒体数据类型命名和描述

  - 将 ImageData/AudioData/VideoData 重命名为更简洁的 Image/Audio/Video
  - 并明确说明这些类型可支持的数据格式和引用方式

- docs(architecture): 更新前端 API 管理和 LLM 适配器架构文档

  - refactor(architecture): 重构 LLM 适配器架构为分层路由策略
  - 将渠道组改为支持嵌套路由策略
  - 新增策略执行器组件处理复杂路由逻辑
  - 简化 GenericLlmRequestNode 职责
  - feat(architecture): 添加统一外部 API 网关设计方案
  - 支持将工作流封装为标准 OpenAI API
  - 通过 ApiAdapter 实现模型别名映射
  - 提供无缝外部集成能力

- feat:有点问题的工作流，但是因为这个工作流的文档都失踪了，随便弄的

- fix:修正规则位置

- docs: 添加 kilo 规则

- refactor(llm): 重构 LLM 请求节点的参数结构以提升可读性

  - 将请求参数从扁平结构重组为嵌套结构，分离模型配置和渠道配置，使代码更清晰易读

- feat(调度器): 添加多用户模式支持并传递用户 ID 到执行引擎

  - 在 ConcurrencyScheduler 中新增 multiUserMode 配置选项
  - 在执行流程中传递 userId 参数至 ExecutionEngine
  - 修改 WebSocket 处理器以获取并传递 userId
  - 临时禁用 GenericLlmRequestNode 中的模型检查

- refactor(调度器): 重构服务注入机制以支持依赖注入

  - 将服务实例化提升到入口文件，并通过构造函数注入到调度器和执行引擎
  - 添加服务类型定义并在 LLM 节点中添加服务验证逻辑

- style(Dialog): 调整遮罩层背景透明度使用 CSS 变量

  - 使用 CSS 变量(--ct-backdrop-opacity)控制遮罩层透明度，提高样式可维护性

- style(llm): 调整合并消息节点的宽度为 200 像素

- feat(llm): 添加创建消息和合并消息节点并修复文档格式

  - 添加两个新的 LLM 节点：创建单条消息和合并多条消息功能，用于更灵活地构建对话流程。同时将文档中的`UI_BLOCK`格式修正为`UiBlock`以保持命名一致性。

- style(ui): 调整背景透明度和主题样式

  - 修改 BaseModal 和 LlmConfigManager 的背景透明度
  - 统一所有主题的 backdrop-opacity 为 0.3
  - 提升 UI 元素的视觉层次感

- fix(键盘快捷键): 修复快捷键在非画布区域触发的问题

  - 修改键盘快捷键逻辑，仅在编辑器或画布区域获得焦点时响应快捷键操作。为相关函数添加容器引用参数，确保快捷键只在正确的上下文中触发。

- feat(settings): 添加紧凑模式响应式布局支持

  - 在设置页面组件中实现紧凑模式，当容器宽度小于 768px 时自动启用。通过 ResizeObserver 监听容器尺寸变化，并使用 Vue 的 provide/inject 机制在组件间共享紧凑状态。
  - 新增 injectionKeys.ts 定义紧凑模式注入键
  - 修改 SettingGroup、SettingsLayout 和 SettingItemRow 组件支持紧凑模式
  - 添加紧凑模式下的样式调整

- feat(llm-config): 添加响应式布局支持并优化 UI 细节

  - 为 API 渠道列表添加响应式布局，在小屏幕下显示卡片视图
  - 优化表格视图的列宽和文本溢出处理
  - 调整侧边栏宽度和主内容区的最小宽度
  - 添加容器宽度监听实现自适应布局切换

- style(components): 优化多个组件的响应式布局和样式

  - 移除固定宽度限制，使控件更适应容器
  - 添加响应式设计处理小屏幕布局
  - 使用 CSS gap 替代手动间距
  - 统一按钮组在不同屏幕尺寸下的表现

- feat: 更新项目版本号
  - 将各个包的版本号进行更新：
  - 后端应用版本号从 0.1.2 更新到 0.1.3
  - 前端应用版本号从 0.0.8 更新到 0.0.9
  - 根项目版本号从 0.0.8 更新到 0.0.9
  - 类型定义包版本号从 0.0.8 更新到 0.0.9

## 2025 年 6 月 21 日

- fix: 修正 Claude 模型 ID 格式错误

  - 更新前后端中 Claude 模型 ID 的命名格式，从"claude-4-opus-20250522"改为正确的"claude-opus-4-20250522"格式，保持命名一致性

- docs: 更新模型 ID 的描述信息

  - 调整了 `activated_model_id` 字段的显示名称和描述信息，使其更加简洁明了。具体更改如下：
  - 将 `displayName` 从 '激活的模型 ID' 修改为 '模型 ID'。
  - 将 `description` 修改为 '要使用的已激活模型的 ID \n 比如`claude-4-opus-20250522`、`gemini-2.5-pro`、`deepseek-reasoner`等'，增加了具体的示例以帮助用户更好地理解。

- feat(llm 节点): 添加 LLM 参数单独配置项并优化参数合并逻辑

  - 添加 temperature、max_tokens、top_p 和 seed 等 LLM 参数配置项到节点 UI
  - 实现节点 UI 参数与输入参数的合并逻辑，输入参数优先级更高
  - 更新相关参数的描述信息，提供更详细的配置说明和示例

- refactor(llm-adapter): 重构渠道引用为唯一 ID 并移除前端渠道选择

  - 将渠道引用从用户定义的名称改为系统生成的唯一 ID，提高数据一致性和安全性
  - 移除前端渠道选择逻辑，改为由后端自动路由
  - 更新相关接口和文档以反映这些变更

- feat(设置): 添加画布控件显示开关功能

  - 在设置面板中添加显示画布控件的开关选项，并实现其功能。同时更新了多语言翻译文件以支持此功能。

- docs(本地化): 更新小地图描述为显示在右下角

- perf(theme): 批量应用 CSS 变量减少闪烁

  - 优化主题变量应用方式，通过构建完整 CSS 文本一次性设置，避免逐个变量应用导致的页面闪烁。同时保留现有非主题相关样式。
  - style(sidebar): 优化导航项过渡效果
  - 将导航项中的 transition-all 替换为具体属性 transition-[opacity,max-width,margin-left]，避免不必要的性能消耗

- style(ApiChannelList): 调整频道状态标签的样式间距和大小

- fix: 修复 API 配置更新时的错误处理和请求体净化

  - 在 ApiConfigService 中添加数据库更新操作的错误处理，捕获并记录错误后重新抛出
  - 在 llmConfigApi 中净化请求体，移除 null 值和后端管理字段，确保与后端验证器兼容

- feat(渠道管理): 在渠道列表中添加启用/禁用开关

  - 在 ApiChannelList 中添加 BooleanToggle 组件用于切换渠道状态
  - 调整 BooleanToggle 和 BaseNode 的样式以适配新功能
  - 移除操作列的文字居中样式，改为 flex 布局
  - 新增 toggleChannelStatus 方法处理渠道状态切换

- refactor(ui): 优化布尔切换组件样式并替换复选框为统一组件

  - 更新 BooleanToggle 组件的样式类，使用更一致的配色方案
  - 在 ApiChannelForm 中用 BooleanToggle 替换原生复选框，提升 UI 一致性
  - 将 disabled 字段改为必填项以增强类型安全

- refactor(llm-config): 优化表单组件样式和功能

  - 使用 SelectInput 替换原生 select 提升用户体验
  - 更新模型预设列表并添加更多选项
  - 调整表单输入样式和自动完成属性
  - 移除 LlmConfigManager 侧边栏标题
  - 修复 SuggestionDropdown 边框样式

- refactor(auth): 简化用户系统设计，统一单用户与多用户模式

  - 将原有的三种用户模式（LocalNoPassword、LocalWithPassword、MultiUserShared）简化为两种（SingleUser、MultiUser）
  - 引入统一的 UserIdentity 模型，取代原有的 DefaultUserIdentity 和 AuthenticatedMultiUserIdentity
  - 重构相关代码，包括路由、服务、中间件和前端组件
  - 更新设计文档，反映 v4 版本的简化设计
  - 调整数据库迁移和类型定义，确保与新模式兼容

- style(SideBar): 调整用户头像和用户名的样式以适应侧边栏折叠状态

  - 修改头像和用户名的样式类，使其在不同侧边栏状态下有更好的过渡效果和视觉表现

- docs(frontend-vueflow): 添加默认头像图片资源

- feat(llm): 实现 LLM 配置管理功能 MVP

  - 新增 LLM 配置路由和服务，支持 API 渠道和激活模型管理
  - 重构数据库 schema，移除 refName 字段，使用 id 作为主键
  - 添加前端 LLM 配置管理界面，包括渠道列表和表单
  - 实现模型发现和激活流程
  - 更新相关文档和架构设计

- feat: 实现 LLM 配置管理及请求功能

  - 新增 LLM 配置路由及 API 端点
  - 实现 API 渠道配置和激活模型的服务层
  - 添加 OpenAI 适配器的模型列表功能
  - 重构 GenericLlmRequestNode 以支持 MVP 版本
  - 在 schema 中添加 createdAt 字段

- feat(llm): 实现 LLM 适配器架构及数据库迁移

  - 新增 LLM API 适配器注册表服务，OpenAI 适配器实现及相关服务
  - 添加 activated_models 和 api_channels 数据库表结构
  - 移除不再使用的 CustomMessage 和 StandardResponse 类型

- docs(架构): 更新 LLM 适配器实施方案和本地用户系统设计文档
  - 新增 LLM 适配器 MVP 实施方案文档，包含核心目标、架构图和详细实施步骤
  - 重构 LLM 适配器架构文档，拆分模型管理服务职责并更新核心流程
  - 修改本地用户系统设计文档，调整外部凭证存储策略为可选加密模式

## 2025 年 6 月 20 日

- style(主题): 更新主题颜色和按钮样式

  - 调整暖色日落和紫色梦境主题的成功色值
  - 统一测试面板中的按钮样式，使用语义化类名
  - 移除重复的黄色按钮样式定义

- feat(i18n): 重构国际化扫描器

  - 重构国际化扫描器脚本，改进语言文件合并逻辑并支持多语言文件处理
  - 优化扫描器输出目录结构，生成合并后的语言文件到独立目录

- refactor(i18n-scanner): 重构合并翻译逻辑以保留现有翻译

  - 重构 mergeTranslations 函数，改为基于最终模板结构进行合并，自动保留现有翻译字符串。新增 getValueByPath 辅助函数用于安全获取嵌套对象值，并确保 \_meta 区块被正确保留。

- refactor(i18n): 将\_meta 字段移至模板文件顶部

  - 修改 i18n 扫描脚本，确保生成的本地化模板文件中\_meta 字段出现在最前面，提高可读性和一致性

- refactor(workflow): 重构默认工作流应用逻辑并使用转换工具

  - feat(node): 添加节点定义调试日志注释
  - style(ui): 移除 uiStore 中的冗余调试日志

- style(HierarchicalMenu): 调整菜单项的样式和间距

  - 优化菜单标题和分类的样式，使用圆角和背景色增强视觉效果，并通过调整间距简化布局

- fix(上下文菜单): 修复上下文菜单定位问题

  - 将上下文菜单的定位方式从 fixed 改为 absolute，并更新定位计算逻辑以相对于容器而非视口。同时为画布容器添加 relative 定位以支持新的菜单定位方式。

- feat(i18n): 为上下文菜单添加国际化支持

  - 将 NodeContextMenu、ContextMenu、SlotContextMenu 和 WorkflowMenu 组件中的硬编码文本替换为国际化键

- fix(workflow): 实现批量添加元素并修复粘贴功能

  - 添加 addElementsAndRecord 方法以支持批量添加节点和边，并确保原子性操作
  - 重构 useCanvasClipboard 以使用新的协调器方法，优化粘贴流程和历史记录

- feat(i18n): 为文件管理器组件和弹窗添加国际化支持

  - 为 HierarchicalMenu、FileGridItem、FileListItem 等组件及 MoveModal、FilterModal、UploadManagerModal、ViewSettingsModal 等弹窗添加国际化支持，使用 vue-i18n 管理多语言文本。同时更新 zh-CN 语言文件，补充文件管理器相关内容。
  - 重构部分硬编码文本为国际化键值，优化类型显示逻辑，确保所有用户界面文本可通过语言文件配置。移除组件中的硬编码中文文本，改为从语言文件中获取。

- feat(i18n): 为多个组件添加国际化支持并更新到中文语言文件
  - 添加 vue-i18n 到多个组件中，将硬编码的中文字符串替换为国际化键值
  - 更新 zh-CN.json 文件，添加新的内容字段

## 2025 年 6 月 19 日

- feat(i18n): 为多个组件添加国际化支持

  - 为 NodePanel、WorkflowPanel、HistoryPanel 等组件添加 i18n 支持
  - 更新 zh-CN.json 文件，添加相应的翻译内容
  - 移除组件中的硬编码文本，改为使用翻译键

- feat(i18n): 添加国际化支持框架和基础翻译文件

  - 集成 vue-i18n 库，实现多语言支持
  - 添加英文(en-US)和中文(zh-CN)基础翻译文件
  - 创建语言切换功能和相关组件
  - 实现语言包自动扫描和合并工具

- feat(i18n): 实现国际化扫描器工具

  - 添加扫描器脚本，自动提取代码中的国际化键
  - 实现语言文件的合并和更新功能
  - 支持多语言文件的处理和维护

- docs(i18n): 添加国际化实施计划文档

  - 详细说明国际化实施策略和技术方案
  - 定义翻译键命名规范和组织结构
  - 提供组件国际化改造指南和示例

- feat(节点组): 实现节点组接口同步和连接验证
  - 添加节点组接口同步机制，确保引用工作流变更时自动更新节点组接口
  - 实现节点组连接验证逻辑，支持类型兼容性检查
  - 优化节点组创建和编辑流程，提升用户体验

## 2025 年 6 月 18 日

- feat(工作流): 实现工作流历史记录功能

  - 添加工作流操作历史记录，支持撤销和重做功能
  - 实现历史记录面板，显示操作列表和时间戳
  - 优化历史记录存储结构，减少内存占用

- feat(节点): 添加节点预览功能

  - 实现节点输出预览功能，支持实时查看节点执行结果
  - 添加预览面板组件，显示选中节点的输出数据
  - 优化预览数据的格式化和展示方式

- feat(ui): 优化节点面板和侧边栏交互

  - 改进节点面板的折叠和展开动画
  - 优化侧边栏的响应式布局和交互体验
  - 添加节点搜索和过滤功能，提升使用效率

- fix(工作流): 修复工作流保存和加载问题
  - 修复工作流保存时可能丢失节点连接的问题
  - 解决加载大型工作流时的性能瓶颈
  - 优化工作流数据结构，提高存储效率

## 2025 年 6 月 17 日

- feat(节点): 实现节点组功能

  - 添加节点组创建和编辑功能，支持将多个节点封装为一个组
  - 实现节点组接口定义，支持输入输出参数配置
  - 添加节点组引用功能，支持在不同工作流中复用节点组

- feat(编辑器): 添加标签页系统

  - 实现多标签页编辑功能，支持同时打开多个工作流
  - 添加标签页管理组件，支持创建、切换、关闭标签页
  - 优化标签页状态管理，确保数据隔离和一致性

- feat(ui): 添加主题切换功能

  - 实现亮色和暗色主题切换功能
  - 优化组件样式，确保在不同主题下的一致性
  - 添加主题配置选项，支持自定义主题颜色

- refactor(状态管理): 重构工作流状态管理逻辑
  - 将工作流状态管理拆分为多个专门的组合式函数
  - 优化状态更新逻辑，提高响应性能
  - 改进数据流转方式，减少不必要的组件重渲染

## 2025 年 6 月 16 日

- feat(节点): 添加多输入插槽功能

  - 实现多输入插槽的连接管理，支持多个连接到同一输入
  - 添加连接顺序管理功能，确保多输入数据的正确顺序
  - 优化多输入插槽的视觉呈现和交互体验

- feat(编辑器): 实现可停靠编辑器面板

  - 添加可停靠的代码编辑器面板，支持多标签页编辑
  - 实现编辑器状态管理，保持编辑内容的一致性
  - 优化编辑器与节点输入的交互，提升用户体验

- feat(ui): 添加右侧预览面板

  - 实现右侧专用预览面板，用于显示节点输出和工作流状态
  - 添加面板展开/收起和宽度调整功能
  - 优化预览数据的格式化和展示方式

- refactor(类型系统): 重构节点插槽类型系统
  - 将 SocketType 替换为 DataFlowType，统一类型命名
  - 添加 matchCategories 用于连接验证，提高类型检查准确性
  - 更新所有节点定义和组件以适配新的类型系统

## 2025 年 6 月 15 日

- refactor(ui): 将侧边栏状态管理迁移到 uiStore
  - 从 themeStore 迁移 isMobileView 和 collapsed 状态到 uiStore
  - 添加 setupMobileViewListener 方法用于响应式监听移动端视图变化
  - 更新 SideBar 和 HomeLayout 组件使用 uiStore 的状态和方法
  - 在 App.vue 中初始化移动端视图监听器
- refactor(布局): 重构侧边栏和主内容区域布局结构
  - 将侧边栏和主内容区域的布局逻辑集中到 HomeLayout 组件中管理
  - 移除各视图组件中重复的侧边栏导入和边距计算逻辑
  - 添加主内容区域的内边距动态计算功能
- feat(文件管理): 新增网格视图尺寸调整和扩展名排序功能
  - 在视图设置中新增 gridItemSize 属性用于控制网格视图项目大小
  - 添加扩展名排序选项并实现排序逻辑
  - 重构排序下拉菜单，增加网格尺寸调整输入框和反向排序开关
  - 优化排序下拉菜单的样式和交互
- refactor(file-manager): 移除重复样式并迁移到 tailwind 配置
  - 将组件中重复定义的 CSS 样式移除，统一在 tailwind.config.js 中配置
  - 使用 DaisyUI 提供的组件样式替代自定义样式
- refactor(file-manager): 重构详情面板状态管理至 uiStore
  - 将文件管理器的详情面板可见性状态从 fileManagerStore 迁移至 uiStore 统一管理
  - 添加详情面板宽度调整功能及持久化支持
  - 优化点击事件处理逻辑避免与双击冲突
- style(文件管理器): 调整文件管理器的样式和颜色配置
  - 优化文件管理器中搜索框、面包屑导航和文件列表的样式，统一亮色和暗色模式下的颜色配置
- refactor(file-manager): 统一使用 FAMItem 类型替换本地 ListItem 定义
  - 重构文件管理系统相关组件和服务，使用@comfytavern/types 中的 FAMItem 类型替换原有的本地 ListItem 接口定义。主要变更包括：
  - 在 types 包中新增 FAMItem 类型定义和验证 schema
  - 更新前端组件和后端服务使用统一类型
  - 修改相关 API 接口和 store 逻辑适配新类型
- fix(FileManagerService): 添加受保护路径的重命名检查
  - 在文件重命名操作中添加对系统路径、固定路径和项目结构目录的保护检查，防止这些关键路径被意外修改。包括对 system://、user://projects、user://library 等路径的特殊处理，当尝试重命名这些路径时会抛出错误。
- feat(文件管理): 添加文件管理路由模块
  - 实现文件管理系统的核心路由功能，包括：
  - 文件/目录列表查看
  - 创建目录
  - 删除文件/目录
  - 重命名文件/目录
  - 移动文件/目录
  - 文件上传下载
  - 路由前缀为/api/fam，支持用户上下文鉴权和路径编码处理
- feat(文件管理器): 添加文件管理器页面及组件
  - 实现文件管理器功能，包括：
  - 添加文件管理器页面路由和基础布局
  - 实现文件列表、网格视图和面包屑导航组件
  - 添加文件操作工具栏和上下文菜单
  - 实现文件上传、移动、重命名等 API 接口
  - 添加视图设置和移动文件模态框
- docs(frontend): 新增前端文件管理器设计文档
  - 添加 FAM 系统前端文件管理器的详细设计文档，包含组件结构、状态管理、API 设计和用户流程。文档基于项目现有组件和实践进行设计，确保与现有代码风格一致。

## 2025 年 6 月 14 日

- fix(frontend-vueflow): 修复 Tooltip 组件 placement 类型问题
  - 将 Tooltip 组件的 placement 属性类型从 Placement 改为 string，并在使用时断言回 Placement 类型
  - 更新多个包的版本号及依赖
- refactor: 重构文件系统操作以使用统一的 FileManagerService
  - 移除直接的文件系统操作，统一通过 FileManagerService 处理
  - 重构 config.ts，移除不再使用的全局路径配置
  - 更新所有 loader 节点和路由以使用逻辑路径和 FAMService
  - 为 FileManagerService 添加 append 模式支持
  - 重构日志服务和用户头像上传以使用 FAMService
  - 确保所有系统目录通过 FAMService 创建
- feat(文件管理): 实现文件管理服务核心功能
  - 添加 FileManagerService 实现，支持解析逻辑路径和基本文件操作
  - 包含路径解析、文件读写、目录操作等功能
  - 实现安全检查和错误处理机制
- docs(architecture): 添加统一文件与资产管理系统的设计文档草案
  - 添加统一文件与资产管理系统的设计文档草案，包含系统架构、核心概念、API 设计和实施计划。文档详细描述了文件组织结构、逻辑路径方案以及与现有系统的集成方案。
- docs: 添加 Mermaid 图表代码块标记
- docs(DesignDocs): 添加项目架构图及 mermaid 源码
  - 添加项目架构的 mermaid 流程图定义及生成的 PNG 图片，用于文档说明系统各组件关系
- docs:移动已实施的到 old 文件夹
- chore: 更新所有包的版本号至 0.0.8 或 0.1.2
- docs(DesignDocs): 更新项目结构脑图文档以反映最新技术架构
  - 重构项目结构脑图文档，详细描述前后端技术栈、核心模块和开发规范。新增项目概述、核心架构、开发流程和未来展望章节，保持文档与代码实现同步。
- docs(project): 全面新建和完善项目技术文档体系
  - 本次提交完成了对 ComfyTavern 项目技术文档的全面整理和撰写工作，主要内容包括：
  - 根据 [`DesignDocs/DocumentationPlan.md`](DesignDocs/DocumentationPlan.md:1) 的规划，系统性地创建了全新的项目技术文档结构。
  - 新文档体系覆盖了项目的四大核心模块：
  - Packages ([`DesignDocs/整理/Packages/`](DesignDocs/整理/Packages/))
  - Backend ([`DesignDocs/整理/Backend/`](DesignDocs/整理/Backend/))
  - Frontend ([`DesignDocs/整理/Frontend/`](DesignDocs/整理/Frontend/))
  - Development ([`DesignDocs/整理/Development/`](DesignDocs/整理/Development/))
  - 为每个模块撰写了详细的子文档及一个模块概览文档。
  - 创建了顶层的项目总览文档 [`DesignDocs/整理/ProjectOverview.md`](DesignDocs/整理/ProjectOverview.md:1) 作为整个文档体系的入口。
  - 共计新增 24 份结构化 Markdown 文档，均存放于 [`DesignDocs/整理/`](DesignDocs/整理/) 目录下。
  - 这套新文档旨在为项目的现有及未来开发者提供清晰、全面、易于导航的技术参考和开发指引。
- docs:清理过时文档
- docs(rules): 添加对话框与通知服务规范文档
  - 添加 DialogService 的详细使用规范，包括对话框类型、参数说明和示例代码。涵盖消息框、确认框、输入框和通知 toast 的使用方法，以及相关组件和注意事项。
- refactor: 移除冗余代码和阻塞 UI 的 alert 提示
  - 清理了 TODO 注释和已实现的占位逻辑
  - 移除了开发调试用的 alert 弹窗和冗余的 console 日志
  - 简化了工作流数据处理逻辑，移除不必要的检查
- refactor(SettingItemRow): 调整头像编辑按钮位置至头像预览前
  - 将头像编辑按钮从头像预览后移动到预览前，提升用户操作体验
- feat(用户头像): 实现用户头像上传与展示功能
  - 新增头像上传组件和模态框
  - 扩展用户身份接口以支持头像 URL
  - 修改设置控件以支持头像类型
  - 实现头像上传 API 和后端处理逻辑
  - 在侧边栏和设置页面展示用户头像
  - 添加默认头像和错误处理机制
- feat(backend): 实现用户隔离的角色卡存储和访问
  - refactor(frontend): 使用统一的 API 工具和 URL 处理
  - docs(types): 添加 PNG 处理库的类型定义
  - 后端现在根据用户 ID 存储角色卡到各自目录，确保数据隔离
  - 前端改用统一的 useApi 工具和 URL 处理函数
  - 添加了 png-chunks-extract 和 png-chunk-text 的类型定义
  - 改进错误处理和日志记录
- refactor(file): 集中文件路径管理到 fileUtils 模块
  - 将分散在各处的文件路径计算和目录创建逻辑统一到 fileUtils 模块
  - 添加 ensureDirExists 函数确保目录存在
  - 重构各服务使用新的路径获取方法
  - 在应用启动时统一创建必要目录

## 2025 年 6 月 13 日

- feat(projectRoutes): 添加用户认证支持并更新.gitignore
  - 在项目路由中添加用户认证支持，包括从上下文中提取用户 ID 并验证
  - 更新.gitignore 以忽略 userData 目录
- fix(vComfyTooltip): 检查空内容时不显示工具提示
  - 修复工具提示在内容为空时仍会显示的问题，同时修正 StringInput 组件中 class 的合并方式
- feat(用户设置): 添加初始用户名设置功能并改进相关组件
  - 在 uiStore 中添加初始用户名设置模态框状态和方法
  - 创建 InitialUsernameSetupModal 组件用于用户名设置
  - 扩展 BaseModal 组件支持无样式模式和自定义类
  - 为 TextAreaInput 组件添加尺寸控制功能
  - 在 TestPanelView 中添加测试用例和设置面板
- refactor(auth): 重构认证中间件为函数式插件并改进错误处理
  - 将认证中间件从 Elysia 实例重构为函数式插件，确保 derive 方法正确执行
  - 改进错误处理逻辑，统一错误对象结构
  - 添加调试日志以跟踪认证流程
  - 更新相关路由和主应用以使用新的中间件形式
- refactor(SideBar): 移除 Tooltip 组件改用 v-comfy-tooltip 指令
  - 简化侧边栏按钮实现，使用内置指令替代外部组件，减少依赖
- feat(启动脚本): 添加项目环境准备步骤并整合数据库初始化
  - 添加 prepare:project 脚本用于检查并初始化数据库
  - 删除冗余的 cleanup_and_generate.ps1 脚本
  - 在启动流程中增加环境准备检查
- refactor: 优化项目配置并添加数据库迁移支持
  - 添加 drizzle.config.ts 配置文件用于数据库迁移
  - 更新.gitignore 忽略本地生成的数据文件
  - 在 package.json 中添加数据库相关脚本
  - 创建 cleanup_and_generate.ps1 脚本用于清理和生成操作
  - 更新 README.md 添加镜像源安装说明
  - 调整前端组件属性命名以保持一致性
- feat(用户资料): 添加用户名修改功能及相关组件
  - 实现用户资料管理功能，包括：
  - 1. 后端添加用户资料路由和用户名更新接口
  - 2. 前端新增用户资料 API 和 store 操作
  - 3. 创建初始用户名设置模态框
  - 4. 扩展设置组件支持自定义保存逻辑
  - 5. 数据库 schema 添加 updatedAt 字段
  - 这些改动使得本地模式用户可以修改默认用户名，并在首次使用时强制设置昵称
- feat(auth): 实现用户认证和密钥凭证管理功能
  - 添加用户认证相关 API 和状态管理，包括：
  - - 用户上下文获取 API
  - - 服务 API 密钥和外部凭证的 CRUD 操作 API
  - - Pinia store 管理认证状态和密钥凭证
  - - 在 App 初始化时自动获取用户上下文
- feat(backend): 实现用户认证与密钥管理功能
  - - 新增用户认证中间件及路由
  - - 添加数据库服务与用户管理配置
  - - 实现服务 API 密钥和外部凭证管理
  - - 引入加密服务处理敏感数据
  - - 重构项目路由为插件形式
  - - 更新依赖以支持新功能
- docs(用户系统): 本地用户系统设计方案已更新至 v3。 该方案详细阐述了三种用户操作模式、两种核心密钥（服务 API 密钥和外部服务凭
  - ）的管理机制、基于 SQLite 的数据存储模型、具体的后端 API 设计、前端实现要点、安全性考量以及分阶段的实施路线图。
  - 此设计旨在提供一个安全、灵活且可扩展的用户系统，为 ComfyTavern 项目的后续开发提供了清晰的架构指导。

## 2025 年 6 月 12 日

- docs(architecture): 更新知识库架构文档，废弃 placement 字段并新增 depth_offset
  - - 废弃 usage_metadata 中的 placement 字段，其功能由 tags 结合组装器模板替代
  - - 新增 depth_offset 字段支持深度偏移插入方式
  - - 完善 SillyTavern 导入策略文档，详细说明 ST 字段到 CAIU 的映射关系
  - - 明确核心上下文组装器对原生字段的处理规则
- docs(knowledgebase-architecture): 更新知识库架构文档以支持 ST 资产导入
  - - 在 `usage_metadata` 部分增加了 `role` 字段，用于指定内容注入时扮演的角色，包括 "null", "system", "user", "assistant", 未来可能支持 "
  - ool"。未设置时默认为 "null"，根据上下文自动确定。
  - - 修改了 `source` 字段的描述，增加了 "imported_from:sillytavern:v1.x" 作为来源选项，用于标记从 SillyTavern 导入的内容。
  - - 在 `extensions` 部分增加了对从外部数据源导入时存储其特有元数据的说明，例如，从 SillyTavern 导入时的 `st_import_metadata`。
  - - 更新了 ST 兼容性策略的描述，强调通过 CAIU 结构的灵活性来适应从外部数据源导入的知识。
  - - 增加了对 ST 世界书 (Lorebook) 和角色卡 (Character Card) 的文本内容和核心元数据的导入转换说明。
  - - 添加了对 ST 特有行为逻辑参数的存储说明，这些参数可以存储在 CAIU 的 `extensions` 字段内，供专门的工作流节点使用。
  - - 提供了详细的兼容性策略文档链接，以便进一步了解资产导入与转换的具体策略和设计。
- docs(兼容性):将 SillyTavern 资产导入与 ComfyTavern 兼容性策略的初步内容撰写完成。
- docs(架构): 添加 Agent 工具调用协议设计文档
  - 添加 Agent 工具调用协议的设计文档，定义 LLM 输出工具调用指令的 XML 格式规范，包括`<ACTION>`标签的使用、参数传递方式、错误处理机制等。文档详
  - 说明了协议的设计目标、解析流程、Prompt 工程指南及示例，为 Agent 与工具/技能的交互提供标准化方案。
- docs(架构): 更新应用面板与 Agent 集成的设计文档
  - 补充应用面板与 Agent 交互的设计细节，包括安全考量、执行流程和知识库架构
  - 更新 Agent 助手功能规划以对齐 v3 架构，完善 LLM 适配器文档中对 Agent 支持的描述
- docs(architecture): 更新架构文档以整合 Agent 系统
  - 更新项目架构、场景架构和工作流概念文档，全面整合 Agent 系统设计。主要变更包括：
  - 1. 在项目架构中新增 Agent Profile 定义管理，更新 project.json schema
  - 2. 在场景架构中强化 Agent 实例托管功能，定义 scene.json schema
  - 3. 在工作流概念中扩展 Agent 核心逻辑承载机制
  - 4. 统一目录结构和文档格式，保持一致性
  - 这些变更为实现自主 Agent 系统提供完整的文档基础和架构支持。
- docs(architecture): 更新 Agent 架构文档以包含知识库质量管理与遗忘机制
  - - 为确保知识库的质量，防止低效或错误的“经验”污染共享知识，引入“管理员/策展人”角色或机制，定期审核、整合与校验 Agent 贡献的知识。
  - - 描述“遗忘”机制实现方式，强调其作为个体特性而非直接物理删除知识库条目的方法。
- docs(architecture): 修改 AgentRuntime 的驱动机制描述
  - - 将 `AgentRuntime` 的驱动审议循环机制从仅基于事件驱动扩展为混合驱动模式，包括事件驱动、低频定时驱动和自主休眠/唤醒。
  - - 详细说明混合驱动模式中的各个驱动方式及其具体实现细节。
- docs(architecture): 更新 WorldState 的原子性更新与并发控制描述
  - - 拓展 WorldState 的原子性更新描述，强调通过系统设计和任务流编排规避并发写冲突。
  - - 增加并发控制的详细说明，包括乐观锁和悲观锁的具体实现机制。
- docs(architecture): 丰富 Agent 安全与权限控制内容
  - - 强调安全与权限控制体系的重要性，并将其列为一个持续的过程。
  - - 扩展具体措施，包括沙箱化环境和资源限制的细化，以及审核、过滤或标记机制的描述。
  - - 增加防止恶意或滥用 Agent 的防护措施描述，强调安全边界的设定和维护的重要性。
- docs(architecture): 增强 Agent 行为可观测性与调试描述
  - - 强调审议过程不应是完全的黑箱，并明确平台将提供强大的行为可观测性工具和机制。
  - - 描述官方模板内置可视化和调试支持的具体实现方式。
  - - 强调对于第三方开发者，平台提供基础设施，由开发者决定暴露何种程度的可解释性信息。
- docs(architecture): 修正格式错误
  - - 修正文档中的格式错误，将多余的引号和代码块闭合符删除，确保文档格式一致。
- docs:整理格式
- docs: 添加 ComfyTavern Agent 架构详细规划报告 (v3 - 整合版)
  - 本报告详细阐述了 ComfyTavern 平台 Agent 系统的统一架构设计。核心结论包括：
  - - Agent 定义与实例的分离。
  - - 自主 Agent 模型，以目标驱动的审议循环为核心。
  - - 场景作为 Agent 运行时实例的宿主环境和生命周期管理者。
  - - 模块化与可扩展性设计，清晰的层级划分和组件职责。
  - - 模板化赋能，为复杂的多 Agent 协作场景提供官方应用模板。
  - 报告还对现有设计文档进行了修订建议，以确保平台知识体系的一致性，并展望了未来的发展方向，包括多 Agent 协作的实现模式、学习与反思机制、A
  - ent 安全与权限控制等。
- docs(architecture): 新增动态世界模拟引擎架构文档 v2 并更新原文档
  - 新增 agent-architecture-plan-v2.md 详细描述多 Agent 协同的动态世界模拟引擎设计
  - 更新 agent-architecture-plan.md 扩展核心机制与工程实现细节

## 2025 年 6 月 11 日

- docs(guides): 添加客户端脚本指南文档
  - 添加详细的客户端脚本开发指南，解释其工作原理、编写方法和最佳实践
- docs(guides): 添加工作流历史记录与状态管理指南文档
- feat(拖拽): 改进拖拽节点的视觉反馈和暗色模式支持
  - - 调整拖拽图标样式，支持暗色模式适配
  - - 优化拖拽提示的 SVG 图标和布局
  - - 统一拖拽元素的样式与上下文菜单保持一致
  - - 改进日志输出的格式和可读性
- feat(canvas): 支持从画布添加节点时指定位置
  - 现在 handleAddNodeFromPanel 接受可选的 position 参数，允许从画布添加节点时指定具体位置，而不再总是使用中心位置
- refactor(context-menu): 重构上下文菜单定位逻辑使用视口坐标
  - - 将菜单定位逻辑改为基于视口坐标而非容器相对坐标
  - - 移除不再需要的 screenPosition 参数传递
  - - 导出 getEventClientPosition 工具函数
  - - 添加 rawInteractionPosition 存储原始交互位置
  - - 优化菜单边界检查逻辑确保始终显示在视口内
- style(components): 调整布尔切换和字符串输入组件的样式
  - - 优化布尔切换组件的滑块大小和位置
  - - 重构字符串输入组件的类名结构，添加工具提示功能
  - - 统一代码格式，提高可读性
- refactor(nodes): 清理节点定义文件中的注释和格式
  - 移除多个节点定义文件中的冗余注释和临时标记
  - 统一代码格式和引号使用
  - 更新 OpenAINode 的模型配置和描述
  - 优化 TestWidgetsNode 的输入输出定义
- fix(输入组件): 根据 matchCategories 区分纯下拉选择和带建议输入框
  - 当插槽的 matchCategories 包含 ComboOption 时，渲染为纯下拉选择框，否则对于 STRING/INTEGER/FLOAT 类型渲染为允许自由输入并提供建议的输入框。同
  - 时更新相关文档说明。
- feat(输入组件): 优化输入组件选择逻辑
  - 重构 getInputComponent 函数，使用更清晰的类型检查和条件分支结构。改进组件匹配逻辑。
- fix(版本管理): 修复版本号获取和使用不一致的问题
  - 将 package.json 中的版本号字段从'Version'改为'version'以匹配标准命名
  - 使用 import.meta.env.VITE_APP_VERSION 作为工作流版本号来源
- feat(workflowStore): 替换 prompt 为 dialogService 实现工作流保存命名
  - 使用 dialogService.showInput 替换原生 prompt，提供更好的用户体验和界面一致性。处理取消操作时返回 null 的情况。
- feat(侧边栏): 使用本地存储保存预览面板模式状态
  - 将预览面板模式从 ref 改为 useLocalStorage，以持久化用户选择的显示模式
- feat(tooltip): 实现全局 Tooltip 服务并替换多处独立组件
  - 新增全局 Tooltip 服务，包含 Pinia 状态管理、指令和渲染器组件
  - 移除多处独立 Tooltip 组件，改用 v-comfy-tooltip 指令
  - 添加相关设计文档和类型定义，优化性能与一致性
- docs(architecture): 添加场景架构设计文档
  - 添加 ComfyTavern 场景架构的详细设计文档，阐述其作为状态机编排引擎的核心定位、构成元素及交互模型
- docs(guides): 添加工作流概念详解文档
  - 新增 ComfyTavern 工作流概念的详细说明文档，涵盖工作流定义、构成元素、生命周期、关键特性等内容，帮助开发者理解核心机制

## 2025 年 6 月 10 日

- docs(架构): 拆分项目架构和知识库架构设计文档
- refactor(架构设计): 重构 API 服务与集成接口文档为前端 API 适配管理器设计
  - 将原有 API 服务与集成接口文档拆分为更清晰的前端 API 适配管理器设计文档，重点实现纯前端的数据转换层。新增 ApiAdapterManager 核心服务概念，明
  - 适配器转换规则与面板 API 交互方式，同时保留后端 HTTP API 的简洁设计。文档结构调整为更合理的章节划分，包含核心概念、面板 API、适配器规则、前
  - 后端交互等完整设计。
- fix(llm-test): 智能处理 base_url 的版本路径
  - 根据用户建议改进 base_url 处理逻辑：
  - - 自动检测路径是否包含版本信息
  - - 对裸域名自动追加 /v1
  - - 保留自定义路径不变
  - - 对无效 URL 发出警告
- feat(architecture): 新增全局 Tokenization 服务设计方案
  - 添加 TokenizationService 作为核心组件，用于统一处理 token 计算需求
- docs: 更新 README 文档内容与结构
  - - 添加项目状态徽章和许可证信息
  - - 重构核心特性描述，突出平台定位与架构优势
  - - 完善快速开始指南和开发环境配置说明
  - - 新增工作流创建教程和临时 API 配置方法
  - - 更新技术栈和路线图信息
- feat(PerformancePanel): 改进性能统计面板的 UI 和功能
  - - 使用 SVG 图标替换文本箭头，提升视觉一致性
  - - 优化树形结构缩进和间距，提高可读性
  - - 添加节点原始类型显示功能
  - - 清理复制的 JSON 数据，移除不必要字段
  - - 改进组件统计逻辑，更准确计算渲染组件
- feat(性能统计): 重构组件使用统计逻辑并移除无用代码
  - - 在 PerformancePanel 中实现组件使用统计功能，通过分析节点配置和输入定义收集实际渲染的组件信息
  - - 移除 BaseNode 中分散的组件计数逻辑，改为统一在 PerformancePanel 中处理
  - - 添加 setComponentUsageStats 方法到性能统计 store
  - - 清理输入类型定义中无用的 HISTORY 类型
- fix(PerformancePanel): 修正组件实例统计标签描述更准确
- feat(性能统计): 添加组件实例统计功能
  - 在性能面板中新增组件实例统计功能，跟踪不同组件类型的实例数量。修改 BaseNode 组件在挂载和卸载时更新计数，并在 PerformanceStatsStore 中添加
  - 关状态和方法管理组件计数数据。
- feat(性能统计): 添加性能统计面板及相关功能
  - - 新增性能统计面板组件，用于展示节点和槽位统计数据
  - - 创建性能统计 store 管理各标签页的统计数据
  - - 在 tabStore 中集成性能统计清理功能
  - - 实现数据收集、展示和复制到剪贴板功能

## 2025 年 6 月 9 日

- refactor(workflow): 清理调试日志并优化节点组输入顺序处理
  - 移除冗余的调试日志代码，添加处理节点组输入顺序的功能
  - 添加辅助函数用于提取父级句柄键，确保节点组创建时输入顺序正确
- feat(NodeGroup): 实现节点组实例输入值覆盖和模板同步功能
  - 新增 NodeGroup 实例输入值覆盖功能，允许用户为实例设置特定值
  - 实现模板工作流接口变更时自动同步到 NodeGroup 实例
  - 修改 workflowTransformer 以正确处理 NodeGroup 实例的 inputValues
  - 添加工作流扁平化时对 NodeGroup 输入值的处理逻辑
  - 更新 useGroupIOSlots 以支持实例值覆盖和 CONVERTIBLE_ANY 过滤
  - 在 workflowStore 中添加模板变更跟踪和同步相关操作
  - 添加设计文档说明 NodeGroup 实例配置与同步机制
- docs: 添加 CONVERTIBLE_ANY 类型详细说明
  - 本部分详细解释 `CONVERTIBLE_ANY` 类型的行为特性，主要供 AI 系统理解及开发者参考。
  - `CONVERTIBLE_ANY` (`BEHAVIOR_CONVERTIBLE`) 的特性与应用：解释了 `CONVERTIBLE_ANY` 类型的核心行为和规则，包括彻底的类型转换、禁止互连及动态占位符再生机制等。
  - 针对节点组（`core:NodeGroup`）的外部接口行为：描述了 `NodeGroup` 节点在外部接口上如何处理 `CONVERTIBLE_ANY` 插槽，确保其“不可见性”和无持久值”的特性。
- docs: 移除关于节点组节点的描述
- feat(剪贴板): 实现系统剪贴板与本地剪贴板功能
  - 新增 useClipboard 和 useCanvasClipboard composables 用于处理剪贴板操作
  - 重构上下文菜单和快捷键逻辑以支持两种剪贴板模式
  - 添加工作流片段序列化和反序列化工具函数
  - 优化节点样式和菜单交互体验
- enhance(marked-renderer): 优化 Markdown 渲染和 Tooltip 交互逻辑
  - - 将 `Marked` 实例的创建和配置移出 `computed`，只执行一次，提高性能和避免不必要的重复计算。
  - - 优化 `MarkdownRenderer` 中的链接渲染逻辑，确保链接在新标签页打开，并对 `href` 和 `title` 进行净化。
  - - 引入 `markedHighlight` 扩展，提高代码块高亮的错误处理能力。
  - - 简化 `Tooltip` 组件中的样式和结构，移除不必要的注释，提高代码可读性。
  - - 优化 `Tooltip` 组件的交互逻辑，仅在 `interactive` 模式下初始化浮动元素悬停检测，并在组件卸载时清除监听器。
  - - 修改 `useNodeResize` 中的节点宽度获取逻辑，直接从 `activeTabState` 获取元素，避免 `getElements()` 的深拷贝，提高性能。
  - - 在 `measureTextWidth` 函数中引入缓存机制，存储已计算的文本宽度，减少重复计算，提高性能。设置缓存大小限制，防止内存无限增长。
- refactor(workflowTransformer): 重构 workflowTransformer 以优化缓存和辅助函数
  - 移除了不必要的 nodeStore 获取，引入了缓存机制以提高 Node Definitions Map 的性能。
  - 重构了 `_createBaseStorageNodeProperties` 函数，用于提取节点的基础属性到 WorkflowStorageNode 格式。
  - 重构了 `_extractInputValuesForStorage` 函数，用于提取节点的 inputValues，区分了 core 和 fragment 模式。
  - 重构了 `_extractCustomSlotDescriptionsForStorage` 函数，用于提取节点的 customSlotDescriptions。
  - 重构了 `_createBaseVueFlowNodeData` 函数，用于创建 VueFlowNode.data 的基础部分。
  - 重构了 `_populateVueFlowNodeSlots` 函数，用于填充 VueFlowNode.data 的 inputs 和 outputs，不处理 NodeGroup 的异步接口加载。
  - 优化了 `transformVueFlowToCoreWorkflow` 函数，使用缓存的 Node Definitions Map。
  - 优化了 `transformWorkflowToVueFlow` 函数，使用缓存加载函数并改进了 slot 类型处理。
  - 优化了 `extractGroupInterface` 函数，使用 klona 复制 inputs 和 outputs。
  - 优化了 `transformVueFlowToExecutionPayload` 函数，直接从 coreWorkflow 提取数据。
  - 优化了 `serializeWorkflowFragment` 函数，使用辅助函数提取节点属性。
  - 优化了 `deserializeWorkflowFragment` 函数，使用辅助函数创建和填充节点数据。
  - 确保在 `deserializeWorkflowFragment` 中对 position 进行深拷贝以避免位置冲突。

## 2025 年 6 月 8 日

- refactor(ExecutionEngine): 优化接口输出处理流程并支持批处理 Promise
  将\_processAndBroadcastFinalOutputs 方法重构为三个阶段：识别流并启动、等待批处理 Promise 完成、发送最终输出。新增对 Promise 类型输出的处理支持，并优化了错误处理和日志记录。
- feat(ExecutionEngine): 支持异步处理节点输入和流式输出
  refactor(RightPreviewPanel): 重组流状态显示逻辑
  - 将 prepareNodeInputs 改为异步方法以处理 Promise 输入
  - 改进流式节点的执行状态处理和结果返回
  - 调整前端面板中流状态信息的显示位置
  - 移除重复的状态显示并优化布局结构
- feat(OpenAINode): 在流式处理中累积并返回完整响应内容
  修改流式处理逻辑以累积内容并在结束时通过 response 端口输出
  更新输出端口描述以反映流式/批处理模式的行为变化
  同时修正前端节点工具提示中的缓存结果描述
- docs(node-types): 添加 STREAM 类型及相关流式处理文档
  添加 STREAM 数据类型定义，说明其在节点执行时的流式处理机制，包括：
  - 输出槽的 STREAM 类型定义
  - 异步生成器实现流式输出的方式
  - 流式数据的连接规则
  - 相关的 WebSocket 消息类型
- fix(ExecutionEngine): 修复节点执行失败后未跳过下游节点的问题
  添加邻接表存储和 skipDescendants 方法，当节点执行失败或中断时自动标记下游节点为跳过状态
- feat(utils): 添加字符串转义字符解析工具函数
  将字符串转义字符解析功能提取到 utils 包中，供多个节点复用
  更新 MergeNode 和 StreamSuffixRelayNode 使用新的工具函数
  修改 tsconfig 以支持 utils 包的路径映射
- fix(ui): 修正右预览面板的显示逻辑和样式
  修复了右预览面板中的一些显示问题和样式细节，具体如下：
  - 移除了多余的 `resize-handle-top` 拖拽句柄。
  - 更新了面板头部的 `class` 绑定，确保正确切换展开和收起状态。
  - 优化了 `singlePreview` 模式下插槽信息和预览数据的显示逻辑，增加了流式状态的提示。
  - 修正了 `groupOverview` 模式下组输出项的折叠状态逻辑，确保默认展开所有项。
  - 优化了组输出项的显示逻辑，增加了流式状态和空内容提示。
  - 调整了 `previewData` 和 `currentAccumulatedStreamText` 的逻辑，确保正确显示最终值或流式文本。
  - 添加了 `mergedSinglePreviewContent` 计算属性，根据状态智能决定显示实时流还是最终/静态值。
  - 修正了 `processedGroupOutputs` 计算属性中的逻辑，确保正确处理组输出项的内容和状态。
  - 优化了样式部分，确保在展开和收起状态下面板有正确的边框和圆角处理。
- feat(websocket): 实现接口流式输出和后台任务管理
  实现流式接口输出的处理逻辑，包括占位符发送和流数据分块传输
  扩展 ExecutionEngine 以支持接口流式输出的后台任务管理和生命周期控制
- feat(Utilities): 添加流后缀接力节点实现
  实现 StreamSuffixRelayNode 用于处理文本流并添加指定后缀
  包含节点定义和执行逻辑，支持错误处理和日志记录
- feat(stream): 新增流式处理支持及相关节点
  添加对 STREAM 数据类型的默认值处理
  实现流式日志节点用于调试流数据
  为 OpenAINode 添加流式输出选项

## 2025 年 6 月 7 日

- feat(websocket): 新增 NODE_YIELD 消息类型支持流式输出
  添加 NODE_YIELD 消息类型以支持流式输出功能，同时在 workflow 数据中新增 previewTarget 字段用于保存预览目标。修改 websocket 处理逻辑以支持消息类型。
- feat(ExecutionEngine): 添加日志敏感信息过滤功能
  新增 sanitizeObjectForLogging 方法用于过滤日志中的敏感长文本信息
  修改相关日志输出调用，对包含系统提示、消息等敏感字段的对象进行过滤
  优化执行开始日志的显示格式
- feat(llm-test): 为 OpenAINode 添加默认值和占位文本
  为系统提示和用户提示字段添加默认空字符串和占位文本，并扩展匹配类别包含 UiBlock
- style: 调整内联输入组件的最小宽度
  将内联输入组件（如数字、布尔值、下拉框）的最小宽度从 80px 调整为 120px，以提供更好的用户体验和更充裕的输入空间。
- refactor(workflow): 优化代码结构并修复类型导入顺序，统一代码格式和缩进风格
- feat(预览面板): 添加流式预览模式并优化显示逻辑
  - 在右侧预览面板中新增流式预览模式，支持实时显示节点流式输出
  - 重构组输出预览逻辑，添加可显示组输出项的计算属性
  - 优化节点和插槽显示名称的获取逻辑
  - 在 workflowManager 中添加调试日志以便追踪节点状态变化
- docs(.roo/rules): 添加 apply_diff 工具报错排查指南
  补充关于`apply_diff`工具报错`marker '=======' found`的排查说明，包括错误原因分析及处理建议，帮助开发者快速定位和解决问题。
- feat(streaming): 实现 LLM 节点流式输出功能
  - 在 OpenAINode 中修改 execute 方法为生成器函数，支持流式输出
  - 在 executionStore 中添加 streamingNodeContent 状态和相关处理方法
  - 添加 getAccumulatedStreamedText 和 getRawStreamedChunks getter 方法
  - 更新 DialogDemo 组件中的 placeholder 属性名为 inputPlaceholder 以保持一致性
- docs(.roo/rules/rules.md): 更新代码检查命令
  将代码检查命令从 `bun tsc -p apps/frontend-vueflow/tsconfig.json --noEmit` 更新为 `bunx vue-tsc --build apps/frontend-vueflow/tsconfig.json`，以使用 Vue 的 TypeScript 编译器进行检查。
- fix(CharacterCardPreview): 修复角色卡预览页面的路由链接
  使用命名路由替代硬编码路径，提高路由维护性
- refactor: 优化代码格式和导入顺序
  整理多个文件的导入语句顺序，移除多余空行和注释
  统一代码格式，调整部分文件的代码结构以提高可读性
- refactor(types): 重构类型定义文件结构并优化类型组织
  将类型定义文件按功能模块拆分，移除冗余类型定义，移动 SillyTavern 相关类型
  统一工作流执行相关类型定义，优化类型导入路径
  修复多处类型引用路径错误，清理无用导入和注释
- feat(ExecutionEngine): 添加流式节点执行支持
  实现 BoundedBuffer 类用于流式数据缓冲
  添加 handleStreamNodeExecution 方法处理流式节点执行
  支持通过 WebSocket 广播流式数据块
- feat(types): 添加流式处理支持并重构类型定义
  - 在 NodeDefinition 中扩展 execute 函数以支持流式处理
  - 新增 ChunkPayload 类型和相关 schema 用于流式数据块
  - 在 DataFlowType 中添加 STREAM 类型
  - 将 ExecutionNode 和 ExecutionEdge 类型移至 schemas.ts 作为单一数据源
  - 新增 NodeYieldPayload 类型用于流式处理事件
  - 重构 index.ts 以提供更清晰的类型导出结构
- refactor: 精简流式功能设计文档并更新方案
- docs(rules): 更新规则文档并添加完整性规范
  重构规则文档结构，添加文档重构与修订内容完整性规范，明确要求输出完整文档而非变更描述
- refactor(布局): 将设置页面导航从侧边栏改为顶部标签页
  - 修改布局方向为垂直排列
  - 导航样式调整为标签页形式
  - 调整内边距和间距以适应新布局
  - 更新激活状态的视觉样式
- feat(components): 为输入组件添加大尺寸支持
  为 SettingControl 中的 NumberInput、BooleanToggle 和 SelectInput 组件添加 size 属性，支持'small'和'large'两种尺寸。同时重构了这些组件的样式处理逻辑，使用计算属性动态生成不同尺寸的样式类。
  修改包括：
  - 为所有输入组件添加 size 属性
  - 使用 sizeClasses 计算属性管理不同尺寸的样式
  - 统一处理不同尺寸下的布局和交互样式
- style(settings): 调整设置页面的间距、字体和颜色变量
  增加各设置组件的内边距和间距，增大标题字号和权重，优化颜色变量定义
- style(frontend): 移除链接颜色注释并优化侧边栏路由链接样式
  移除 main.css 中链接颜色的注释代码，优化 SideBar.vue 中路由链接的点击行为和样式，使用 custom v-slot 实现更精确的激活状态控制
- feat(router): 重构路由结构并添加主页布局组件
  - 新增 HomeLayout 组件作为主页的统一布局
  - 将原有路由重构为嵌套结构，统一在 /home 路径下
  - 更新所有相关组件的路由链接指向新路径
  - 移除 HomeView 中重复的 SideBar 组件
- refactor(布局): 重构设置页面布局并优化侧边栏导航
  - 将 SettingsLayout 从组件移动到视图层
  - 修改设置页面高度从 100vh 到 100%以避免布局问题
  - 优化侧边栏导航样式和设置按钮路由
  - 移除重复的样式注释保持代码整洁
- feat(settings): 添加设置页面基础架构和组件
  实现设置页面的路由和基础组件结构，包括：
  1. 添加设置页面路由入口
  2. 创建设置项类型定义和存储管理
  3. 实现数据驱动的设置项展示组件
  4. 构建设置页面布局框架
- style(Dialog): 移除对话框组件的边框并统一输入框样式
  移除标题栏和按钮区域的边框样式，使界面更简洁。统一输入框的亮色和暗色模式下的样式，确保视觉一致性。
- refactor(ProjectListView): 使用 dialogService 替换原生 prompt 进行项目创建
  将原生 window.prompt 替换为 dialogService.showInput 以提供更一致的用户体验，并改进空输入时的错误处理
- refactor(对话框组件): 重构对话框组件为统一 Dialog 组件并更新 DialogService
  将 MessageDialog、ConfirmDialog 和 InputDialog 合并为统一的 Dialog 组件，简化代码结构
  更新 DialogService 以适配新组件并优化类型定义和接口
  修复 DialogContainer 中的导入路径为别名路径
- feat(对话框): 添加输入和多行输入对话框功能
  - 新增 InputDialog 组件支持文本、密码、数字和多行输入
  - 扩展 DialogService 添加 showInput 方法处理输入对话框逻辑
  - 在 DialogDemo 中添加演示按钮展示输入对话框功能
- refactor(ui): 替换 alert 为 DialogService 提供统一错误提示
- feat(ui): 添加全局对话框和通知系统
  实现完整的对话框和通知系统，包括：
  1. 对话框服务(DialogService)管理对话框和通知的显示
  2. 基础对话框组件(MessageDialog, ConfirmDialog)
  3. 通知组件(ToastNotification)
  4. 全局对话框容器(DialogContainer)
  5. 演示页面(DialogDemo)展示功能

## 2025 年 6 月 6 日

- feat(配置): 添加配置文件合并功能以补全缺失字段
  当配置文件存在时，自动合并模板中的新字段到现有配置中。这解决了需要手动更新配置文件的问题，提高了配置管理的便利性。
- feat(配置): 添加配置文件合并功能以补全缺失字段
  当配置文件存在时，自动合并模板中的新字段到现有配置中。这解决了需要手动更新配置文件的问题，提高了配置管理的便利性。
- docs(architecture): 添加流处理核心机制与背压策略文档
  详细说明阶段二的核心流处理机制，包括多路复用方案选择、LLM 解耦策略和 Node.js Streams 实现方案
- docs(architecture): 更新交互模板和节点接口模型的架构文档
  - 交互模板部分：明确模板定位、目的、核心特征及使用流程
  - 节点接口模型部分：详细描述接口定义、管理方式和动态插槽机制
  - 更新内容使架构设计更清晰，便于团队理解和实施
- docs(architecture): 更新流式功能设计文档，新增 StreamAggregatorNode 设计
  - 新增显式流聚合节点(StreamAggregatorNode)的详细设计规范
  - 补充流式数据与批处理节点的适配方案
  - 完善执行引擎改造和事件总线的流式处理机制
  - 强调显式转换节点对工作流清晰度和可组合性的价值
- docs(architecture): 更新流式功能计划文档，明确阶段划分和设计原则
  重构流式功能架构文档，明确三个阶段的演进路径：
  1. UI 实时流与批处理访问（当前焦点）
  2. 引擎原生节点间实时流
  3. 基于事件的协调控制
     强调类型系统集成、职责分离和增量演进原则

## 2025 年 6 月 5 日

- docs(architecture): 完善流式功能设计文档中的事件类型和错误处理
  - 补充 `eventData.type` 的详细事件类型说明
  - 重构错误处理流程为更清晰的节点执行终止场景分类
  - 明确三种终止情况（正常结束、内部错误、外部取消）的处理逻辑和事件信号
- docs(architecture): 添加流式功能演进计划文档
  添加详细的流式功能演进计划文档，描述三个阶段实现路径：
  1. 基础流式能力与 UI 实时更新
  2. 基于事件总线的高级异步交互
  3. 引擎原生支持节点间实时流
     包含各阶段设计细节、关键组件和实现方案，为后续开发提供指导
- docs(架构设计): 更新本地用户系统设计方案，增加 API Key 扩展
  更新本地用户系统设计方案文档，新增 API Key 机制支持程序化访问，完善用户上下文类型定义和 API 设计。主要变更包括：
  1. 新增 API Key 数据结构和管理流程
  2. 扩展 UserContext 类型支持三种运行模式
  3. 新增 API Key 相关接口设计
  4. 补充安全考虑和实施阶段规划
- docs: 移动到 old.
- docs: 移动到 old
- docs(architecture): 添加本地用户系统设计方案文档
  添加详细的本地用户系统设计方案文档，描述三种核心使用模式（纯本地自用、个人远程访问和多用户共享）的设计目标、配置机制、用户交互流和 API 设计。文档包含完整的系统架构说明和安全考虑，为后续实现提供基础。
- docs(架构): 添加应用面板集成方案及相关设计文档
  新增应用面板集成方案的架构设计文档，包括总览文档和四个详细子文档：
  1. 应用面板规范与生命周期管理
  2. API 服务与集成接口设计
  3. 执行核心与安全保障
  4. 开发者生态与支持
     这些文档详细规划了 ComfyTavern 平台中应用面板的技术实现方案，涵盖面板定义、API 设计、执行流程和安全考虑等多个方面。同时删除了旧的综合性设计文档，将其拆分为更专注的独立文档。
- feat: 移除注释
- refactor(types): 将节点尺寸属性从对象结构改为独立属性
  将 WorkflowStorageNode 接口中的 size 对象拆分为独立的 width 和 height 属性，简化数据结构
  同时更新相关转换器逻辑以适配新的属性结构
- refactor(workflow): 根据设计文档移除未使用的类型和接口
  移除 ExecutePreviewRequestPayload 和 ExecutionType 类型导出，这些类型已根据设计文档不再需要
  重构预览执行逻辑，使用新的 triggerPreview 方法并简化参数传递
  清理 Canvas.vue 中未使用的 currentWorkflowInterface 计算属性

## 2025 年 6 月 4 日

- style: 优化控制台日志格式并添加自定义启动信息
  在 backend/src/index.ts 中添加换行符使日志输出更清晰易读
  在 frontend-vueflow/vite.config.ts 中添加自定义开发模式和预览模式的启动日志，提供更友好的用户体验和调试信息
- style(backend): 改进服务器启动日志的可读性和信息展示
  修改控制台输出格式，添加颜色标记和中英文双语的服务器启动信息，提升开发调试时的可读性和用户体验
- feat: 添加配置文件检查与自动复制功能
  在服务器启动时检查配置文件是否存在，若不存在则从模板文件自动复制创建。确保程序在缺少配置文件时能够正常初始化或给出明确错误提示。
- chore: 更新.gitignore 并添加 config.template.json
  - 将 config.json 添加到.gitignore 以防止提交实际配置文件
  - 添加 config.template.json 作为配置文件模板，包含服务器端口和工作流配置等默认设置
- Merge branch 'main' of https://github.com/ComfyTavern/comfytavern
- docs: 添加核心文档链接和更新目录结构
  在 README 中添加了核心文档的链接，包括节点类型系统和自定义节点开发指南，方便开发者快速查阅。同时更新了项目目录结构说明，更清晰地示后端技术栈和新增的文档目录组织方式。
- docs: 更新前后端 README 文档以完善项目描述
  - 重写后端 README，详细说明核心功能、技术栈和项目结构
  - 重写前端 README，补充可视化编辑器功能和技术实现细节
  - 统一前后端文档风格，提供更清晰的项目说明和开发指引
- docs(Updatelog): 更新设计文档变更记录
  - 新增 2025 年 6 月 1 日至 4 日的详细更新记录
  - 记录功能新增、问题修复、架构优化等多项变更
  - 完善文档结构，保持更新日志的完整性和时效性
- fix(workflow): 修复删除节点时未正确处理关联边的问题
  新增逻辑识别因节点删除而隐式删除的边，确保同时更新相关节点的 inputConnectionOrders。优化了删除元素的处理流程，避免因节点删除导致边残留或状态不一致。（其实这里同时修复了节点删除的状态更新问题，但 AI 没有识别出进更新日志）
- style(节点样式): 修复节点头部右侧布局和文本换行问题
  调整节点头部右侧容器的 flex-shrink 属性防止布局压缩，并为分类标签添加 nowrap 防止文本换行

- refactor(node-resize): 优化节点宽度计算逻辑并调整参数

  - 移除未使用的 NODE_DESC_FONT 导入
  - 定义更具体的 UseNodeResizeProps 接口
  - 调整自动计算宽度限制值（MAX_NODE_WIDTH 1200，AUTO_CALC_MAX_WIDTH 420）
  - 重构 calculateMinWidth 方法，移除描述参数并添加分类标签计算
  - 改进输入/输出插槽宽度计算逻辑

- fix(节点加载): 修正自定义节点路径加载问题并改进节点重载逻辑

  - 修复项目根目录路径计算错误，从 apps/backend/src 正确返回到 comfytavern 根目录
  - 在节点路由中区分内置节点路径和自定义节点路径
  - 添加自定义节点路径配置的导入
  - 改进节点重载流程，分别处理内置节点和自定义节点
  - 增加更详细的日志输出以便调试

- fix(节点加载): 修复自定义节点路径解析和错误处理

  1. 将自定义节点路径解析为绝对路径，确保在不同环境下都能正确加载
  2. 改进 NodeLoader 的错误处理逻辑，对目录不存在的情况提供更友好的警告提示
  3. 优化日志输出格式，合并重复的日志信息并增加更多上下文信息

- refactor(架构文档): 简化项目与知识库架构文档结构

  - 移除冗余字段如 alt_text, caption, editor_description 等，将相关元数据合并到 metadata 字段
  - 简化知识库引用结构，去除 type 和 path 字段，统一使用 source_id 标识
  - 删除不再使用的 variable_handling 和 templateUsed 字段
  - 优化文档结构使其更简洁易维护

- docs(architecture): 完善知识库架构文档中的嵌入模型配置和动态引用机制
  - 详细说明嵌入模型配置的优先级和回退机制
  - 新增 CAIU 动态内容引用规范，包括引用格式、解析规则和循环检测
  - 补充编辑器集成说明和标签机制
  - 更新 CAIU 条目类型和组 CAIU 的处理逻辑
  - 明确角色卡数据将转换为结构化 CAIU 条目
- docs(架构设计): 添加项目与知识库架构规划 v2 文档
  新增 ComfyTavern 项目与知识库架构规划 v2 文档，详细说明以下核心概念：
  - 工程项目(Project)的组织结构
  - 知识库(Knowledge Base)的 CAIU 原子信息单元设计
  - 工作流(Workflow)与核心节点类型
  - 统一项目结构与 project.json 规范
  - 知识库管理与引用机制
    该文档取代旧版架构规划，为后续开发提供设计依据。

## 2025 年 6 月 3 日

- docs(guides): 更新自定义节点开发文档以反映路径变更
  更新中英文文档，明确区分内置节点和自定义/第三方节点的存放路径。现在：
  1. 内置节点存放在 `apps/backend/src/nodes/`
  2. 自定义节点默认存放在 `plugins/nodes/`，可通过 `config.json` 的 `customNodePaths` 配置
  3. 更新所有示例路径和相关说明
- feat(节点加载): 添加自定义节点路径配置支持
  - 在 config.json 中添加 customNodePaths 配置项，用于指定自定义节点路径
  - 修改 config.ts 导出 CUSTOM_NODE_PATHS 常量
  - 更新 index.ts 以支持从配置路径加载自定义节点
  - 创建 plugins/nodes 目录及.gitignore 文件，忽略除指定文件外的所有内容
- docs: 更新节点类型文档并添加自定义节点开发指南
  添加两个新的操作提示标签 `CanPreview` 和 `NoDefaultEdit` 到节点类型文档
  在输入定义中新增 `actions` 属性用于定义输入槽操作按钮
  创建完整的中英文自定义节点开发指南文档，包含节点定义、执行逻辑和前端渲染等详细说明
- docs(node-types): 更新节点类型文档，添加 UI_BLOCK 和 hideHandle 说明
  添加了两个新的配置项说明：
  1. UI_BLOCK 标签用于提示前端将输入组件渲染为块级元素
  2. hideHandle 选项用于隐藏连接点手柄
- docs(node-types): 添加 UI_BLOCK 类型和 hideHandle 选项说明
  在节点类型文档中添加了 UI_BLOCK 类型的说明，用于标记块级元素渲染方式。同时新增了 hideHandle 选项的文档说明，用于控制是否显示
  接点。
- feat(节点): 添加隐藏连接点支持并优化 UI 块级渲染
  - 在 SlotDefinitionBase 接口和 GroupSlotInfoSchema 中添加 hideHandle 字段，用于控制连接点(Handle)的显示
  - 为多个节点添加 UiBlock 匹配类别，统一处理块级 UI 元素的渲染逻辑
  - 修改 BaseNode.vue 组件，根据 hideHandle 字段和 UiBlock 类别调整连接点和输入组件的显示条件
  - 移除过时的条件判断，简化 UI 块级渲染逻辑
- fix: 移除错误的文档
- docs(architecture): 更新节点输入渲染重构方案文档
  - 简化 `SlotUIDescriptor` 结构，明确其核心职责为决定主输入组件名称
  - 调整 `SlotUIDescriptorFactory` 设计，使其保持轻量化
  - 移除 `TRIGGER` Category，改为通过 `config.component` 明确指定按钮组件
  - 优化 `BaseNode.vue` 的改造方案，强调模板简化和职责分离
  - 更新实施步骤，增加对现有节点定义的审查要求
- refactor(architecture): 优化 `BaseNode.vue` 模板渲染逻辑，引入 `SlotUIDescriptorFactor`
  - **`SlotUIDescriptorFactory`** 的职责更清晰：用于生成描述插槽 UI 渲染的 `SlotUIDescriptor` 对象，包含组件名称、属性、布
    提示等。
  - **`BaseNode.vue` 的模板**：根据 `SlotUIDescriptor` 属性进行条件渲染，简化了模板中的逻辑判断，通过动态组件 `<component :is="slotUIDescriptor.componentName" ... />` 实现复杂 UI 的渲染。
  - **输入定义的 `labelText`**：明确其来源为 `inputDefinition.displayName`，对于按钮类输入，可能来源于 `inputDefinition.config.label`。
  - **`languageHint`**：明确其为前端组件如 `RichCodeEditor` 期望的 prop 名称。
  - **`default`, `placeholder`, `label`**：主要用于按钮类型输入的显示文本。
  - **节点定义**：审查并修改部分现有节点的输入定义，确保所有期望渲染为“大块”内联组件的输入都在其 `config` 中添加 `multiline: true`。
  - **`getInputComponent` 函数**：其职责可能会被 `SlotUIDescriptorFactory` 吸收或调整。
  - **预期收益**：优化 `BaseNode.vue` 的模板结构，使其条件渲染逻辑更清晰，降低维护成本；UI 渲染决策逻辑高度集中和内聚，更于理解、测试和扩展；节点输入 UI 的行为定义更加清晰、声明式和统一；提高添加新输入类型或 UI 变体的效率和安全性。
  - **设计步骤**：
    - 设计 `SlotUIDescriptorFactory` 的详细逻辑。
    - 识别并修改需要更新 `config.multiline: true` 的现有节点定义。
    - （可选）进一步评估是否确实需要 `UI_NO_DEFAULT_INPUT_INPUT_WIDGET` Category，或者是否有其他方式实现其意图。
    - 分步实施：先从 `SlotUIDescriptor` 定义和 `SlotUIDescriptorFactory` 的骨架开始，逐步将 `BaseNode.vue` 中的输入渲染逻辑重构为基于 `SlotUIDescriptor`，最后更新节点定义和相关文档。
- fix(ui): 修正节点输入操作栏的自定义动作顺序

## 2025 年 6 月 2 日

- docs: 添加 .VSCodeCounter 到 .gitignore
- docs(rules): 添加通用类型导入路径说明到规则文档
  在规则文档中补充了关于通用类型导入路径`@comfytavern/types`的说明，明确其通过`index.ts`统一注册所有通用类型定义的功能。
- docs(architecture): 添加节点输入 UI 渲染重构规划文档并移除废弃字段
  添加详细的架构设计文档，规划如何重构节点输入 UI 渲染逻辑以实现解耦和可维护性。
  同时移除动态节点输入动作中不再使用的 showConditionKey 字段。
- feat(regex): 实现内联正则规则编辑器功能
  新增正则规则编辑器功能，包括：
  1. 在 ApplyRegexNode 节点中添加内联规则编辑支持
  2. 创建 RegexEditorModal 模态框组件用于规则管理
  3. 添加 InlineRegexRuleDisplay 组件显示规则列表
  4. 更新类型定义和校验逻辑
     相关变更涉及前端组件、后端节点逻辑和类型定义，提供完整的正则规则编辑体验。
- feat(节点输入): 实现动态输入操作按钮系统
  添加 NodeInputAction 类型定义和 NodeInputActionsBar 组件，支持通过 matchCategories 语义标签和 actions 数组动态控制输入槽作按钮。移除 BaseNode.vue 中硬编码的按钮逻辑，改为由输入定义驱动。
  新增设计文档说明动态按钮方案，更新测试节点以使用 CanPreview 标签。核心变更包括：
  1. 在 schemas.ts 中添加 NodeInputAction 类型和 CanPreview/NoDefaultEdit 标签
  2. 在 node.ts 的 InputDefinition 中添加 actions 字段
  3. 实现 NodeInputActionsBar 组件处理按钮渲染和交互
  4. 重构 BaseNode.vue 使用新组件处理按钮逻辑
- style(侧边栏): 优化节点面板和侧边栏的样式细节
  - 将添加节点的"+"文本替换为 SVG 图标，提升视觉一致性
  - 调整侧边栏图标的内边距和间距，改善布局
  - 为节点拖拽手柄添加边框样式，增强可视性
  - 统一各部分的间距和字体大小，提高整体协调性
- feat(侧边栏): 添加节点面板折叠状态本地存储功能
  在 NodePanel.vue 组件中新增 localStorage 持久化功能，用于保存和恢复节点面板的折叠状态。当用户切换折叠状态时自动保存到 localStorage，并在组件挂载时从 localStorage 加载之前的状态。同时添加错误处理以防止数据格式异常导致的问题。

## 2025 年 6 月 1 日

- docs(architecture): 新增前端主导的工作流预览执行方案文档
  添加详细的设计文档，阐述前端主导的工作流预览执行方案。该方案将智能决策和子图构建逻辑移至前端，后端仅执行标准工作流，从而现高效预览并简化后端逻辑。
  主要变更包括：
  - 前端负责构建迷你预览工作流并处理边界输入
  - 后端保持标准执行逻辑不变
  - 详细说明核心流程、API 调整和实现要点
  - 包含 Mermaid 流程图和具体修改计划
- style(workflowFlattener): 修正代码缩进和格式
- refactor(workflowTransformer): 移除调试日志代码
  清理 transformVueFlowToCoreWorkflow 函数中的调试日志代码，这些日志已不再需要且影响代码整洁性
- docs: 更新 README.md 中的状态描述和功能说明
- refactor(services): 将节点管理相关文件移动到 services 目录
  将 NodeManager 和 NodeLoader 及相关引用从 nodes 目录移动到 services 目录，以更好地组织代码结构。同时更新所有相关文件的引用路径。
- docs(guides): 添加自定义节点开发指南文档
  添加详细的 ComfyTavern 自定义节点开发指南，包含节点定义、执行逻辑、前端渲染等完整说明。该文档将帮助开发者快速上手创建功能强大且易于维护的自定义节点。
- 更新日志
- chore: 更新版本号
  将版本号从 0.0.5 更新为 0.0.6，以反映最近的代码更改。
- refactor: 移除调试日志以清理代码
  清理多个文件中的调试日志输出，包括 ExecutionEngine、websocket handler、GroupInputNode 以及前端相关的 websocket 和 workflow 执行逻辑。这些调试日志在开发阶段有用，但在生产环境中会带来不必要的控制台输出。
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
    新增功能允许用户为节点和插槽提供自定义描述，会覆盖节点定义中的默认描述。同时改进了节点转换逻辑，确保正确处理输入/输出的默认值和描述信息。添加的调试日志有助于排查工作流转换和扁平化过程中的问题。
- fix: 修正工作流数据保存时的日志打印和默认工作流的坐标位置
  - 修改 `useWorkflowData.ts` 文件中保存新工作流和更新工作流时的日志打印，从使用模板字符串改为直接打印对象。
  - 调整 `DefaultWorkflow.json` 文件中默认工作流输入和输出组的坐标位置，使其符合预期布局。
- fix(workflow): 修复对引用工作流的支持
  在 useWorkflowData 和 workflowTransformer 中添加 referencedWorkflows 字段，用于存储和管理被引用的工作流 ID。当节点类型为 NodeGroup 时，会收集其引用的工作流 ID 并存储在核心工作流数据中。
- refactor(schemas): 重构插槽定义结构并提取公共辅助函数
  将 GroupSlotInfoSchema 重构为继承 SlotDefinitionBase 的结构，提取公共插槽属性到基础接口。创建 useSlotDefinitionHelper 组合式函数统一处理插槽定义获取逻辑，替代各处的重复代码。
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
  添加一个调试按钮用于将当前工作流状态以 JSON 格式输出到控制台，方便开发时查看工作流数据。使用 transformVueFlowToCoreWorkflow 函数转换数据格式，确保输出内容与核心工作流数据结构一致。
- feat(节点组): 实现节点组动态接口同步与边类型验证
  1. 在节点组组件中动态加载并同步引用工作流的输入输出接口，不再保存静态插槽定义
  2. 增强边类型验证逻辑，支持从节点组接口动态获取类型信息
  3. 改进工作流转换器，异步加载节点组引用工作流并填充接口数据
  4. 优化节点组创建逻辑，正确处理嵌套节点组的接口继承
     重构工作流加载逻辑，确保节点组接口在加载时动态获取。边验证现在会优先检查节点组动态接口，回退到静态定义。移除了阻塞 UI 的 alert 提示，改为日志记录。

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
  修改 TextAreaInput 和 JsonInlineViewer 组件中的 wheel 事件处理，将 passive 选项从 false 改为 true。这可以提升滚动性能，因为浏览器不再需要等待事件处理完成才能执行滚动。
- fix(节点组): 修复节点组连接验证和分组逻辑中的类型处理问题
  改进节点组连接验证逻辑，正确处理带命名空间的节点类型。优化节点组创建流程，添加调试日志并确保类型兼容性检查的准确性。
  重构节点组创建工作流转换逻辑，使用 transformVueFlowToCoreWorkflow 进行格式转换。添加详细的调试日志帮助追踪分组过程中的连接处理情况。
  修复边界情况下节点类型解析问题，确保组输入/输出能正确匹配内部节点的数据流类型。同时改进不兼容连接的用户提示信息。
- feat(节点组): 允许单个节点创建组并更新提示信息
  - 允许用户选择单个节点创建节点组
  - 更新相关提示信息，明确告知用户至少需要选择一个节点
  - 优化节点组创建逻辑，确保在单节点情况下也能正确处理
- docs(架构): 添加应用面板集成方案设计文档
  新增应用面板集成方案设计文档，详细阐述了 ComfyTavern 如何将复杂工作流封装为面向最终用户的交互式应用面板。文档内容包括核心概念、技术选型、交互设计、数据流、API 接口、扩展性及未来展望。
- docs:移动已实施计划到 old
  将已完成或部分完成的计划文档（如 action-plan-project-refactor.md, backend-driven-preview-plan.md 等）移动到 DesignDocs/old 目录下，以保持文档结构的清晰和整洁。
- docs(architecture): 添加 ComfyTavern Agent 架构规划草案文档
  新增 ComfyTavern Agent 架构规划草案文档，初步探讨了 Agent 的核心功能、技术选型、模块设计、交互流程以及与现有系统的集成方案。该文档为后续 Agent 功能的详细设计和开发奠定了基础。
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
- 初始提交到 GitHub

------ 旧记录，顺序时间排序，提交记录在旧分支，懒得考据时间了 ------

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
