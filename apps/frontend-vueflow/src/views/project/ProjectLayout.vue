<template>
  <div class="project-layout flex flex-col h-screen bg-background-base">
    <header class="flex-shrink-0 bg-background-surface">
      <nav class="flex items-end px-4 border-b border-border-base">
        <div class="flex items-center mb-1 mr-4 space-x-2">
          <router-link
            v-comfy-tooltip="'首页'"
            :to="{ name: 'home' }"
            class="p-2 rounded-md hover:bg-background-muted transition-colors"
          >
            <HomeIcon class="w-5 h-5 text-text-base" />
          </router-link>
          <router-link
            v-comfy-tooltip="'项目列表'"
            :to="{ name: 'projects' }"
            class="p-2 rounded-md hover:bg-background-muted transition-colors"
          >
            <RectangleStackIcon class="w-5 h-5 text-text-base" />
          </router-link>
        </div>
        
        <router-link :to="{ name: 'ProjectDashboard', params: { projectId: $route.params.projectId } }" custom v-slot="{ navigate, isActive }">
          <a @click="navigate" :class="['px-4 py-2 rounded-t-lg text-lg font-medium cursor-pointer transition-colors mr-1', isActive ? 'bg-background-base text-text-base border-t border-x border-border-base -mb-px z-10' : 'text-text-secondary hover:bg-primary-softest border-t border-x border-transparent']">
            总览
          </a>
        </router-link>
        <router-link :to="{ name: 'ProjectEditor', params: { projectId: $route.params.projectId } }" custom v-slot="{ navigate, isActive }">
          <a @click="navigate" :class="['px-4 py-2 rounded-t-lg text-lg font-medium cursor-pointer transition-colors mr-1', isActive ? 'bg-background-base text-text-base border-t border-x border-border-base -mb-px z-10' : 'text-text-secondary hover:bg-primary-softest border-t border-x border-transparent']">
            工作流编辑器
          </a>
        </router-link>
        <router-link :to="{ name: 'ProjectPanels', params: { projectId: $route.params.projectId } }" custom v-slot="{ navigate, isActive }">
          <a @click="navigate" :class="['px-4 py-2 rounded-t-lg text-lg font-medium cursor-pointer transition-colors mr-1', (isActive || $route.name?.toString().startsWith('ProjectPanel')) ? 'bg-background-base text-text-base border-t border-x border-border-base -mb-px z-10' : 'text-text-secondary hover:bg-primary-softest border-t border-x border-transparent']">
            应用面板
          </a>
        </router-link>
        <router-link :to="{ name: 'ProjectSettings', params: { projectId: $route.params.projectId } }" custom v-slot="{ navigate, isActive }">
          <a @click="navigate" :class="['px-4 py-2 rounded-t-lg text-lg font-medium cursor-pointer transition-colors mr-1', isActive ? 'bg-background-base text-text-base border-t border-x border-border-base -mb-px z-10' : 'text-text-secondary hover:bg-primary-softest border-t border-x border-transparent']">
            项目设置
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
import { HomeIcon, RectangleStackIcon } from '@heroicons/vue/24/outline';
// const projectStore = useProjectStore();
</script>

<style scoped>
</style>