import { watch, type Ref } from 'vue';
import { useTabStore } from '@/stores/tabStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { FrontendNodeDefinition } from '@/stores/nodeStore'; // 需要 FrontendNodeDefinition 类型用于 selectedNodeForPreview

/**
 * 用于管理活动标签页更改相关副作用的 Composable。
 * @param activeTabId - 活动标签页 ID 的计算属性引用。
 * @param currentInstance - 持有当前 VueFlow 实例的引用。
 * @param selectedNodeForPreview - 用于预览的选定节点的引用。
 */
export function useTabManagement(
    activeTabId: Ref<string | null>,
    currentInstance: Ref<any | null>, // 暂时保留 any 类型
    selectedNodeForPreview: Ref<FrontendNodeDefinition | null>
) {
  const tabStore = useTabStore();
  const workflowStore = useWorkflowStore();

  // 监听活动标签页的变化
  watch(
    activeTabId,
    async (newTabId, oldTabId) => {
      // console.info(`useTabManagement: 活动标签页从 ${oldTabId} 更改为 ${newTabId}`);
      selectedNodeForPreview.value = null; // 标签页切换时清除预览

      if (newTabId) {
        // 确保新标签页的状态存在
        await workflowStore.ensureTabState(newTabId);
        const tabInfo = tabStore.tabs.find((t) => t.internalId === newTabId);

        // 如果实例已准备好，则将实例与新标签页关联
        if (currentInstance.value) {
          // console.debug(`useTabManagement: 将现有实例与新标签页 ${newTabId} 关联`);
          await workflowStore.setVueFlowInstance(newTabId, currentInstance.value);
        } else {
          // console.debug(`useTabManagement: 标签页 ${newTabId} 的画布实例尚未准备好`);
        }

        // 如果是真实的工作流且尚未加载，则加载工作流数据
        if (
          tabInfo &&
          (tabInfo.type === "workflow" || tabInfo.type === "groupEditor") &&
          tabInfo.associatedId &&
          !tabInfo.associatedId.startsWith("temp-") &&
          !workflowStore.isTabLoaded(newTabId)
        ) {
          // console.info(
          //   `useTabManagement: 触发标签页 ${newTabId} 的工作流加载，真实工作流 ID: ${tabInfo.associatedId}`
          // );
          // 异步加载
          workflowStore.loadWorkflow(newTabId, tabInfo.associatedId).catch((error: any) => {
            console.error(
              `useTabManagement: 加载标签页 ${newTabId} 的工作流 ${tabInfo.associatedId} 失败:`,
              error
            );
            // TODO: 添加用户反馈
          });
        } else if (tabInfo?.associatedId?.startsWith("temp-")) {
          // console.debug(
          //   `useTabManagement: 跳过加载具有临时 ID ${tabInfo.associatedId} 的标签页 ${newTabId} 的工作流。内容应为默认值。`
          // );
        }

        // 切换到标签页后强制更新界面
        setTimeout(() => {
          const event = new CustomEvent("force-save-interface-changes", {
            detail: { tabId: newTabId },
          });
          document.dispatchEvent(event);
          // console.debug(
          //   `[useTabManagement Watcher] 标签页切换后为标签页 ${newTabId} 分派了 force-save-interface-changes。`
          // );
        }, 0);
      }

      // 将实例与旧标签页解除关联
      if (oldTabId) {
        // console.debug(`useTabManagement: 将实例与旧标签页 ${oldTabId} 解除关联`);
        await workflowStore.setVueFlowInstance(oldTabId, null);
      }
    },
    { immediate: true } // 立即运行以处理初始标签页状态
  );

  // 如果只设置了监听器，则无需返回特定函数
}