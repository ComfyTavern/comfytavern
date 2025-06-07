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
  padding: 24px;
  border-radius: 8px;
  background-color: var(--ct-bg-subtle);
  border: 1px solid var(--ct-border-color);
}

.setting-group:has(h3) {
  padding-top: 16px;
}

.group-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ct-border-color-light);
}

.group-content {
  display: flex;
  flex-direction: column;
  gap: 16px; /* 设置项之间的垂直间距 */
}
</style>