<template>
  <div class="p-8 flex flex-col h-full">
    <div class="flex items-baseline flex-wrap gap-x-4 flex-shrink-0 mb-6">
      <h1 class="text-2xl font-bold text-text-base">面板配置</h1>
      <p class="text-text-secondary">正在配置面板: {{ panelId }}</p>
    </div>

    <div class="flex-grow min-h-0">
      <WorkflowBinder :project-id="projectId" :panel-id="panelId" class="h-full"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import WorkflowBinder from '@/components/panel/WorkflowBinder.vue';

const route = useRoute();

const projectId = computed(() => route.params.projectId as string);
const panelId = computed(() => route.params.panelId as string);
</script>