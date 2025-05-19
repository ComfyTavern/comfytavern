<script setup lang="ts">
import SideBar from './SideBar.vue'; // 侧边栏仍然需要
import { useProjectManagement } from '../composables/editor/useProjectManagement';
import { useThemeStore } from '../stores/theme'; // 导入 theme store

// 使用 Composable 获取项目数据和方法
const { projects, isLoading, error, createNewProject, openProject } = useProjectManagement();
const themeStore = useThemeStore(); // 获取 theme store 实例

const promptAndCreateProject = async () => {
  const projectName = window.prompt('请输入新项目的名称：');
  if (projectName && projectName.trim() !== '') {
    await createNewProject(projectName.trim());
  } else if (projectName !== null) { // 用户点击了确定但输入为空
    alert('项目名称不能为空！');
  }
  // 如果 projectName 为 null，表示用户点击了取消，不执行任何操作
};
</script>

<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900">
    <!-- 左侧边栏 -->
    <SideBar />

    <!-- 主要内容区域 -->
    <div
      class="p-4 lg:p-6 max-w-screen-2xl mx-auto transition-all duration-300 ease-in-out"
      :class="themeStore.collapsed ? 'ml-16' : 'ml-64'"
    >
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">我的项目</h1>
        <button
          @click="promptAndCreateProject"
          :disabled="isLoading"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? '创建中...' : '创建新项目' }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading && projects.length === 0" class="text-center text-gray-500 dark:text-gray-400 mt-10">
        正在加载项目...
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
        <strong class="font-bold">加载错误:</strong>
        <span class="block sm:inline"> {{ error }}</span>
      </div>

      <!-- 项目列表 -->
      <div v-if="!isLoading || projects.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="project in projects"
          :key="project.id"
          @click="openProject(project.id)"
          class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ project.name }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ project.description || '暂无描述' }}</p>
          <div class="text-xs text-gray-500 dark:text-gray-500">
            最后更新: {{ new Date(project.updatedAt).toLocaleString() }}
          </div>
        </div>
      </div>
      <div v-if="!isLoading && projects.length === 0 && !error" class="text-center text-gray-500 dark:text-gray-400 mt-10">
        还没有项目，点击右上角按钮创建一个吧！
      </div>
    </div>
  </div>
</template>

<style scoped></style>