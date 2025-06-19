<template>
  <div class="settings-layout">
    <!-- 顶部标签页导航 -->
    <nav class="settings-nav">
      <ul>
        <li
          v-for="section in sections"
          :key="section.id"
          :class="{ active: activeSectionId === section.id }"
          @click="activeSectionId = section.id"
        >
          <!-- <Icon :name="section.icon" />  图标暂时占位 -->
          <span>{{ t(`settings.sections.${section.id.replace('-', '_')}`) }}</span>
        </li>
      </ul>
    </nav>

    <!-- 主体内容区 -->
    <OverlayScrollbarsComponent
      class="settings-content"
      :options="{
        scrollbars: { autoHide: 'leave', theme: themeStore.currentAppliedMode === 'dark' ? 'os-theme-dark' : 'os-theme-light' },
        overflow: { y: 'scroll' },
        paddingAbsolute: true,
      }"
      defer
    >
      <template v-if="activeSection">
        <!-- 核心: 根据类型动态渲染 -->
        <!-- Case 1: 数据驱动模式 -->
        <SettingsPanel
          v-if="activeSection.type === 'data-driven' && activeSection.dataConfig"
          :config="activeSection.dataConfig"
        />
        <!-- Case 2: 模块嵌入模式 -->
        <component
          v-else-if="activeSection.type === 'component' && activeSection.component"
          :is="activeSection.component"
        />
        <div v-else class="placeholder-content">
          咕？这里似乎没有内容... 可能是正在施工中。
        </div>
      </template>
    </OverlayScrollbarsComponent>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, defineAsyncComponent, markRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SettingsSection, SettingItemConfig } from '@/types/settings';
import SettingsPanel from './SettingsPanel.vue';
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";
import { useThemeStore, type DisplayMode } from '@/stores/theme'; // + type DisplayMode
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useLanguagePackManager } from '@/composables/useLanguagePackManager'; // + i18n
import { storeToRefs } from 'pinia';

// --- Store 实例化 ---
const { t } = useI18n();
const themeStore = useThemeStore(); // 移动到顶部
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const languageManager = useLanguagePackManager(); // + i18n
const { currentUser } = storeToRefs(authStore);
// 从 themeStore 解构需要的 refs
const { displayMode, availableThemes, selectedThemeId } = storeToRefs(themeStore);
const { i18nSettings } = storeToRefs(settingsStore); // + i18n
const { availableLanguages } = languageManager; // + i18n (直接从 composable 获取 ref)


// --- 占位符组件 ---
// 后续这些将被替换为真实的自定义组件
const PlaceholderComponent = defineComponent({
  props: { title: String },
  template: `<div class="placeholder-component"><h3>{{ title }}</h3><p>这里将来是一个自定义的复杂配置模块，目前正在施工中... 咕~</p></div>`,
});


// === 定义所有设置分区 ===

// 1. 数据驱动的配置示例
// const authStore = useAuthStore(); // 已提前
// const settingsStore = useSettingsStore(); // 已提前
// const { currentUser } = storeToRefs(authStore); // 已提前


const userSettingsConfig: SettingItemConfig[] = [
  {
    key: 'user.nickname',
    type: 'string',
    label: '昵称',
    description: '您在平台中显示的名称。',
    defaultValue: currentUser.value?.username || '本地用户', // 尝试从 authStore 获取初始值
    category: '基础信息',
    async onSave(key, newValue) {
      if (key === 'user.nickname' && typeof newValue === 'string') {
        try {
          // uiStore.showLoading('正在保存昵称...'); // 可选
          const result = await authStore.updateUsername(newValue);
          if (!result.success) {
            console.error('Failed to update username (onSave):', result.message);
            // uiStore.showToast({ type: 'error', message: `更新昵称失败: ${result.message || '未知错误'}` });
            return { success: false, message: result.message || '更新昵称失败' };
          }
          // uiStore.showToast({ type: 'success', message: '昵称更新成功！' });
          return { success: true };
        } catch (error: any) {
          console.error('Error in onSave for user.nickname:', error);
          // uiStore.showToast({ type: 'error', message: `更新昵称时出错: ${error.message || '未知错误'}` });
          return { success: false, message: error.message || '更新昵称时发生未知错误' };
        } finally {
          // uiStore.hideLoading(); // 可选
        }
      }
      return { success: true }; // 默认其他 key 保存成功
    },
  },
  {
    key: 'user.avatar',
    type: 'avatar', // <--- 修改类型
    label: '头像', // <--- 修改标签
    description: '设置您的个人头像。', // <--- 修改描述
    category: '基础信息',
    // defaultValue 已移除，将从 authStore 动态获取
  },
];

const displaySettingsConfig: SettingItemConfig[] = [
  {
    key: 'i18n.currentLanguage',
    type: 'select',
    label: t('settings.general.language'),
    category: '外观',
    get defaultValue() {
      return i18nSettings.value.currentLanguage;
    },
    get options() {
      return availableLanguages.value.map(lang => ({
        label: `${lang.nativeName} (${lang.name})`,
        value: lang.code,
      }));
    },
    async onSave(_key, newValue) {
      if (typeof newValue === 'string') {
        settingsStore.setLanguage(newValue);
        return { success: true };
      }
      return { success: false, message: '无效的语言代码' };
    },
    description: '选择 ComfyTavern 的界面显示语言。',
  },
  {
    key: 'theme.displayMode', // 使用更明确的key
    type: 'button-group', // <--- 修改类型为 button-group
    label: '显示模式',
    category: '外观',
    get defaultValue() {
      return displayMode.value; // 从 storeToRefs 获取响应式值
    },
    options: [
      { label: '浅色', value: 'light' as DisplayMode },
      { label: '深色', value: 'dark' as DisplayMode },
      { label: '系统', value: 'system' as DisplayMode }, // 与 DisplayMode 类型一致
    ],
    async onSave(_key, newValue) {
      if (newValue === 'light' || newValue === 'dark' || newValue === 'system') {
        themeStore.setDisplayMode(newValue as DisplayMode); // 调用 themeStore 的方法
        return { success: true };
      }
      return { success: false, message: '无效的显示模式值' };
    },
    description: '选择界面的显示模式：浅色、深色或跟随操作系统设置。',
  },
  {
    key: 'theme.preset',
    type: 'select',
    label: '主题预设',
    category: '外观',
    get defaultValue() {
      return selectedThemeId.value; // 从 storeToRefs 获取响应式值
    },
    get options() {
      return availableThemes.value.map(theme => ({ label: theme.name, value: theme.id })); // 从 storeToRefs 获取响应式值
    },
    async onSave(_key, newValue) {
      if (typeof newValue === 'string') {
        themeStore.selectThemePreset(newValue);
        return { success: true };
      }
      return { success: false, message: '无效的主题预设值' };
    },
    description: '选择一个预设的主题样式。',
  },
  {
    key: 'display.fontSize',
    type: 'number',
    label: '基础字体大小 (px)',
    defaultValue: 14,
    min: 12,
    max: 20,
    category: '外观',
    description: '调整应用界面的基础字体大小。'
  },
  {
    key: 'display.showMinimap',
    type: 'boolean',
    label: '显示编辑器小地图',
    defaultValue: true,
    category: '编辑器',
    description: '在节点编辑器右侧显示代码小地图。'
  },
  {
    key: 'display.showConnectionStatus',
    type: 'boolean',
    label: '显示后端连接状态',
    defaultValue: true,
    category: '界面元素',
    description: '在界面底部显示与后端服务的连接状态指示。'
  },
];

const mcpSettingsConfig: SettingItemConfig[] = [
    { key: 'mcp.autoConnect', type: 'boolean', label: '自动连接MCP服务器', defaultValue: true, description: '启动时自动连接已配置的MCP服务器。' },
    { key: 'mcp.defaultTimeout', type: 'number', label: '默认超时 (ms)', defaultValue: 30000, description: '与MCP服务器通信的默认超时时间。' },
];

// 2. 组装所有 Section
const sections = ref<SettingsSection[]>([
  { id: 'display', label: t('settings.sections.display'), icon: 'screen', type: 'data-driven', dataConfig: displaySettingsConfig },
  { id: 'user', label: t('settings.sections.user'), icon: 'user', type: 'data-driven', dataConfig: userSettingsConfig },
  { id: 'keybindings', label: t('settings.sections.keybindings'), icon: 'keyboard', type: 'component', component: { ...PlaceholderComponent, props: { title: '快捷键编辑器' } } },
  { id: 'llm', label: t('settings.sections.llm'), icon: 'brain', type: 'component', component: { ...PlaceholderComponent, props: { title: 'LLM API 管理器' } } },
  { id: 'mcp', label: t('settings.sections.mcp'), icon: 'protocol', type: 'data-driven', dataConfig: mcpSettingsConfig },
  {
    id: 'test-panel',
    label: t('settings.sections.test_panel'),
    icon: 'bug_report', // Material Icon name for a bug or test
    type: 'component',
    component: markRaw(defineAsyncComponent(() => import('@/views/TestPanelView.vue')))
  },
  { id: 'about', label: t('settings.sections.about'), icon: 'info', type: 'component', component: { ...PlaceholderComponent, props: { title: '关于 ComfyTavern' } } },
]);

const activeSectionId = ref(sections.value[0]?.id ?? ''); // 默认选中第一个, 如果数组为空则默认为空字符串

const activeSection = computed(() =>
  sections.value.find(s => s.id === activeSectionId.value)
);

// const themeStore = useThemeStore(); // 已提前实例化
// const isDark = computed(() => themeStore.currentAppliedMode === 'dark'); // currentAppliedMode 是 themeStore 的 getter

// 新增: 监听 authStore 中用户名的变化，并同步到 settingsStore
// 这确保了 SettingControl 能通过 settingsStore.getSetting 获取到最新的昵称
watch(
  () => currentUser.value?.username, // 使用 storeToRefs 获取的 currentUser
  (newUsername) => {
    if (newUsername !== undefined && newUsername !== settingsStore.getSetting('user.nickname', '')) {
      // console.log(`SettingsLayout: authStore.currentUser.username changed to "${newUsername}". Updating settingsStore['user.nickname'].`);
      settingsStore.updateSetting('user.nickname', newUsername);
    }
  },
  { immediate: true } // 立即执行一次，以在组件挂载后同步初始值
);
</script>

<style scoped>
.settings-layout {
  display: flex;
  flex-direction: column; /* 改为垂直布局 */
  height: 100%;
  width: 100%;
  background-color: transparent; /* 由父容器控制背景 */
  color: var(--ct-text-base);
}

.settings-nav {
  width: 100%; /* 宽度占满 */
  flex-shrink: 0;
  /* 移除下边框，胶囊样式不需要这个 */
  background-color: transparent;
  padding: 12px 0; /* 给胶囊组一些垂直方向的呼吸空间 */
  display: flex; /* 用于内部 ul 的对齐 */
  justify-content: flex-start; /* 默认靠左，可以改为 center 使胶囊居中 */
}

.settings-nav ul {
  list-style: none;
  width: auto; /* 宽度根据内容自适应 */
  padding: 4px; /* 内边距，让li元素和ul边框之间有空隙 */
  margin: 0 42px; /* 左右外边距调整为32px */
  display: inline-flex; /* 让ul根据内容自适应宽度，并可以应用padding和圆角 */
  background-color: transparent; /* 胶囊组的背景色 */
  border-radius: 8px; /* 修改为圆角矩形容器 */
  gap: 4px; /* 标签之间的间距 */
}

.settings-nav li {
  padding: 10px 20px; /* 调整内边距以适应胶囊形状 */
  cursor: pointer;
  font-size: 0.9rem; /* 可以适当减小字体 */
  display: flex;
  align-items: center;
  gap: 6px; /* 调整图标和文字间距 */
  border-radius: 8px; /* 修改为圆角矩形 */
  transition: all 0.2s ease;
  border: 1px solid transparent; /* 添加一个透明边框，防止激活时跳动 */
  /* 移除 border-bottom 和 margin-bottom */
}

.settings-nav li:hover {
  background-color: hsl(var(--ct-primary-hsl) / 0.1); /* 使用 primary 色的浅透明背景作为悬停 */
  color: hsl(var(--ct-primary-hsl)); /* 悬停时文字颜色变为 primary */
}

.settings-nav li.active {
  background-color: hsl(var(--ct-primary-hsl)); /* 激活时的背景色 */
  color: hsl(var(--ct-primary-content-hsl)); /* 激活时的文字颜色 */
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1); /* 可选：给激活的标签一点点凸起感 */
}

.settings-content {
  flex-grow: 1;
  padding: 16px 48px; /* 调整内边距, OverlayScrollbarsComponent会使用这个padding */
  /* overflow-y: auto; 由 OverlayScrollbarsComponent 控制 */
}

.section-title {
  font-size: 2rem; /* 增大标题字号 */
  font-weight: 700; /* 加粗 */
  margin-bottom: 32px; /* 增-大下外边距 */
  padding-bottom: 16px; /* 增-大下内边距 */
  border-bottom: 1px solid hsl(var(--ct-border-base-hsl)); /* 使用 CSS 变量 */
}

.placeholder-content,
.placeholder-component {
  padding: 20px;
  background-color: hsl(var(--ct-background-surface-hsl)); /* 使用 surface 背景 */
  border-radius: 8px;
  border: 1px dashed hsl(var(--ct-border-base-hsl)); /* 使用 CSS 变量 */
}
</style>