import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useTabStore } from "@/stores/tabStore";
import type { GroupSlotInfo } from "@comfytavern/types";

/**
 * 管理 GroupIOEdit 组件的内部状态和选择逻辑。
 */
export function useGroupIOState() {
  const workflowStore = useWorkflowStore();
  const tabStore = useTabStore();
  const { activeTabId } = storeToRefs(tabStore);
  // 直接获取响应式的 activeTabState
  const activeState = computed(() => workflowStore.getActiveTabState());

  // 用于编辑所选项目的状态
  const selectedInputKey = ref<string | null>(null);
  const selectedOutputKey = ref<string | null>(null);
  const oldInputDisplayName = ref<string | null>(null); // 用于存储旧的输入显示名称
  const oldOutputDisplayName = ref<string | null>(null); // 用于存储旧的输出显示名称
  const editingDisplayName = ref<string>("");
  const editingDescription = ref<string>("");
  // --- 新增状态 ---
  const editingDefaultValue = ref<any>(null); // 默认值可以是任何类型
  const editingMin = ref<number | null>(null); // 最小值
  const editingMax = ref<number | null>(null); // 最大值
  // --- 结束新增 ---

  // 监视活动选项卡更改以重置选择
  watch(
    activeTabId,
    (newTabId, oldTabId) => {
      console.log(
        `[useGroupIOState] Active tab changed from ${oldTabId} to ${newTabId}, resetting selection.`
      );
      selectedInputKey.value = null;
      selectedOutputKey.value = null;
      editingDisplayName.value = "";
      editingDescription.value = "";
      // --- 重置新增状态 ---
      editingDefaultValue.value = null;
      editingMin.value = null;
      editingMax.value = null;
      // --- 结束重置 ---
      oldInputDisplayName.value = null;
      oldOutputDisplayName.value = null;
    },
    { immediate: true } // immediate: true ensures initial reset if needed
  );

  // 所选项目数据的计算属性 - 直接从 activeState 读取
  const selectedInputData = computed<GroupSlotInfo | null>(() => {
    const inputs = activeState.value?.workflowData?.interfaceInputs;
    if (!selectedInputKey.value || !inputs) return null;
    return inputs[selectedInputKey.value] || null; // 返回 store 中的对象引用
  });

  const selectedOutputData = computed<GroupSlotInfo | null>(() => {
    const outputs = activeState.value?.workflowData?.interfaceOutputs;
    if (!selectedOutputKey.value || !outputs) return null;
    return outputs[selectedOutputKey.value] || null; // 返回 store 中的对象引用
  });

  // 选择逻辑
 function selectInput(key: string) {
    console.log(`[useGroupIOState] selectInput called with key: ${key}`);
    selectedInputKey.value = key;
    selectedOutputKey.value = null; // 取消选择输出
    // 从 activeState 初始化编辑状态
    const inputData = activeState.value?.workflowData?.interfaceInputs?.[key];
    if (inputData) {
      editingDisplayName.value = inputData.displayName || "";
      editingDescription.value = inputData.customDescription || "";
      // --- 初始化新增状态 ---
      // 使用 ?? 避免将 undefined 存入 ref，如果属性不存在则设为 null
      editingDefaultValue.value = inputData.defaultValue ?? null;
      editingMin.value = inputData.min ?? null;
      editingMax.value = inputData.max ?? null;
      // --- 结束初始化 ---
      oldInputDisplayName.value = editingDisplayName.value;
    } else {
      editingDisplayName.value = "";
      editingDescription.value = "";
      // --- 重置新增状态 ---
      editingDefaultValue.value = null;
      editingMin.value = null;
      editingMax.value = null;
      // --- 结束重置 ---
      oldInputDisplayName.value = null;
    }
  }

  function selectOutput(key: string) {
    console.log(`[useGroupIOState] selectOutput called with key: ${key}`);
    selectedOutputKey.value = key;
    selectedInputKey.value = null; // 取消选择输入
    // 重置输入相关的编辑状态，包括新增的
    editingDefaultValue.value = null;
    editingMin.value = null;
    editingMax.value = null;

    const outputData = activeState.value?.workflowData?.interfaceOutputs?.[key];
    if (outputData) {
      editingDisplayName.value = outputData.displayName || "";
      editingDescription.value = outputData.customDescription || "";
      oldOutputDisplayName.value = editingDisplayName.value;
    } else {
      editingDisplayName.value = "";
      editingDescription.value = "";
      oldOutputDisplayName.value = null;
    }
  }


  return {
    activeTabId, // 仍然导出 activeTabId 以便其他 composable 可能需要
    activeState, // 仍然导出 activeState 以便其他 composable 可能需要
    selectedInputKey,
    selectedOutputKey,
    oldInputDisplayName,
    oldOutputDisplayName,
    editingDisplayName,
    editingDescription,
    // --- 导出新增状态 ---
    editingDefaultValue,
    editingMin,
    editingMax,
    // --- 结束导出 ---
    selectedInputData,
    selectedOutputData,
    selectInput,
    selectOutput,
  };
}