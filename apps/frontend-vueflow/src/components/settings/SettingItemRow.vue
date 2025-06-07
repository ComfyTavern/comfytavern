<template>
  <div class="setting-item-row">
    <div class="label-area">
      <label :for="itemConfig.key" class="item-label">{{ itemConfig.label }}</label>
      <p v-if="itemConfig.description" class="item-description">{{ itemConfig.description }}</p>
    </div>
    <div class="control-area">
      <!-- 核心: 渲染动态控件 -->
      <SettingControl :item-config="itemConfig" />
    </div>
    <!--
    <div class="action-area">
      <button @click="resetToDefault" title="恢复默认值">
        <Icon name="rotate-2" />
      </button>
    </div>
    -->
  </div>
</template>

<script setup lang="ts">
import type { SettingItemConfig } from '@/types/settings';
import SettingControl from './SettingControl.vue';
// import { useSettingsStore } from '@/stores/settingsStore';

defineProps<{
  itemConfig: SettingItemConfig;
}>();

// const settingsStore = useSettingsStore();
// const resetToDefault = () => {
//   settingsStore.updateSetting(props.itemConfig.key, props.itemConfig.defaultValue);
// };
</script>

<style scoped>
.setting-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--ct-border-color-light);
}

.setting-group .setting-item-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.setting-group .setting-item-row:first-child {
  padding-top: 0;
}


.label-area {
  flex: 1;
  padding-right: 24px;
}

.item-label {
  font-size: 1rem;
  font-weight: 500;
  color: var(--ct-text-base);
}

.item-description {
  font-size: 0.875rem;
  color: var(--ct-text-muted);
  margin-top: 4px;
}

.control-area {
  flex-shrink: 0;
  min-width: 250px; /* 给控件一个最小宽度 */
  display: flex;
  justify-content: flex-end;
}

/*
.action-area {
  padding-left: 16px;
}
*/
</style>