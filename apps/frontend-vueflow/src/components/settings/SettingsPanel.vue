<template>
  <div class="settings-panel">
    <!-- 按 categoryKey 分组渲染，保持顺序稳定 -->
    <SettingGroup v-for="(group, key) in groupedConfig" :key="key" :title="group.title">
      <SettingItemRow v-for="item in group.items" :key="item.key" :item-config="item" />
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

interface GroupedSettings {
  title: string;
  items: SettingItemConfig[];
}

// 计算属性: 将 config 数组按 categoryKey 转换成 Record<string, GroupedSettings>
// 这样可以保证分组和排序的稳定性，不受语言切换影响
const groupedConfig = computed(() => {
  const groups: Record<string, GroupedSettings> = {};

  for (const item of props.config) {
    const key = item.categoryKey || 'default';
    const title = item.category || ''; // 显示的标题

    if (!groups[key]) {
      groups[key] = { title: title, items: [] };
    }
    // 确保标题是最新的 (虽然在同一分组内应该是一样的)
    groups[key].title = title;
    groups[key].items.push(item);
  }

  // 按照 props.config 中 categoryKey 出现的顺序进行排序
  // 这样就实现了“按照条目在配置中的顺序”
  const categoryKeyOrder: string[] = [];
  for (const item of props.config) {
    const key = item.categoryKey || 'default';
    if (!categoryKeyOrder.includes(key)) {
      categoryKeyOrder.push(key);
    }
  }

  const orderedGroups: Record<string, GroupedSettings> = {};
  for (const key of categoryKeyOrder) {
    if (groups[key]) {
      orderedGroups[key] = groups[key];
    }
  }

  return orderedGroups;
});
</script>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  /* 组之间的间距 */
}

.setting-item-row-like {
  /* 模拟 SettingItemRow 的一些基本布局，如果需要的话 */
  /* 或者直接在 SettingGroup 内自定义布局 */
  padding: 8px 0;
  /* 上下留出一些空间 */
}

.mt-4 {
  /* 简单的 margin-top 工具类 */
  margin-top: 1rem;
  /* 16px */
}
</style>