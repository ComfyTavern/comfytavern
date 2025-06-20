import { ref, shallowRef, markRaw, type Component } from 'vue';
import { defineStore } from 'pinia';
import i18n from '@/locales';

// 对话框类型 (DialogInstance 内部使用)
type DialogInstanceType = 'message' | 'confirm' | 'input';

// 通知类型
type ToastType = 'info' | 'success' | 'warning' | 'error';

// 通知位置
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

// 通用对话框配置接口 (对应 Dialog.vue 的 props)
interface UniversalDialogOptions {
  title?: string;
  message?: string; // 作为提示信息或slot后备
  // type prop for Dialog.vue is set internally by showMessage/showConfirm/showInput

  confirmText?: string;
  cancelText?: string;
  showCancelButton?: boolean; 
  showCloseIcon?: boolean; // 对应 Dialog.vue 的 showCloseIcon
  closeOnBackdrop?: boolean;
  autoClose?: number;
  dangerConfirm?: boolean;

  // Input-specific props for Dialog.vue
  initialValue?: string;
  inputPlaceholder?: string;
  inputType?: 'text' | 'password' | 'number' | 'textarea';
  inputRows?: number;
  width?: string;
}

// 通知配置
interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
}

// 对话框实例接口 (服务内部使用)
interface DialogInstance {
  id: string;
  type: DialogInstanceType; // 服务内部类型，用于区分 Promise 等
  component: Component; // 总是 Dialog.vue
  props: Record<string, any>; // 传递给 Dialog.vue 的 props
  resolve: (value: boolean | string | void | null) => void; // 调整以适应不同 Promise 返回值
  reject: (reason?: any) => void;
}

// ToastNotification 组件的具体 Props
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

// 通知实例接口
interface ToastInstance {
  id: string;
  props: ConcreteToastProps;
  visible: boolean;
}

export const useDialogService = defineStore('dialogService', () => {
  const t = i18n.global.t;
  const activeDialog = shallowRef<DialogInstance | null>(null);
  const dialogQueue = ref<DialogInstance[]>([]);
  const toasts = ref<ToastInstance[]>([]);
  const maxToasts = 10;

  function generateId(): string {
    return `dialog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function addDialog(dialog: DialogInstance): void {
    dialogQueue.value.push(dialog);
    processDialogQueue();
  }

  function processDialogQueue(): void {
    if (!activeDialog.value && dialogQueue.value.length > 0) {
      const nextDialog = dialogQueue.value.shift(); // 取出队列的第一个
      if (nextDialog) {
        activeDialog.value = nextDialog;
      }
    }
  }

  function closeDialog(id: string): void {
    if (activeDialog.value && activeDialog.value.id === id) {
      activeDialog.value = null;
      // dialogQueue.value.shift(); // 已经在 processDialogQueue 前移除了
      processDialogQueue(); // 尝试处理队列中的下一个
    } else {
      // 如果不是活动对话框（理论上不应发生，因为关闭总是针对活动对话框）
      // 但为保险起见，也从队列中移除
      const index = dialogQueue.value.findIndex(d => d.id === id);
      if (index !== -1) {
        dialogQueue.value.splice(index, 1);
      }
    }
  }
  
  // 显示消息对话框
  function showMessage(options: UniversalDialogOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      import('../components/common/Dialog.vue').then((module) => {
        const dialogId = generateId();
        const dialogProps = {
          ...options,
          visible: true,
          type: 'message' as const, // 传递给 Dialog.vue 的 type
          title: options.title || t('testPanel.dialogContent.messageTitle'),
          message: options.message,
          confirmText: options.confirmText || t('common.confirm'),
          showCloseIcon: options.showCloseIcon !== undefined ? options.showCloseIcon : true,
          closeOnBackdrop: options.closeOnBackdrop !== undefined ? options.closeOnBackdrop : true,
          autoClose: options.autoClose || 0,
          onConfirm: () => {
            closeDialog(dialogId);
            resolve();
          },
          onCancel: () => { 
            closeDialog(dialogId);
            resolve(); 
          },
          'onUpdate:visible': (value: boolean) => {
            if (!value) {
              if (activeDialog.value && activeDialog.value.id === dialogId) {
                closeDialog(dialogId);
                resolve();
              }
            }
          }
        };

        const dialog: DialogInstance = {
          id: dialogId,
          type: 'message', // DialogInstance 自身的 type
          component: markRaw(module.default),
          props: dialogProps,
          resolve: () => resolve(),
          reject
        };
        addDialog(dialog);
      }).catch(reject);
    });
  }
  
  // 显示确认对话框
  function showConfirm(options: UniversalDialogOptions): Promise<boolean> {
    return new Promise((resolve, reject) => {
      import('../components/common/Dialog.vue').then((module) => {
        const dialogId = generateId();
        const dialogProps = {
          ...options,
          visible: true,
          type: 'confirm' as const,
          title: options.title || t('common.confirm'),
          message: options.message,
          confirmText: options.confirmText || t('common.confirm'),
          cancelText: options.cancelText || t('common.cancel'),
          showCloseIcon: options.showCloseIcon !== undefined ? options.showCloseIcon : true,
          closeOnBackdrop: options.closeOnBackdrop !== undefined ? options.closeOnBackdrop : false,
          dangerConfirm: options.dangerConfirm || false,
          onConfirm: () => {
            closeDialog(dialogId);
            resolve(true);
          },
          onCancel: () => {
            closeDialog(dialogId);
            resolve(false);
          },
          'onUpdate:visible': (value: boolean) => {
            if (!value) {
              if (activeDialog.value && activeDialog.value.id === dialogId) {
                closeDialog(dialogId);
                resolve(false);
              }
            }
          }
        };
        const dialog: DialogInstance = {
          id: dialogId,
          type: 'confirm',
          component: markRaw(module.default),
          props: dialogProps,
          resolve: (val) => resolve(val as boolean), // 明确 resolve 类型
          reject
        };
        addDialog(dialog);
      }).catch(reject);
    });
  }

  // 显示输入对话框
  function showInput(options: UniversalDialogOptions): Promise<string | null> {
    return new Promise((resolve, reject) => {
      import('../components/common/Dialog.vue').then((module) => {
        const dialogId = generateId();
        const dialogProps = {
          ...options,
          visible: true,
          type: 'input' as const,
          title: options.title || t('testPanel.dialogContent.inputTitle'),
          message: options.message,
          confirmText: options.confirmText || t('common.confirm'),
          cancelText: options.cancelText || t('common.cancel'),
          showCloseIcon: options.showCloseIcon !== undefined ? options.showCloseIcon : true,
          closeOnBackdrop: options.closeOnBackdrop !== undefined ? options.closeOnBackdrop : false,
          dangerConfirm: options.dangerConfirm || false,
          initialValue: options.initialValue || '',
          inputPlaceholder: options.inputPlaceholder || '请输入内容...',
          inputType: options.inputType || 'text',
          inputRows: options.inputRows || 3,
          onConfirm: (inputValue?: string) => { 
            closeDialog(dialogId);
            resolve(inputValue !== undefined ? inputValue : ''); 
          },
          onCancel: () => {
            closeDialog(dialogId);
            resolve(null);
          },
          'onUpdate:visible': (value: boolean) => {
            if (!value) {
              if (activeDialog.value && activeDialog.value.id === dialogId) {
                closeDialog(dialogId);
                resolve(null);
              }
            }
          }
        };
        const dialog: DialogInstance = {
          id: dialogId,
          type: 'input',
          component: markRaw(module.default),
          props: dialogProps,
          resolve: (val) => resolve(val as string | null), // 明确 resolve 类型
          reject
        };
        addDialog(dialog);
      }).catch(reject);
    });
  }
  
  function removeToast(id: string): void {
    const index = toasts.value.findIndex(toast => toast.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  // 显示通知
  function showToast(options: ToastOptions): string {
    const id = generateId(); // ToastNotification 不在此动态导入，假设已全局或按需加载
    
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
    
    toasts.value.push(toast);
    if (toasts.value.length > maxToasts) {
      const oldestToast = toasts.value.shift();
      if (oldestToast) {
        // 触发 ToastNotification 内部的关闭动画和逻辑
        // 这通常是通过将其 visible prop 设置为 false 来完成的
        // 但由于 ToastNotification 实例不由 DialogService 直接控制其 props.visible,
        // 我们需要一种方式通知它关闭。
        // 简单的做法是直接从数组移除，依赖 DialogContainer 的 :key 或 v-for 更新。
        // 或者，如果 ToastNotification 监听其 props.onClose，我们可以在这里调用。
        // 目前的 removeToast(id) 应该能处理。
      }
    }
    return id; // 返回ID，而非message
  }
  
  function showSuccess(message: string, title?: string, duration?: number): string {
    return showToast({ title, message, type: 'success', duration });
  }
  
  function showError(message: string, title?: string, duration?: number): string {
    return showToast({ title, message, type: 'error', duration });
  }
  
  function showWarning(message: string, title?: string, duration?: number): string {
    return showToast({ title, message, type: 'warning', duration });
  }
  
  function showInfo(message: string, title?: string, duration?: number): string {
    return showToast({ title, message, type: 'info', duration });
  }
  
  return {
    activeDialog,
    // dialogQueue, // dialogQueue 是内部状态，通常不直接暴露
    toasts,
    showMessage,
    showConfirm,
    showInput,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    // closeDialog, // 内部辅助函数
    // removeToast, // 内部辅助函数
  };
});