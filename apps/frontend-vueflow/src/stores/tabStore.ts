import { defineStore } from "pinia";
import { ref, computed, watch } from "vue"; // Import watch
import { v4 as uuidv4 } from "uuid";
import { useWorkflowStore } from "./workflowStore"; // 需要访问工作流数据
import { useProjectStore } from "./projectStore"; // 导入 project store
import { useRouter } from "vue-router"; // Import useRouter
// 定义标签页类型
export type TabType = "workflow" | "settings" | "character" | "groupEditor"; // Add 'groupEditor' back

// 定义标签页接口
export interface Tab {
  internalId: string; // 标签页自身的唯一ID
  projectId: string; // 关联的项目 ID
  type: TabType; // 标签页类型
  label: string; // 显示的标签名
  associatedId: string | null; // 关联的对象ID (例如 workflowId, 相对于项目)
  isDirty: boolean; // 是否有未保存的更改
}

export const useTabStore = defineStore("tab", () => {
  const workflowStore = useWorkflowStore(); // 获取 workflow store 实例
  const projectStore = useProjectStore(); // 获取 project store 实例
  const router = useRouter(); // 获取 router 实例
  // --- State ---
  const tabs = ref<Tab[]>([]);
  const activeTabId = ref<string | null>(null);

  // --- Getters ---
  const activeTab = computed(
    () => tabs.value.find((tab) => tab.internalId === activeTabId.value) || null
  );
  // Getter to get tabs for the current project (Currently unused, commented out to avoid TS warning)
  // const currentProjectTabs = computed(() => {
  //   const currentProjectId = projectStore.currentProjectId;
  //   if (!currentProjectId) return [];
  //   return tabs.value.filter(tab => tab.projectId === currentProjectId);
  // });

  // --- Actions ---

  /**
   * 添加新标签页
   * @param type - 标签页类型
   * @param label - 标签页名称
   * @param associatedId - 关联的对象ID
   * @param setActive - 是否立即激活新标签页
   * @returns 新创建的标签页对象
   */
  function addTab(
    type: TabType = "workflow",
    label: string = "未命名工作流",
    associatedId: string | null = null, // workflowId or other relative ID
    setActive: boolean = true,
    projectId?: string // Allow specifying projectId, otherwise use current
  ): Tab | null {
    // Return null if projectId is missing
    const currentProjectId = projectId || projectStore.currentProjectId;

    if (!currentProjectId) {
      console.error("TabStore: Cannot add tab, current project ID is not set.");
      // TODO: Show user error message
      return null; // Indicate failure
    }

    // For new workflow tabs, associatedId should remain null initially.
    // workflowStore.ensureTabState will handle loading the default template based on null associatedId.
    const finalAssociatedId = associatedId;
    const newTab: Tab = {
      internalId: uuidv4(),
      projectId: currentProjectId, // Set the project ID
      type,
      label,
      associatedId: finalAssociatedId,
      isDirty: false, // 新标签页初始状态不是脏的
    };
    tabs.value.push(newTab);

    if (setActive) {
      setActiveTab(newTab.internalId);
    }
    return newTab;
  }

  /**
   * 移除标签页
   * @param internalId - 要移除的标签页ID
   */
  function removeTab(internalId: string) {
    const index = tabs.value.findIndex((tab) => tab.internalId === internalId);
    if (index === -1) return;

    const tabToRemove = tabs.value[index];
    if (!tabToRemove) return; // 添加检查确保 tabToRemove 存在

    // 检查是否有未保存的更改
    if (tabToRemove.isDirty) {
      // TODO: 实现更友好的确认对话框
      const confirmClose = confirm(`标签页 "${tabToRemove.label}" 有未保存的更改，确定要关闭吗？`);
      if (!confirmClose) {
        return;
      }
    }

    // 如果关闭的是当前活动标签页，则切换到邻近的标签页
    if (activeTabId.value === internalId) {
      if (tabs.value.length > 1) {
        // 优先切换到右侧标签页，否则切换到左侧
        const nextTab = tabs.value[index + 1] || tabs.value[index - 1];
        if (nextTab) {
          // 添加检查确保 nextTab 存在
          setActiveTab(nextTab.internalId);
        } else {
          // 如果没有邻近标签页（理论上不应发生，因为 length > 1），则清空
          activeTabId.value = null;
        }
      } else {
        // 如果是最后一个标签页，则清空活动ID
        activeTabId.value = null;
        // TODO: 考虑是否需要创建一个新的默认标签页？
      }
    }

    // 从数组中移除
    const removedInternalId = tabToRemove.internalId; // 在 splice 前保存 ID
    tabs.value.splice(index, 1);

    // --- 清理工作流状态 ---
    // 调用 workflowStore 移除与关闭标签页关联的状态
    // 无论标签页类型如何都应执行此操作，因为非工作流标签页也可能有临时状态
    workflowStore.removeWorkflowData(removedInternalId);
    console.debug(
      `TabStore: 已为关闭的标签页 ${removedInternalId} 调用 workflowStore.removeWorkflowData`
    );
    // --- 清理结束 ---

    // Check if the removed tab was the last one for the *current* project
    const remainingTabsForProject = tabs.value.filter(
      (tab) => tab.projectId === tabToRemove.projectId
    );
    if (
      remainingTabsForProject.length === 0 &&
      tabToRemove.projectId === projectStore.currentProjectId
    ) {
      // Only initialize default if the removed tab belonged to the currently active project
      // and it was the last one for that project.
      initializeDefaultTab();
    }

    // The logic above now handles the case where the last tab of the current project is removed.
    // The global check `if (tabs.value.length === 0)` might still be relevant if ALL tabs across ALL projects are somehow removed,
    // but the primary logic should be project-specific. We keep the project-specific logic above.
    // if (tabs.value.length === 0) { // This global check might be redundant now
    //   initializeDefaultTab()
    // }
  }

  /**
   * 更新标签页信息
   * @param internalId - 要更新的标签页ID
   * @param updates - 包含要更新的属性的对象 (Partial<Tab>)
   */
  function updateTab(
    internalId: string,
    updates: Partial<Omit<Tab, "internalId" | "type" | "projectId">>
  ) {
    // Prevent projectId update via this method
    const tab = tabs.value.find((t) => t.internalId === internalId);
    if (tab) {
      Object.assign(tab, updates);
    }
  }

  /**
   * 设置活动标签页，并同步 URL
   * @param internalId - 要激活的标签页ID
   */
  function setActiveTab(internalId: string | null) {
    if (internalId === activeTabId.value) return; // 如果已经是活动标签页，则无需操作

    if (internalId === null || tabs.value.some((tab) => tab.internalId === internalId)) {
      activeTabId.value = internalId;

      // --- URL Synchronization ---
      const newActiveTab = activeTab.value; // 获取新激活的标签页对象
      const currentProjectId = projectStore.currentProjectId; // 获取当前项目 ID

      if (!currentProjectId) {
        console.warn("TabStore: Cannot sync URL, current project ID is missing.");
        return; // 没有项目 ID，无法同步 URL
      }

      // --- URL Synchronization with Loop Prevention ---
      const currentParams = router.currentRoute.value.params;
      const targetWorkflowId =
        newActiveTab?.type === "workflow" || newActiveTab?.type === "groupEditor"
          ? newActiveTab.associatedId
          : null; // Get target workflowId or null

      // Check if URL update is needed
      const needsUpdate =
        currentParams.projectId !== currentProjectId || // Project ID mismatch
        (targetWorkflowId && currentParams.workflowId !== targetWorkflowId) || // Workflow ID exists and mismatches
        (!targetWorkflowId && currentParams.workflowId); // Target has no workflow ID, but URL does

      if (needsUpdate) {
        const params: Record<string, string> = { projectId: currentProjectId };
        if (targetWorkflowId) {
          params.workflowId = targetWorkflowId;
          console.debug(`TabStore: setActiveTab - Updating URL for workflow ${targetWorkflowId}`);
        } else {
          console.debug(`TabStore: setActiveTab - Updating URL (removing workflowId)`);
        }
        router.replace({ name: "Editor", params }).catch((err) => {
          if (err.name !== "NavigationDuplicated") {
            console.error("Router replace error in setActiveTab:", err);
          }
        });
      } else {
        console.debug(
          `TabStore: setActiveTab - URL already matches target state for tab ${internalId}. Skipping router.replace.`
        );
      }
      // --- End URL Synchronization ---
    } else {
      console.warn(`TabStore: Attempted to activate non-existent tab with ID: ${internalId}`);
    }
  }

  /**
   * 初始化默认标签页 (如果需要)
   */
  function initializeDefaultTab() {
    const currentProjectId = projectStore.currentProjectId;
    if (!currentProjectId) {
      console.warn("TabStore: Cannot initialize default tab without a current project ID.");
      return;
    }

    // Filter tabs for the current project
    const tabsForCurrentProject = tabs.value.filter((tab) => tab.projectId === currentProjectId);

    if (tabsForCurrentProject.length === 0) {
      console.info(
        `TabStore: No tabs found for project ${currentProjectId}, initializing default workflow tab.`
      ); // 改为 info
      // addTab will automatically use the currentProjectId
      addTab("workflow", "未命名工作流_1", null, true);
    } else if (
      !activeTabId.value ||
      !tabsForCurrentProject.some((t) => t.internalId === activeTabId.value)
    ) {
      // If there's no active tab OR the active tab doesn't belong to the current project, activate the first tab of the current project
      console.debug(`TabStore: Activating the first tab for project ${currentProjectId}.`);
      // Ensure the first tab exists before trying to access its ID
      if (tabsForCurrentProject[0]) {
        setActiveTab(tabsForCurrentProject[0].internalId);
      } else {
        console.warn(
          `TabStore: Expected to find tabs for project ${currentProjectId} but array was empty when trying to set active tab.`
        );
        // Fallback: Set active tab to null if no tabs are found for the project
        setActiveTab(null);
      }
    } else {
      // Active tab exists and belongs to the current project, do nothing.
      console.debug(
        `TabStore: Active tab ${activeTabId.value} already exists for project ${currentProjectId}.`
      );
    }
  }

  /**
   * Clears all tabs associated with a specific project ID.
   * Also resets activeTabId if it belonged to the cleared project.
   * @param projectIdToClear The ID of the project whose tabs should be cleared.
   */
  function clearTabsForProject(projectIdToClear: string) {
    if (!projectIdToClear) return;

    console.info(`TabStore: Clearing tabs for project ${projectIdToClear}...`); // 改为 info
    const initialLength = tabs.value.length;

    // Check if the currently active tab belongs to the project being cleared
    const activeTabBelongsToClearedProject = activeTab.value?.projectId === projectIdToClear;

    // Filter out tabs belonging to the specified project
    tabs.value = tabs.value.filter((tab) => tab.projectId !== projectIdToClear);

    // If the active tab was cleared, reset activeTabId
    if (activeTabBelongsToClearedProject) {
      activeTabId.value = null;
      // Note: initializeDefaultTab might be called later by App.vue's watch
      // if a new project is loaded immediately after.
    }

    console.info(
      `TabStore: Cleared ${initialLength - tabs.value.length} tabs for project ${projectIdToClear}.`
    ); // 改为 info
  }

  /**
   * 打开一个用于编辑内嵌组的新标签页
   * @param parentWorkflowTabId - 包含该内嵌组的父工作流标签页的 internalId
   * @param embeddedWorkflowId - 要编辑的内嵌组的 ID (在父工作流的 embeddedWorkflows 中)
   */
  /**
   * 打开一个用于编辑引用的工作流的标签页
   * @param referencedWorkflowId - 要编辑的工作流的 ID
   * @param projectId - 工作流所属的项目 ID（可选，默认使用当前项目）
   */
  async function openGroupEditorTab(referencedWorkflowId: string, projectId?: string) {
    // 使用指定的项目 ID 或当前项目 ID
    const targetProjectId = projectId || projectStore.currentProjectId;
    if (!targetProjectId) {
      console.error("TabStore: Cannot open group editor. Project ID is missing.");
      return;
    }

    // Removed try block as lookup is now local
    // 尝试从已加载的列表中获取工作流名称
    const availableWorkflow = workflowStore.availableWorkflows.find(
      (wf) => wf.id === referencedWorkflowId
      // Note: We assume availableWorkflows is filtered by project elsewhere or fetched for the targetProjectId
    );
    const tabLabel = availableWorkflow
      ? `组: ${availableWorkflow.name || referencedWorkflowId.substring(0, 6)}`
      : `组: ${referencedWorkflowId.substring(0, 6)}`; // Fallback if not found in list
    // 检查是否已经存在该工作流的标签页
    const existingTab = tabs.value.find(
      (tab) =>
        tab.type === "groupEditor" &&
        tab.associatedId === referencedWorkflowId &&
        tab.projectId === targetProjectId
    );

    if (existingTab) {
      // 激活已存在的标签页
      setActiveTab(existingTab.internalId);
      console.debug(
        `TabStore: Activated existing group editor tab for workflow ${referencedWorkflowId} in project ${targetProjectId}`
      );
    } else {
      // 添加新标签页
      addTab("groupEditor", tabLabel, referencedWorkflowId, true, targetProjectId);
      console.info(
        `TabStore: Opened new group editor tab for workflow ${referencedWorkflowId} in project ${targetProjectId}`
      ); // 改为 info
    }
    // Removed the try-catch block as we are now looking up locally
  }

  // --- Watchers ---
  // 监听活动标签页的 associatedId 变化 (例如保存新工作流后获得 ID)
  watch(
    () => activeTab.value?.associatedId,
    (newAssociatedId, _oldAssociatedId) => {
      // Prefix unused oldAssociatedId
      const tab = activeTab.value;
      const currentProjectId = projectStore.currentProjectId;
      // 仅当活动标签页属于当前项目且是工作流或组编辑器类型时更新 URL
      if (
        tab &&
        tab.projectId === currentProjectId &&
        (tab.type === "workflow" || tab.type === "groupEditor")
      ) {
        const currentParams = router.currentRoute.value.params;
        const targetWorkflowId = newAssociatedId; // The new ID from the watch

        // Check if URL update is needed
        const needsUpdate =
          currentParams.projectId !== currentProjectId || // Project ID mismatch (shouldn't happen here ideally)
          (targetWorkflowId && currentParams.workflowId !== targetWorkflowId) || // Workflow ID exists and mismatches
          (!targetWorkflowId && currentParams.workflowId); // Target has no workflow ID, but URL does

        if (needsUpdate) {
          console.debug(
            `TabStore Watcher: associatedId changed to ${newAssociatedId}. Updating URL.`
          );
          const params: Record<string, string> = { projectId: currentProjectId };
          if (targetWorkflowId) {
            params.workflowId = targetWorkflowId;
          }
          router.replace({ name: "Editor", params }).catch((err) => {
            if (err.name !== "NavigationDuplicated") {
              console.error("Router replace error in watcher:", err);
            }
          });
        } else {
          console.debug(
            `TabStore Watcher: URL already matches new associatedId ${newAssociatedId}. Skipping router.replace.`
          );
        }
      }
    },
    { immediate: false }
  ); // 不需要立即执行，仅在变化时执行

  // 移除旧的 workflowStore.isCurrentWorkflowDirty 监听器 (如果存在)
  // watch(() => workflowStore.isCurrentWorkflowDirty, ...); // 假设这个监听器不再需要或已移至 workflowStore 内部处理 isDirty 状态同步

  // --- Initialization ---
  // initializeDefaultTab() // Removed: Call will be made explicitly from App.vue after project load

  return {
    tabs,
    activeTabId,
    activeTab,
    addTab,
    removeTab,
    updateTab,
    setActiveTab,
    openGroupEditorTab, // Export the new function
    initializeDefaultTab, // Export the initialization function
    clearTabsForProject, // Export the new function
  };
});
