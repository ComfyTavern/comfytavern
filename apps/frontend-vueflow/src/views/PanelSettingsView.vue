<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-2 text-text-base">面板配置</h1>
    <p class="text-text-secondary mb-6">正在配置面板: {{ panelId }}</p>

    <WorkflowBinder :project-id="projectId" :panel-id="panelId" />
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