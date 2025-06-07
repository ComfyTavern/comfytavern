<template>
  <div class="settings-layout">
    <!-- 左侧导航区 -->
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

    <!-- 右侧主体内容区 -->
    <main class="settings-content">
      <template v-if="activeSection">
        <h2 class="section-title">{{ activeSection.label }}</h2>

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
  height: 100%;
  width: 100%;
  background-color: var(--ct-bg-base);
  color: var(--ct-text-base);
}

.settings-nav {
  width: 240px;
  flex-shrink: 0;
  padding: 24px 0;
  border-right: 1px solid var(--ct-border-color);
  background-color: var(--ct-bg-subtle);
}

.settings-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.settings-nav li {
  padding: 12px 24px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.settings-nav li:hover {
  background-color: var(--ct-bg-hover);
}

.settings-nav li.active {
  background-color: var(--ct-bg-active);
  color: var(--ct-text-accent);
  border-left-color: var(--ct-accent-color);
  font-weight: 600;
}

.settings-content {
  flex-grow: 1;
  padding: 24px 48px;
  overflow-y: auto;
}

.section-title {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ct-border-color);
}

.placeholder-content,
.placeholder-component {
  padding: 20px;
  background-color: var(--ct-bg-subtle);
  border-radius: 8px;
  border: 1px dashed var(--ct-border-color);
}
</style>