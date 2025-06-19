<template>
  <div class="performance-panel p-4 h-full flex flex-col text-sm">
    <h3 class="text-lg font-semibold mb-4 text-text-base">{{ t('performancePanel.title') }}</h3>
    <div class="flex items-center mb-4 space-x-2">
      <button @click="collectStats"
        class="px-4 py-2 bg-primary text-primary-content rounded hover:bg-primary hover:brightness-95 transition-colors flex-grow">
        {{ t('performancePanel.collectButton') }}
      </button>
      <button @click="copyStatsToClipboard" :title="t('performancePanel.copyTooltip')" :disabled="!stats.length || loading"
        class="p-2 bg-background-surface text-text-base rounded hover:bg-background-surface hover:brightness-95 dark:hover:brightness-105 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
          stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="text-text-secondary">{{ t('performancePanel.loadingMessage') }}</div>

    <div v-if="!loading && stats.length > 0" class="flex-1 overflow-y-auto">
      <ul class="space-y-1">
        <li v-for="(item, index) in stats" :key="index">
          <div @click="toggleItem(item)"
            class="flex justify-between items-center p-2 rounded cursor-pointer hover:bg-neutral-softest dark:hover:bg-neutral-soft"
            :class="{ ' bg-primary/20': item.children && item.children.length > 0 }">
            <span class="font-medium text-text-base flex items-start">
              <!-- 箭头/占位符容器 (固定宽度，防止被压缩) -->
              <span class="shrink-0">
                <span v-if="item.children && item.children.length > 0"
                  class="mr-1 inline-flex items-center justify-center w-5 h-5 text-text-secondary transform transition-transform duration-150"
                  :class="[item.expanded ? 'rotate-0' : '-rotate-90']">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-full w-full" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clip-rule="evenodd" />
                  </svg>
                </span>
                <span v-else class="mr-1 inline-block w-5"></span> <!-- 占位符 -->
              </span>

              <!-- 文本内容容器 -->
              <span class="flex flex-col">
                <span>{{ item.label }}</span>
                <span v-if="item.originalType" class="text-xs text-text-muted">
                  ({{ item.originalType }})
                </span>
              </span>
            </span>
            <span class="text-text-secondary">{{ item.count }}</span>
          </div>
          <!-- 子级列表 -->
          <ul v-if="item.expanded && item.children"
            class="pl-1 mt-1 space-y-1 border-l border-border-base ml-1">
            <li v-for="(child, childIndex) in item.children" :key="childIndex">
              <div @click="toggleItem(child)"
                class="flex justify-between items-center p-1.5 rounded cursor-pointer hover:bg-neutral-softest dark:hover:bg-neutral-soft"
                :class="{ ' bg-primary/30': child.children && child.children.length > 0 }">
                <span class="text-text-secondary dark:text-text-base flex items-start">
                  <!-- 箭头/占位符容器 (固定宽度，防止被压缩) -->
                  <span class="shrink-0">
                    <span v-if="child.children && child.children.length > 0"
                      class="mr-1 inline-flex items-center justify-center w-5 h-5 text-text-secondary transform transition-transform duration-150"
                      :class="[child.expanded ? 'rotate-0' : '-rotate-90']">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-full w-full" viewBox="0 0 20 20"
                        fill="currentColor">
                        <path fill-rule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clip-rule="evenodd" />
                      </svg>
                    </span>
                    <span v-else class="mr-1 inline-block w-5"></span> <!-- 占位符 -->
                  </span>

                  <!-- 文本内容容器 -->
                  <span class="flex flex-col">
                    <span>{{ child.label }}</span>
                    <span v-if="child.originalType" class="text-xs text-text-muted">
                      ({{ child.originalType }})
                    </span>
                  </span>
                </span>
                <span class="text-text-secondary">{{ child.count }}</span>
              </div>
              <!-- 孙级列表 -->
              <ul v-if="child.expanded && child.children"
                class="pl-1 mt-1 space-y-1 border-l border-border-base ml-1">
                <li v-for="(grandChild, grandChildIndex) in child.children" :key="grandChildIndex">
                  <!-- 孙级通常没有 originalType 和 children，保持简单显示 -->
                  <div class="flex justify-between items-center p-1 rounded">
                    <span class="text-text-secondary ml-6">{{ grandChild.label }}</span> <!-- 增加缩进 -->
                    <span class="text-text-secondary">{{ grandChild.count }}</span>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </div>
    <div v-if="!loading && stats.length === 0 && collected" class="text-text-secondary">
      {{ t('performancePanel.noDataOrEmptyCanvas') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from "vue-i18n";
import { useVueFlow } from '@vue-flow/core';
import { useClipboard } from '@/composables/useClipboard';
import { useDialogService } from '@/services/DialogService';
import { useNodeStore } from '@/stores/nodeStore';
import { useTabStore } from '@/stores/tabStore';
import { usePerformanceStatsStore } from '@/stores/performanceStatsStore';
import type { Node, Edge } from '@vue-flow/core';
import type { InputDefinition, OutputDefinition } from '@comfytavern/types';
import { getInputComponent } from '@/components/graph/inputs';

// !!! 修改点: 移除 isNodeTypeEntry !!!
export interface StatItem {
  label: string;
  count: number;
  expanded?: boolean;
  children?: StatItem[];
  originalType?: string; // 用于存储原始节点类型，当 displayName 不同时
  // isNodeTypeEntry?: boolean; // <-- 已移除
}
// !!! 修改结束 !!!


const { t } = useI18n();
const { getNodes, getEdges } = useVueFlow();
const nodeStore = useNodeStore();
const tabStore = useTabStore();
const performanceStatsStore = usePerformanceStatsStore();
const dialogService = useDialogService();

const { writeText, error: clipboardError, isSupported: clipboardIsSupported } = useClipboard();

const currentTabId = computed(() => tabStore.activeTab?.internalId);

const stats = computed((): StatItem[] => {
  if (!currentTabId.value) return [];

  const canvasStats = performanceStatsStore.getStats(currentTabId.value) || [];
  const componentRawStats = performanceStatsStore.getComponentStats(currentTabId.value);

  const componentStatItems: StatItem[] = [];
  if (componentRawStats && Object.keys(componentRawStats).length > 0) {
    const children: StatItem[] = Object.entries(componentRawStats)
      .map(([type, count]) => ({ label: type, count }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (children.length > 0) {
      componentStatItems.push({
        label: t('performancePanel.componentInstancesLabel'),
        count: children.reduce((sum, item) => sum + item.count, 0),
        children: children,
        expanded: true,
      });
    }
  }
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
  // 只有包含子项时才允许切换展开状态
  if (item.children && item.children.length > 0) {
    item.expanded = !item.expanded;
  }
  // 对于没有子项的条目，点击无效果，避免不必要的响应式更新
};


const collectStats = async () => {
  if (!currentTabId.value) {
    console.warn(t('performancePanel.warnNoTabId'));
    return;
  }
  const tabId = currentTabId.value;
  performanceStatsStore.setLoading(tabId, true);

  const nodes: Node[] = getNodes.value;
  const edges: Edge[] = getEdges.value;

  const collectedComponentUsage: Record<string, number> = {};

  if (!nodes || nodes.length === 0) {
    performanceStatsStore.setStats(tabId, []);
    performanceStatsStore.setComponentUsageStats(tabId, {});
    performanceStatsStore.setLoading(tabId, false);
    return;
  }

  const calculatedStats: StatItem[] = [];

  // 1. 节点总数
  const nodeCount = nodes.length;
  const nodeStatsItem: StatItem = { label: t('performancePanel.nodeCountLabel'), count: nodeCount, children: [], expanded: true };

  // 2. 各类型节点数量
  const nodeTypes: Record<string, { count: number, definition: any | null }> = {}; // 存储计数和定义
  nodes.forEach(node => {
    const type = node.type || t('performancePanel.unknownType');
    if (!nodeTypes[type]) {
      nodeTypes[type] = { count: 0, definition: nodeStore.getNodeDefinitionByFullType(type) };
    }
    nodeTypes[type].count += 1;
  });

  // 按 label 排序
  Object.entries(nodeTypes)
    .map(([type, { count, definition: nodeDef }]) => {
      let statLabel = type;
      let originalTypeForDisplay: string | undefined = undefined;
      if (nodeDef && nodeDef.displayName && nodeDef.displayName !== type) {
        statLabel = nodeDef.displayName;
        originalTypeForDisplay = type;
      }
      // !!! 修改点: 移除 isNodeTypeEntry: true !!!
      return {
        label: statLabel,
        count,
        originalType: originalTypeForDisplay,
        // isNodeTypeEntry: true, // <-- 已移除
      };
      // !!! 修改结束 !!!
    })
    .sort((a, b) => a.label.localeCompare(b.label)) // 排序
    .forEach(item => nodeStatsItem.children?.push(item));

  calculatedStats.push(nodeStatsItem);

  // 3. 连线总数
  calculatedStats.push({ label: t('performancePanel.edgeCountLabel'), count: edges.length, expanded: true });


  // 4. 槽位统计 (包括输入、输出、配置)
  let totalInputSlots = 0;
  let totalOutputSlots = 0;
  let totalConfigSlotInstances = 0;

  const inputSlotTypes: Record<string, number> = {};
  const outputSlotTypes: Record<string, number> = {};
  const configSlotKeyCounts: Record<string, number> = {};

  await nodeStore.ensureDefinitionsLoaded();

  nodes.forEach(node => {
    const nodeDefinition = nodeStore.getNodeDefinitionByFullType(node.type as string);

    if (nodeDefinition) {
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

      if (nodeDefinition.configSchema) {
        Object.values(nodeDefinition.configSchema).forEach((configDef: InputDefinition) => {
          totalConfigSlotInstances++;

        const configKeyForDisplay = configDef.displayName || (Object.keys(nodeDefinition.configSchema!).find(key => nodeDefinition.configSchema![key] === configDef)) || t('performancePanel.unknownConfigItem');
        configSlotKeyCounts[configKeyForDisplay] = (configSlotKeyCounts[configKeyForDisplay] || 0) + 1;

        const componentObject = getInputComponent(configDef.dataFlowType, configDef.config, configDef.matchCategories);
          if (componentObject) {
            const componentName = componentObject.name || (componentObject as any).__name || 'UnknownComponent';
            if (componentName !== 'InlineConnectionSorter' && componentName !== 'NodeInputActionsBar' && componentName !== 'UnknownComponent') {
              collectedComponentUsage[componentName] = (collectedComponentUsage[componentName] || 0) + 1;
              // console.log(`[PerformancePanel] Node ${node.id} config item '${configKeyForDisplay}' (DataFlowType: ${configDef.dataFlowType}) renders as component: ${componentName}`);
            } else if (componentName === 'UnknownComponent') {
              // console.warn(`[PerformancePanel] Node ${node.id} config item '${configKeyForDisplay}' (DataFlowType: ${configDef.dataFlowType}) resolved to an unknown component. Object:`, componentObject);
            }
          }
        });
      }

      if (nodeDefinition.inputs) {
        Object.entries(nodeDefinition.inputs).forEach(([_inputKey, inputDef]) => {
          const componentObject = getInputComponent(inputDef.dataFlowType, inputDef.config, inputDef.matchCategories);
          if (componentObject) {
            const componentName = componentObject.name || (componentObject as any).__name || 'UnknownComponent';
            if (componentName !== 'InlineConnectionSorter' && componentName !== 'NodeInputActionsBar' && componentName !== 'UnknownComponent') {
              collectedComponentUsage[componentName] = (collectedComponentUsage[componentName] || 0) + 1;
            } else if (componentName === 'UnknownComponent') {
              // const inputKeyForDisplay = inputDef.displayName || inputKey;
              // console.warn(`[PerformancePanel] Node ${node.id} input item '${inputKeyForDisplay}' (DataFlowType: ${inputDef.dataFlowType}) resolved to an unknown component. Object:`, componentObject);
            }
          }
        });
      }
    } else {
      const inputsFromData = node.data?.inputs;
      const outputsFromData = node.data?.outputs;

      if (inputsFromData) {
        Object.values(inputsFromData).forEach((slotDefValue: unknown) => {
          totalInputSlots++;
          let typeKey = t('performancePanel.unknownType');
          if (slotDefValue && typeof slotDefValue === 'object' && 'dataFlowType' in slotDefValue && typeof (slotDefValue as any).dataFlowType === 'string') {
            typeKey = (slotDefValue as any).dataFlowType;
          }
          inputSlotTypes[typeKey] = (inputSlotTypes[typeKey] || 0) + 1;
        });
      }
      if (outputsFromData) {
        Object.values(outputsFromData).forEach((slotDefValue: unknown) => {
          totalOutputSlots++;
          let typeKey = t('performancePanel.unknownType');
          if (slotDefValue && typeof slotDefValue === 'object' && 'dataFlowType' in slotDefValue && typeof (slotDefValue as any).dataFlowType === 'string') {
            typeKey = (slotDefValue as any).dataFlowType;
          }
          outputSlotTypes[typeKey] = (outputSlotTypes[typeKey] || 0) + 1;
        });
      }
    }
  });

  const overallTotalSlots = totalInputSlots + totalOutputSlots + totalConfigSlotInstances;
  const slotStatsItem: StatItem = { label: t('performancePanel.slotCountLabel'), count: overallTotalSlots, children: [], expanded: true };

  const inputSlotChildren: StatItem[] = [];
  Object.entries(inputSlotTypes).sort(([a], [b]) => a.localeCompare(b)).forEach(([type, count]) => {
    inputSlotChildren.push({ label: type, count });
  });
  slotStatsItem.children?.push({
    label: t('performancePanel.inputSlotsLabel'),
    count: totalInputSlots,
    children: inputSlotChildren.length > 0 ? inputSlotChildren : undefined,
    expanded: false
  });

  const outputSlotChildren: StatItem[] = [];
  Object.entries(outputSlotTypes).sort(([a], [b]) => a.localeCompare(b)).forEach(([type, count]) => {
    outputSlotChildren.push({ label: type, count });
  });
  slotStatsItem.children?.push({
    label: t('performancePanel.outputSlotsLabel'),
    count: totalOutputSlots,
    children: outputSlotChildren.length > 0 ? outputSlotChildren : undefined,
    expanded: false
  });

  const configSlotChildren: StatItem[] = [];
  Object.entries(configSlotKeyCounts).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, count]) => {
    configSlotChildren.push({ label: key, count });
  });
  slotStatsItem.children?.push({
    label: t('performancePanel.configSlotsLabel'),
    count: totalConfigSlotInstances,
    children: configSlotChildren.length > 0 ? configSlotChildren : undefined,
    expanded: false
  });

  calculatedStats.push(slotStatsItem);

  performanceStatsStore.setStats(tabId, calculatedStats);
  performanceStatsStore.setComponentUsageStats(tabId, collectedComponentUsage);

  // console.groupCollapsed('统计数据 (PerformancePanel)');
  // console.log(JSON.stringify(stats.value, null, 2));
  // console.groupEnd();
  // 延迟结束加载状态，给UI一点反应时间
  setTimeout(() => {
    performanceStatsStore.setLoading(tabId, false);
  }, 100);
};

// !!! 修改点: 清理复制的 JSON !!!
const copyStatsToClipboard = async () => {
  if (!stats.value || stats.value.length === 0) {
    dialogService.showWarning(t('performancePanel.warnNoStatsToCopy'), t('common.warning'));
    return;
  }
  if (!clipboardIsSupported) {
    dialogService.showError(t('performancePanel.errorClipboardNotSupported'), t('common.error'));
    return;
  }

  // 使用 JSON.stringify 的 replacer 函数来过滤掉不需要的字段
  const statsJson = JSON.stringify(stats.value, (key, value) => {
    // 过滤掉 UI 状态字段 'expanded'
    if (key === 'expanded') {
      return undefined;
    }
    // 过滤掉空的 children 数组
    if (key === 'children' && Array.isArray(value) && value.length === 0) {
      return undefined;
    }
    // 过滤掉值为 undefined 的 originalType
    if (key === 'originalType' && value === undefined) {
      return undefined;
    }
    // isNodeTypeEntry 已经不存在，无需过滤
    return value;
  }, 2); // 缩进 2 个空格

  await writeText(statsJson);

  if (clipboardError.value) {
    dialogService.showError(t('performancePanel.errorCopyFailed', { message: clipboardError.value.message }), t('common.error'));
    console.error(t('performancePanel.logErrorCopyFailed'), clipboardError.value);
  } else {
    dialogService.showSuccess(t('performancePanel.successCopied'), t('common.success'));
  }
};
// !!! 修改结束 !!!

</script>

<style scoped>
/* 保持样式不变 */
</style>
