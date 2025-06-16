<template>
  <div class="settings-panel">
    <!-- 按 category 分组渲染 -->
    <SettingGroup
      v-for="(items, categoryName) in groupedConfig"
      :key="categoryName"
      :title="categoryName === 'default' ? '' : categoryName"
    >
      <SettingItemRow
        v-for="item in items"
        :key="item.key"
        :item-config="item"
      />
    </SettingGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SettingItemConfig } from '@/types/settings';
import SettingGroup from './SettingGroup.vue';
import SettingItemRow from './SettingItemRow.vue';

const props = defineProps<{
  config: SettingItemConfig[];
}>();

// 计算属性: 将 config 数组按 category 转换成 Record<string, SettingItemConfig[]>
const groupedConfig = computed(() => {
  const groups: Record<string, SettingItemConfig[]> = {};
  for (const item of props.config) {
    const category = item.category || 'default'; // 没有分类的放默认组
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
  }
  // 可以在这里对 groups 的 key 进行排序，保证显示顺序固定
  // 例如，可以定义一个期望的顺序数组
  const orderedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'default') return -1; // 'default' 组总是在最前
    if (b === 'default') return 1;
    return a.localeCompare(b); // 其他按字母顺序
  });

  const orderedGroups: Record<string, SettingItemConfig[]> = {};
  for (const key of orderedKeys) {
    orderedGroups[key] = groups[key]!; // 使用非空断言，因为 key 来自 groups 的 keys，所以值必然存在
  }

  return orderedGroups;
});
</script>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 24px; /* 组之间的间距 */
}

.setting-item-row-like {
  /* 模拟 SettingItemRow 的一些基本布局，如果需要的话 */
  /* 或者直接在 SettingGroup 内自定义布局 */
  padding: 8px 0; /* 上下留出一些空间 */
}

.mt-4 { /* 简单的 margin-top 工具类 */
  margin-top: 1rem; /* 16px */
}
</style>