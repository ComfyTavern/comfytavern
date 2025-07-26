// apps/frontend-vueflow/src/stores/workflow/actions/lifecycleActions.ts
import type { GroupSlotInfo, HistoryEntry } from '@comfytavern/types';
import type { WorkflowStoreContext } from '../types';

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export function createLifecycleActions(context: WorkflowStoreContext) {
  const { tabStore, dialogService, workflowManager, workflowLifecycleCoordinator, recordHistory, workflowInterfaceManagement, currentSnapshot } = context;

  /**
   * 更新工作流的接口定义并记录历史。
   * 这是对 useWorkflowInterfaceManagement 中 updateWorkflowInterface 的封装，增加了历史记录功能。
   * @param internalId 标签页的内部 ID。
   * @param updateFn 一个函数，接收当前的输入和输出，并返回更新后的对象。
   * @param entry 描述此操作的历史记录条目。
   */
  async function updateWorkflowInterfaceAndRecord(
    internalId: string,
    updateFn: (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ) => {
      inputs: Record<string, GroupSlotInfo>;
      outputs: Record<string, GroupSlotInfo>;
    },
    entry: HistoryEntry
  ) {
    const snapshotBefore = currentSnapshot.value;
    if (!snapshotBefore) {
      console.error(`[lifecycleActions] 无法为 ${internalId} 获取更新前的快照。`);
      return;
    }
    
    // 我们在此记录旧状态
    recordHistory(internalId, entry, snapshotBefore);

    // 调用底层的、不记录历史的接口更新方法
    await workflowInterfaceManagement.updateWorkflowInterface(internalId, updateFn);
  }

  async function promptAndSaveWorkflow(isSaveAs: boolean = false): Promise<boolean> {
    const activeId = tabStore.activeTabId;
    if (!activeId) {
      console.error("[LifecycleActions] 无法提示保存：没有活动的标签页。");
      dialogService.showError("无法保存：请先打开一个标签页。");
      return false;
    }

    const currentData = workflowManager.getWorkflowData(activeId);
    const currentName = currentData?.name;
    let defaultName: string;

    if (isSaveAs) {
      defaultName = `${currentName || "工作流"} 副本`;
    } else {
      const timestamp = formatDateTime(new Date());
      defaultName = `新工作流 ${timestamp}`;
    }

    const title = isSaveAs ? "另存为工作流" : "保存工作流";
    const message = isSaveAs ? "请输入新的工作流名称:" : "请输入工作流名称:";

    const newName = await dialogService.showInput({
      title: title,
      message: message,
      initialValue: defaultName,
      inputPlaceholder: "工作流名称",
      confirmText: "确定",
      cancelText: "取消",
    });

    if (newName !== null && newName.trim()) { // dialogService.showInput 在取消时返回 null
      const finalName = newName.trim();
      try {
        const success = await workflowLifecycleCoordinator.saveWorkflow(finalName);
        if (!success) {
          console.warn(`[LifecycleActions] 保存工作流 "${finalName}" 失败 (saveWorkflow 返回 false)。`);
        } else {
          console.info(`[LifecycleActions] 保存工作流 "${finalName}" 成功。`);
        }
        return success;
      } catch (error) {
        console.error(`[LifecycleActions] 调用 saveWorkflow 时捕获到错误:`, error);
        return false;
      }
    } else {
      console.log(`[LifecycleActions] 用户取消保存或名称为空 (prompt 返回: ${newName})。`);
      return false;
    }
  }

  // 未来其他的 lifecycle actions 也可以加在这里, 比如 fetch, delete...

  return {
    promptAndSaveWorkflow,
    updateWorkflowInterfaceAndRecord,
  };
}