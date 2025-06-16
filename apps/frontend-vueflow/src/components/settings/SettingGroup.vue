<template>
  <section class="setting-group">
    <h3 v-if="title" class="group-title">{{ title }}</h3>
    <div class="group-content">
      <slot /> <!-- 渲染传入的 SettingItemRow -->
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<style scoped>
.setting-group {
  padding: 8px 16px; /* 增加内边距 */
  border-radius: 12px; /* 增加圆角 */
  background-color: var(--ct-background-surface); /* 使用标准主题变量 */
  border: 1px solid var(--ct-border-base); /* 使用标准主题变量 */
}

.setting-group:has(h3) {
  padding-top: 20px; /* 相应调整 */
}

.group-title {
  font-size: 1.5rem; /* 增大字号 */
  font-weight: 600;
  margin-bottom: 16px; /* 增加下外边距 */
  padding-bottom: 6px; /* 增加下内边距 */
  border-bottom: 1px solid var(--ct-border-base); /* 使用标准主题变量 */
  color: var(--ct-text-base); /* 确保标题颜色 */
}

.group-content {
  display: flex;
  flex-direction: column;
  gap: 12px; /* 调整设置项之间的垂直间距，使其更紧凑 */
}
</style>