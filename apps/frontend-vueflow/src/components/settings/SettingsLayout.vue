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
          <span>{{ section.label }}</span>
        </li>
      </ul>
    </nav>

    <!-- 主体内容区 -->
    <main class="settings-content">
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent } from 'vue';
import type { SettingsSection, SettingItemConfig } from '@/types/settings';
import SettingsPanel from './SettingsPanel.vue';

// --- 占位符组件 ---
// 后续这些将被替换为真实的自定义组件
const PlaceholderComponent = defineComponent({
  props: { title: String },
  template: `<div class="placeholder-component"><h3>{{ title }}</h3><p>这里将来是一个自定义的复杂配置模块，目前正在施工中... 咕~</p></div>`,
});


// === 定义所有设置分区 ===

// 1. 数据驱动的配置示例
const userSettingsConfig: SettingItemConfig[] = [
  { key: 'user.nickname', type: 'string', label: '昵称', description: '您在平台中显示的名称。', defaultValue: '姐姐', category: '基础信息' },
  { key: 'user.avatar', type: 'string', label: '头像URL', description: '一个指向您头像图片的链接。', defaultValue: '', category: '基础信息' },
];

const displaySettingsConfig: SettingItemConfig[] = [
  { key: 'display.theme', type: 'select', label: '主题', defaultValue: 'auto', options: [{label:'浅色', value:'light'}, {label:'深色', value:'dark'}, {label:'跟随系统', value:'auto'}], category: '外观' },
  { key: 'display.fontSize', type: 'number', label: '基础字体大小 (px)', defaultValue: 14, min: 12, max: 20, category: '外观' },
  { key: 'display.showMinimap', type: 'boolean', label: '显示编辑器小地图', defaultValue: true, category: '编辑器' },
  { key: 'display.showConnectionStatus', type: 'boolean', label: '显示后端连接状态', defaultValue: true, category: '界面元素' },
];

const mcpSettingsConfig: SettingItemConfig[] = [
    { key: 'mcp.autoConnect', type: 'boolean', label: '自动连接MCP服务器', defaultValue: true, description: '启动时自动连接已配置的MCP服务器。' },
    { key: 'mcp.defaultTimeout', type: 'number', label: '默认超时 (ms)', defaultValue: 30000, description: '与MCP服务器通信的默认超时时间。' },
];

// 2. 组装所有 Section
const sections = ref<SettingsSection[]>([
  { id: 'display', label: '显示设置', icon: 'screen', type: 'data-driven', dataConfig: displaySettingsConfig },
  { id: 'user', label: '用户设置', icon: 'user', type: 'data-driven', dataConfig: userSettingsConfig },
  { id: 'keybindings', label: '快捷键', icon: 'keyboard', type: 'component', component: { ...PlaceholderComponent, props: { title: '快捷键编辑器' } } },
  { id: 'llm', label: '模型配置', icon: 'brain', type: 'component', component: { ...PlaceholderComponent, props: { title: 'LLM API 管理器' } } },
  { id: 'mcp', label: 'MCP', icon: 'protocol', type: 'data-driven', dataConfig: mcpSettingsConfig },
  { id: 'about', label: '关于', icon: 'info', type: 'component', component: { ...PlaceholderComponent, props: { title: '关于 ComfyTavern' } } },
]);

const activeSectionId = ref(sections.value[0]?.id ?? ''); // 默认选中第一个, 如果数组为空则默认为空字符串

const activeSection = computed(() =>
  sections.value.find(s => s.id === activeSectionId.value)
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
  border-bottom: 1px solid var(--ct-border-color); /* 从右边框改为下边框 */
  background-color: transparent;
}

.settings-nav ul {
  list-style: none;
  padding: 0 32px; /* 左右留出边距 */
  margin: 0;
  display: flex; /* 横向排列 */
  gap: 8px; /* 标签间距 */
}

.settings-nav li {
  padding: 14px 20px; /* 调整内边距以适应标签页 */
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 8px; /* 缩小图标和文字间距 */
  border-bottom: 3px solid transparent; /* 从左边框改为下边框 */
  margin-bottom: -1px; /* 巧妙地让边框与父元素的下边框重合 */
  transition: all 0.2s ease;
}

.settings-nav li:hover {
  background-color: var(--ct-bg-hover);
  color: var(--ct-text-accent);
}

.settings-nav li.active {
  background-color: var(--ct-bg-hover);
  color: var(--ct-text-accent);
  border-bottom-color: var(--ct-accent-color); /* 激活时下边框高亮 */
  font-weight: 600;
}

.settings-content {
  flex-grow: 1;
  padding: 32px 48px; /* 调整内边距 */
  overflow-y: auto;
}

.section-title {
  font-size: 2rem; /* 增大标题字号 */
  font-weight: 700; /* 加粗 */
  margin-bottom: 32px; /* 增-大下外边距 */
  padding-bottom: 16px; /* 增-大下内边距 */
  border-bottom: 1px solid var(--ct-border-color);
}

.placeholder-content,
.placeholder-component {
  padding: 20px;
  background-color: var(--ct-bg-hover);
  border-radius: 8px;
  border: 1px dashed var(--ct-border-color);
}
</style>