import { computed, nextTick, type Ref, type ComputedRef } from "vue";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { GroupSlotInfo, HistoryEntry } from "@comfytavern/types"; // <-- Import HistoryEntry
import { createHistoryEntry } from "@comfytavern/utils"; // <-- Import createHistoryEntry
import { SocketType } from "@comfytavern/types";
import type { TabWorkflowState } from "@/types/workflowTypes";

// 辅助函数：生成唯一 Key (保持私有或按需导出)
function generateUniqueKey(
  type: string,
  existingKeys: Record<string, any>,
  ioType: "input" | "output"
): string {
  let index = 0;
  let newKey = `${type}_${ioType}_${index}`;
  while (existingKeys[newKey]) {
    index++;
    newKey = `${type}_${ioType}_${index}`;
  }
  return newKey;
}

// 辅助函数：排序插槽 (保持私有或按需导出)
const CONVERTIBLE_ANY_KEY = SocketType.CONVERTIBLE_ANY;
function sortSlots(slots: Record<string, GroupSlotInfo>): Record<string, GroupSlotInfo> {
  // 过滤掉 CONVERTIBLE_ANY
  const filteredEntries = Object.entries(slots).filter(
    ([, slotInfo]) => slotInfo && slotInfo.type !== CONVERTIBLE_ANY_KEY
  );

  // 排序 (优先 displayName, 其次 key)
  filteredEntries.sort(([, a], [, b]) => {
    const nameA = a.displayName || a.key;
    const nameB = b.displayName || b.key;
    return nameA.localeCompare(nameB);
  });

  // 重新构建对象
  const sortedSlots: Record<string, GroupSlotInfo> = {};
  for (const [key, slot] of filteredEntries) {
    sortedSlots[key] = slot;
  }

  // 检查原始 slots 中是否有 CONVERTIBLE_ANY，并添加到末尾
  const convertibleAnyEntry = Object.entries(slots).find(
    ([, slotInfo]) => slotInfo && slotInfo.type === CONVERTIBLE_ANY_KEY
  );
  if (convertibleAnyEntry) {
    const [key, slot] = convertibleAnyEntry;
    // 确保 convertibleAnySlot 存在且有 key
    if (key && slot) {
      sortedSlots[key] = slot;
    }
  }

  return sortedSlots;
}

// 辅助函数：获取过滤后的插槽条目 (保持私有或按需导出)
function getFilteredSlotEntries(
  slots: Record<string, GroupSlotInfo> | undefined | null
): [string, GroupSlotInfo][] {
  if (!slots) return [];
  return Object.entries(slots).filter(
    ([, slotInfo]) => slotInfo && slotInfo.type !== CONVERTIBLE_ANY_KEY
  );
}

/**
 * 管理 GroupIOEdit 组件中与添加、删除、排序、移动 IO 相关的操作。
 * @param activeTabId - 当前活动 Tab ID 的 Ref。
 * @param activeState - 当前活动 Tab 状态的 Ref (包含 workflowData)。
 * @param selectedInputKey - 当前选中的输入 Key 的 Ref。
 * @param selectedOutputKey - 当前选中的输出 Key 的 Ref。
 * @param selectInput - 用于选择新添加的输入的函数。
 * @param selectOutput - 用于选择新添加的输出的函数。
 * @param closeInputDropdown - 关闭输入下拉菜单的函数。
 * @param closeOutputDropdown - 关闭输出下拉菜单的函数。
 */
export function useGroupIOActions(
  activeTabId: Ref<string | null>,
  activeState: ComputedRef<TabWorkflowState | undefined>, // Update type to ComputedRef<TabWorkflowState | undefined>
  selectedInputKey: Ref<string | null>,
  selectedOutputKey: Ref<string | null>,
  selectInput: (key: string) => void,
  selectOutput: (key: string) => void,
  closeInputDropdown: () => void,
  closeOutputDropdown: () => void
) {
  const workflowStore = useWorkflowStore();

  // --- 添加/移除逻辑 ---
  function addInput(type: string) {
    console.log(`[useGroupIOActions] addInput called with type: ${type}`);
    if (!activeTabId.value) return;

    const newKey = generateUniqueKey(
      type,
      activeState.value?.workflowData?.interfaceInputs || {},
      "input"
    ); // Generate key first
    // const label = `修改 - 接口 (添加输入 ${newKey})`; // Removed label creation

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const newSlotData: GroupSlotInfo = {
        key: newKey,
        displayName: newKey,
        type: type,
        customDescription: "",
      };

      const orderedInputs: Record<string, GroupSlotInfo> = {};
      let convertibleAnySlot: GroupSlotInfo | null = null;
      let convertibleAnyKey: string | null = null;

      for (const key in currentInputs) {
        const slot = currentInputs[key];
        if (slot) {
          if (slot.type === CONVERTIBLE_ANY_KEY) {
            convertibleAnySlot = slot;
            convertibleAnyKey = key;
          } else {
            orderedInputs[key] = slot;
          }
        }
      }
      orderedInputs[newKey] = newSlotData;
      if (convertibleAnySlot && convertibleAnyKey) {
        orderedInputs[convertibleAnyKey] = convertibleAnySlot;
      }

      return { inputs: orderedInputs, outputs: currentOutputs }; // Return updated inputs and original outputs
    };
 
    // Create history entry
    const summary = `添加输入 ${newKey} (类型: ${type})`; // Use key and type
    const entry: HistoryEntry = createHistoryEntry(
      'add', // actionType
      'interfaceInput', // objectType
      summary, // Use descriptive summary
      { key: newKey, type: type } // Add type to details
    );
 
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry object
    // markAsDirty is handled within updateWorkflowInterface now

    nextTick(() => {
      selectInput(newKey);
    });
    closeInputDropdown();
  }

  function removeInput(keyToRemove: string) {
    // Renamed key to keyToRemove for clarity
    console.log(`[useGroupIOActions] removeInput called for key: ${keyToRemove}`);
    if (!activeTabId.value) return;
 
    // const label = `修改 - 接口 (删除输入 ${keyToRemove})`; // Removed label creation

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedInputs = { ...currentInputs }; // Create a shallow copy
      if (updatedInputs[keyToRemove]) {
        delete updatedInputs[keyToRemove];
        console.log(`[useGroupIOActions] Input removed within updateFn. Remaining:`, updatedInputs);
      } else {
        console.warn(
          `[useGroupIOActions] Input key ${keyToRemove} not found in current state during updateFn.`
        );
      }
      return { inputs: updatedInputs, outputs: currentOutputs };
    };
 
    // Create history entry - Try to get display name before removal
    const inputToRemove = activeState.value?.workflowData?.interfaceInputs?.[keyToRemove];
    const inputNameToRemove = inputToRemove?.displayName || keyToRemove;
    const summary = `删除输入 ${inputNameToRemove}`; // Use display name or key
    const entry: HistoryEntry = createHistoryEntry(
      'delete', // actionType
      'interfaceInput', // objectType
      summary, // Use descriptive summary
      { key: keyToRemove, name: inputNameToRemove, slotType: 'input' } // Add name and slotType to details
    );

    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry object

    if (selectedInputKey.value === keyToRemove) {
      selectedInputKey.value = null;
    }
  }

  function addOutput(type: string) {
    console.log(`[useGroupIOActions] addOutput called with type: ${type}`);
    if (!activeTabId.value) return;

    const newKey = generateUniqueKey(
      type,
      activeState.value?.workflowData?.interfaceOutputs || {},
      "output"
    );
    // const label = `修改 - 接口 (添加输出 ${newKey})`; // Removed label creation

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const newSlotData: GroupSlotInfo = {
        key: newKey,
        displayName: newKey,
        type: type,
        customDescription: "",
      };

      const orderedOutputs: Record<string, GroupSlotInfo> = {};
      let convertibleAnySlot: GroupSlotInfo | null = null;
      let convertibleAnyKey: string | null = null;

      for (const key in currentOutputs) {
        const slot = currentOutputs[key];
        if (slot) {
          if (slot.type === CONVERTIBLE_ANY_KEY) {
            convertibleAnySlot = slot;
            convertibleAnyKey = key;
          } else {
            orderedOutputs[key] = slot;
          }
        }
      }
      orderedOutputs[newKey] = newSlotData;
      if (convertibleAnySlot && convertibleAnyKey) {
        orderedOutputs[convertibleAnyKey] = convertibleAnySlot;
      }

      return { inputs: currentInputs, outputs: orderedOutputs };
    };
 
    // Create history entry
    const summary = `添加输出 ${newKey} (类型: ${type})`; // Use key and type
    const entry: HistoryEntry = createHistoryEntry(
      'add', // actionType
      'interfaceOutput', // objectType
      summary, // Use descriptive summary
      { key: newKey, type: type } // Add type to details
    );
 
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry object

    nextTick(() => {
      selectOutput(newKey);
    });
    closeOutputDropdown();
  }

  function removeOutput(keyToRemove: string) {
    // Renamed key to keyToRemove
    console.log(`[useGroupIOActions] removeOutput called for key: ${keyToRemove}`);
    if (!activeTabId.value) return;
 
    // const label = `修改 - 接口 (删除输出 ${keyToRemove})`; // Removed label creation

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const updatedOutputs = { ...currentOutputs }; // Shallow copy
      if (updatedOutputs[keyToRemove]) {
        delete updatedOutputs[keyToRemove];
        console.log(
          `[useGroupIOActions] Output removed within updateFn. Remaining:`,
          updatedOutputs
        );
      } else {
        console.warn(
          `[useGroupIOActions] Output key ${keyToRemove} not found in current state during updateFn.`
        );
      }
      return { inputs: currentInputs, outputs: updatedOutputs };
    };
 
    // Create history entry - Try to get display name before removal
    const outputToRemove = activeState.value?.workflowData?.interfaceOutputs?.[keyToRemove];
    const outputNameToRemove = outputToRemove?.displayName || keyToRemove;
    const summary = `删除输出 ${outputNameToRemove}`; // Use display name or key
    const entry: HistoryEntry = createHistoryEntry(
      'delete', // actionType
      'interfaceOutput', // objectType
      summary, // Use descriptive summary
      { key: keyToRemove, name: outputNameToRemove, slotType: 'output' } // Add name and slotType to details
    );

    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry object

    if (selectedOutputKey.value === keyToRemove) {
      selectedOutputKey.value = null;
    }
  }

  // --- 排序逻辑 ---
  function sortInputs() {
    if (!activeTabId.value) return;
 
    // const label = `修改 - 接口 (排序输入)`; // Removed label creation

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const sortedInputs = sortSlots(currentInputs);
      // Only return updated state if the order actually changed
      if (
        JSON.stringify(Object.keys(currentInputs)) !== JSON.stringify(Object.keys(sortedInputs))
      ) {
        console.log("[useGroupIOActions] Sorting inputs within updateFn...");
        return { inputs: sortedInputs, outputs: currentOutputs };
      } else {
        console.log(
          "[useGroupIOActions] Inputs already sorted or no change needed within updateFn."
        );
        // Return original state to avoid unnecessary history record if no change
        return { inputs: currentInputs, outputs: currentOutputs };
      }
    };

    // Check if update is needed *before* calling the store function
    const currentInputsSnapshot = JSON.parse(
      JSON.stringify(activeState.value?.workflowData?.interfaceInputs || {})
    );
    const sortedInputsSnapshot = sortSlots(currentInputsSnapshot);
    if (
      JSON.stringify(Object.keys(currentInputsSnapshot)) !==
      JSON.stringify(Object.keys(sortedInputsSnapshot))
    ) {
      // Create history entry only if changes are made
      const entry: HistoryEntry = createHistoryEntry(
        'sort', // actionType
        'interfaceInput', // objectType
        '排序输入', // summary
        {} // details (no specific details needed for sort)
      );
      workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry object
    } else {
      console.log("[useGroupIOActions] Inputs already sorted or no change needed (pre-check).");
    }
  }

  function sortOutputs() {
    if (!activeTabId.value) return;
 
    // const label = `修改 - 接口 (排序输出)`; // Removed label creation

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const sortedOutputs = sortSlots(currentOutputs);
      if (
        JSON.stringify(Object.keys(currentOutputs)) !== JSON.stringify(Object.keys(sortedOutputs))
      ) {
        console.log("[useGroupIOActions] Sorting outputs within updateFn...");
        return { inputs: currentInputs, outputs: sortedOutputs };
      } else {
        console.log(
          "[useGroupIOActions] Outputs already sorted or no change needed within updateFn."
        );
        return { inputs: currentInputs, outputs: currentOutputs };
      }
    };

    // Pre-check
    const currentOutputsSnapshot = JSON.parse(
      JSON.stringify(activeState.value?.workflowData?.interfaceOutputs || {})
    );
    const sortedOutputsSnapshot = sortSlots(currentOutputsSnapshot);
    if (
      JSON.stringify(Object.keys(currentOutputsSnapshot)) !==
      JSON.stringify(Object.keys(sortedOutputsSnapshot))
    ) {
      // Create history entry only if changes are made
      const entry: HistoryEntry = createHistoryEntry(
        'sort', // actionType
        'interfaceOutput', // objectType
        '排序输出', // summary
        {} // details
      );
      workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry object
    } else {
      console.log("[useGroupIOActions] Outputs already sorted or no change needed (pre-check).");
    }
  }

  // --- 移动逻辑 ---
  function moveSlot(keyToMove: string, direction: "up" | "down", ioType: "input" | "output") {
    if (!activeTabId.value) return;
 
    // const label = `修改 - 接口 (移动 ${ioType} ${keyToMove} ${direction})`; // Removed label creation

    const updateFn = (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
      const targetSlots = ioType === "input" ? { ...currentInputs } : { ...currentOutputs }; // Shallow copy

      const filteredEntries = getFilteredSlotEntries(targetSlots);
      const currentIndex = filteredEntries.findIndex(([k]) => k === keyToMove);

      if (currentIndex === -1) {
        console.warn(
          `[useGroupIOActions] Key ${keyToMove} not found in filtered ${ioType}s during updateFn.`
        );
        return { inputs: currentInputs, outputs: currentOutputs }; // Return original state
      }

      const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (newIndex < 0 || newIndex >= filteredEntries.length) {
        console.warn(
          `[useGroupIOActions] Cannot move ${keyToMove} ${direction}. Already at boundary during updateFn.`
        );
        return { inputs: currentInputs, outputs: currentOutputs }; // Return original state
      }

      // Perform the swap within the filtered list
      const currentEntry = filteredEntries[currentIndex];
      const targetEntry = filteredEntries[newIndex];
      if (currentEntry && targetEntry) {
        filteredEntries[currentIndex] = targetEntry;
        filteredEntries[newIndex] = currentEntry;
      } else {
        console.warn(
          `[useGroupIOActions] Error during swap in updateFn: one or both entries are undefined. Index: ${currentIndex}, ${newIndex}`
        );
        return { inputs: currentInputs, outputs: currentOutputs }; // Return original state
      }

      // Reconstruct the full slot object including CONVERTIBLE_ANY
      const reorderedSlots: Record<string, GroupSlotInfo> = {};
      for (const [k, slot] of filteredEntries) {
        reorderedSlots[k] = slot;
      }

      // Find and re-add the CONVERTIBLE_ANY slot if it exists in the original targetSlots
      const convertibleAnyEntry = Object.entries(targetSlots).find(
        ([, slotInfo]) =>
          slotInfo &&
          typeof slotInfo === "object" &&
          "type" in slotInfo &&
          slotInfo.type === CONVERTIBLE_ANY_KEY
      );
      if (convertibleAnyEntry) {
        const [convKey, convSlot] = convertibleAnyEntry;
        if (convKey && convSlot && typeof convSlot === "object" && "key" in convSlot) {
          reorderedSlots[convKey] = convSlot as GroupSlotInfo;
        }
      }

      console.log(
        `[useGroupIOActions] Moving ${ioType} ${keyToMove} ${direction} within updateFn...`
      );
      if (ioType === "input") {
        return { inputs: reorderedSlots, outputs: currentOutputs };
      } else {
        return { inputs: currentInputs, outputs: reorderedSlots };
      }
    };

    // No pre-check needed here as move is always a change if possible
    const objectType = ioType === 'input' ? 'interfaceInput' : 'interfaceOutput';
    // Try to get display name before move
    const currentSlots = ioType === 'input'
        ? activeState.value?.workflowData?.interfaceInputs
        : activeState.value?.workflowData?.interfaceOutputs;
    const slotToMove = currentSlots?.[keyToMove];
    const slotNameToMove = slotToMove?.displayName || keyToMove;
    const summary = `移动 ${ioType === 'input' ? '输入' : '输出'} ${slotNameToMove}`; // Use display name or key
    const entry: HistoryEntry = createHistoryEntry(
      'move', // actionType
      objectType, // objectType
      summary, // summary
      { key: keyToMove, direction: direction } // details
    );
    workflowStore.updateWorkflowInterface(activeTabId.value, updateFn, entry); // Pass entry object
  }

  // --- 过滤后的计算属性 (用于移动按钮禁用状态) ---
  // 这些计算属性依赖于 activeState，所以放在这里
  const filteredInputEntries = computed(() =>
    // Add check for activeState.value
    getFilteredSlotEntries(activeState.value?.workflowData?.interfaceInputs)
  );
  const filteredOutputEntries = computed(() =>
    // Add check for activeState.value
    getFilteredSlotEntries(activeState.value?.workflowData?.interfaceOutputs)
  );

  // --- 计算属性：控制移动按钮的禁用状态 ---
  const canMoveInputUp = computed(() => {
    if (!selectedInputKey.value) return false;
    const index = filteredInputEntries.value.findIndex(([k]) => k === selectedInputKey.value);
    return index > 0;
  });

  const canMoveInputDown = computed(() => {
    if (!selectedInputKey.value) return false;
    const index = filteredInputEntries.value.findIndex(([k]) => k === selectedInputKey.value);
    return index !== -1 && index < filteredInputEntries.value.length - 1;
  });

  const canMoveOutputUp = computed(() => {
    if (!selectedOutputKey.value) return false;
    const index = filteredOutputEntries.value.findIndex(([k]) => k === selectedOutputKey.value);
    return index > 0;
  });

  const canMoveOutputDown = computed(() => {
    if (!selectedOutputKey.value) return false;
    const index = filteredOutputEntries.value.findIndex(([k]) => k === selectedOutputKey.value);
    return index !== -1 && index < filteredOutputEntries.value.length - 1;
  });

  return {
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
    // 也导出过滤后的条目，以防模板需要它们（虽然最好通过子组件传递）
    filteredInputEntries,
    filteredOutputEntries,
  };
}
