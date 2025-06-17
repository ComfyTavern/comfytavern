<template>
  <div class="min-h-screen bg-background-base">
    <!-- 主要内容区域 -->
    <OverlayScrollbarsComponent
      :options="{
        scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
      }"
      class="h-screen"
      defer
    >
      <div class="p-6 lg:p-8 max-w-screen-2xl mx-auto transition-all duration-300 ease-in-out">
        <!-- :class="themeStore.collapsed ? 'ml-16' : 'ml-64'" REMOVED -->
      <h1
        class="text-5xl font-bold text-center mb-8 pb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
        欢迎使用 ComfyTavern
      </h1>
      <p class="text-xl text-center text-gray-600 dark:text-gray-300 mb-10">
        管理您的工作流项目和角色卡，释放创造力。
      </p>

      <div class="grid grid-cols-1 gap-8">
        <!-- 项目预览区 -->
        <div class="bg-background-surface rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-primary-content mb-4">最近项目</h2>
          <div>
            <div v-if="isLoading" class="text-center text-gray-500 dark:text-gray-400">
              正在加载项目...
            </div>
            <div v-else-if="error" class="text-center text-red-500 dark:text-red-400">
              加载项目失败: {{ error }}
            </div>
            <div v-else-if="recentProjects.length === 0" class="text-center text-gray-500 dark:text-gray-400">
              还没有项目。
              <router-link to="/home/projects" class="text-blue-500 hover:underline ml-2">创建新项目</router-link>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div v-for="project in recentProjects" :key="project.id"
                class="bg-background-surface p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                @click="openProject(project.id)">
                <h3 class="font-semibold text-lg text-gray-900 dark:text-primary-content mb-2 truncate">{{ project.name }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  最后修改: {{ formatDate(project.updatedAt) }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {{ project.description || '暂无描述' }}
                </p>
              </div>
            </div>
            <router-link to="/home/projects"
              class="text-blue-500 hover:underline mt-4 inline-block float-right">查看所有项目</router-link>
          </div>
        </div>

        <!-- 角色卡预览区 -->
        <div class="bg-background-surface rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-primary-content mb-4">角色卡概览</h2>
          <div>
            <CharacterCardPreview />
          </div>
        </div>
      </div>

      <!-- 其他可能的欢迎信息或快速入口 -->
      <div class="mt-10 text-center text-gray-500 dark:text-gray-400">
        <p>探索侧边栏以开始您的创作之旅。</p>
      </div>

      </div>
    </OverlayScrollbarsComponent>
  </div>
</template>

<script setup lang="ts">
import CharacterCardPreview from '../components/CharacterCardPreview.vue';
import { useThemeStore } from '../stores/theme'; // 导入 theme store
import { useProjectManagement } from '../composables/editor/useProjectManagement';
import { computed } from 'vue';
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";

const themeStore = useThemeStore(); // 获取 theme store 实例
const isDark = computed(() => themeStore.currentAppliedMode === 'dark');
const { projects, isLoading, error, openProject } = useProjectManagement();

// 计算属性，获取最近修改的最多 6 个项目
const recentProjects = computed(() => {
  // 确保 projects.value 是数组
  const projs = Array.isArray(projects.value) ? projects.value : [];
  return [...projs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);
});

// 格式化日期
const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    return '无效日期';
  }
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
</script>

<style scoped>
/* 可以根据需要添加样式 */
</style>
