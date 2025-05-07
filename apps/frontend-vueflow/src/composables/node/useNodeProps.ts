import { useTabStore } from '@/stores/tabStore';
import { useProjectStore } from '@/stores/projectStore'; // 导入 projectStore
import type { InputType } from '@/components/graph/inputs'; // 假设 InputType 在这里定义
import type { UseNodeStateProps } from './useNodeState'; // 导入修正后的 Props 类型
import { useNodeState } from './useNodeState'; // 导入 useNodeState

export function useNodeProps(props: Readonly<UseNodeStateProps>) {
  const tabStore = useTabStore();
  const projectStore = useProjectStore(); // 获取 projectStore
  const { isInputConnected } = useNodeState(props); // 获取状态检查函数

  // 获取输入组件的 props
  const getInputProps = (input: any, inputKey: string) => {
    const connected = isInputConnected(inputKey);
    const showReceivedValue = input.config?.showReceivedValue === true;
    const configDisabled = input.config?.disabled ?? false;

    // 禁用条件：已连接 或 配置了禁用
    const isDisabled = connected || configDisabled;
    // 只读条件：已连接 且 配置了显示接收值
    const isReadOnly = connected && showReceivedValue;

    const componentProps: Record<string, any> = {
      placeholder: input.config?.placeholder,
      // 最终禁用状态：基础禁用 或 只读状态（只读通常意味着禁用编辑）
      disabled: isDisabled || isReadOnly,
      // 传递 readonly 给支持它的组件 (如 CodeInput)
      ...(isReadOnly && { readonly: true, readOnly: true }), // 传递两种可能的属性名
      // 默认传递 suggestions (如果存在)
      suggestions: input.config?.suggestions,
    };

    switch (input.type as InputType) {
      case 'INT':
      case 'FLOAT':
        componentProps.type = input.type;
        componentProps.min = input.config?.min;
        componentProps.max = input.config?.max;
        componentProps.step = input.config?.step;
        // suggestions 已经在上面默认传递了
        break;
      case 'COMBO':
        // 不再需要特殊处理 options，因为 suggestions 会被默认传递 (见第 30 行)
        // componentProps.options = input.config?.suggestions || []; // 移除此行
        break;
      case 'CODE':
        componentProps.language = input.config?.language || 'text';
        // readOnly/readonly 已经在上面根据 isReadOnly 设置了
        break;
      case 'BUTTON':
        componentProps.label = input.config?.label || input.displayName || String(inputKey);
        // 按钮的禁用逻辑：已连接 或 配置了禁用。不受 showReceivedValue 影响。
        componentProps.disabled = connected || configDisabled;
        // 移除只读属性，按钮没有只读概念
        delete componentProps.readonly;
        delete componentProps.readonly;
        delete componentProps.readOnly;
        break;
      // STRING 类型不需要特殊处理 suggestions，因为它已在上面默认传递
    }
    // 传递节点和工作流上下文给特定输入，例如 EmbeddedGroupSelector
    componentProps.nodeId = props.id; // 传递当前节点的 ID
    componentProps.workflowId = tabStore.activeTabId; // 传递活动工作流的 ID

    return componentProps;
  };

  // 获取配置项组件的 props
  const getConfigProps = (configDef: any, configKey: string) => {
    const { getConfigValue } = useNodeState(props); // 在这里获取 getConfigValue
    const projectId = projectStore.currentProjectId; // 获取当前项目 ID
    // 从 configSchema 的 config 中提取 props
    const configProps = configDef.config || {};
    const isDisabled = props.data.configValues?._disabled?.[configKey] ?? false; // 假设有禁用状态
    const isReadOnly = props.data.configValues?._readonly?.[configKey] ?? false; // 假设有只读状态

    return {
      ...configProps, // 传递来自后端定义的 config
      disabled: isDisabled || isReadOnly || configProps.disabled, // 合并禁用状态
      readonly: isReadOnly || configProps.readonly, // 合并只读状态
      // 其他可能需要的通用 props
      placeholder: configProps.placeholder || configDef.description,
      // 传递节点和工作流上下文，类似于 getInputProps
      nodeId: props.id, // 传递当前节点的 ID
      workflowId: tabStore.activeTabId, // 传递活动工作流的 ID
      projectId: projectId, // 传递当前项目 ID
      // 如果这是 embeddedWorkflowId 或 referencedWorkflowId 选择器，则传递当前的 groupMode
      ...( (configKey === 'embeddedWorkflowId' || configKey === 'referencedWorkflowId') && { groupMode: getConfigValue('groupMode') } ),
      // 为 RESOURCE_SELECTOR 传递 acceptedTypes
      ...( configDef.type === 'RESOURCE_SELECTOR' && { acceptedTypes: configDef.config?.acceptedTypes } )
    };
  };

  return {
    getInputProps,
    getConfigProps,
  };
}