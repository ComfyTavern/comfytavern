flowchart TD
%% 定义暗色主题样式
classDef user fill:#2D3748,stroke:#4299E1,stroke-width:2px,shape:ellipse,color:#EDF2F7
classDef frontend fill:#2D3748,stroke:#ED8936,stroke-width:2px,shape:rounded,color:#EDF2F7
classDef backend fill:#2D3748,stroke:#E53E3E,stroke-width:2px,shape:rounded,color:#EDF2F7
classDef assets fill:#2D3748,stroke:#9F7AEA,stroke-width:2px,shape:rounded,color:#EDF2F7
classDef runtime fill:#2D3748,stroke:#4299E1,stroke-width:2px,shape:rounded,color:#EDF2F7
classDef kb fill:#2D3748,stroke:#48BB78,stroke-width:2px,shape:hexagon,color:#EDF2F7

    %% 用户层
    subgraph UserLayer["<b>用户层</b>"]
        style UserLayer fill:#1A202C,stroke:#4A5568,stroke-width:1px,color:#EDF2F7
        User([最终用户 / 创作者]):::user
    end

    %% 前端应用
    subgraph FrontendApp["<b>前端应用</b>"]
        style FrontendApp fill:#1A202C,stroke:#ED8936,stroke-width:2px,color:#EDF2F7
        AppPanel(应用面板):::frontend
        VueFlowEditor(可视化节点编辑器):::frontend
        SettingsUI(用户设置/密钥管理):::frontend
        ApiAdapterManagerFE["前端ApiAdapterManager"]:::frontend
        InteractionServiceFE["前端InteractionService (P2)"]:::frontend
    end

    %% 后端服务
    subgraph BackendApp["<b>后端服务</b>"]
        style BackendApp fill:#1A202C,stroke:#E53E3E,stroke-width:2px,color:#EDF2F7
        API([HTTP API]):::backend
        AuthService(认证服务):::backend
        WorkflowEngine(工作流引擎):::backend
        AgentSys(Agent系统):::backend
        SceneManager(场景管理器):::backend
        KB_Service(知识库服务):::backend
        WebSocketService([WebSocket服务]):::backend
        DB[(数据库)]:::backend
        LlmAdapterSys["LLM适配器系统 (Router, Registry, ConfigSvc)"]:::backend
        ApiAdapterDefBE["API适配器定义管理"]:::backend
    end

    %% 项目资产层
    subgraph ProjectAssets["<b>项目资产层</b>"]
        style ProjectAssets fill:#1A202C,stroke:#9F7AEA,stroke-width:2px,color:#EDF2F7
        ProjectJSON([project.json]):::assets
        AgentProfileDef(Agent Profile定义):::assets
        WorkflowDef(工作流定义):::assets
        SceneDef(场景定义):::assets
        PanelDef(面板定义):::assets
        ProjectKB(项目知识库):::assets
        ApiAdapterConfig["(前端)ApiAdapter配置"]:::assets
        LlmModelConfig["LLM模型/渠道/组配置"]:::assets
    end

    %% 场景运行时
    subgraph SceneRuntime["<b>场景运行时</b>"]
        style SceneRuntime fill:#1A202C,stroke:#4299E1,stroke-width:2px,color:#EDF2F7
        ActiveAgent(Agent实例):::runtime
        WorldState(世界状态):::runtime
        EventBus(事件总线):::runtime
    end

    %% 知识库
    GlobalKB(全局知识库):::kb

    %% 用户交互
    User --> AppPanel & VueFlowEditor & SettingsUI

    %% 前端到后端
    AppPanel -- "panelApi.executeWorkflow" --> ApiAdapterManagerFE
    ApiAdapterManagerFE -- "原生输入" --> API
    VueFlowEditor --> API
    SettingsUI --> API

    %% API路由与核心服务交互
    API --> AuthService
    API --> WorkflowEngine
    API --> SceneManager
    API --> KB_Service
    API --> LlmAdapterSys
    API --> ApiAdapterDefBE
    API --> AgentSys
    %% API层可以与Agent系统交互 (例如管理Agent实例或Profile)

    %% 后端服务连接
    AuthService --> DB
    SceneManager --> SceneRuntime
    SceneManager --> SceneDef
    SceneManager --> AgentSys
    %% 场景管理器在实例化场景时需要与Agent系统协作
    LlmAdapterSys --> DB
    %% LLM配置存DB
    ApiAdapterDefBE --> DB
    %% ApiAdapter定义存DB

    %% Agent系统核心依赖
    AgentSys --> WorkflowEngine
    %% Agent的核心逻辑由工作流驱动
    AgentSys --> KB_Service
    %% Agent需要访问知识库
    AgentSys --> LlmAdapterSys
    %% Agent的审议工作流可能直接或间接使用LLM

    %% 运行时交互
    SceneRuntime --> ActiveAgent & WorldState & EventBus
    ActiveAgent --> AgentProfileDef
    ActiveAgent -- "执行审议/技能" --> WorkflowEngine
    ActiveAgent -- "感知/交互" --> WorldState
    ActiveAgent -- "感知/发布事件" --> EventBus
    ActiveAgent -- "访问知识" --> KB_Service

    WorkflowEngine -- "执行" --> WorkflowDef
    WorkflowEngine -- "访问知识" --> KB_Service
    WorkflowEngine -- "访问世界状态" --> WorldState
    WorkflowEngine -- "发布/订阅事件" --> EventBus
    WorkflowEngine -- "调用LLM (通过GenericLlmNode)" --> LlmAdapterSys

    %% 知识库连接
    KB_Service --> ProjectKB & GlobalKB

    %% 项目资产关系
    ProjectJSON --> AgentProfileDef & SceneDef & PanelDef & ProjectKB & ApiAdapterConfig & LlmModelConfig
    AgentProfileDef --> WorkflowDef & GlobalKB
    SceneDef --> AgentProfileDef & PanelDef & WorkflowDef
    PanelDef --> WorkflowDef

    %% WebSocket通信
    WebSocketService <--> AppPanel
    WebSocketService <--> InteractionServiceFE
    InteractionServiceFE -- "submit_interaction_result" --> API
    API -- "BE_REQUEST_FE_INTERACTION" --> WebSocketService

    %% 重要组件样式
    classDef important stroke:#ECC94B,stroke-width:4px
    class AppPanel,ActiveAgent,SceneManager,AgentSys,ApiAdapterManagerFE,LlmAdapterSys important

    %% 美化暗色箭头
    linkStyle default stroke:#718096,stroke-width:2px,arrowhead-width:10,arrowhead-length:8
