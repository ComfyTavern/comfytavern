<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useTabStore } from "@/stores/tabStore";
import { DataFlowType, type DataFlowTypeName, type GroupSlotInfo, type HistoryEntry } from "@comfytavern/types"; // <-- Import HistoryEntry
import { createHistoryEntry, getEffectiveDefaultValue } from "@comfytavern/utils"; // <-- Import createHistoryEntry
import { useGroupIOState } from "@/composables/group/useGroupIOState";
import { useGroupIOActions } from "@/composables/group/useGroupIOActions";
// import Tooltip from "@/components/common/Tooltip.vue"; // Tooltip 组件不再直接使用
import styles from "@/components/graph/nodes/handleStyles.module.css";
// Import OverlayScrollbars and theme
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";
import { useThemeStore } from "@/stores/theme";

const workflowStore = useWorkflowStore();
const tabStore = useTabStore();

const { activeTabId } = storeToRefs(tabStore);
const themeStore = useThemeStore(); // Get theme store instance
const { isDark } = storeToRefs(themeStore); // Get isDark state
// 直接获取响应式的 activeTabState
const activeState = computed(() => workflowStore.getActiveTabState());

// 使用 composable 管理状态
const {
  selectedInputKey,
  selectedOutputKey,
  oldInputDisplayName,
  oldOutputDisplayName,
  editingDisplayName,
  editingDescription,
  editingDefaultValue, // 新增
  editingMin, // 新增
  editingMax, // 新增
  selectedInputData, // Use computed properties from composable
  selectedOutputData, // Use computed properties from composable
  selectInput, // Use functions from composable
  selectOutput, // Use functions from composable
} = useGroupIOState();

// 添加控制下拉菜单显示的状态
const showInputDropdown = ref(false);
const showOutputDropdown = ref(false);

// 添加 Template Refs
const inputDropdownButtonRef = ref<HTMLButtonElement | null>(null);
const inputDropdownMenuRef = ref<HTMLDivElement | null>(null);
const outputDropdownButtonRef = ref<HTMLButtonElement | null>(null);
const outputDropdownMenuRef = ref<HTMLDivElement | null>(null);
// 下拉菜单状态保留在组件内
// const showInputDropdown = ref(false); // Already exists
// const showOutputDropdown = ref(false); // Already exists
const closeInputDropdown = () => {
  showInputDropdown.value = false;
};
const closeOutputDropdown = () => {
  showOutputDropdown.value = false;
};

// 使用操作 composable
const {
  addInput,
  removeInput,
  addOutput,
  removeOutput,
  sortInputs,
  sortOutputs,
  moveSlot,
  canMoveInputUp,
  canMoveInputDown,
  canMoveOutputUp,
  canMoveOutputDown,
  // filteredInputEntries, // No longer needed here
  // filteredOutputEntries, // No longer needed here
} = useGroupIOActions(
  activeTabId,
  activeState, // Pass the ComputedRef directly
  selectedInputKey,
  selectedOutputKey,
  selectInput, // Pass state functions
  selectOutput, // Pass state functions
  closeInputDropdown, // Pass close functions
  closeOutputDropdown // Pass close functions
);

// 已移除：对 interfaceInputs 和 interfaceOutputs 的监视器，以防止潜在循环。
// 现在将由来自 EditorView 的事件触发更新。

// 监视活动选项卡更改的逻辑已移至 useGroupIOState

// 从下拉菜单的可用类型中过滤掉 CONVERTIBLE_ANY
const availableTypes = ref(
  Object.values(DataFlowType).filter((type) => type !== DataFlowType.CONVERTIBLE_ANY) as DataFlowTypeName[]
);

// --- 选择逻辑 ---
// 选择逻辑已移至 useGroupIOState

// 辅助函数 generateUniqueKey 已移至 useGroupIOActions

// --- 添加/移除逻辑 ---
// addInput, removeInput, addOutput, removeOutput 函数已移至 useGroupIOActions

// --- 保存更改到 Store --- (REMOVED - No longer used)
// function saveChanges() { ... }

// 包装函数，用于模板点击事件 (保留，因为它们直接被模板使用)
function handleAddInput(type: DataFlowTypeName) {
  addInput(type); // 调用 composable 中的函数
}

function handleAddOutput(type: DataFlowTypeName) {
  addOutput(type); // 调用 composable 中的函数
}

// --- 排序逻辑 ---
// sortSlots, sortInputs, sortOutputs 函数已移至 useGroupIOActions

// --- 点击外部逻辑 ---
// 保留在组件内部，因为它直接操作组件的 ref 和 state
const handleClickOutside = (event: MouseEvent, type: "input" | "output") => {
  const buttonRef = type === "input" ? inputDropdownButtonRef : outputDropdownButtonRef;
  const menuRef = type === "input" ? inputDropdownMenuRef : outputDropdownMenuRef;
  const showDropdown = type === "input" ? showInputDropdown : showOutputDropdown;

  if (
    buttonRef.value &&
    !buttonRef.value.contains(event.target as Node) &&
    menuRef.value &&
    !menuRef.value.contains(event.target as Node)
  ) {
    showDropdown.value = false;
  }
};

const inputClickListener = (event: MouseEvent) => handleClickOutside(event, "input");
const outputClickListener = (event: MouseEvent) => handleClickOutside(event, "output");

watch(showInputDropdown, (newValue) => {
  if (newValue) {
    nextTick(() => {
      document.addEventListener("mousedown", inputClickListener);
    });
  } else {
    document.removeEventListener("mousedown", inputClickListener);
  }
});

watch(showOutputDropdown, (newValue) => {
  if (newValue) {
    nextTick(() => {
      document.addEventListener("mousedown", outputClickListener);
    });
  } else {
    document.removeEventListener("mousedown", outputClickListener);
  }
});

// 在卸载时清理监听器
onUnmounted(() => {
  document.removeEventListener("mousedown", inputClickListener);
  document.removeEventListener("mousedown", outputClickListener);
});

// --- REMOVED: 监视本地更改并实时更新 store 的 Watcher ---
// );

// selectedInputData 和 selectedOutputData 的计算属性已移至 useGroupIOState
// 过滤掉 CONVERTIBLE_ANY 的计算属性 - 直接从 activeState 读取
const CONVERTIBLE_ANY_KEY = DataFlowType.CONVERTIBLE_ANY; // 使用导入的枚举值

// --- 辅助函数：获取过滤后的插槽条目 ---
// getFilteredSlotEntries 函数已移至 useGroupIOActions

// --- 过滤后的计算属性 ---
// filteredInputEntries 和 filteredOutputEntries 现在从 useGroupIOActions 获取

// filteredInputs 和 filteredOutputs 仍然需要，用于模板渲染列表
const filteredInputs = computed(() => {
  const inputs = activeState.value?.workflowData?.interfaceInputs;
  if (!inputs) return {};
  return Object.fromEntries(
    Object.entries(inputs).filter(
      ([, slotInfo]) => slotInfo && slotInfo.dataFlowType !== CONVERTIBLE_ANY_KEY // 添加 slotInfo 检查
    )
  );
});

const filteredOutputs = computed(() => {
  const outputs = activeState.value?.workflowData?.interfaceOutputs;
  if (!outputs) return {};
  return Object.fromEntries(
    Object.entries(outputs).filter(
      ([, slotInfo]) => slotInfo && slotInfo.dataFlowType !== CONVERTIBLE_ANY_KEY // 添加 slotInfo 检查
    )
  );
});

// --- 移动逻辑 ---
// moveSlot 函数已移至 useGroupIOActions

// --- 计算属性：控制移动按钮的禁用状态 ---
// canMoveInputUp, canMoveInputDown, canMoveOutputUp, canMoveOutputDown 已移至 useGroupIOActions

// --- 输入编辑处理函数 ---
function handleInputNameBlur() {
  if (
    activeTabId.value &&
    selectedInputKey.value &&
    oldInputDisplayName.value !== editingDisplayName.value
  ) {
    const keyToUpdate = selectedInputKey.value;
    const newDisplayName = editingDisplayName.value;
    const oldDisplayNameValue = oldInputDisplayName.value; // Capture old name before resetting
    // const label = `修改 - 接口 (重命名 ${keyToUpdate}: '${oldDisplayNameValue}' -> '${newDisplayName}')`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedInputs = { ...currentInputs }; // Shallow copy
      if (updatedInputs[keyToUpdate]) {
        updatedInputs[keyToUpdate] = { ...updatedInputs[keyToUpdate], displayName: newDisplayName };
      } else {
        console.warn(
          `[GroupIOEdit @blur name updateFn] Input key ${keyToUpdate} not found in current state.`
        );
      }
      return { inputs: updatedInputs, outputs: currentOutputs };
    };

    // Create History Entry
    const summary = `修改输入 ${oldDisplayNameValue || keyToUpdate
      } 名称: '${oldDisplayNameValue}' -> '${newDisplayName}'`;
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceInput", summary, {
      key: keyToUpdate,
      propertyName: "displayName",
      oldValue: oldDisplayNameValue,
      newValue: newDisplayName,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
    oldInputDisplayName.value = null; // Reset old name after update call
  }
}

function handleInputTypeChange(event: Event) {
  if (activeTabId.value && selectedInputKey.value) {
    const keyToUpdate = selectedInputKey.value;
    const newType = (event.target as HTMLSelectElement).value as DataFlowTypeName;
    const oldType = selectedInputData.value?.dataFlowType; // Get old type
    // const label = `修改 - 接口 (更改类型 ${keyToUpdate}: ${newType})`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedInputs = { ...currentInputs };
      if (updatedInputs[keyToUpdate]) {
        updatedInputs[keyToUpdate] = { ...updatedInputs[keyToUpdate], dataFlowType: newType };
      } else {
        console.warn(
          `[GroupIOEdit @change dataFlowType updateFn] Input key ${keyToUpdate} not found in current state.`
        );
      }
      return { inputs: updatedInputs, outputs: currentOutputs };
    };

    // Create History Entry
    const inputName = selectedInputData.value?.displayName || keyToUpdate;
    const summary = `修改输入 ${inputName} 类型: '${oldType}' -> '${newType}'`;
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceInput", summary, {
      key: keyToUpdate,
      propertyName: "dataFlowType",
      oldValue: oldType,
      newValue: newType,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
  }
}

function handleInputDescriptionBlur() {
  if (
    activeTabId.value &&
    selectedInputKey.value &&
    selectedInputData.value &&
    selectedInputData.value.customDescription !== editingDescription.value // 使用 customDescription
  ) {
    const keyToUpdate = selectedInputKey.value;
    const newDescription = editingDescription.value;
    const oldDescription = selectedInputData.value?.customDescription; // 使用 customDescription 获取旧值
    // const label = `修改 - 接口 (更新描述 ${keyToUpdate})`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedInputs = { ...currentInputs };
      if (updatedInputs[keyToUpdate]) {
        // 更新 customDescription 字段
        updatedInputs[keyToUpdate] = {
          ...updatedInputs[keyToUpdate],
          customDescription: newDescription,
        };
      } else {
        console.warn(
          `[GroupIOEdit @blur desc updateFn] Input key ${keyToUpdate} not found in current state.`
        );
      }
      return { inputs: updatedInputs, outputs: currentOutputs };
    };

    // Create History Entry
    const inputName = selectedInputData.value?.displayName || keyToUpdate;
    const summary = `修改输入 ${inputName} 描述`; // Simplified summary for potentially long text
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceInput", summary, {
      key: keyToUpdate,
      propertyName: "customDescription", // 历史记录属性名改为 customDescription
      oldValue: oldDescription,
      newValue: newDescription,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
  }
}

// --- 新增：默认值、最小值、最大值处理函数 ---
function handleInputDefaultValueChange() {
  // 检查值是否真的改变了，避免不必要的更新
  if (
    activeTabId.value &&
    selectedInputKey.value &&
    selectedInputData.value &&
    getEffectiveDefaultValue(selectedInputData.value) !== editingDefaultValue.value // 比较有效默认值和编辑值
  ) {
    const keyToUpdate = selectedInputKey.value;
    const newDefaultValue = editingDefaultValue.value;
    const oldDefaultValue = getEffectiveDefaultValue(selectedInputData.value); // Get old effective default value
    // const label = `修改 - 接口 (更新默认值 ${keyToUpdate})`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedInputs = { ...currentInputs };
      if (updatedInputs[keyToUpdate]) {
        // 确保 config 对象存在
        updatedInputs[keyToUpdate] = {
          ...updatedInputs[keyToUpdate],
          config: {
            ...(updatedInputs[keyToUpdate].config || {}),
            default: newDefaultValue,
          },
        };
      } else {
        console.warn(`[GroupIOEdit @change defVal updateFn] Input key ${keyToUpdate} not found.`);
      }
      return { inputs: updatedInputs, outputs: currentOutputs };
    };

    // Create History Entry
    const inputName = selectedInputData.value?.displayName || keyToUpdate;
    const summary = `修改输入 ${inputName} 默认值`;
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceInput", summary, {
      key: keyToUpdate,
      propertyName: "config.default",
      oldValue: oldDefaultValue,
      newValue: newDefaultValue,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
  }
}

function handleInputMinBlur() {
  if (
    activeTabId.value &&
    selectedInputKey.value &&
    selectedInputData.value &&
    selectedInputData.value?.config?.min !== editingMin.value // 比较 config.min 和编辑值
  ) {
    const keyToUpdate = selectedInputKey.value;
    const newMin = editingMin.value;
    const oldMin = selectedInputData.value?.config?.min; // Get old min from config
    // const label = `修改 - 接口 (更新最小值 ${keyToUpdate})`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedInputs = { ...currentInputs };
      if (updatedInputs[keyToUpdate]) {
        // 确保 config 对象存在
        updatedInputs[keyToUpdate] = {
          ...updatedInputs[keyToUpdate],
          config: {
            ...(updatedInputs[keyToUpdate].config || {}),
            min: newMin,
          },
        };
      } else {
        console.warn(`[GroupIOEdit @blur min updateFn] Input key ${keyToUpdate} not found.`);
      }
      return { inputs: updatedInputs, outputs: currentOutputs };
    };

    // Create History Entry
    const inputName = selectedInputData.value?.displayName || keyToUpdate;
    const summary = `修改输入 ${inputName} 最小值`;
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceInput", summary, {
      key: keyToUpdate,
      propertyName: "min",
      oldValue: oldMin,
      newValue: newMin,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
  }
}

function handleInputMaxBlur() {
  if (
    activeTabId.value &&
    selectedInputKey.value &&
    selectedInputData.value &&
    selectedInputData.value?.config?.max !== editingMax.value // 比较 config.max 和编辑值
  ) {
    const keyToUpdate = selectedInputKey.value;
    const newMax = editingMax.value;
    const oldMax = selectedInputData.value?.config?.max; // Get old max from config
    // const label = `修改 - 接口 (更新最大值 ${keyToUpdate})`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedInputs = { ...currentInputs };
      if (updatedInputs[keyToUpdate]) {
        // 确保 config 对象存在
        updatedInputs[keyToUpdate] = {
          ...updatedInputs[keyToUpdate],
          config: {
            ...(updatedInputs[keyToUpdate].config || {}),
            max: newMax,
          },
        };
      } else {
        console.warn(`[GroupIOEdit @blur max updateFn] Input key ${keyToUpdate} not found.`);
      }
      return { inputs: updatedInputs, outputs: currentOutputs };
    };

    // Create History Entry
    const inputName = selectedInputData.value?.displayName || keyToUpdate;
    const summary = `修改输入 ${inputName} 最大值`;
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceInput", summary, {
      key: keyToUpdate,
      propertyName: "max",
      oldValue: oldMax,
      newValue: newMax,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
  }
}
// --- 结束新增处理函数 ---

// --- 输出编辑处理函数 ---
function handleOutputNameBlur() {
  if (
    activeTabId.value &&
    selectedOutputKey.value &&
    oldOutputDisplayName.value !== editingDisplayName.value
  ) {
    const keyToUpdate = selectedOutputKey.value;
    const newDisplayName = editingDisplayName.value;
    const oldDisplayNameValue = oldOutputDisplayName.value; // Capture old name
    // const label = `修改 - 接口 (重命名 ${keyToUpdate}: '${oldDisplayNameValue}' -> '${newDisplayName}')`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedOutputs = { ...currentOutputs };
      if (updatedOutputs[keyToUpdate]) {
        updatedOutputs[keyToUpdate] = {
          ...updatedOutputs[keyToUpdate],
          displayName: newDisplayName,
        };
      } else {
        console.warn(
          `[GroupIOEdit @blur name updateFn] Output key ${keyToUpdate} not found in current state.`
        );
      }
      return { inputs: currentInputs, outputs: updatedOutputs };
    };

    // Create History Entry
    const summary = `修改输出 ${oldDisplayNameValue || keyToUpdate
      } 名称: '${oldDisplayNameValue}' -> '${newDisplayName}'`;
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceOutput", summary, {
      key: keyToUpdate,
      propertyName: "displayName",
      oldValue: oldDisplayNameValue,
      newValue: newDisplayName,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
    oldOutputDisplayName.value = null; // Reset old name after update call
  }
}

function handleOutputTypeChange(event: Event) {
  if (activeTabId.value && selectedOutputKey.value) {
    const keyToUpdate = selectedOutputKey.value;
    const newType = (event.target as HTMLSelectElement).value as DataFlowTypeName;
    const oldType = selectedOutputData.value?.dataFlowType; // Get old type
    // const label = `修改 - 接口 (更改类型 ${keyToUpdate}: ${newType})`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedOutputs = { ...currentOutputs };
      if (updatedOutputs[keyToUpdate]) {
        updatedOutputs[keyToUpdate] = { ...updatedOutputs[keyToUpdate], dataFlowType: newType };
      } else {
        console.warn(
          `[GroupIOEdit @change dataFlowType updateFn] Output key ${keyToUpdate} not found in current state.`
        );
      }
      return { inputs: currentInputs, outputs: updatedOutputs };
    };

    // Create History Entry
    const outputName = selectedOutputData.value?.displayName || keyToUpdate;
    const summary = `修改输出 ${outputName} 类型: '${oldType}' -> '${newType}'`;
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceOutput", summary, {
      key: keyToUpdate,
      propertyName: "dataFlowType",
      oldValue: oldType,
      newValue: newType,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
  }
}

function handleOutputDescriptionBlur() {
  if (
    activeTabId.value &&
    selectedOutputKey.value &&
    selectedOutputData.value &&
    selectedOutputData.value.customDescription !== editingDescription.value // 使用 customDescription
  ) {
    const keyToUpdate = selectedOutputKey.value;
    const newDescription = editingDescription.value;
    const oldDescription = selectedOutputData.value?.customDescription; // 使用 customDescription 获取旧值
    // const label = `修改 - 接口 (更新描述 ${keyToUpdate})`; // Removed label

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedOutputs = { ...currentOutputs };
      if (updatedOutputs[keyToUpdate]) {
        updatedOutputs[keyToUpdate] = {
          ...updatedOutputs[keyToUpdate],
          customDescription: newDescription, // 更新 customDescription 字段
        };
      } else {
        console.warn(
          `[GroupIOEdit @blur desc updateFn] Output key ${keyToUpdate} not found in current state.`
        );
      }
      return { inputs: currentInputs, outputs: updatedOutputs };
    };

    // Create History Entry
    const outputName = selectedOutputData.value?.displayName || keyToUpdate;
    const summary = `修改输出 ${outputName} 描述`; // Simplified summary
    const entry: HistoryEntry = createHistoryEntry("modify", "interfaceOutput", summary, {
      key: keyToUpdate,
      propertyName: "customDescription", // 历史记录属性名改为 customDescription
      oldValue: oldDescription,
      newValue: newDescription,
    });
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry
  }
}

// 辅助函数：获取 Handle 的 CSS 类
function getHandleClasses(slot: GroupSlotInfo, isInput: boolean): string[] {
  const classes: string[] = []; // 初始化为空数组

  // 添加基础类 (如果存在)
  if (styles.handle) {
    classes.push(styles.handle);
  }

  // 添加类型特定的类
  const typeClassKey = `handleType${slot.dataFlowType}` as keyof typeof styles;
  const typeClass = styles[typeClassKey];
  if (typeClass) {
    classes.push(typeClass);
  } else if (styles.handleAny) {
    // Fallback to handleAny if specific type class doesn't exist and handleAny exists
    classes.push(styles.handleAny);
  }

  // 添加 handleAny 类（如果适用，并确保它存在且未重复添加）
  if (
    (slot.dataFlowType === DataFlowType.WILDCARD || slot.dataFlowType === DataFlowType.CONVERTIBLE_ANY) &&
    styles.handleAny
  ) {
    if (!classes.includes(styles.handleAny)) {
      classes.push(styles.handleAny);
    }
  }

  // 添加 handleMulti 类（仅输入且 multi 为 true，并确保它存在）
  if (isInput && slot.multi && styles.handleMulti) {
    if (!classes.includes(styles.handleMulti)) {
      // 避免重复添加（虽然不太可能）
      classes.push(styles.handleMulti);
    }
  }

  // 如果 classes 为空（例如 styles.handle 不存在），至少返回一个空字符串数组
  // 否则 Vue 的 :class 绑定会报错
  return classes.length > 0 ? classes : [];
}

// ... (其他 setup 代码) ...
</script>

<template>
  <div class="flex flex-col h-full text-sm">
    <h3 class="text-lg font-semibold mb-2 border-b pb-1 px-4 pt-4">工作流接口</h3>

    <div v-if="activeState?.workflowData" class="flex-grow flex flex-col overflow-y-auto">
      <!-- 接口列表 (顶部区域) -->
      <div class="px-4 pb-2 space-y-3">
        <!-- 移除了 overflow-y-auto -->
        <!-- 输入列表 -->
        <div>
          <div class="flex justify-between items-center">
            <h4 class="font-medium mb-1 text-xs uppercase text-gray-500">输入 (Inputs)</h4>
            <button @click="sortInputs"
              v-comfy-tooltip="'按名称排序输入'"
              class="btn btn-xs btn-ghost p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
          </div>
          <div v-if="Object.keys(filteredInputs).length === 0" class="text-gray-400 italic text-xs px-1">
            无输入接口
          </div>
          <OverlayScrollbarsComponent v-else :options="{
            scrollbars: {
              autoHide: 'scroll',
              theme: isDark ? 'os-theme-light' : 'os-theme-dark',
            },
          }" class="max-h-48 flex-shrink" defer>
            <ul class="space-y-1">
              <template v-for="(input, key) in filteredInputs" :key="String(key)">
                <li @click="selectInput(String(key))"
                  class="cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
                  :class="{ 'bg-blue-100 dark:bg-blue-900': selectedInputKey === key }">
                  <span class="truncate" v-comfy-tooltip="{ content: `${input.displayName} (${String(key)})` }">{{ input.displayName || key }}</span>
                  <div class="flex items-center space-x-1.5 flex-shrink-0">
                    <span class="text-xs text-gray-500">{{ input.dataFlowType }}</span>
                    <span :class="getHandleClasses(input, true)" style="
                        width: 8px !important;
                        height: 8px !important;
                        position: static !important;
                        transform: none !important;
                        border-width: 1px !important;
                        display: inline-block;
                      "></span>
                  </div>
                </li>
              </template>
            </ul>
          </OverlayScrollbarsComponent>
          <!-- 输入添加下拉菜单 -->
          <div class="relative mt-2">
            <!-- 输入下拉菜单容器 -->
            <button ref="inputDropdownButtonRef" @click="showInputDropdown = !showInputDropdown"
              class="btn btn-xs btn-outline w-full">
              + 添加输入
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div ref="inputDropdownMenuRef" v-if="showInputDropdown"
              class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
              <ul>
                <li v-for="type in availableTypes" :key="`add-input-${type}`" @click="handleAddInput(type)"
                  class="px-3 py-1 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                  {{ type }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 输出列表 -->
        <div>
          <div class="flex justify-between items-center">
            <h4 class="font-medium mb-1 text-xs uppercase text-gray-500">输出 (Outputs)</h4>
            <button @click="sortOutputs"
              v-comfy-tooltip="'按名称排序输出'"
              class="btn btn-xs btn-ghost p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
          </div>
          <div v-if="Object.keys(filteredOutputs).length === 0" class="text-gray-400 italic text-xs px-1">
            无输出接口
          </div>
          <OverlayScrollbarsComponent v-else :options="{
            scrollbars: {
              autoHide: 'scroll',
              theme: isDark ? 'os-theme-light' : 'os-theme-dark',
            },
          }" class="max-h-48 flex-shrink" defer>
            <ul class="space-y-1">
              <template v-for="(output, key) in filteredOutputs" :key="String(key)">
                <li @click="selectOutput(String(key))"
                  class="cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
                  :class="{ 'bg-blue-100 dark:bg-blue-900': selectedOutputKey === key }">
                  <span class="truncate" v-comfy-tooltip="{ content: `${output.displayName} (${String(key)})` }">{{ output.displayName || key }}</span>
                  <div class="flex items-center space-x-1.5 flex-shrink-0">
                    <span class="text-xs text-gray-500">{{ output.dataFlowType }}</span>
                    <span :class="getHandleClasses(output, false)" style="
                        width: 8px !important;
                        height: 8px !important;
                        position: static !important;
                        transform: none !important;
                        border-width: 1px !important;
                        display: inline-block;
                      "></span>
                  </div>
                </li>
              </template>
            </ul>
          </OverlayScrollbarsComponent>
          <!-- 输出添加下拉菜单 -->
          <div class="relative mt-2">
            <!-- 输出下拉菜单容器 -->
            <button ref="outputDropdownButtonRef" @click="showOutputDropdown = !showOutputDropdown"
              class="btn btn-xs btn-outline w-full">
              + 添加输出
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div ref="outputDropdownMenuRef" v-if="showOutputDropdown"
              class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
              <ul>
                <li v-for="type in availableTypes" :key="`add-output-${type}`" @click="handleAddOutput(type)"
                  class="px-3 py-1 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                  {{ type }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="border-t mx-4 my-4"></div>

      <!-- 编辑区域 (底部区域) -->
      <OverlayScrollbarsComponent :options="{
        scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
      }" class="flex-grow flex-shrink-0 px-4 pb-4" defer>
        <h4 class="font-medium mb-2 text-xs uppercase text-gray-500">编辑接口属性</h4>

        <div v-if="!selectedInputKey && !selectedOutputKey" class="text-gray-400 italic text-xs">
          请在上方列表中选择一个接口进行编辑。
        </div>

        <!-- 输入编辑表单 -->
        <div v-if="selectedInputKey && selectedInputData" class="space-y-2">
          <div class="flex justify-between items-center mb-1">
            <span class="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-1 rounded" v-comfy-tooltip="'接口 Key (唯一标识符)'">{{
              selectedInputKey
            }}</span>
            <div class="flex items-center space-x-2">
              <button @click="moveSlot(selectedInputKey, 'up', 'input')" :disabled="!canMoveInputUp"
                v-comfy-tooltip="'上移'"
                class="btn btn-xs btn-ghost p-0 text-gray-500 hover:text-gray-700 disabled:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:disabled:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button @click="moveSlot(selectedInputKey, 'down', 'input')" :disabled="!canMoveInputDown"
                v-comfy-tooltip="'下移'"
                class="btn btn-xs btn-ghost p-0 text-gray-500 hover:text-gray-700 disabled:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:disabled:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button @click="removeInput(selectedInputKey)" class="text-red-500 hover:text-red-700 text-xs">
                删除此输入
              </button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-x-2 gap-y-1 items-center text-xs">
            <label class="col-span-1 text-right">名称:</label>
            <input v-model="editingDisplayName" type="text" class="col-span-2 input-xs" placeholder="显示名称"
              @focus="oldInputDisplayName = editingDisplayName" @blur="handleInputNameBlur" />

            <label class="col-span-1 text-right">类型:</label>
            <select :value="selectedInputData?.dataFlowType" class="col-span-2 input-xs"
              @change="handleInputTypeChange">
              <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
            </select>

            <label class="col-span-1 text-right">描述:</label>
            <input v-model="editingDescription" type="text" class="col-span-2 input-xs" placeholder="接口描述信息"
              @blur="handleInputDescriptionBlur" />

            <!-- 默认值输入 -->
            <label class="col-span-1 text-right">默认值:</label>
            <div class="col-span-2">
              <!-- 优先检查 suggestions -->
              <select
                v-if="selectedInputData.config && Array.isArray(selectedInputData.config.suggestions) && selectedInputData.config.suggestions.length > 0"
                v-model="editingDefaultValue" class="input-xs" @change="handleInputDefaultValueChange">
                <option v-for="suggestion in selectedInputData.config.suggestions"
                  :key="typeof suggestion === 'object' ? String(suggestion.value) : String(suggestion)"
                  :value="typeof suggestion === 'object' ? suggestion.value : suggestion">
                  {{ typeof suggestion === 'object' ? suggestion.label : suggestion }}
                </option>
              </select>
              <!-- 根据类型渲染不同输入 (回退逻辑) -->
              <input v-else-if="
                selectedInputData.dataFlowType === DataFlowType.INTEGER ||
                selectedInputData.dataFlowType === DataFlowType.FLOAT
              " v-model.number="editingDefaultValue" type="number" class="input-xs" placeholder="默认数值"
                @change="handleInputDefaultValueChange" />
              <textarea v-else-if="selectedInputData.dataFlowType === DataFlowType.STRING" v-model="editingDefaultValue"
                class="input-xs textarea-xs" placeholder="默认字符串 (支持多行)" rows="3"
                @change="handleInputDefaultValueChange"></textarea>
              <input v-else-if="selectedInputData.dataFlowType === DataFlowType.BOOLEAN" v-model="editingDefaultValue"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600 dark:ring-offset-gray-800"
                @change="handleInputDefaultValueChange" />
              <!-- TODO: 添加对 CODE 等类型的默认值支持 (COMBO 已通过 suggestions 处理) -->
              <span v-else class="text-gray-400 italic text-xs">不支持此类型的默认值</span>
            </div>

            <!-- 最小值输入 (仅数值类型) -->
            <template v-if="
              selectedInputData.dataFlowType === DataFlowType.INTEGER ||
              selectedInputData.dataFlowType === DataFlowType.FLOAT
            ">
              <label class="col-span-1 text-right">最小值:</label>
              <input v-model.number="editingMin" type="number" class="col-span-2 input-xs" placeholder="最小值 (可选)"
                @blur="handleInputMinBlur" />
            </template>

            <!-- 最大值输入 (仅数值类型) -->
            <template v-if="
              selectedInputData.dataFlowType === DataFlowType.INTEGER ||
              selectedInputData.dataFlowType === DataFlowType.FLOAT
            ">
              <label class="col-span-1 text-right">最大值:</label>
              <input v-model.number="editingMax" type="number" class="col-span-2 input-xs" placeholder="最大值 (可选)"
                @blur="handleInputMaxBlur" />
            </template>

            <!-- TODO: 添加 required, config 字段 -->
            <!-- required 示例 (如果添加到类型中) -->
            <!--
            <label class="col-span-1 text-right">必需:</label>
            <input v-model="selectedInputData.required" type="checkbox" class="col-span-2 justify-self-start" />
            -->
          </div>
        </div>

        <!-- 输出编辑表单 -->
        <div v-if="selectedOutputKey && selectedOutputData" class="space-y-2">
          <div class="flex justify-between items-center mb-1">
            <span class="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-1 rounded" v-comfy-tooltip="'接口 Key (唯一标识符)'">{{
              selectedOutputKey
            }}</span>
            <div class="flex items-center space-x-2">
              <button @click="moveSlot(selectedOutputKey, 'up', 'output')" :disabled="!canMoveOutputUp"
                v-comfy-tooltip="'上移'"
                class="btn btn-xs btn-ghost p-0 text-gray-500 hover:text-gray-700 disabled:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:disabled:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button @click="moveSlot(selectedOutputKey, 'down', 'output')" :disabled="!canMoveOutputDown"
                v-comfy-tooltip="'下移'"
                class="btn btn-xs btn-ghost p-0 text-gray-500 hover:text-gray-700 disabled:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:disabled:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button @click="removeOutput(selectedOutputKey)" class="text-red-500 hover:text-red-700 text-xs">
                删除此输出
              </button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-x-2 gap-y-1 items-center text-xs">
            <label class="col-span-1 text-right">名称:</label>
            <input v-model="editingDisplayName" type="text" class="col-span-2 input-xs" placeholder="显示名称"
              @focus="oldOutputDisplayName = editingDisplayName" @blur="handleOutputNameBlur" />

            <label class="col-span-1 text-right">类型:</label>
            <select :value="selectedOutputData?.dataFlowType" class="col-span-2 input-xs"
              @change="handleOutputTypeChange">
              <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
            </select>

            <label class="col-span-1 text-right">描述:</label>
            <input v-model="editingDescription" type="text" class="col-span-2 input-xs" placeholder="接口描述信息"
              @blur="handleOutputDescriptionBlur" />

            <!-- TODO: 添加 config 字段 -->
          </div>
        </div>
      </OverlayScrollbarsComponent>
    </div>
    <div v-else class="px-4 py-4 text-gray-500 italic text-xs">
      没有活动的工作流或工作流数据不可用。
    </div>
  </div>
</template>

<style scoped>
/* 自定义输入样式 (手动替换 DaisyUI) */
.input-xs {
  @apply w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors;
}

/* 添加 textarea-xs 样式 */
.textarea-xs {
  @apply w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-y;
  /* 改为 resize-y */
  min-height: calc(1.5rem * 3);
  /* 保持与 rows="3" 大致一致的高度 */
}

/* 按钮样式 (替换 DaisyUI btn 类) */
.btn {
  @apply font-medium rounded-md text-center inline-flex items-center justify-center transition-colors duration-150 ease-in-out;
  /* 基本按钮样式 */
}

.btn-xs {
  @apply px-2 py-0.5 text-xs;
  /* 超小 */
}

.btn-sm {
  @apply px-3 py-1 text-sm;
  /* 小 */
}

.btn-outline {
  @apply border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400;
  /* 轮廓样式 */
}

/* 添加 ghost 按钮样式 */
.btn-ghost {
  @apply border border-transparent bg-transparent text-current hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed;
  /* 幽灵按钮样式 */
}

.btn-primary {
  @apply bg-blue-500 hover:bg-blue-600 text-white border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500;
  /* 主要按钮样式 */
}

/* 隐藏滚动条的步进三角 */
.overflow-y-auto::-webkit-scrollbar-button {
  display: none;
}

/* 对于 Firefox，设置滚动条宽度为薄 */
.overflow-y-auto {
  scrollbar-width: thin;
}

/* 选中列表项的附加样式 */
.bg-blue-100 {
  background-color: #dbeafe;
  /* 浅蓝色用于浅色模式 */
}

.dark .dark\:bg-blue-900 {
  background-color: #1e3a8a;
  /* 深蓝色用于深色模式 */
}

/* 确保列表项不会奇怪地收缩 */
li>span:first-child {
  min-width: 0;
  /* 允许截断 */
}
</style>
