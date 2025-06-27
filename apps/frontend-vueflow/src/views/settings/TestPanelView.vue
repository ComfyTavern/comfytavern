<template>
  <div class="p-6 max-w-5xl mx-auto">
    <InitialUsernameSetupModal :visible="isInitialUsernameSetupModalVisible" @close="
      isInitialUsernameSetupModalVisible = false;
    uiStoreResult = t('testPanel.uiStore.resultsContent.initialUsernameClosed');
    " @saved="
        isInitialUsernameSetupModalVisible = false;
      uiStoreResult = t('testPanel.uiStore.resultsContent.initialUsernameSaved');
      " />
    <h1 class="text-3xl font-bold mb-8 text-text-base">{{ t("testPanel.title") }}</h1>

    <!-- DialogService 测试 -->
    <section class="mb-12">
      <h2 class="text-2xl font-semibold mb-6 text-text-base border-b pb-2">
        {{ t("testPanel.dialogService.title") }}
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <!-- 对话框部分 -->
        <div class="bg-background-surface p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-semibold mb-4 text-text-secondary">
            {{ t("testPanel.dialogService.dialogs") }}
          </h3>
          <div class="space-y-4">
            <button @click="showMessageDialog" class="btn btn-blue w-full">
              {{ t("testPanel.dialogService.buttons.showMessage") }}
            </button>
            <button @click="showConfirmDialog" class="btn btn-green w-full">
              {{ t("testPanel.dialogService.buttons.showConfirm") }}
            </button>
            <button @click="showDangerConfirmDialog" class="btn btn-red w-full">
              {{ t("testPanel.dialogService.buttons.showDangerConfirm") }}
            </button>
            <button @click="showAutoCloseDialog" class="btn btn-purple w-full">
              {{ t("testPanel.dialogService.buttons.showAutoClose") }}
            </button>
            <button @click="showInputDialog" class="btn btn-teal w-full">
              {{ t("testPanel.dialogService.buttons.showInput") }}
            </button>
            <button @click="showTextareaDialog" class="btn btn-cyan w-full">
              {{ t("testPanel.dialogService.buttons.showTextarea") }}
            </button>
            <button @click="showLargeTextMessageDialog" class="btn btn-orange w-full">
              {{ t("testPanel.dialogService.buttons.showLargeMessage") }}
            </button>
          </div>
        </div>

        <!-- 通知部分 -->
        <div class="bg-background-surface p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-semibold mb-4 text-text-secondary">
            {{ t("testPanel.dialogService.toasts") }}
          </h3>
          <div class="space-y-4">
            <button @click="showInfoToast" class="btn btn-info w-full">
              {{ t("testPanel.dialogService.buttons.showInfoToast") }}
            </button>
            <button @click="showSuccessToast" class="btn btn-success w-full">
              {{ t("testPanel.dialogService.buttons.showSuccessToast") }}
            </button>
            <button @click="showWarningToast" class="btn btn-warning w-full">
              {{ t("testPanel.dialogService.buttons.showWarningToast") }}
            </button>
            <button @click="showErrorToast" class="btn btn-error w-full">
              {{ t("testPanel.dialogService.buttons.showErrorToast") }}
            </button>
            <button @click="showCustomToast" class="btn btn-purple w-full">
              {{ t("testPanel.dialogService.buttons.showCustomToast") }}
            </button>
            <button @click="showMultipleToasts" class="btn btn-gray w-full">
              {{ t("testPanel.dialogService.buttons.showMultipleToasts") }}
            </button>
            <button @click="showLargeTextToast" class="btn btn-lime w-full">
              {{ t("testPanel.dialogService.buttons.showLargeToast") }}
            </button>
          </div>
        </div>
      </div>
      <div class="mt-8 bg-background-surface p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-3 text-text-secondary">
          {{ t("testPanel.dialogService.results") }}
        </h3>
        <div class="bg-background-base p-4 rounded-md min-h-[50px]">
          <pre class="text-sm text-text-base whitespace-pre-wrap">{{ dialogServiceResult }}</pre>
        </div>
      </div>
    </section>

    <!-- UiStore Modals 测试 -->
    <section>
      <h2 class="text-2xl font-semibold mb-6 text-text-base border-b pb-2">
        {{ t("testPanel.uiStore.title") }}
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div class="bg-background-surface p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-semibold mb-4 text-text-secondary">
            {{ t("testPanel.uiStore.specificModals") }}
          </h3>
          <div class="space-y-4">
            <button @click="openSettings" class="btn btn-indigo w-full">
              {{ t("testPanel.uiStore.buttons.openSettings") }}
            </button>
            <button @click="openRegexEditor" class="btn btn-pink w-full">
              {{ t("testPanel.uiStore.buttons.openRegexEditor") }}
            </button>
            <button @click="openInitialUsernameSetup" class="btn btn-sky w-full">
              {{ t("testPanel.uiStore.buttons.openInitialUsernameSetup") }}
            </button>
          </div>
        </div>
      </div>
      <div class="mt-8 bg-background-surface p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-3 text-text-secondary">
          {{ t("testPanel.uiStore.results") }}
        </h3>
        <div class="bg-background-base p-4 rounded-md min-h-[50px]">
          <pre class="text-sm text-text-base whitespace-pre-wrap">{{ uiStoreResult }}</pre>
        </div>
      </div>
    </section>

    <!-- SettingsControl 测试 (使用 SettingsPanel) -->
    <section class="mt-12">
      <h2 class="text-2xl font-semibold mb-6 text-text-base border-b pb-2">
        {{ t("testPanel.settingsControl.title") }}
      </h2>
      <div class="bg-background-surface p-6 rounded-lg shadow-md">
        <SettingsPanel :config="testSettingItems" />
      </div>
      <!-- 用于验证 settingsStore 中的值是否正确更新 -->
      <div class="mt-8 bg-background-surface p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-3 text-text-secondary">
          {{ t("testPanel.settingsControl.results") }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="config in testSettingItems" :key="`debug-${config.key}`" class="bg-background-base p-3 rounded">
            <p class="text-sm font-medium text-text-base">{{ config.label }} ({{ config.key }})</p>
            <pre class="mt-1 text-xs text-text-secondary whitespace-pre-wrap">{{
              settingsStore.getSetting(config.key, config.defaultValue)
            }}</pre>
          </div>
        </div>
      </div>
    </section>

    <!-- PanelContainer 测试 -->
    <section class="mt-12">
      <h2 class="text-2xl font-semibold mb-6 text-text-base border-b pb-2">PanelContainer Test</h2>
      <div class="bg-background-surface p-6 rounded-lg shadow-md" style="height: 500px">
        <PanelContainer panel-id="panel_chat_default_v1" />
      </div>
    </section>
    <!-- DaisyUI Component Showcase -->
    <section class="mt-12">
      <h2 class="text-2xl font-semibold mb-6 text-text-base border-b pb-2">DaisyUI 组件样式展示</h2>
      <div class="bg-background-surface p-6 rounded-lg shadow-md space-y-8">
        <!-- Buttons -->
        <div>
          <h3 class="text-xl font-semibold mb-4 text-text-secondary">按钮 (Button)</h3>
          <div class="flex flex-wrap gap-4 items-center">
            <button class="btn btn-brand-primary">主要按钮</button>
            <button class="btn btn-brand-primary" disabled>禁用按钮</button>
            <button class="btn">基础按钮</button>
          </div>
        </div>

        <!-- Alerts -->
        <div>
          <h3 class="text-xl font-semibold mb-4 text-text-secondary">警告框 (Alert)</h3>
          <div class="space-y-4">
            <div role="alert" class="alert alert-brand-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                class="stroke-current shrink-0 w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>这是一条信息提示。</span>
            </div>
            <div role="alert" class="alert alert-brand-success">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>操作已成功！</span>
            </div>
            <div role="alert" class="alert alert-brand-warning">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>警告：请注意此操作。</span>
            </div>
            <div role="alert" class="alert alert-brand-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>错误：任务执行失败。</span>
            </div>
          </div>
        </div>

        <!-- Badges -->
        <div>
          <h3 class="text-xl font-semibold mb-4 text-text-secondary">徽章 (Badge)</h3>
          <div class="flex flex-wrap gap-4 items-center">
            <div class="badge badge-brand-info gap-2">info</div>
            <div class="badge badge-brand-success gap-2">success</div>
            <div class="badge badge-brand-warning gap-2">warning</div>
            <div class="badge badge-brand-error gap-2">error</div>
            <div class="badge badge-brand-primary">primary</div>
            <div class="badge badge-brand-secondary">secondary</div>
            <div class="badge badge-brand-accent">accent</div>
          </div>
        </div>

        <!-- Card -->
        <div>
          <h3 class="text-xl font-semibold mb-4 text-text-secondary">卡片 (Card)</h3>
          <div class="card w-96">
            <figure>
              <img src="https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.jpg" alt="Shoes" />
            </figure>
            <div class="card-body">
              <h2 class="card-title">
                卡片标题
                <div class="badge badge-brand-secondary">新</div>
              </h2>
              <p>这是一个卡片组件的示例，用于展示内容摘要。</p>
              <div class="card-actions justify-end">
                <div class="badge badge-outline">时尚</div>
                <div class="badge badge-outline">产品</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import PanelContainer from "@/components/panel/PanelContainer.vue"; // + 导入 PanelContainer
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDialogService } from "@/services/DialogService";
import { useUiStore } from "@/stores/uiStore";
// import { useAuthStore } from '@/stores/authStore'; // authStore 暂时不需要直接在此处调用特定方法来显示模态框
import InitialUsernameSetupModal from "@/components/auth/InitialUsernameSetupModal.vue"; // + 导入模态框组件
import type { RegexRule } from "@comfytavern/types";
// import SettingControl from '@/components/settings/SettingControl.vue'; // 不再直接使用
import SettingsPanel from "@/components/settings/SettingsPanel.vue"; // + 导入 SettingsPanel
import type { SettingItemConfig } from "@/types/settings";
import { useSettingsStore } from "@/stores/settingsStore";

const { t } = useI18n();
const dialogService = useDialogService();
const uiStore = useUiStore();
// const authStore = useAuthStore(); // 暂时注释掉，如果模态框内部需要，它自己会导入
const settingsStore = useSettingsStore();

const dialogServiceResult = ref(t("testPanel.dialogService.resultsContent.waiting"));
const uiStoreResult = ref(t("testPanel.dialogService.resultsContent.waiting"));
const isInitialUsernameSetupModalVisible = ref(false); // + 控制模态框显示的状态

const testSettingItems = ref<SettingItemConfig[]>([
  {
    key: "testPanel.stringInput",
    type: "string",
    label: t("testPanel.settingsControl.labels.string"),
    description: t("testPanel.settingsControl.descriptions.string"),
    defaultValue: "你好，咕咕！",
    category: "testControls",
  },
  {
    key: "testPanel.textareaInput",
    type: "textarea",
    label: t("testPanel.settingsControl.labels.textarea"),
    description: t("testPanel.settingsControl.descriptions.textarea"),
    defaultValue: "这是一个\n多行文本示例。\n咕咕咕~",
    category: "testControls",
  },
  {
    key: "testPanel.numberInput",
    type: "number",
    label: t("testPanel.settingsControl.labels.number"),
    description: t("testPanel.settingsControl.descriptions.number"),
    defaultValue: 42,
    min: 0,
    max: 100,
    step: 1,
    category: "testControls",
  },
  {
    key: "testPanel.booleanToggle",
    type: "boolean",
    label: t("testPanel.settingsControl.labels.boolean"),
    description: t("testPanel.settingsControl.descriptions.boolean"),
    defaultValue: true,
    category: "testControls",
  },
  {
    key: "testPanel.selectInput",
    type: "select",
    label: t("testPanel.settingsControl.labels.select"),
    description: t("testPanel.settingsControl.descriptions.select"),
    defaultValue: "option2",
    options: [
      { label: t("testPanel.settingsControl.selectOptions.a"), value: "option1" },
      { label: t("testPanel.settingsControl.selectOptions.b"), value: "option2" },
      { label: t("testPanel.settingsControl.selectOptions.c"), value: "option3" },
      { label: t("testPanel.settingsControl.selectOptions.d"), value: "option4" },
    ],
    category: "testControls",
  },
]);

const veryLongText = `收到了，姐姐。这是一个用于测试 UI 组件的面板，结构很清晰。咕~\n\n整体来看，这个测试面板的设计目标明确，将 \`DialogService\` 的瞬时交互（如确认框、通知）和 \`UiStore\` 控制的全局状态模态框（如设置、编辑器）分离开来，这是很好的实践。前者是命令式的，后者是声明式的，各司其职。\n\n代码写得很规整，不过从逻辑和代码复用的角度，有几个可以琢磨的地方：\n\n### 1. \`DialogService\` 的 \`async/await\` 与错误处理\n\n*   **重复的 \`try...catch\` 结构**：在 \`showMessageDialog\`、\`showConfirmDialog\` 等异步函数中，你都使用了相似的 \`try...catch\` 结构来更新 \`dialogServiceResult\`。这种重复的模式是“样板代码”（Boilerplate Code），可以被抽象出来。\n\n    可以考虑创建一个辅助函数来包装 \`dialogService\` 的调用，从而简化代码。\n\n    例如，可以这样封装：\n    \`\`\`typescript\n    async function handleDialog<T>(\n      action: () => Promise<T>,\n      resultUpdater: (result: string) => void,\n      successMessageFactory: (result: T) => string,\n      initialMessage: string = \'等待响应...\'\n    ) {\n      resultUpdater(initialMessage);\n      try {\n        const result = await action();\n        resultUpdater(successMessageFactory(result));\n      } catch (error) {\n        // 如果用户取消操作（通常是 reject），也在这里捕获\n        if (error === \'cancelled\') { // 假设 DialogService 在取消时 reject(\'cancelled\')\n             resultUpdater(\'操作已取消。\');\n        } else {\n             resultUpdater(\`操作失败: \${error}\`);\n        }\n      }\n    }\n\n    // 使用示例\n    const showConfirmDialog = async () => {\n      await handleDialog(\n        () => dialogService.showConfirm({ title: \'确认操作\', message: \'您确定吗？\' }),\n        (res) => dialogServiceResult.value = res,\n        (confirmed) => \`确认对话框：用户选择 -> \${confirmed} ? \'确认\' : \'取消\'}\`,\n        \'等待确认对话框响应...\'\n      );\n    };\n    \`\`\`\n    这样一来，每个按钮的点击事件处理器都会变得非常简洁。\n\n*   **取消操作的语义**：目前来看，当用户点击“取消”或关闭对话框时，Promise 很可能会被 \`reject\`，然后进入 \`catch\` 块。从语义上讲，用户主动取消并非一个程序“错误”（Error）。更清晰的设计是让 \`showConfirm\` 或 \`showInput\` 在用户取消时 \`resolve(null)\` 或 \`resolve(false)\`。这样 \`catch\` 就可以专门用来处理网络中断、组件加载失败等真正的异常情况。当然，这取决于 \`DialogService\` 的内部实现。\n\n### 2. \`UiStore\` 的状态反馈\n\n*   你在注释里提到了 \`// 为简单起见，这里只记录打开操作\`，这很诚实。要实现完整的反馈闭环（即模态框关闭后更新 \`uiStoreResult\`），确实需要监听 \`uiStore\` 的状态。\n\n    使用 Vue 的 \`watch\` 是一个很直接的方案：\n    \`\`\`typescript\n    import { watch } from \'vue\';\n\n    watch(\n      () => uiStore.isSettingsModalVisible,\n      (isVisible, wasVisible) => {\n        if (wasVisible && !isVisible) {\n          uiStoreResult.value = \'设置模态框已关闭。\';\n        }\n      }\n    );\n    \`\`\`\n    这样，组件就能响应 store 的变化，而不是依赖于模态框自身的回调，逻辑会更符合 Pinia 的数据驱动思想。\n\n### 3. 一些小细节\n\n*   **超长文本占位符**：\`veryLongText\` 的内容是 “这里是超长文本占位符，请替换成你准备的小作文。”。既然是测试，不如直接放一段真正的长文本，比如“道可道，非常道；名可名，非常名”之类的，或者直接用经典的 “Lorem Ipsum”。这样测试时能更直观地看到长文本在对话框和通知中的实际渲染效果，比如滚动条是否出现、文本是否正确换行等。\n*   **CSS 样式**：使用 \`@apply\` 将 Tailwind 的原子类组合成 \`.btn-*\` 这样的组件类，是保持模板（template）整洁和语义化的好方法。这对于维护和主题化都很有利，没什么问题。\n\n总的来说，这个测试组件已经非常完备和实用了。上面的一些想法主要是从代码复用和设计模式的角度出发，供姐姐参考。\n\n咕~ 如果需要我帮忙实现那个简化 \`try...catch\` 的辅助函数，或者有其他问题，随时可以叫我。`; // 示例长文本

// 辅助函数，用于封装 DialogService 的异步操作和状态更新逻辑
async function executeDialogAction<T>(
  actionName: string,
  action: () => Promise<T>,
  onSuccess: (result: T) => string,
  onCancel: string = t("testPanel.dialogService.resultsContent.cancelled", { actionName })
) {
  dialogServiceResult.value = t("testPanel.dialogService.resultsContent.waitingFor", {
    actionName,
  });
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
    if (error === "cancelled" || error === null || String(error).toLowerCase().includes("cancel")) {
      dialogServiceResult.value = onCancel;
    } else {
      dialogServiceResult.value = t("testPanel.dialogService.resultsContent.exception", {
        actionName,
        error,
      });
    }
  }
}

// --- DialogService 方法 ---
const showMessageDialog = async () => {
  await executeDialogAction(
    t("testPanel.dialogService.buttons.showMessage"),
    () =>
      dialogService.showMessage({
        title: t("testPanel.dialogService.dialogContent.messageTitle"),
        message: t("testPanel.dialogService.dialogContent.messageText"),
      }),
    () => t("testPanel.dialogService.resultsContent.messageSuccess"),
    t("testPanel.dialogService.resultsContent.messageCancelled")
  );
};

const showConfirmDialog = async () => {
  await executeDialogAction(
    t("testPanel.dialogService.buttons.showConfirm"),
    () =>
      dialogService.showConfirm({
        title: t("testPanel.dialogService.dialogContent.confirmTitle"),
        message: t("testPanel.dialogService.dialogContent.confirmText"),
      }),
    (confirmed) =>
      t("testPanel.dialogService.resultsContent.confirmSuccess", {
        choice: confirmed ? t("common.confirm") : t("common.cancel"),
      }),
    t("testPanel.dialogService.resultsContent.confirmCancelled")
  );
};

const showDangerConfirmDialog = async () => {
  await executeDialogAction(
    t("testPanel.dialogService.buttons.showDangerConfirm"),
    () =>
      dialogService.showConfirm({
        title: t("testPanel.dialogService.dialogContent.dangerConfirmTitle"),
        message: t("testPanel.dialogService.dialogContent.dangerConfirmText"),
        dangerConfirm: true,
        confirmText: t("testPanel.dialogService.dialogContent.dangerConfirmYes"),
        cancelText: t("testPanel.dialogService.dialogContent.dangerConfirmNo"),
      }),
    (confirmed) =>
      t("testPanel.dialogService.resultsContent.dangerConfirmSuccess", {
        choice: confirmed ? t("common.delete") : t("common.cancel"),
      }),
    t("testPanel.dialogService.resultsContent.dangerConfirmCancelled")
  );
};

const showAutoCloseDialog = async () => {
  await executeDialogAction(
    t("testPanel.dialogService.buttons.showAutoClose"),
    () =>
      dialogService.showMessage({
        title: t("testPanel.dialogService.dialogContent.autoCloseTitle"),
        message: t("testPanel.dialogService.dialogContent.autoCloseText"),
        autoClose: 3000,
      }),
    () => t("testPanel.dialogService.resultsContent.autoCloseSuccess"),
    t("testPanel.dialogService.resultsContent.autoCloseCancelled")
  );
};

const showInputDialog = async () => {
  await executeDialogAction(
    t("testPanel.dialogService.buttons.showInput"),
    () =>
      dialogService.showInput({
        title: t("testPanel.dialogService.dialogContent.inputTitle"),
        message: t("testPanel.dialogService.dialogContent.inputText"),
        initialValue: "ComfyGugu",
        inputPlaceholder: t("testPanel.dialogService.dialogContent.inputPlaceholder"),
      }),
    (input) => t("testPanel.dialogService.resultsContent.inputSuccess", { input }),
    t("testPanel.dialogService.resultsContent.inputCancelled")
  );
};

const showTextareaDialog = async () => {
  await executeDialogAction(
    t("testPanel.dialogService.buttons.showTextarea"),
    () =>
      dialogService.showInput({
        title: t("testPanel.dialogService.dialogContent.textareaTitle"),
        message: t("testPanel.dialogService.dialogContent.textareaText"),
        inputType: "textarea",
        inputRows: 4,
        inputPlaceholder: t("testPanel.dialogService.dialogContent.textareaPlaceholder"),
      }),
    (input) => t("testPanel.dialogService.resultsContent.textareaSuccess", { input }),
    t("testPanel.dialogService.resultsContent.textareaCancelled")
  );
};

const showLargeTextMessageDialog = async () => {
  await executeDialogAction(
    t("testPanel.dialogService.buttons.showLargeMessage"),
    () =>
      dialogService.showMessage({
        title: t("testPanel.dialogService.dialogContent.largeMessageTitle"),
        message: veryLongText,
        confirmText: t("testPanel.dialogService.dialogContent.largeMessageConfirm"),
      }),
    () => t("testPanel.dialogService.resultsContent.largeMessageSuccess"),
    t("testPanel.dialogService.resultsContent.largeMessageCancelled")
  );
};

const showInfoToast = () => {
  dialogService.showInfo(
    t("testPanel.dialogService.dialogContent.infoToastText"),
    t("testPanel.dialogService.dialogContent.infoToastTitle")
  );
  dialogServiceResult.value = t("testPanel.dialogService.resultsContent.infoToastTriggered");
};
const showSuccessToast = () => {
  dialogService.showSuccess(
    t("testPanel.dialogService.dialogContent.successToastText"),
    t("testPanel.dialogService.dialogContent.successToastTitle")
  );
  dialogServiceResult.value = t("testPanel.dialogService.resultsContent.successToastTriggered");
};
const showWarningToast = () => {
  dialogService.showWarning(
    t("testPanel.dialogService.dialogContent.warningToastText"),
    t("testPanel.dialogService.dialogContent.warningToastTitle")
  );
  dialogServiceResult.value = t("testPanel.dialogService.resultsContent.warningToastTriggered");
};
const showErrorToast = () => {
  dialogService.showError(
    t("testPanel.dialogService.dialogContent.errorToastText"),
    t("testPanel.dialogService.dialogContent.errorToastTitle")
  );
  dialogServiceResult.value = t("testPanel.dialogService.resultsContent.errorToastTriggered");
};
const showCustomToast = () => {
  dialogService.showToast({
    title: t("testPanel.dialogService.dialogContent.customToastTitle"),
    message: t("testPanel.dialogService.dialogContent.customToastText"),
    type: "info",
    duration: 5000,
    position: "bottom-center",
  });
  dialogServiceResult.value = t("testPanel.dialogService.resultsContent.customToastTriggered");
};
const showMultipleToasts = () => {
  dialogService.showInfo(t("testPanel.dialogService.dialogContent.multiToast1"));
  setTimeout(
    () => dialogService.showSuccess(t("testPanel.dialogService.dialogContent.multiToast2")),
    500
  );
  setTimeout(
    () => dialogService.showWarning(t("testPanel.dialogService.dialogContent.multiToast3")),
    1000
  );
  dialogServiceResult.value = t("testPanel.dialogService.resultsContent.multipleToastsTriggered");
};

const showLargeTextToast = () => {
  dialogService.showToast({
    title: t("testPanel.dialogService.dialogContent.largeToastTitle"),
    message: veryLongText,
    type: "info",
    duration: 10000, // 持续时间长一点，方便查看
    position: "top-center",
  });
  dialogServiceResult.value = t("testPanel.dialogService.resultsContent.largeToastTriggered");
};

// --- UiStore 方法 ---
const openSettings = () => {
  uiStoreResult.value = t("testPanel.uiStore.resultsContent.openingSettings");
  uiStore.openSettingsModal({ width: "max-w-2xl", height: "80vh" });
  // 实际的关闭和结果由 App.vue 中的 BaseModal 处理，这里只记录触发
  // 可以在 BaseModal 的 @close 事件中更新 uiStoreResult，但这需要更复杂的事件传递
  // 为简单起见，这里只记录打开操作
  // 如果需要知道何时关闭，可以 watch uiStore.isSettingsModalVisible
};

const openRegexEditor = () => {
  uiStoreResult.value = t("testPanel.uiStore.resultsContent.openingRegexEditor");
  const mockRules: RegexRule[] = [
    {
      name: "rule1",
      pattern: "^start",
      replacement: "begin",
      enabled: true,
      description: "替换开头",
    },
    {
      name: "rule2",
      pattern: "end$",
      replacement: "finish",
      enabled: false,
      description: "替换结尾",
    },
  ];
  uiStore.openRegexEditorModal({
    rules: mockRules,
    nodeId: "testNode123",
    inputKey: "testInputKey",
    onSave: (updatedRules) => {
      console.log("正则编辑器保存:", updatedRules);
      uiStoreResult.value = t("testPanel.uiStore.resultsContent.regexEditorSaved", {
        count: updatedRules.length,
      });
      uiStore.closeRegexEditorModal(); // 通常在 onSave 后关闭
    },
  });
};

const openInitialUsernameSetup = () => {
  uiStoreResult.value = t("testPanel.uiStore.resultsContent.openingInitialUsernameSetup");
  isInitialUsernameSetupModalVisible.value = true; // + 更新 ref 来显示模态框
};

// --- UiStore 状态监听 ---
watch(
  () => uiStore.isSettingsModalVisible,
  (isVisible, wasVisible) => {
    if (wasVisible === true && isVisible === false) {
      uiStoreResult.value = t("testPanel.uiStore.resultsContent.settingsClosed");
    } else if (wasVisible === false && isVisible === true) {
      // 可选：如果希望在打开时也更新，可以取消注释下一行
      // uiStoreResult.value = '设置模态框已打开。';
    }
  }
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

.btn-info {
  @apply bg-info hover:opacity-90 focus:ring-info text-primary-content;
}

.btn-success {
  @apply bg-success hover:opacity-90 focus:ring-success text-primary-content;
}

.btn-warning {
  @apply bg-warning hover:opacity-90 focus:ring-warning text-primary-content;
}

.btn-error {
  @apply bg-error hover:opacity-90 focus:ring-error text-primary-content;
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
  @apply bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-text-base;
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
