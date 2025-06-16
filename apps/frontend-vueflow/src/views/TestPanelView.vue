<template>
  <div class="p-6 max-w-5xl mx-auto">
    <InitialUsernameSetupModal
      :visible="isInitialUsernameSetupModalVisible"
      @close="isInitialUsernameSetupModalVisible = false; uiStoreResult = '初始用户名设置模态框已关闭 (事件)。'"
      @saved="isInitialUsernameSetupModalVisible = false; uiStoreResult = '初始用户名已保存 (事件)。'"
    />
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
            <button @click="showLargeTextMessageDialog" class="btn btn-orange w-full">显示超大文本消息对话框</button>
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
            <button @click="showLargeTextToast" class="btn btn-lime w-full">显示超大文本通知</button>
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
            <button @click="openInitialUsernameSetup" class="btn btn-sky w-full">打开初始用户名设置</button>
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

    <!-- SettingsControl 测试 (使用 SettingsPanel) -->
    <section class="mt-12">
      <h2 class="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200 border-b pb-2">SettingControl (通过 SettingsPanel) 测试</h2>
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <SettingsPanel :config="testSettingItems" />
      </div>
      <!-- 用于验证 settingsStore 中的值是否正确更新 -->
      <div class="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">SettingsStore 当前值 (验证用):</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="config in testSettingItems" :key="`debug-${config.key}`" class="bg-gray-100 dark:bg-gray-700 p-3 rounded">
            <p class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ config.label }} ({{ config.key }})</p>
            <pre class="mt-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{{ settingsStore.getSetting(config.key, config.defaultValue) }}</pre>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDialogService } from '@/services/DialogService';
import { useUiStore } from '@/stores/uiStore';
// import { useAuthStore } from '@/stores/authStore'; // authStore 暂时不需要直接在此处调用特定方法来显示模态框
import InitialUsernameSetupModal from '@/components/auth/InitialUsernameSetupModal.vue'; // + 导入模态框组件
import type { RegexRule } from '@comfytavern/types';
// import SettingControl from '@/components/settings/SettingControl.vue'; // 不再直接使用
import SettingsPanel from '@/components/settings/SettingsPanel.vue'; // + 导入 SettingsPanel
import type { SettingItemConfig } from '@/types/settings';
import { useSettingsStore } from '@/stores/settingsStore';

const dialogService = useDialogService();
const uiStore = useUiStore();
// const authStore = useAuthStore(); // 暂时注释掉，如果模态框内部需要，它自己会导入
const settingsStore = useSettingsStore();

const dialogServiceResult = ref('等待操作...');
const uiStoreResult = ref('等待操作...');
const isInitialUsernameSetupModalVisible = ref(false); // + 控制模态框显示的状态

const testSettingItems = ref<SettingItemConfig[]>([
  {
    key: 'testPanel.stringInput',
    type: 'string',
    label: '字符串输入 (String)',
    description: '用于测试单行文本输入。',
    defaultValue: '你好，咕咕！',
    category: 'testControls',
  },
  {
    key: 'testPanel.textareaInput',
    type: 'textarea',
    label: '文本域输入 (Textarea)',
    description: '用于测试多行文本输入。',
    defaultValue: '这是一个\n多行文本示例。\n咕咕咕~',
    category: 'testControls',
  },
  {
    key: 'testPanel.numberInput',
    type: 'number',
    label: '数字输入 (Number)',
    description: '用于测试数字输入，带范围和步长。',
    defaultValue: 42,
    min: 0,
    max: 100,
    step: 1,
    category: 'testControls',
  },
  {
    key: 'testPanel.booleanToggle',
    type: 'boolean',
    label: '布尔切换 (Boolean)',
    description: '用于测试开关状态。',
    defaultValue: true,
    category: 'testControls',
  },
  {
    key: 'testPanel.selectInput',
    type: 'select',
    label: '选择框 (Select)',
    description: '用于测试下拉选择。',
    defaultValue: 'option2',
    options: [
      { label: '选项 A (option1)', value: 'option1' },
      { label: '选项 B (option2)', value: 'option2' },
      { label: '选项 C (option3)', value: 'option3' },
      { label: '选项 D (原计划禁用)', value: 'option4' },
    ],
    category: 'testControls',
  },
]);

const veryLongText = `收到了，姐姐。这是一个用于测试 UI 组件的面板，结构很清晰。咕~\n\n整体来看，这个测试面板的设计目标明确，将 \`DialogService\` 的瞬时交互（如确认框、通知）和 \`UiStore\` 控制的全局状态模态框（如设置、编辑器）分离开来，这是很好的实践。前者是命令式的，后者是声明式的，各司其职。\n\n代码写得很规整，不过从逻辑和代码复用的角度，有几个可以琢磨的地方：\n\n### 1. \`DialogService\` 的 \`async/await\` 与错误处理\n\n*   **重复的 \`try...catch\` 结构**：在 \`showMessageDialog\`、\`showConfirmDialog\` 等异步函数中，你都使用了相似的 \`try...catch\` 结构来更新 \`dialogServiceResult\`。这种重复的模式是“样板代码”（Boilerplate Code），可以被抽象出来。\n\n    可以考虑创建一个辅助函数来包装 \`dialogService\` 的调用，从而简化代码。\n\n    例如，可以这样封装：\n    \`\`\`typescript\n    async function handleDialog<T>(\n      action: () => Promise<T>,\n      resultUpdater: (result: string) => void,\n      successMessageFactory: (result: T) => string,\n      initialMessage: string = \'等待响应...\'\n    ) {\n      resultUpdater(initialMessage);\n      try {\n        const result = await action();\n        resultUpdater(successMessageFactory(result));\n      } catch (error) {\n        // 如果用户取消操作（通常是 reject），也在这里捕获\n        if (error === \'cancelled\') { // 假设 DialogService 在取消时 reject(\'cancelled\')\n             resultUpdater(\'操作已取消。\');\n        } else {\n             resultUpdater(\`操作失败: \${error}\`);\n        }\n      }\n    }\n\n    // 使用示例\n    const showConfirmDialog = async () => {\n      await handleDialog(\n        () => dialogService.showConfirm({ title: \'确认操作\', message: \'您确定吗？\' }),\n        (res) => dialogServiceResult.value = res,\n        (confirmed) => \`确认对话框：用户选择 -> \${confirmed} ? \'确认\' : \'取消\'}\`,\n        \'等待确认对话框响应...\'\n      );\n    };\n    \`\`\`\n    这样一来，每个按钮的点击事件处理器都会变得非常简洁。\n\n*   **取消操作的语义**：目前来看，当用户点击“取消”或关闭对话框时，Promise 很可能会被 \`reject\`，然后进入 \`catch\` 块。从语义上讲，用户主动取消并非一个程序“错误”（Error）。更清晰的设计是让 \`showConfirm\` 或 \`showInput\` 在用户取消时 \`resolve(null)\` 或 \`resolve(false)\`。这样 \`catch\` 就可以专门用来处理网络中断、组件加载失败等真正的异常情况。当然，这取决于 \`DialogService\` 的内部实现。\n\n### 2. \`UiStore\` 的状态反馈\n\n*   你在注释里提到了 \`// 为简单起见，这里只记录打开操作\`，这很诚实。要实现完整的反馈闭环（即模态框关闭后更新 \`uiStoreResult\`），确实需要监听 \`uiStore\` 的状态。\n\n    使用 Vue 的 \`watch\` 是一个很直接的方案：\n    \`\`\`typescript\n    import { watch } from \'vue\';\n\n    watch(\n      () => uiStore.isSettingsModalVisible,\n      (isVisible, wasVisible) => {\n        if (wasVisible && !isVisible) {\n          uiStoreResult.value = \'设置模态框已关闭。\';\n        }\n      }\n    );\n    \`\`\`\n    这样，组件就能响应 store 的变化，而不是依赖于模态框自身的回调，逻辑会更符合 Pinia 的数据驱动思想。\n\n### 3. 一些小细节\n\n*   **超长文本占位符**：\`veryLongText\` 的内容是 “这里是超长文本占位符，请替换成你准备的小作文。”。既然是测试，不如直接放一段真正的长文本，比如“道可道，非常道；名可名，非常名”之类的，或者直接用经典的 “Lorem Ipsum”。这样测试时能更直观地看到长文本在对话框和通知中的实际渲染效果，比如滚动条是否出现、文本是否正确换行等。\n*   **CSS 样式**：使用 \`@apply\` 将 Tailwind 的原子类组合成 \`.btn-*\` 这样的组件类，是保持模板（template）整洁和语义化的好方法。这对于维护和主题化都很有利，没什么问题。\n\n总的来说，这个测试组件已经非常完备和实用了。上面的一些想法主要是从代码复用和设计模式的角度出发，供姐姐参考。\n\n咕~ 如果需要我帮忙实现那个简化 \`try...catch\` 的辅助函数，或者有其他问题，随时可以叫我。`; // 示例长文本

// 辅助函数，用于封装 DialogService 的异步操作和状态更新逻辑
async function executeDialogAction<T>(
  actionName: string,
  action: () => Promise<T>,
  onSuccess: (result: T) => string,
  onCancel: string = `${actionName}：用户取消了操作或关闭了对话框。`,
) {
  dialogServiceResult.value = `等待 ${actionName} 响应...`;
  try {
    const result = await action();
    // 针对 showConfirm 返回 false 或 showInput 返回 null 的情况，视为取消
    if (result === false || result === null) {
      dialogServiceResult.value = onCancel;
    } else {
      dialogServiceResult.value = onSuccess(result);
    }
  } catch (error) {
    // 假设 DialogService 在用户取消时可能 reject('cancelled') 或 reject(null)
    // 或者某些情况下，错误对象本身可能就是 null 或 'cancelled'
    if (error === 'cancelled' || error === null || String(error).toLowerCase().includes('cancel')) {
      dialogServiceResult.value = onCancel;
    } else {
      dialogServiceResult.value = `${actionName}：发生异常: ${error}`;
    }
  }
}

// --- DialogService 方法 ---
const showMessageDialog = async () => {
  await executeDialogAction(
    '消息对话框',
    () => dialogService.showMessage({
      title: '消息提示',
      message: '这是一个简单的消息对话框，只有一个确定按钮。',
    }),
    () => '消息对话框：用户点击了确定。',
    '消息对话框：用户关闭了对话框或发生异常。', // showMessage 通常不区分取消
  );
};

const showConfirmDialog = async () => {
  await executeDialogAction(
    '确认对话框',
    () => dialogService.showConfirm({
      title: '确认操作',
      message: '您确定要执行此操作吗？',
    }),
    (confirmed) => `确认对话框：用户选择 -> ${confirmed ? '确认' : '取消'}`, // DialogService.showConfirm resolves with true/false
    '确认对话框：用户取消了操作。', // 这个分支理论上不会被 DialogService.showConfirm 触发，因为它总是 resolve
  );
};

const showDangerConfirmDialog = async () => {
  await executeDialogAction(
    '危险操作确认',
    () => dialogService.showConfirm({
      title: '危险操作确认',
      message: '此操作不可逆转，您确定要继续吗？',
      dangerConfirm: true,
      confirmText: '是的，删除它',
      cancelText: '不了',
    }),
    (confirmed) => `危险操作确认：用户选择 -> ${confirmed ? '确认删除' : '取消'}`,
    '危险操作确认：用户取消了操作。',
  );
};

const showAutoCloseDialog = async () => {
  await executeDialogAction(
    '自动关闭对话框',
    () => dialogService.showMessage({
      title: '自动关闭示例',
      message: '此对话框将在3秒后自动关闭。',
      autoClose: 3000,
    }),
    () => '自动关闭对话框：已自动关闭或用户点击了确定。',
    '自动关闭对话框：用户在自动关闭前关闭了对话框或发生异常。',
  );
};

const showInputDialog = async () => {
  await executeDialogAction(
    '输入对话框',
    () => dialogService.showInput({
      title: '请输入信息',
      message: '请输入您的昵称：',
      initialValue: 'ComfyGugu',
      inputPlaceholder: '例如：咕咕',
    }),
    (input) => `输入对话框：用户输入了 "${input}"`, // input 不会是 null，因为 null 会走 onCancel
    '输入对话框：用户取消了输入。',
  );
};

const showTextareaDialog = async () => {
  await executeDialogAction(
    '多行输入对话框',
    () => dialogService.showInput({
      title: '请输入反馈',
      message: '请详细描述您遇到的问题或建议：',
      inputType: 'textarea',
      inputRows: 4,
      inputPlaceholder: '请在此处输入您的反馈内容...',
    }),
    (input) => `多行输入对话框：用户输入了 "${input}"`,
    '多行输入对话框：用户取消了输入。',
  );
};

const showLargeTextMessageDialog = async () => {
  await executeDialogAction(
    '超大文本消息对话框',
    () => dialogService.showMessage({
      title: '超大文本消息',
      message: veryLongText,
      confirmText: '朕已阅',
    }),
    () => '超大文本消息对话框：用户点击了确定。',
    '超大文本消息对话框：用户关闭了对话框或发生异常。',
  );
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

const showLargeTextToast = () => {
  dialogService.showToast({
    title: '超大文本通知',
    message: veryLongText,
    type: 'info',
    duration: 10000, // 持续时间长一点，方便查看
    position: 'top-center',
  });
  dialogServiceResult.value = '触发了超大文本通知。';
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

const openInitialUsernameSetup = () => {
  uiStoreResult.value = '尝试打开初始用户名设置模态框...';
  isInitialUsernameSetupModalVisible.value = true; // + 更新 ref 来显示模态框
};

// --- UiStore 状态监听 ---
watch(
  () => uiStore.isSettingsModalVisible,
  (isVisible, wasVisible) => {
    if (wasVisible === true && isVisible === false) {
      uiStoreResult.value = '设置模态框已关闭。';
    } else if (wasVisible === false && isVisible === true) {
      // 可选：如果希望在打开时也更新，可以取消注释下一行
      // uiStoreResult.value = '设置模态框已打开。';
    }
  },
);

// 如果需要，也可以为 RegexEditorModal 添加类似的 watch
// watch(
//   () => uiStore.isRegexEditorModalVisible,
//   (isVisible, wasVisible) => {
//     if (wasVisible === true && isVisible === false) {
//       // 检查是否是通过保存关闭的，避免覆盖 onSave 的消息
//       if (!uiStoreResult.value.startsWith('正则编辑器已保存')) {
//         uiStoreResult.value = '正则编辑器模态框已关闭 (未保存)。';
//       }
//     }
//   }
// );

</script>

<style scoped>
.btn {
  @apply px-4 py-2 rounded-md font-medium text-primary-content focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors shadow hover:shadow-md;
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

.btn-orange {
  @apply bg-orange-500 hover:bg-orange-600 focus:ring-orange-400;
}

.btn-lime {
  @apply bg-lime-500 hover:bg-lime-600 focus:ring-lime-400;
}

.btn-sky {
  @apply bg-sky-500 hover:bg-sky-600 focus:ring-sky-400;
}
</style>