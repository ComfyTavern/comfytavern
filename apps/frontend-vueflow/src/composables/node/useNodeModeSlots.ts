import { computed, type Ref } from 'vue';
import type { NodeProps } from '@vue-flow/core';
import type { InputDefinition, OutputDefinition, NodeModeDefinition, NodeDefinition, DisplayInputSlotInfo, DisplayOutputSlotInfo } from '@comfytavern/types';
import { klona } from 'klona';

/**
 * 处理节点多模式逻辑的 Composable。
 * 根据当前选定的模式，动态提供节点的输入和输出插槽定义。
 */
export function useNodeModeSlots(props: NodeProps) {
  const nodeData = computed(() => props.data as NodeDefinition);

  // 获取当前选定的模式ID
  const currentModeId: Ref<string | undefined> = computed(() => {
    const modeConfigKey = nodeData.value.modeConfigKey;
    if (modeConfigKey && nodeData.value.configValues) {
      return nodeData.value.configValues[modeConfigKey] as string;
    }
    return nodeData.value.defaultModeId; // 如果没有配置模式键，使用默认模式ID
  });

  // 获取当前模式的定义
  const currentModeDefinition: Ref<NodeModeDefinition | undefined> = computed(() => {
    if (nodeData.value.modes && currentModeId.value) {
      return nodeData.value.modes[currentModeId.value];
    }
    return undefined;
  });

  // 根据当前模式动态计算最终的输入插槽
  const finalInputs: Ref<DisplayInputSlotInfo[]> = computed(() => {
    let inputs: Record<string, InputDefinition> = {};

    // 优先使用当前模式的输入定义
    if (currentModeDefinition.value?.inputs) {
      inputs = klona(currentModeDefinition.value.inputs);
    } else if (nodeData.value.inputs) {
      // 如果没有模式定义，或者当前模式没有指定输入，则使用节点默认的输入定义
      inputs = klona(nodeData.value.inputs);
    }

    // 将对象转换为数组并返回
    return Object.entries(inputs).map(([key, def]) => ({ ...def, key }));
  });

  // 根据当前模式动态计算最终的输出插槽
  const finalOutputs: Ref<DisplayOutputSlotInfo[]> = computed(() => {
    let outputs: Record<string, OutputDefinition> = {};

    // 优先使用当前模式的输出定义
    if (currentModeDefinition.value?.outputs) {
      outputs = klona(currentModeDefinition.value.outputs);
    } else if (nodeData.value.outputs) {
      // 如果没有模式定义，或者当前模式没有指定输入，则使用节点默认的输出定义
      outputs = klona(nodeData.value.outputs);
    }

    // 将对象转换为数组并返回
    return Object.entries(outputs).map(([key, def]) => ({ ...def, key }));
  });

  return {
    currentModeId,
    currentModeDefinition,
    finalInputs,
    finalOutputs,
  };
}