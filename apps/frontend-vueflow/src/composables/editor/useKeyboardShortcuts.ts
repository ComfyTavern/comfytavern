import { onMounted, onUnmounted, type Ref } from "vue";
import { useWorkflowStore } from "@/stores/workflowStore";

/**
 * 用于处理键盘快捷键的组合式函数，特别是用于保存的 Ctrl+S/Cmd+S。
 * @param activeTabId - 计算属性 ref，表示活动选项卡的 ID。
 * @param containerRef - 指向编辑器容器元素的 Ref。
 */
export function useKeyboardShortcuts(activeTabId: Ref<string | null>, containerRef: Ref<HTMLElement | null>) {
  const workflowStore = useWorkflowStore();

  const handleKeyDown = async (event: KeyboardEvent) => {
    const activeElement = document.activeElement;

    // 检查焦点是否在编辑器或其子元素中
    const isEditorFocused = () => {
      if (!containerRef.value || !activeElement) {
        return false;
      }
      if (activeElement === document.body) {
        // 如果焦点在 body 上，也认为是在编辑器上下文中，允许保存
        return true;
      }
      return containerRef.value.contains(activeElement);
    };

    if (!isEditorFocused()) {
      return;
    }

    if (!activeTabId.value) return; // 需要一个活动的选项卡

    // Ctrl+S / Cmd+S 用于保存
    if (event.key === "s" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      // console.debug(`检测到选项卡 ${activeTabId.value} 的保存快捷键。`);

      const currentTabId = activeTabId.value; // 捕获当前 ID
      const isDirty = workflowStore.isWorkflowDirty(currentTabId);
      const workflowData = workflowStore.getWorkflowData(currentTabId);

      if (isDirty) {
        // 判断是否为新工作流：ID 不存在或是临时的 ('temp-')
        const isNewWorkflow = !workflowData?.id || workflowData.id.startsWith("temp-");
        // console.debug(
        //   `handleKeyDown: isDirty=${isDirty}, workflowData.id=${workflowData?.id}, isNewWorkflow=${isNewWorkflow}`
        // );
        if (isNewWorkflow) {
          // 调用 store action 来处理提示和保存
          // console.debug(`正在为选项卡 ${currentTabId} 触发 promptAndSaveWorkflow (isSaveAs=false)...`);
          const success = await workflowStore.promptAndSaveWorkflow(false);
          if (success) {
            // console.info("通过快捷键成功保存新工作流 (via promptAndSaveWorkflow)。");
          } else {
            // promptAndSaveWorkflow 内部会处理错误日志和 alert
            // console.debug("通过快捷键保存新工作流失败或被取消 (via promptAndSaveWorkflow)。");
          }
        } else {
          // console.debug(`正在为选项卡 ${currentTabId} 保存现有工作流...`);
          // 保存现有工作流时不传递参数
          const success = await workflowStore.saveWorkflow();
          if (success) {
            // console.info("通过快捷键成功保存现有工作流。");
          } else {
            console.error("Failed to save existing workflow via shortcut.");
            // 可选：添加用户反馈
          }
        }
      } else {
        // console.debug(`选项卡 ${currentTabId} 中的工作流未修改，无需保存。`);
      }
    }
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  // 如果只设置监听器，则无需返回任何内容
}
