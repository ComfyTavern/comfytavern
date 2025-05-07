<template>
  <div
    class="workflow-menu absolute bottom-full left-0 mb-1 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 py-1">
    <ul>
      <li>
        <button @click="handleNew" class="menu-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新建
        </button>
      </li>
      <li>
        <button @click="handleOpen" class="menu-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.08a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6.75A2.25 2.25 0 0 1 5.625 4.5h12.75a2.25 2.25 0 0 1 2.25 2.25v3.026" />
          </svg>
          打开...
        </button>
      </li>
      <li class="menu-separator">
        <hr class="border-gray-200 dark:border-gray-700 my-1">
      </li>
      <li>
        <button @click="handleSave" class="menu-item" :disabled="!isCurrentTabDirty && !!currentWorkflowData?.id">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              transform="rotate(180 12 12)" />
          </svg>
          保存
          <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">Ctrl+S</span>
        </button>
      </li>
      <li>
        <button @click="handleSaveAs" class="menu-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z" />
          </svg>
          另存为...
        </button>
      </li>
      <li class="menu-separator">
        <hr class="border-gray-200 dark:border-gray-700 my-1">
      </li>
      <li>
        <button @click="handleImportClick" class="menu-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3v11.25" />
          </svg>
          导入...
        </button>
        <input type="file" ref="importInputRef" @change="handleFileChange" accept=".json" style="display: none;" />
      </li>
      <li>
        <button @click="handleExport" class="menu-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          导出
        </button>
      </li>
      <li class="menu-separator">
        <hr class="border-gray-200 dark:border-gray-700 my-1">
      </li>
      <li>
        <button @click="handleUndoClick" class="menu-item" :disabled="!canUndoActive">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2 transform scale-x-[-1]">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          </svg>
          撤销
          <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">Ctrl+Z</span>
        </button>
      </li>
      <li>
        <button @click="handleRedoClick" class="menu-item" :disabled="!canRedoActive">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          </svg>
          重做
          <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">Ctrl+Shift+Z</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">

import type { WorkflowData } from '@/types/workflowTypes';  // Import WorkflowData type using relative path
import { useWorkflowStore } from '@/stores/workflowStore'; // Removed WorkflowData import
import { useTabStore } from '@/stores/tabStore'; // 导入 Tab Store
import { storeToRefs } from 'pinia';
// import { useVueFlow } from '@vue-flow/core'; // 不再需要
import { ref, computed } from 'vue'; // 导入 computed
// import type { WorkflowObject } from '@comfytavern/types'; // 不再需要
import sanitize from 'sanitize-filename'; // 导入 sanitize-filename
// 假设有一个 UI store 来控制侧边栏
// import { useUiStore } from '@/stores/uiStore'; // 导入 UI Store (假设) - 待创建
// 导入事件总线或 provide/inject 来触发侧边栏打开
// import { eventBus } from '@/utils/eventBus'; // 假设有事件总线
const emit = defineEmits(['close']);

const workflowStore = useWorkflowStore();
const tabStore = useTabStore();
// const uiStore = useUiStore(); // 实例化 UI Store (假设) - 待创建

const { activeTabId } = storeToRefs(tabStore);
// const vueFlow = useVueFlow(); // 不再直接在顶层使用
const importInputRef = ref<HTMLInputElement | null>(null);
// --- Computed properties for active tab state ---
const currentTabState = computed(() => {
  return activeTabId.value ? workflowStore.getActiveTabState() : undefined;
});

const currentWorkflowData = computed(() => {
  return currentTabState.value?.workflowData ?? null;
});

const isCurrentTabDirty = computed(() => {
  return activeTabId.value ? workflowStore.isWorkflowDirty(activeTabId.value) : false;
});

// --- Computed properties for Undo/Redo state ---
const canUndoActive = computed(() => {
  return activeTabId.value ? workflowStore.canUndo(activeTabId.value).value : false;
});

const canRedoActive = computed(() => {
  return activeTabId.value ? workflowStore.canRedo(activeTabId.value).value : false;
});

const closeMenu = () => {
  emit('close');
};


const handleNew = () => {
  if (activeTabId.value) {
    // 调用 store action 创建新工作流（现在需要 tab id）
    workflowStore.createNewWorkflow(activeTabId.value);
  } else {
    console.error("无法创建新工作流：没有活动的标签页。");
    alert("无法创建新工作流：请先打开一个标签页。");
  }
  closeMenu();
};
const handleOpen = () => {
  // TODO: 实现打开侧边栏工作流面板的逻辑 (需要 UI Store 或其他机制)
  console.warn("需要实现打开侧边栏工作流面板的逻辑");
  alert("打开功能需要连接到侧边栏，暂未实现");
  // uiStore.openSidebarTab('workflows'); // 调用 UI store action (假设) - 待创建
  closeMenu();
};

const handleSave = async () => {
  if (!activeTabId.value) {
    console.error("无法保存：没有活动的标签页。");
    alert("无法保存：请先打开一个标签页。");
    closeMenu();
    return;
  }

  // 如果是新工作流 (没有 ID 或 ID 以 'temp-' 开头)，则调用 store action 获取名称并保存
  const isNewOrTemp = !currentWorkflowData.value?.id || currentWorkflowData.value.id.startsWith('temp-');
  if (isNewOrTemp) {
    console.debug("[WorkflowMenu handleSave] 检测到新工作流或临时工作流，触发 promptAndSaveWorkflow。"); // 添加日志
    await workflowStore.promptAndSaveWorkflow(false);
    closeMenu(); // promptAndSaveWorkflow 不负责关闭菜单
  } else {
    // 如果是现有工作流，直接调用 store action 保存 (不需要传 name)
    console.debug("[WorkflowMenu handleSave] 检测到现有工作流，直接触发 saveWorkflow。"); // 添加日志
    try {
      await workflowStore.saveWorkflow(); // 调用 store action 保存，不需要参数
      closeMenu();
    } catch (error) {
      console.error('保存工作流时出错:', error);
      alert(`保存工作流失败: ${error instanceof Error ? error.message : '未知错误'}`);
      closeMenu();
    }
  }
};
const handleSaveAs = async () => {
  // 直接调用 store action 处理另存为，它会处理 activeTabId 检查和 prompt
  // console.debug("触发 promptAndSaveWorkflow (isSaveAs=true) 从 handleSaveAs");
  await workflowStore.promptAndSaveWorkflow(true);
  closeMenu(); // promptAndSaveWorkflow 不负责关闭菜单
};

const handleImportClick = () => {
  importInputRef.value?.click();
  closeMenu();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!activeTabId.value) {
    console.error("无法导入：没有活动的标签页。");
    alert("无法导入：请先打开一个标签页。");
    // 重置文件输入
    if (importInputRef.value) {
      importInputRef.value.value = '';
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const currentTabId = activeTabId.value; // 捕获当前 ID
    if (!currentTabId) return; // Double check

    try {
      const content = e.target?.result as string;
      const parsedData = JSON.parse(content);

      // 验证导入的数据结构是否基本符合预期 (FlowExportObject)
      // 注意：这里导入的是 VueFlow 的导出格式，可能需要适配 WorkflowObject
      if (parsedData && Array.isArray(parsedData.nodes) && Array.isArray(parsedData.edges) && parsedData.viewport) {

        // 尝试从导入的数据中提取元数据
        const name = ('name' in parsedData && typeof parsedData.name === 'string') ? parsedData.name : file.name.replace(/\.json$/i, '');
        const description = ('description' in parsedData && typeof parsedData.description === 'string') ? parsedData.description : undefined;
        const version = ('version' in parsedData && typeof parsedData.version === 'string') ? parsedData.version : undefined;

        // TODO: 需要在 workflowStore 中实现 loadImportedData action 来处理导入
        // const importPayload: WorkflowObject = { ... };
        // await workflowStore.loadImportedData(currentTabId, importPayload);

        // --- 临时替代方案：直接操作当前 vueFlow 实例和 store 状态 ---
        // 这不是最佳实践，但作为过渡
        const vueFlowInstance = workflowStore.getVueFlowInstance(currentTabId);
        if (vueFlowInstance) {
            vueFlowInstance.setNodes(parsedData.nodes);
            vueFlowInstance.setEdges(parsedData.edges);
            vueFlowInstance.setViewport(parsedData.viewport);
        }
        // 更新 store 中的数据 (需要更健壮的方式)
        const tabState = workflowStore.getActiveTabState(); // 获取当前状态
        if(tabState) {
            tabState.elements = [...parsedData.nodes, ...parsedData.edges];
            tabState.viewport = parsedData.viewport;
            // 更新 workflowData，注意 id 应为空，表示未保存的导入
            tabState.workflowData = {
                ...(tabState.workflowData || {}), // 保留可能的旧数据？或者完全覆盖？先覆盖
                id: '', // 必须为空，表示新导入未保存
                name: name,
                description: description,
                version: version,
                nodes: parsedData.nodes, // 存储转换后的类型？暂时用 any
                edges: parsedData.edges,
                viewport: parsedData.viewport,
                embeddedWorkflows: ('embeddedWorkflows' in parsedData) ? parsedData.embeddedWorkflows : undefined, // 保留嵌入式组
            } as WorkflowData; // 需要确保类型匹配
            workflowStore.markAsDirty(currentTabId); // 标记为脏
            // 重置历史记录
            // historyHandler.clearHistory(currentTabId);
            // historyHandler.recordHistory(currentTabId, tabState.elements);
            console.warn("导入成功，但历史记录未正确处理，store action 未实现");
        }
         // 更新 Tab 标签名称
        tabStore.updateTab(currentTabId, { label: name, isDirty: true, associatedId: '' });


        console.log('工作流导入成功（临时实现）。'); // Keep as log - user action feedback
        alert(`工作流 "${name}" 已导入到当前标签页。请记得保存。`);
        // --- 临时方案结束 ---

      } else {
        throw new Error('无效的工作流文件格式。需要包含 nodes, edges, 和 viewport。');
      }
    } catch (error) {
      console.error('导入工作流时出错:', error);
      alert(`导入工作流失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      // 重置文件输入，以便可以再次选择相同的文件
      if (importInputRef.value) {
        importInputRef.value.value = '';
      }
    }
  };
  reader.onerror = (error) => {
    console.error('读取文件时出错:', error);
    alert('读取文件失败。');
    if (importInputRef.value) {
      importInputRef.value.value = '';
    }
  };
  reader.readAsText(file);
};


const handleExport = () => {
  const currentTabId = activeTabId.value;
  if (!currentTabId) {
      console.error("无法导出：没有活动的标签页。");
      alert("无法导出：请先打开一个标签页。");
      closeMenu();
      return;
  }
  const instance = workflowStore.getVueFlowInstance(currentTabId);
  if (!instance) {
    console.error(`无法导出：标签页 ${currentTabId} 的 VueFlow 实例不可用。`);
    alert("无法导出：VueFlow 实例不可用。");
    closeMenu();
    return;
  }

  const flowExportData = instance.toObject();

  // 将 store 中的元数据（name, description, version, embeddedWorkflows）添加到导出的数据中
  const workflowMeta = currentWorkflowData.value;
  const dataToExport = {
    ...flowExportData,
    name: workflowMeta?.name,
    description: workflowMeta?.description,
    version: workflowMeta?.version,
    // embeddedWorkflows: workflowMeta?.embeddedWorkflows, // 如果需要导出嵌入式组
  };


  const jsonString = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  let workflowName = currentWorkflowData.value?.name; // 使用 computed 属性
  let filename = '';

  if (workflowName) {
    // 使用 sanitize-filename 清理名称
    filename = `${sanitize(workflowName, { replacement: '_' })}.json`;
  } else {
    // 生成带时间戳的默认文件名
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    filename = `CT_workflow_${year}${month}${day}_${hours}${minutes}${seconds}.json`;
  }

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  closeMenu();
};


const handleUndoClick = () => {
  if (activeTabId.value) {
    workflowStore.undo(); // 函数默认在当前激活的标签页上操作
  }
  closeMenu();
};

const handleRedoClick = () => {
  if (activeTabId.value) {
    workflowStore.redo(); // 函数默认在当前激活的标签页上操作
  }
  closeMenu();
};

// 添加键盘快捷键监听 (Ctrl+S, Ctrl+O)
// onMounted(() => {
//   const handleKeyDown = (event: KeyboardEvent) => {
//     if (event.ctrlKey && event.key === 's') {
//       event.preventDefault();
//       handleSave();
//     }
//     // 导入没有标准快捷键，可以考虑 Ctrl+Shift+O 或其他
//     // if (event.ctrlKey && event.key === 'o') {
//     //   event.preventDefault();
//     //   handleOpen(); // 这个是打开侧边栏的
//     // }
//   };
//   window.addEventListener('keydown', handleKeyDown);
//   onBeforeUnmount(() => {
//     window.removeEventListener('keydown', handleKeyDown);
//   });
// });

</script>

<style scoped>
.workflow-menu {
  /* 菜单样式 */
}

.menu-item {
  @apply flex items-center w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed;
}

.menu-separator {
  /* 分隔线样式 */
}
</style>