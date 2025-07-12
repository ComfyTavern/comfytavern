<script setup lang="ts">
import type { PanelDefinition } from '@comfytavern/types';
import { DocumentTextIcon, PhotoIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  item: PanelDefinition;
}>();

const emit = defineEmits<{
  (e: 'select', item: PanelDefinition): void;
}>();

function handleClick() {
  emit('select', props.item);
}
</script>

<template>
  <div
    class="border border-border-base rounded-lg bg-background-surface text-text-base cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary overflow-hidden flex flex-col h-full"
    @click="handleClick"
  >
    <div class="flex flex-col flex-grow">
      <!-- Screenshot Placeholder -->
      <div class="relative w-full aspect-video bg-muted flex flex-col justify-center items-center text-text-muted text-sm">
        <PhotoIcon class="w-12 h-12 mb-2 opacity-60" />
        <span>暂无截图</span>
      </div>

      <!-- Info Section -->
      <div class="p-4 flex flex-col flex-grow">
        <div class="flex items-center gap-3 mb-3">
          <DocumentTextIcon class="w-6 h-6 text-primary flex-shrink-0" />
          <h3 class="text-lg font-semibold truncate" :title="item.displayName">{{ item.displayName }}</h3>
        </div>
        <p class="text-sm text-text-muted flex-grow line-clamp-3" :title="item.description">
          {{ item.description }}
        </p>
      </div>

      <!-- Actions Slot -->
      <div v-if="$slots.actions" class="border-t border-border-base p-3 bg-muted/20 mt-auto">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* line-clamp is a standard tailwind utility, but sometimes requires this for full browser compatibility */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>