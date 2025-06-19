<template>
  <div class="settings-layout">
    <!-- 咕咕：添加隐藏的文件输入框 -->
    <input type="file" ref="languageFileInput" @change="onFileSelected" accept=".json" style="display: none;" />
    <!-- 顶部标签页导航 -->
    <nav class="settings-nav">
      <ul>
        <li v-for="section in sections" :key="section.id" :class="{ active: activeSectionId === section.id }"
          @click="activeSectionId = section.id">
          <!-- <Icon :name="section.icon" />  图标暂时占位 -->
          <span>{{ t(`settings.sections.${section.id.replace("-", "_")}`) }}</span>
        </li>
      </ul>
    </nav>

    <!-- 主体内容区 -->
    <OverlayScrollbarsComponent class="settings-content" :options="{
      scrollbars: {
        autoHide: 'leave',
        theme: themeStore.currentAppliedMode === 'dark' ? 'os-theme-dark' : 'os-theme-light',
      },
      overflow: { y: 'scroll' },
      paddingAbsolute: true,
    }" defer>
      <template v-if="activeSection">
        <!-- 核心: 根据类型动态渲染 -->
        <!-- Case 1: 数据驱动模式 -->
        <SettingsPanel v-if="activeSection.type === 'data-driven' && activeSection.dataConfig"
          :config="activeSection.dataConfig" />
        <!-- Case 2: 模块嵌入模式 -->
        <component v-else-if="activeSection.type === 'component' && activeSection.component"
          :is="activeSection.component" />
        <div v-else class="placeholder-content">
          {{ t("settings.placeholders.no_content") }}
        </div>
      </template>
    </OverlayScrollbarsComponent>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, defineAsyncComponent, markRaw, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { SettingsSection, SettingItemConfig } from "@/types/settings";
import { fileManagerApiClient } from "@/api/fileManagerApi"; // + 咕咕：导入 fileManagerApiClient
import { useDialogService } from "@/services/DialogService"; // + 咕咕：导入 DialogService
import SettingsPanel from "./SettingsPanel.vue";
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";
import { useThemeStore, type DisplayMode } from "@/stores/theme"; // + type DisplayMode
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useLanguagePackManager } from "@/composables/useLanguagePackManager"; // + i18n
import { storeToRefs } from "pinia";

// --- Store 实例化 ---
const { t } = useI18n();
const themeStore = useThemeStore(); // 移动到顶部
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const languageManager = useLanguagePackManager(); // + i18n
const dialogService = useDialogService(); // + 咕咕：实例化 DialogService
const { currentUser } = storeToRefs(authStore);
// 从 themeStore 解构需要的 refs
const { displayMode, availableThemes, selectedThemeId } = storeToRefs(themeStore);
const { i18nSettings } = storeToRefs(settingsStore); // + i18n
const { availableLanguages } = languageManager; // + i18n (直接从 composable 获取 ref)

const languageFileInput = ref<HTMLInputElement | null>(null); // + 咕咕：为文件输入添加 ref

// + 咕咕：添加处理语言包上传的函数
function handleAddLanguagePack() {
  languageFileInput.value?.click();
}

async function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    
    // + 咕咕：添加对 file 存在的显式检查
    if (!file) {
      dialogService.showToast({ type: 'error', message: t('settings.notifications.no_file_selected_error') });
      target.value = '';
      return;
    }

    const fileName = file.name;

    if (!fileName.endsWith('.json')) {
      dialogService.showToast({ type: 'error', message: t('settings.notifications.invalid_file_type_json') });
      target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileContent = e.target?.result as string;
        const parsedContent = JSON.parse(fileContent);

        if (!parsedContent._meta || !parsedContent._meta.name || !parsedContent._meta.nativeName) {
          dialogService.showToast({ type: 'error', message: t('settings.notifications.invalid_lang_file_meta') });
          target.value = '';
          return;
        }

        const formData = new FormData();
        formData.append('files', file, fileName);

        const targetDir = 'user://library/locales/ui/@ComfyTavern-ui/';
        
        // dialogService.showLoading(t('settings.notifications.uploading_lang_file')); // DialogService 可能没有 showLoading
        dialogService.showToast({ type: 'info', message: t('settings.notifications.uploading_lang_file'), duration: 1500 });


        await fileManagerApiClient.writeFile(targetDir, formData);
        
        dialogService.showToast({ type: 'success', message: t('settings.notifications.lang_file_upload_success') });
        
        await languageManager.discoverLanguagePacks();
        
      } catch (error) {
        console.error("咕: 处理语言文件失败:", error);
        dialogService.showError(t('settings.notifications.lang_file_upload_error', { error: (error as Error).message }));
      } finally {
        target.value = '';
      }
    };
    reader.readAsText(file);
  }
}

// --- 占位符组件 ---
// 后续这些将被替换为真实的自定义组件
const PlaceholderComponent = defineComponent({
  props: { title: String },
  setup() {
    const { t } = useI18n();
    return { t };
  },
  template: `<div class="placeholder-component"><h3>{{ title }}</h3><p>{{ t('settings.placeholders.custom_module_wip') }}</p></div>`,
});

// === 定义所有设置分区 ===

// 1. 数据驱动的配置示例
// const authStore = useAuthStore(); // 已提前
// const settingsStore = useSettingsStore(); // 已提前
// const { currentUser } = storeToRefs(authStore); // 已提前

const userSettingsConfig = computed<SettingItemConfig[]>(() => [
  {
    key: "user.nickname",
    type: "string",
    label: t("settings.items.user_nickname_label"),
    description: t("settings.items.user_nickname_desc"),
    defaultValue: currentUser.value?.username || "本地用户", // 尝试从 authStore 获取初始值
    categoryKey: "basic_info",
    category: t("settings.categories.basic_info"),
    async onSave(key, newValue) {
      if (key === "user.nickname" && typeof newValue === "string") {
        try {
          // uiStore.showLoading('正在保存昵称...'); // 可选
          const result = await authStore.updateUsername(newValue);
          if (!result.success) {
            console.error("Failed to update username (onSave):", result.message);
            // uiStore.showToast({ type: 'error', message: `更新昵称失败: ${result.message || '未知错误'}` });
            return { success: false, message: result.message || "更新昵称失败" };
          }
          // uiStore.showToast({ type: 'success', message: '昵称更新成功！' });
          return { success: true };
        } catch (error: any) {
          console.error("Error in onSave for user.nickname:", error);
          // uiStore.showToast({ type: 'error', message: `更新昵称时出错: ${error.message || '未知错误'}` });
          return { success: false, message: error.message || "更新昵称时发生未知错误" };
        } finally {
          // uiStore.hideLoading(); // 可选
        }
      }
      return { success: true }; // 默认其他 key 保存成功
    },
  },
  {
    key: "user.avatar",
    type: "avatar", // <--- 修改类型
    label: t("settings.items.user_avatar_label"),
    description: t("settings.items.user_avatar_desc"),
    categoryKey: "basic_info",
    category: t("settings.categories.basic_info"),
    // defaultValue 已移除，将从 authStore 动态获取
  },
]);

const displaySettingsConfig = computed<SettingItemConfig[]>(() => [
  {
    key: "i18n.currentLanguage",
    type: "select",
    label: t("settings.items.i18n_currentLanguage_label"),
    categoryKey: "appearance",
    category: t("settings.categories.appearance"),
    get defaultValue() {
      return i18nSettings.value.currentLanguage;
    },
    get options() {
      return availableLanguages.value.map((lang) => ({
        label: `${lang.nativeName} (${lang.name})`,
        value: lang.code,
      }));
    },
    async onSave(_key, newValue) {
      if (typeof newValue === "string") {
        settingsStore.setLanguage(newValue);
        return { success: true };
      }
      return { success: false, message: "无效的语言代码" };
    },
    description: t("settings.items.i18n_currentLanguage_desc"),
  },
  // + 咕咕：添加 "添加自定义语言包" 按钮的配置
  {
    key: "i18n.addCustomLanguagePack",
    type: "action-button",
    label: t("settings.items.i18n_addCustomLanguagePack_label"),
    categoryKey: "appearance",
    category: t("settings.categories.appearance"),
    buttonText: t("settings.actions.add_language_pack_button"),
    onClick: handleAddLanguagePack,
    description: t("settings.items.i18n_addCustomLanguagePack_desc"),
  },
  {
    key: "theme.displayMode", // 使用更明确的key
    type: "button-group", // <--- 修改类型为 button-group
    label: t("settings.items.theme_displayMode_label"),
    categoryKey: "appearance",
    category: t("settings.categories.appearance"),
    get defaultValue() {
      return displayMode.value; // 从 storeToRefs 获取响应式值
    },
    options: [
      { label: t("settings.items.light_mode"), value: "light" as DisplayMode },
      { label: t("settings.items.dark_mode"), value: "dark" as DisplayMode },
      { label: t("settings.items.system_mode"), value: "system" as DisplayMode }, // 与 DisplayMode 类型一致
    ],
    async onSave(_key, newValue) {
      if (newValue === "light" || newValue === "dark" || newValue === "system") {
        themeStore.setDisplayMode(newValue as DisplayMode); // 调用 themeStore 的方法
        return { success: true };
      }
      return { success: false, message: "无效的显示模式值" };
    },
    description: t("settings.items.theme_displayMode_desc"),
  },
  {
    key: "theme.preset",
    type: "select",
    label: t("settings.items.theme_preset_label"),
    categoryKey: "appearance",
    category: t("settings.categories.appearance"),
    get defaultValue() {
      return selectedThemeId.value; // 从 storeToRefs 获取响应式值
    },
    get options() {
      return availableThemes.value.map((theme) => ({ label: theme.name, value: theme.id })); // 从 storeToRefs 获取响应式值
    },
    async onSave(_key, newValue) {
      if (typeof newValue === "string") {
        themeStore.selectThemePreset(newValue);
        return { success: true };
      }
      return { success: false, message: "无效的主题预设值" };
    },
    description: t("settings.items.theme_preset_desc"),
  },
  {
    key: "display.fontSize",
    type: "button-group",
    label: t("settings.items.display_fontSize_label"),
    categoryKey: "appearance",
    category: t("settings.categories.appearance"),
    get defaultValue() {
      return settingsStore.getSetting("display.fontSize", "medium");
    },
    options: [
      { label: t("settings.items.fontSize_x_small"), value: "x-small" },
      { label: t("settings.items.fontSize_small"), value: "small" },
      { label: t("settings.items.fontSize_medium"), value: "medium" },
      { label: t("settings.items.fontSize_large"), value: "large" },
      { label: t("settings.items.fontSize_x_large"), value: "x-large" },
    ],
    async onSave(_key, newValue) {
      if (["x-small", "small", "medium", "large", "x-large"].includes(newValue as string)) {
        settingsStore.updateSetting("display.fontSize", newValue);
        return { success: true };
      }
      return { success: false, message: "无效的字体大小" };
    },
    description: t("settings.items.display_fontSize_desc"),
  },
  {
    key: "display.showMinimap",
    type: "boolean",
    label: t("settings.items.display_showMinimap_label"),
    defaultValue: true,
    categoryKey: "editor",
    category: t("settings.categories.editor"),
    description: t("settings.items.display_showMinimap_desc"),
  },
  {
    key: "display.showConnectionStatus",
    type: "boolean",
    label: t("settings.items.display_showConnectionStatus_label"),
    defaultValue: true,
    categoryKey: "interface_elements",
    category: t("settings.categories.interface_elements"),
    description: t("settings.items.display_showConnectionStatus_desc"),
  },
]);

const mcpSettingsConfig = computed<SettingItemConfig[]>(() => [
  {
    key: "mcp.autoConnect",
    type: "boolean",
    label: t("settings.items.mcp_autoConnect_label"),
    defaultValue: true,
    description: t("settings.items.mcp_autoConnect_desc"),
  },
  {
    key: "mcp.defaultTimeout",
    type: "number",
    label: t("settings.items.mcp_defaultTimeout_label"),
    defaultValue: 30000,
    description: t("settings.items.mcp_defaultTimeout_desc"),
  },
]);

// 2. 组装所有 Section
const sections = computed<SettingsSection[]>(() => [
  {
    id: "display",
    label: t("settings.sections.display"),
    icon: "screen",
    type: "data-driven",
    dataConfig: displaySettingsConfig.value,
  },
  {
    id: "user",
    label: t("settings.sections.user"),
    icon: "user",
    type: "data-driven",
    dataConfig: userSettingsConfig.value,
  },
  {
    id: "keybindings",
    label: t("settings.sections.keybindings"),
    icon: "keyboard",
    type: "component",
    component: { ...PlaceholderComponent, props: { title: "快捷键编辑器" } },
  },
  {
    id: "llm",
    label: t("settings.sections.llm"),
    icon: "brain",
    type: "component",
    component: { ...PlaceholderComponent, props: { title: "LLM API 管理器" } },
  },
  {
    id: "mcp",
    label: t("settings.sections.mcp"),
    icon: "protocol",
    type: "data-driven",
    dataConfig: mcpSettingsConfig.value,
  },
  {
    id: "test-panel",
    label: t("settings.sections.test_panel"),
    icon: "bug_report", // Material Icon name for a bug or test
    type: "component",
    component: markRaw(defineAsyncComponent(() => import("@/views/TestPanelView.vue"))),
  },
  {
    id: "about",
    label: t("settings.sections.about"),
    icon: "info",
    type: "component",
    component: { ...PlaceholderComponent, props: { title: "关于 ComfyTavern" } },
  },
]);

const activeSectionId = ref(sections.value[0]?.id ?? ""); // 默认选中第一个, 如果数组为空则默认为空字符串

const activeSection = computed(() => sections.value.find((s) => s.id === activeSectionId.value));

// const themeStore = useThemeStore(); // 已提前实例化
// const isDark = computed(() => themeStore.currentAppliedMode === 'dark'); // currentAppliedMode 是 themeStore 的 getter

// 新增: 监听 authStore 中用户名的变化，并同步到 settingsStore
// 这确保了 SettingControl 能通过 settingsStore.getSetting 获取到最新的昵称
watch(
  () => currentUser.value?.username, // 使用 storeToRefs 获取的 currentUser
  (newUsername) => {
    if (
      newUsername !== undefined &&
      newUsername !== settingsStore.getSetting("user.nickname", "")
    ) {
      // console.log(`SettingsLayout: authStore.currentUser.username changed to "${newUsername}". Updating settingsStore['user.nickname'].`);
      settingsStore.updateSetting("user.nickname", newUsername);
    }
  },
  { immediate: true } // 立即执行一次，以在组件挂载后同步初始值
);
</script>

<style scoped>
.settings-layout {
  display: flex;
  flex-direction: column;
  /* 改为垂直布局 */
  height: 100%;
  width: 100%;
  background-color: transparent;
  /* 由父容器控制背景 */
  color: var(--ct-text-base);
}

.settings-nav {
  width: 100%;
  /* 宽度占满 */
  flex-shrink: 0;
  /* 移除下边框，胶囊样式不需要这个 */
  background-color: transparent;
  padding: 12px 0;
  /* 给胶囊组一些垂直方向的呼吸空间 */
  display: flex;
  /* 用于内部 ul 的对齐 */
  justify-content: flex-start;
  /* 默认靠左，可以改为 center 使胶囊居中 */
}

.settings-nav ul {
  list-style: none;
  width: auto;
  /* 宽度根据内容自适应 */
  padding: 4px;
  /* 内边距，让li元素和ul边框之间有空隙 */
  margin: 0 42px;
  /* 左右外边距调整为32px */
  display: flex;
  /* 改为 flex 以支持换行 */
  flex-wrap: wrap;
  /* 允许标签换行 */
  background-color: transparent;
  /* 胶囊组的背景色 */
  border-radius: 8px;
  /* 修改为圆角矩形容器 */
  gap: 4px;
  /* 标签之间的间距 */
}

.settings-nav li {
  padding: 6px 12px;
  /* 调整内边距以适应胶囊形状 */
  cursor: pointer;
  font-size: 0.9rem;
  /* 可以适当减小字体 */
  white-space: nowrap;
  /* 防止标签内文字换行 */
  display: flex;
  align-items: center;
  gap: 6px;
  /* 调整图标和文字间距 */
  border-radius: 8px;
  /* 修改为圆角矩形 */
  transition: all 0.2s ease;
  border: 1px solid transparent;
  /* 添加一个透明边框，防止激活时跳动 */
}

.settings-nav li span {
  font-size: 1.2rem;
  font-weight: 600;
  /* 标签文本加粗 */
}

.settings-nav li:hover {
  background-color: hsl(var(--ct-primary-hsl) / 0.1);
  /* 使用 primary 色的浅透明背景作为悬停 */
  color: hsl(var(--ct-primary-hsl));
  /* 悬停时文字颜色变为 primary */
}

.settings-nav li.active {
  background-color: hsl(var(--ct-primary-hsl));
  /* 激活时的背景色 */
  color: hsl(var(--ct-primary-content-hsl));
  /* 激活时的文字颜色 */
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  /* 可选：给激活的标签一点点凸起感 */
}

.settings-content {
  flex-grow: 1;
  padding: 16px 48px;
  /* 调整内边距, OverlayScrollbarsComponent会使用这个padding */
  /* overflow-y: auto; 由 OverlayScrollbarsComponent 控制 */
}

.section-title {
  font-size: 2rem;
  /* 增大标题字号 */
  font-weight: 700;
  /* 加粗 */
  margin-bottom: 32px;
  /* 增-大下外边距 */
  padding-bottom: 16px;
  /* 增-大下内边距 */
  border-bottom: 1px solid hsl(var(--ct-border-base-hsl));
  /* 使用 CSS 变量 */
}

.placeholder-content,
.placeholder-component {
  padding: 20px;
  background-color: hsl(var(--ct-background-surface-hsl));
  /* 使用 surface 背景 */
  border-radius: 8px;
  border: 1px dashed hsl(var(--ct-border-base-hsl));
  /* 使用 CSS 变量 */
}
</style>
