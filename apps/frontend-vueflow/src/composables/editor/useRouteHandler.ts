import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/projectStore';
import { useTabStore } from '@/stores/tabStore';

/**
 * 用于处理路由参数变化（projectId, workflowId）
 * 并激活相应工作流选项卡的 Composable。
 */
export function useRouteHandler() {
  const route = useRoute();
  const router = useRouter();
  const projectStore = useProjectStore();
  const tabStore = useTabStore();

  /**
   * 处理来自路由参数的 workflowId。
   * 查找匹配的选项卡或回退到默认逻辑。
   * @param projectId 当前项目 ID。
   * @param workflowId 来自路由的工作流 ID，或为 null。
   */
  const handleWorkflowIdFromRoute = (projectId: string | null, workflowId: string | null) => {
    if (!projectId) {
      console.warn("useRouteHandler: Cannot handle route workflowId without projectId.");
      return;
    }
    // console.debug(
    //   `useRouteHandler: Handling route params - projectId: ${projectId}, workflowId: ${workflowId}`
    // );

    // 确保选项卡列表可用（由 App.vue 的 projectStore 监视器驱动）

    if (workflowId) {
      // 尝试查找匹配的选项卡
      const targetTab = tabStore.tabs.find(
        (tab) =>
          tab.projectId === projectId &&
          tab.associatedId === workflowId &&
          (tab.type === "workflow" || tab.type === "groupEditor")
      );

      if (targetTab) {
        if (tabStore.activeTabId !== targetTab.internalId) {
          // console.debug(
          //   `useRouteHandler: Found matching tab (${targetTab.internalId}) for workflowId ${workflowId}. Activating.`
          // );
          tabStore.setActiveTab(targetTab.internalId);
        } else {
          // console.debug(
          //   `useRouteHandler: Matching tab (${targetTab.internalId}) for workflowId ${workflowId} is already active.`
          // );
        }
      } else {
        console.warn(
          `useRouteHandler: No matching tab found for projectId ${projectId} and workflowId ${workflowId}. Falling back to default tab logic.`
        );
        // 依赖 App.vue 的 initializeDefaultTab 逻辑
        // 可选：如果当前活动选项卡不匹配，则强制切换到默认选项卡
        if (
          tabStore.activeTab?.associatedId !== null &&
          tabStore.activeTab?.projectId === projectId
        ) {
          // console.debug(
          //   "useRouteHandler: URL workflowId missing/invalid, but active tab has one. Resetting URL."
          // );
          router
            .replace({
              name: "Editor", // 确保此路由名称正确
              params: { projectId, workflowId: tabStore.activeTab.associatedId! },
            })
            .catch((err) => {
              if (err.name !== "NavigationDuplicated") console.error("Router replace error:", err);
            });
        } else {
          // console.debug(
          //   "useRouteHandler: No matching tab and active tab has no associatedId. Relying on default tab initialization."
          // );
          // 确保调用 initializeDefaultTab（由 App.vue 处理）
        }
      }
    } else {
      // URL 中没有 workflowId（回退情况）
      // console.debug(
      //   `useRouteHandler: No workflowId in route for project ${projectId}. Ensuring default tab is active.`
      // );
      const activeTab = tabStore.activeTab;
      if (activeTab && activeTab.projectId === projectId && activeTab.associatedId) {
        // console.debug(
        //   `useRouteHandler: URL lacks workflowId, but active tab ${activeTab.internalId} has one (${activeTab.associatedId}). Finding a suitable tab to activate.`
        // );
        const firstTabWithoutId = tabStore.tabs.find(
          (t) => t.projectId === projectId && !t.associatedId
        );
        const firstTabOverall = tabStore.tabs.find((t) => t.projectId === projectId);
        const targetTabToActivate = firstTabWithoutId || firstTabOverall;
        if (targetTabToActivate && targetTabToActivate.internalId !== activeTab.internalId) {
          // console.debug(`useRouteHandler: Activating tab ${targetTabToActivate.internalId} as fallback.`);
          tabStore.setActiveTab(targetTabToActivate.internalId); // This also updates URL
        } else if (targetTabToActivate) {
          // console.debug(
          //   `useRouteHandler: Fallback tab ${targetTabToActivate.internalId} is already active.`
          // );
          // 确保 URL 已清除
          router.replace({ name: "Editor", params: { projectId } }).catch((err) => {
            if (err.name !== "NavigationDuplicated") console.error("Router replace error:", err);
          });
        } else {
          // console.debug(
          //   "useRouteHandler: No suitable fallback tab found, relying on initializeDefaultTab."
          // );
          // 依赖 App.vue 的 initializeDefaultTab
        }
      } else {
        // console.debug(
        //   "useRouteHandler: Active tab matches URL (no workflowId) or no active tab. Relying on default tab initialization."
        // );
        // 依赖 App.vue 的 initializeDefaultTab
      }
    }
  };

  // 监视路由中 projectId 的变化
  watch(
    () => route.params.projectId,
    (newProjectId, oldProjectId) => {
      if (newProjectId && newProjectId !== oldProjectId) {
        // console.debug(`useRouteHandler: Detected project ID change in route params: ${newProjectId}`);
        // 主要逻辑由 App.vue 和 stores 驱动，但如果需要，在此处处理初始 workflowId
        // 当项目更改时重新评估 workflowId
        handleWorkflowIdFromRoute(newProjectId as string, route.params.workflowId as string | null);
      }
    }
    // 此处不需要 immediate: true，由初始调用处理
  );

  // 监视路由中 workflowId 的变化
  watch(
    () => route.params.workflowId,
    (newWorkflowId) => {
      // console.debug(`useRouteHandler: Detected workflowId change in route params: ${newWorkflowId}`);
      // 确保仅在设置了 projectId 时进行处理
      if (projectStore.currentProjectId) {
        handleWorkflowIdFromRoute(projectStore.currentProjectId, newWorkflowId as string | null);
      } else {
        console.warn(
          "useRouteHandler: workflowId changed, but projectId is not set yet. Waiting for projectId change."
        );
        // 等待 projectId 监视器触发 handleWorkflowIdFromRoute
      }
    }
    // 此处不需要 immediate: true，由初始调用处理
  );

  // Composable 初始化时调用一次的函数（例如，在 onMounted 中）
  const initializeRouteHandling = () => {
    // console.debug("useRouteHandler: Initializing route handling.");
    handleWorkflowIdFromRoute(
      projectStore.currentProjectId,
      route.params.workflowId as string | null
    );
  };

  // 如果只是设置监视器和调用函数，则无需返回任何内容
  // 但是，返回 initializeRouteHandling 允许组件控制何时进行初始检查
  return {
    initializeRouteHandling,
  };
}