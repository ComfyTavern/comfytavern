// apps/frontend-vueflow/src/stores/workflow/actions/lifecycleActions.ts
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
  const { tabStore, dialogService, workflowManager, workflowLifecycleCoordinator } = context;

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
  };
}