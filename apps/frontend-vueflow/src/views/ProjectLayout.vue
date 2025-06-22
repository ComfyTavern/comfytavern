<template>
  <div class="project-layout flex flex-col h-screen bg-background-base">
    <header class="flex-shrink-0 bg-background-surface">
      <nav class="flex items-end px-4 border-b border-border-base">
        <router-link :to="{ name: 'home' }" class="text-lg font-semibold text-text-base px-2 py-1 rounded-md hover:bg-background-muted transition-colors mb-1 mr-4">
          返回首页
        </router-link>
        
        <router-link :to="{ name: 'ProjectDashboard', params: { projectId: $route.params.projectId } }" custom v-slot="{ navigate, isActive }">
          <a @click="navigate" :class="['px-4 py-2 rounded-t-lg text-lg font-medium cursor-pointer transition-colors -mr-px', isActive ? 'bg-background-base text-text-base border-t border-x border-border-base -mb-px z-10' : 'text-text-secondary hover:bg-primary-softest border-t border-x border-transparent']">
            总览
          </a>
        </router-link>
        <router-link :to="{ name: 'ProjectEditor', params: { projectId: $route.params.projectId } }" custom v-slot="{ navigate, isActive }">
          <a @click="navigate" :class="['px-4 py-2 rounded-t-lg text-lg font-medium cursor-pointer transition-colors -mr-px', isActive ? 'bg-background-base text-text-base border-t border-x border-border-base -mb-px z-10' : 'text-text-secondary hover:bg-primary-softest border-t border-x border-transparent']">
            编辑器
          </a>
        </router-link>
        <!-- 未来可以添加更多视图的链接 -->
      </nav>
    </header>
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// import { useProjectStore } from '@/stores/projectStore';

// const projectStore = useProjectStore();
</script>

<style scoped>
</style>