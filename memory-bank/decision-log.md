## 工作流执行引擎项目决策日志

### 2025/05/22 - 项目启动与优先级决策
- **决策概述**：启动工作流执行引擎实现项目，基于设计文档[`DesignDocs/architecture/workflow-execution-plan-v2.md`](DesignDocs/architecture/workflow-execution-plan-v2.md)和[`DesignDocs/architecture/floating-preview-editor-design.md`](DesignDocs/architecture/floating-preview-editor-design.md)。
- **优先级调整**：根据用户反馈，决定优先实现工作流执行引擎的核心功能，确保工作流能够运行，随后再增加外围功能。
- **具体优先级**：
  1. **节点绕过机制**：实现`handleBypassedNode`逻辑、智能穿透算法和伪输出生成。
  2. **输入验证机制**：启用节点执行前的必需输入验证。
  3. **基本执行流程**：确保完整的工作流执行逻辑，包括拓扑排序和节点执行。
  4. **前端UI反馈**：实现绕过节点的视觉提示和基本状态更新。
  5. **实时预览执行**：作为次要优先级，待核心功能完成后实现。
  6. **基础服务集成**：如输出管理器和历史记录服务，作为后续功能。
- **来源**：用户反馈和"Code"模式子任务的差距分析报告。