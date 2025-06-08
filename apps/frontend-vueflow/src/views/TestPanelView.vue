<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h1 class="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100">弹窗与UI组件测试面板</h1>

    <!-- DialogService 测试 -->
    <section class="mb-12">
      <h2 class="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200 border-b pb-2">DialogService (模态对话框与通知)
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <!-- 对话框部分 -->
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">模态对话框 (Dialogs)</h3>
          <div class="space-y-4">
            <button @click="showMessageDialog" class="btn btn-blue w-full">显示消息对话框</button>
            <button @click="showConfirmDialog" class="btn btn-green w-full">显示确认对话框</button>
            <button @click="showDangerConfirmDialog" class="btn btn-red w-full">显示危险操作确认</button>
            <button @click="showAutoCloseDialog" class="btn btn-purple w-full">显示自动关闭对话框</button>
            <button @click="showInputDialog" class="btn btn-teal w-full">显示输入对话框</button>
            <button @click="showTextareaDialog" class="btn btn-cyan w-full">显示多行输入对话框</button>
          </div>
        </div>

        <!-- 通知部分 -->
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">通知 (Toasts)</h3>
          <div class="space-y-4">
            <button @click="showInfoToast" class="btn btn-blue w-full">显示信息通知</button>
            <button @click="showSuccessToast" class="btn btn-green w-full">显示成功通知</button>
            <button @click="showWarningToast" class="btn btn-yellow w-full">显示警告通知</button>
            <button @click="showErrorToast" class="btn btn-red w-full">显示错误通知</button>
            <button @click="showCustomToast" class="btn btn-purple w-full">显示自定义通知</button>
            <button @click="showMultipleToasts" class="btn btn-gray w-full">显示多个通知</button>
          </div>
        </div>
      </div>
      <div class="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">DialogService 操作结果:</h3>
        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-md min-h-[50px]">
          <pre class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ dialogServiceResult }}</pre>
        </div>
      </div>
    </section>

    <!-- UiStore Modals 测试 -->
    <section>
      <h2 class="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200 border-b pb-2">UiStore (全局模态框)</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">特定模态框</h3>
          <div class="space-y-4">
            <button @click="openSettings" class="btn btn-indigo w-full">打开设置模态框 (App.vue 管理)</button>
            <button @click="openRegexEditor" class="btn btn-pink w-full">打开正则编辑器模态框</button>
          </div>
        </div>
      </div>
      <div class="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">UiStore 操作结果:</h3>
        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-md min-h-[50px]">
          <pre class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ uiStoreResult }}</pre>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDialogService } from '@/services/DialogService';
import { useUiStore } from '@/stores/uiStore';
import type { RegexRule } from '@comfytavern/types';

const dialogService = useDialogService();
const uiStore = useUiStore();

const dialogServiceResult = ref('等待操作...');
const uiStoreResult = ref('等待操作...');

// --- DialogService 方法 ---
const showMessageDialog = async () => {
  dialogServiceResult.value = '等待消息对话框响应...';
  try {
    await dialogService.showMessage({
      title: '消息提示',
      message: '这是一个简单的消息对话框，只有一个确定按钮。',
    });
    dialogServiceResult.value = '消息对话框：用户点击了确定。';
  } catch (error) {
    dialogServiceResult.value = `消息对话框：发生错误: ${error}`;
  }
};

const showConfirmDialog = async () => {
  dialogServiceResult.value = '等待确认对话框响应...';
  try {
    const confirmed = await dialogService.showConfirm({
      title: '确认操作',
      message: '您确定要执行此操作吗？',
    });
    dialogServiceResult.value = `确认对话框：用户选择 -> ${confirmed ? '确认' : '取消'}`;
  } catch (error) {
    dialogServiceResult.value = `确认对话框：发生错误: ${error}`;
  }
};

const showDangerConfirmDialog = async () => {
  dialogServiceResult.value = '等待危险操作确认响应...';
  try {
    const confirmed = await dialogService.showConfirm({
      title: '危险操作确认',
      message: '此操作不可逆转，您确定要继续吗？',
      dangerConfirm: true,
      confirmText: '是的，删除它',
      cancelText: '不了',
    });
    dialogServiceResult.value = `危险操作确认：用户选择 -> ${confirmed ? '确认删除' : '取消'}`;
  } catch (error) {
    dialogServiceResult.value = `危险操作确认：发生错误: ${error}`;
  }
};

const showAutoCloseDialog = async () => {
  dialogServiceResult.value = '等待自动关闭对话框...';
  try {
    await dialogService.showMessage({
      title: '自动关闭示例',
      message: '此对话框将在3秒后自动关闭。',
      autoClose: 3000,
    });
    dialogServiceResult.value = '自动关闭对话框：已自动关闭。';
  } catch (error) {
    dialogServiceResult.value = `自动关闭对话框：发生错误: ${error}`;
  }
};

const showInputDialog = async () => {
  dialogServiceResult.value = '等待输入对话框响应...';
  try {
    const input = await dialogService.showInput({
      title: '请输入信息',
      message: '请输入您的昵称：',
      initialValue: 'ComfyGugu',
      inputPlaceholder: '例如：咕咕',
    });
    if (input !== null) {
      dialogServiceResult.value = `输入对话框：用户输入了 "${input}"`;
    } else {
      dialogServiceResult.value = '输入对话框：用户取消了输入。';
    }
  } catch (error) {
    dialogServiceResult.value = `输入对话框：发生错误: ${error}`;
  }
};

const showTextareaDialog = async () => {
  dialogServiceResult.value = '等待多行输入对话框响应...';
  try {
    const input = await dialogService.showInput({
      title: '请输入反馈',
      message: '请详细描述您遇到的问题或建议：',
      inputType: 'textarea',
      inputRows: 4,
      inputPlaceholder: '请在此处输入您的反馈内容...',
    });
    if (input !== null) {
      dialogServiceResult.value = `多行输入对话框：用户输入了 "${input}"`;
    } else {
      dialogServiceResult.value = '多行输入对话框：用户取消了输入。';
    }
  } catch (error) {
    dialogServiceResult.value = `多行输入对话框：发生错误: ${error}`;
  }
};

const showInfoToast = () => {
  dialogService.showInfo('这是一条信息通知！', '提示');
  dialogServiceResult.value = '触发了信息通知。';
};
const showSuccessToast = () => {
  dialogService.showSuccess('操作已成功完成！', '成功');
  dialogServiceResult.value = '触发了成功通知。';
};
const showWarningToast = () => {
  dialogService.showWarning('请注意，这是一个警告。', '警告');
  dialogServiceResult.value = '触发了警告通知。';
};
const showErrorToast = () => {
  dialogService.showError('糟糕，发生了一个错误！', '错误');
  dialogServiceResult.value = '触发了错误通知。';
};
const showCustomToast = () => {
  dialogService.showToast({
    title: '自定义样式通知',
    message: '这个通知在底部中间，持续5秒。',
    type: 'info',
    duration: 5000,
    position: 'bottom-center',
  });
  dialogServiceResult.value = '触发了自定义通知。';
};
const showMultipleToasts = () => {
  dialogService.showInfo('通知 1');
  setTimeout(() => dialogService.showSuccess('通知 2 (延迟)'), 500);
  setTimeout(() => dialogService.showWarning('通知 3 (延迟)'), 1000);
  dialogServiceResult.value = '触发了多个通知。';
};

// --- UiStore 方法 ---
const openSettings = () => {
  uiStoreResult.value = '尝试打开设置模态框...';
  uiStore.openSettingsModal({ width: 'max-w-2xl', height: '80vh' });
  // 实际的关闭和结果由 App.vue 中的 BaseModal 处理，这里只记录触发
  // 可以在 BaseModal 的 @close 事件中更新 uiStoreResult，但这需要更复杂的事件传递
  // 为简单起见，这里只记录打开操作
  // 如果需要知道何时关闭，可以 watch uiStore.isSettingsModalVisible
};

const openRegexEditor = () => {
  uiStoreResult.value = '尝试打开正则编辑器模态框...';
  const mockRules: RegexRule[] = [
    { name: 'rule1', pattern: '^start', replacement: 'begin', enabled: true, description: '替换开头' },
    { name: 'rule2', pattern: 'end$', replacement: 'finish', enabled: false, description: '替换结尾' },
  ];
  uiStore.openRegexEditorModal({
    rules: mockRules,
    nodeId: 'testNode123',
    inputKey: 'testInputKey',
    onSave: (updatedRules) => {
      console.log('正则编辑器保存:', updatedRules);
      uiStoreResult.value = `正则编辑器已保存，规则数: ${updatedRules.length}。查看控制台获取详情。`;
      uiStore.closeRegexEditorModal(); // 通常在 onSave 后关闭
    },
  });
};

</script>

<style scoped>
.btn {
  @apply px-4 py-2 rounded-md font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors shadow hover:shadow-md;
}

.btn-blue {
  @apply bg-blue-600 hover:bg-blue-700 focus:ring-blue-500;
}

.btn-green {
  @apply bg-green-600 hover:bg-green-700 focus:ring-green-500;
}

.btn-red {
  @apply bg-red-600 hover:bg-red-700 focus:ring-red-500;
}

.btn-purple {
  @apply bg-purple-600 hover:bg-purple-700 focus:ring-purple-500;
}

.btn-teal {
  @apply bg-teal-600 hover:bg-teal-700 focus:ring-teal-500;
}

.btn-cyan {
  @apply bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500;
}

.btn-yellow {
  @apply bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-gray-800;
  /* 黄色按钮通常用深色文字 */
}

.btn-gray {
  @apply bg-gray-500 hover:bg-gray-600 focus:ring-gray-400;
}

.btn-indigo {
  @apply bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500;
}

.btn-pink {
  @apply bg-pink-600 hover:bg-pink-700 focus:ring-pink-500;
}
</style>