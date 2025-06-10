<template>
  <div class="performance-panel p-4 h-full flex flex-col text-sm">
    <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">节点组件统计</h3>
    <div class="flex items-center mb-4 space-x-2">
      <button @click="collectStats"
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex-grow">
        统计当前画布数据
      </button>
      <button @click="copyStatsToClipboard" title="复制统计数据"
        :disabled="!stats.length || loading"
        class="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">正在统计...</div>

    <div v-if="!loading && stats.length > 0" class="flex-1 overflow-y-auto">
      <ul class="space-y-1">
        <li v-for="(item, index) in stats" :key="index">
          <div @click="toggleItem(item)"
            class="flex justify-between items-center p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            :class="{ 'bg-gray-50 dark:bg-gray-700/50': item.children && item.children.length > 0 }">
            <span class="font-medium text-gray-700 dark:text-gray-300">
              <span v-if="item.children && item.children.length > 0" class="mr-1 inline-block w-4 text-center">
                {{ item.expanded ? '▼' : '►' }}
              </span>
              <span v-else class="mr-1 inline-block w-4"></span>
              {{ item.label }}
            </span>
            <span class="text-gray-600 dark:text-gray-400">{{ item.count }}</span>
          </div>
          <ul v-if="item.expanded && item.children"
            class="pl-3 mt-1 space-y-1 border-l border-gray-200 dark:border-gray-600 ml-1">
            <li v-for="(child, childIndex) in item.children" :key="childIndex">
              <div @click="toggleItem(child)"
                class="flex justify-between items-center p-1.5 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                :class="{ 'bg-gray-50 dark:bg-gray-700/50': child.children && child.children.length > 0 }">
                <span class="text-gray-600 dark:text-gray-300">
                  <span v-if="child.children && child.children.length > 0" class="mr-1 inline-block w-4 text-center">
                    {{ child.expanded ? '▼' : '►' }}
                  </span>
                  <span v-else class="mr-1 inline-block w-4"></span>
                  {{ child.label }}
                </span>
                <span class="text-gray-500 dark:text-gray-400">{{ child.count }}</span>
              </div>
              <ul v-if="child.expanded && child.children"
                class="pl-3 mt-1 space-y-1 border-l border-gray-200 dark:border-gray-600 ml-1">
                <li v-for="(grandChild, grandChildIndex) in child.children" :key="grandChildIndex">
                  <div class="flex justify-between items-center p-1 rounded">
                    <span class="text-gray-500 dark:text-gray-400 ml-2">{{ grandChild.label }}</span>
                    <span class="text-gray-500 dark:text-gray-400">{{ grandChild.count }}</span>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </div>
    <div v-if="!loading && stats.length === 0 && collected" class="text-gray-500 dark:text-gray-400">
      没有收集到数据，或者画布为空。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useVueFlow } from '@vue-flow/core';
import { useClipboard } from '@/composables/useClipboard';
import { useDialogService } from '@/services/DialogService'; // 新增导入
import { useNodeStore } from '@/stores/nodeStore';
import { useTabStore } from '@/stores/tabStore';
import { usePerformanceStatsStore } from '@/stores/performanceStatsStore';
import type { Node, Edge } from '@vue-flow/core';
import type { InputDefinition, OutputDefinition } from '@comfytavern/types';

export interface StatItem {
  label: string;
  count: number;
  expanded?: boolean;
  children?: StatItem[];
}

const { getNodes, getEdges } = useVueFlow();
const nodeStore = useNodeStore();
const tabStore = useTabStore();
const performanceStatsStore = usePerformanceStatsStore();
const dialogService = useDialogService(); // 新增导入

const { writeText, error: clipboardError, isSupported: clipboardIsSupported } = useClipboard();

// 从 store 获取当前激活标签页的统计信息
const currentTabId = computed(() => tabStore.activeTab?.internalId);

const stats = computed((): StatItem[] => {
  if (!currentTabId.value) return [];

  const canvasStats = performanceStatsStore.getStats(currentTabId.value) || [];
  const componentRawStats = performanceStatsStore.getComponentStats(currentTabId.value);

  const componentStatItems: StatItem[] = [];
  if (componentRawStats && Object.keys(componentRawStats).length > 0) {
    const children: StatItem[] = Object.entries(componentRawStats)
      .map(([type, count]) => ({ label: type, count }))
      .sort((a, b) => a.label.localeCompare(b.label)); // 按类型名称排序

    if (children.length > 0) {
      componentStatItems.push({
        label: '各类节点中所用组件实例数量', // 顶级标签
        count: children.reduce((sum, item) => sum + item.count, 0), // 总实例数
        children: children,
        expanded: true, // 默认展开
      });
    }
  }
  // 将组件统计放在画布统计之前或之后，根据偏好调整
  return [...canvasStats, ...componentStatItems];
});

const loading = computed(() => {
  if (!currentTabId.value) return false;
  return performanceStatsStore.isLoading(currentTabId.value);
});

const collected = computed(() => {
  if (!currentTabId.value) return false;
  return performanceStatsStore.hasCollected(currentTabId.value);
});

const toggleItem = (item: StatItem) => {
  if (item.children && item.children.length > 0) {
    item.expanded = !item.expanded;
    // 注意：这个修改是针对 computed 返回的数组中的对象的，
    // 如果希望这个状态持久化，StatItem 自身也需要被 store 管理，或者在 setStats 时深拷贝。
    // 目前，这个展开状态只在当前组件实例生命周期内有效，或者如果 KeepAlive 缓存了组件。
  }
};

const collectStats = async () => {
  if (!currentTabId.value) {
    console.warn('PerformancePanel:无法收集统计信息，当前标签页 ID 无效。');
    return;
  }
  const tabId = currentTabId.value;

  performanceStatsStore.setLoading(tabId, true);

  // VueFlow 的 getNodes/getEdges 应该是响应式的
  const nodes: Node[] = getNodes.value;
  const edges: Edge[] = getEdges.value;

  if (!nodes || nodes.length === 0) {
    performanceStatsStore.setStats(tabId, []);
    performanceStatsStore.setLoading(tabId, false);
    return;
  }

  const calculatedStats: StatItem[] = [];

  // 1. 节点总数
  const nodeCount = nodes.length;
  const nodeStatsItem: StatItem = { label: '节点总数', count: nodeCount, children: [], expanded: true };

  // 2. 各类型节点数量
  const nodeTypes: Record<string, number> = {};
  nodes.forEach(node => {
    const type = node.type || '未知类型';
    nodeTypes[type] = (nodeTypes[type] || 0) + 1;
  });
  Object.entries(nodeTypes).forEach(([type, count]) => {
    nodeStatsItem.children?.push({ label: type, count });
  });
  calculatedStats.push(nodeStatsItem);

  // 3. 连线总数
  calculatedStats.push({ label: '连线总数', count: edges.length, expanded: true });


  // 4. 槽位统计 (包括输入、输出、配置)
  let totalInputSlots = 0;
  let totalOutputSlots = 0;
  let totalConfigSlotInstances = 0; // 新增: 配置槽位实例总数

  const inputSlotTypes: Record<string, number> = {};
  const outputSlotTypes: Record<string, number> = {};
  const configSlotKeyCounts: Record<string, number> = {}; // 新增: 各配置槽位键名的计数

  await nodeStore.ensureDefinitionsLoaded();

  nodes.forEach(node => {
    const nodeDefinition = nodeStore.getNodeDefinitionByFullType(node.type as string);

    if (nodeDefinition) {
      // 处理输入和输出槽位 (来自 nodeDefinition.inputs 和 nodeDefinition.outputs)
      const processNormalSlots = (slotDefinitions: Record<string, InputDefinition | OutputDefinition> | undefined, isInput: boolean) => {
        if (slotDefinitions) {
          Object.values(slotDefinitions).forEach((slotDef: InputDefinition | OutputDefinition) => {
            if (isInput) {
              totalInputSlots++;
              const typeKey = slotDef.dataFlowType;
              inputSlotTypes[typeKey] = (inputSlotTypes[typeKey] || 0) + 1;
            } else {
              totalOutputSlots++;
              const typeKey = slotDef.dataFlowType;
              outputSlotTypes[typeKey] = (outputSlotTypes[typeKey] || 0) + 1;
            }
          });
        }
      };
      processNormalSlots(nodeDefinition.inputs, true);
      processNormalSlots(nodeDefinition.outputs, false);

      // 处理配置槽位 (来自 nodeDefinition.configSchema)
      if (nodeDefinition.configSchema) {
        Object.keys(nodeDefinition.configSchema).forEach(configKey => {
          totalConfigSlotInstances++;
          const configDef = nodeDefinition.configSchema![configKey];
          // 优先使用 displayName，如果不存在则用 key 作为统计标签
          if (configDef) {
            const keyForDisplay = configDef.displayName || configKey;
            configSlotKeyCounts[keyForDisplay] = (configSlotKeyCounts[keyForDisplay] || 0) + 1;
          } else {
            // 后备：如果 configDef 意外地未定义，则直接使用 configKey
            configSlotKeyCounts[configKey] = (configSlotKeyCounts[configKey] || 0) + 1;
          }
        });
      }

    } else { // 如果没有 nodeDefinition，尝试从 node.data 回退 (主要针对输入输出，配置项必须有定义)
      const inputsFromData = node.data?.inputs;
      const outputsFromData = node.data?.outputs;

      if (inputsFromData) {
        Object.values(inputsFromData).forEach((slotDefValue: unknown) => {
          totalInputSlots++;
          let typeKey = '未知';
          if (slotDefValue && typeof slotDefValue === 'object' && 'dataFlowType' in slotDefValue && typeof (slotDefValue as any).dataFlowType === 'string') {
            typeKey = (slotDefValue as any).dataFlowType;
          }
          inputSlotTypes[typeKey] = (inputSlotTypes[typeKey] || 0) + 1;
        });
      }
      if (outputsFromData) {
        Object.values(outputsFromData).forEach((slotDefValue: unknown) => {
          totalOutputSlots++;
          let typeKey = '未知';
          if (slotDefValue && typeof slotDefValue === 'object' && 'dataFlowType' in slotDefValue && typeof (slotDefValue as any).dataFlowType === 'string') {
            typeKey = (slotDefValue as any).dataFlowType;
          }
          outputSlotTypes[typeKey] = (outputSlotTypes[typeKey] || 0) + 1;
        });
      }
    }
  });

  // 总槽位数 = 输入 + 输出 + 配置项实例
  const overallTotalSlots = totalInputSlots + totalOutputSlots + totalConfigSlotInstances;
  const slotStatsItem: StatItem = { label: '槽位总数', count: overallTotalSlots, children: [], expanded: true };

  // 1. 输入槽位子项
  const inputSlotChildren: StatItem[] = [];
  Object.entries(inputSlotTypes).sort(([a], [b]) => a.localeCompare(b)).forEach(([type, count]) => {
    inputSlotChildren.push({ label: type, count });
  });
  // 总是显示输入槽位类别，即使数量为0
  slotStatsItem.children?.push({
    label: '输入槽位',
    count: totalInputSlots,
    children: inputSlotChildren.length > 0 ? inputSlotChildren : undefined,
    expanded: false
  });

  // 2. 输出槽位子项
  const outputSlotChildren: StatItem[] = [];
  Object.entries(outputSlotTypes).sort(([a], [b]) => a.localeCompare(b)).forEach(([type, count]) => {
    outputSlotChildren.push({ label: type, count });
  });
  // 总是显示输出槽位类别，即使数量为0
  slotStatsItem.children?.push({
    label: '输出槽位',
    count: totalOutputSlots,
    children: outputSlotChildren.length > 0 ? outputSlotChildren : undefined,
    expanded: false
  });

  // 3. 配置槽位子项
  const configSlotChildren: StatItem[] = [];
  Object.entries(configSlotKeyCounts).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, count]) => {
    configSlotChildren.push({ label: key, count }); // label 是配置项的 displayName 或 key
  });
  // 总是显示配置槽位类别，即使数量为0
  slotStatsItem.children?.push({
    label: '配置槽位',
    count: totalConfigSlotInstances,
    children: configSlotChildren.length > 0 ? configSlotChildren : undefined,
    expanded: false
  });

  calculatedStats.push(slotStatsItem);
  // 已移除之前独立的 "5. 配置项总数" 部分

  performanceStatsStore.setStats(tabId, calculatedStats);
};

const copyStatsToClipboard = async () => {
  if (!stats.value || stats.value.length === 0) {
    dialogService.showWarning('没有可复制的统计数据。', '提示');
    return;
  }
  // clipboardIsSupported 来自 useClipboard，它不是 ref，直接使用
  if (!clipboardIsSupported) {
    dialogService.showError('您的浏览器不支持或未授权剪贴板写入操作。', '错误');
    return;
  }

  const statsJson = JSON.stringify(stats.value, null, 2);
  await writeText(statsJson);

  if (clipboardError.value) {
    dialogService.showError(`复制失败: ${clipboardError.value.message}`, '错误');
    console.error('复制统计数据失败:', clipboardError.value);
  } else {
    dialogService.showSuccess('统计数据已复制到剪贴板！', '成功');
  }
};

</script>

<style scoped>
.performance-panel {
  /* 可以添加特定于此面板的样式 */
}
</style>