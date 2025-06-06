import { ref, shallowRef, markRaw, type Component } from 'vue';
import { defineStore } from 'pinia';

// 对话框类型
type DialogType = 'message' | 'confirm';

// 通知类型
type ToastType = 'info' | 'success' | 'warning' | 'error';

// 通知位置
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

// 对话框配置
interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  dangerConfirm?: boolean;
  autoClose?: number;
}

// 通知配置
interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
}

// 对话框实例
interface DialogInstance {
  id: string;
  type: DialogType;
  component: Component;
  props: Record<string, any>;
  resolve: (value: boolean | any) => void;
  reject: (reason?: any) => void;
}

// 通知实例

// 这些是 ToastNotification 组件实际接收的 props，
// 由 DialogService 在创建时确保提供（包括可选props的默认值）。
interface ConcreteToastProps {
  visible: boolean;
  title: string;
  message: string;
  type: ToastType;
  duration: number;
  position: ToastPosition;
  onClose: () => void;
  'onUpdate:visible': (value: boolean) => void;
}

interface ToastInstance {
  id: string;
  props: ConcreteToastProps; // 使用更具体的类型
  visible: boolean; // 这个 'visible' 是 ToastInstance 级别的，用于管理其在队列中的状态或动画触发
}

// 创建DialogService
export const useDialogService = defineStore('dialogService', () => {
  // 当前活动的对话框
  const activeDialog = shallowRef<DialogInstance | null>(null);
  
  // 对话框队列
  const dialogQueue = ref<DialogInstance[]>([]);
  
  // 通知列表
  const toasts = ref<ToastInstance[]>([]);
  
  // 最大通知数量
  const maxToasts = 5;
  
  // 显示消息对话框
  function showMessage(options: DialogOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      // 动态导入组件
      import('../components/common/MessageDialog.vue').then((module) => {
        const dialog: DialogInstance = {
          id: generateId(),
          type: 'message',
          component: markRaw(module.default),
          props: {
            visible: true,
            title: options.title || '消息',
            message: options.message,
            confirmText: options.confirmText || '确定',
            showCloseButton: options.showCloseButton !== undefined ? options.showCloseButton : true,
            closeOnBackdrop: options.closeOnBackdrop !== undefined ? options.closeOnBackdrop : true,
            autoClose: options.autoClose || 0,
            onConfirm: () => {
              closeDialog(dialog.id);
              resolve();
            },
            onClose: () => {
              closeDialog(dialog.id);
              resolve();
            },
            'onUpdate:visible': (value: boolean) => {
              if (!value) {
                closeDialog(dialog.id);
                resolve();
              }
            }
          },
          resolve,
          reject
        };
        
        addDialog(dialog);
      }).catch(reject);
    });
  }
  
  // 显示确认对话框
  function showConfirm(options: DialogOptions): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 动态导入组件
      import('../components/common/ConfirmDialog.vue').then((module) => {
        const dialog: DialogInstance = {
          id: generateId(),
          type: 'confirm',
          component: markRaw(module.default),
          props: {
            visible: true,
            title: options.title || '确认',
            message: options.message,
            confirmText: options.confirmText || '确定',
            cancelText: options.cancelText || '取消',
            showCloseButton: options.showCloseButton !== undefined ? options.showCloseButton : true,
            closeOnBackdrop: options.closeOnBackdrop !== undefined ? options.closeOnBackdrop : false,
            dangerConfirm: options.dangerConfirm || false,
            onConfirm: () => {
              closeDialog(dialog.id);
              resolve(true);
            },
            onCancel: () => {
              closeDialog(dialog.id);
              resolve(false);
            },
            onClose: () => {
              closeDialog(dialog.id);
              resolve(false);
            },
            'onUpdate:visible': (value: boolean) => {
              if (!value) {
                closeDialog(dialog.id);
                resolve(false);
              }
            }
          },
          resolve,
          reject
        };
        
        addDialog(dialog);
      }).catch(reject);
    });
  }
  
  // 显示通知
  function showToast(options: ToastOptions): string {
    // 动态导入组件
    import('../components/common/ToastNotification.vue').then((_module) => {
      const id = generateId();
      
      const toast: ToastInstance = {
        id,
        props: {
          visible: true,
          title: options.title || '',
          message: options.message,
          type: options.type || 'info',
          duration: options.duration !== undefined ? options.duration : 3000,
          position: options.position || 'top-right',
          onClose: () => {
            removeToast(id);
          },
          'onUpdate:visible': (value: boolean) => {
            if (!value) {
              removeToast(id);
            }
          }
        },
        visible: true
      };
      
      // 添加到通知列表
      toasts.value.push(toast);
      
      // 如果超过最大数量，移除最早的通知
      if (toasts.value.length > maxToasts) {
        const oldestToast = toasts.value.shift();
        if (oldestToast) {
          oldestToast.visible = false;
        }
      }
    });
    
    return options.message; // 返回消息作为ID（简化处理）
  }
  
  // 快捷方法：显示成功通知
  function showSuccess(message: string, title?: string, duration?: number): string {
    return showToast({
      title,
      message,
      type: 'success',
      duration
    });
  }
  
  // 快捷方法：显示错误通知
  function showError(message: string, title?: string, duration?: number): string {
    return showToast({
      title,
      message,
      type: 'error',
      duration
    });
  }
  
  // 快捷方法：显示警告通知
  function showWarning(message: string, title?: string, duration?: number): string {
    return showToast({
      title,
      message,
      type: 'warning',
      duration
    });
  }
  
  // 快捷方法：显示信息通知
  function showInfo(message: string, title?: string, duration?: number): string {
    return showToast({
      title,
      message,
      type: 'info',
      duration
    });
  }
  
  // 添加对话框到队列并显示（如果没有活动对话框）
  function addDialog(dialog: DialogInstance): void {
    dialogQueue.value.push(dialog);
    processDialogQueue();
  }
  
  // 处理对话框队列
  function processDialogQueue(): void {
    if (!activeDialog.value && dialogQueue.value.length > 0) {
      const nextDialog = dialogQueue.value[0];
      if (nextDialog) { // 进一步确保类型安全，尽管逻辑上在 length > 0 时它不应为 undefined
        activeDialog.value = nextDialog;
      }
    }
  }
  
  // 关闭对话框
  function closeDialog(id: string): void {
    if (activeDialog.value && activeDialog.value.id === id) {
      activeDialog.value = null;
      dialogQueue.value.shift();
      processDialogQueue();
    } else {
      // 如果不是活动对话框，从队列中移除
      const index = dialogQueue.value.findIndex(dialog => dialog.id === id);
      if (index !== -1) {
        dialogQueue.value.splice(index, 1);
      }
    }
  }
  
  // 移除通知
  function removeToast(id: string): void {
    const index = toasts.value.findIndex(toast => toast.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }
  
  // 生成唯一ID
  function generateId(): string {
    return `dialog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  return {
    activeDialog,
    dialogQueue,
    toasts,
    showMessage,
    showConfirm,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    closeDialog,
    removeToast
  };
});