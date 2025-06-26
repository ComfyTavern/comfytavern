<script setup lang="ts">
// import SideBar from './SideBar.vue'; // 侧边栏由 HomeLayout 提供
import { useProjectManagement } from '../../composables/editor/useProjectManagement';
import { useThemeStore } from '../../stores/theme'; // 导入 theme store
import { computed } from 'vue';
import { useDialogService } from '../../services/DialogService'; // 导入 DialogService
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";
import { useI18n } from 'vue-i18n';

// 使用 Composable 获取项目数据和方法
const { projects, isLoading, error, createNewProject, openProject } = useProjectManagement();
const themeStore = useThemeStore(); // 获取 theme store 实例
const dialogService = useDialogService(); // 获取 DialogService 实例
const { t } = useI18n();
const isDark = computed(() => themeStore.currentAppliedMode === 'dark');

const promptAndCreateProject = async () => {
  const projectName = await dialogService.showInput({
    title: t('projects.createDialog.title'),
    message: t('projects.createDialog.message'),
    inputPlaceholder: t('projects.createDialog.placeholder')
  });

  // 用户点击了取消或关闭对话框
  if (projectName === null) {
    return;
  }

  const trimmedProjectName = projectName.trim();
  if (trimmedProjectName !== '') {
    await createNewProject(trimmedProjectName);
  } else {
    // 用户点击了确定但输入为空或只包含空格
    dialogService.showError(t('projects.errors.nameRequired'));
  }
};
</script>

<template>
  <div class="min-h-screen bg-background-base">
    <!-- 左侧边栏 由 HomeLayout 提供 -->
    <!-- <SideBar /> -->

    <!-- 主要内容区域, HomeLayout 会处理 padding-left -->
    <div class="p-4 lg:p-6 max-w-screen-2xl mx-auto transition-all duration-300 ease-in-out">
      <!-- :class="themeStore.collapsed ? 'ml-16' : 'ml-64'" REMOVED -->
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-text-base">{{ t('projects.title') }}</h1>
        <button @click="promptAndCreateProject" :disabled="isLoading"
          class="px-4 py-2 bg-primary text-primary-content rounded hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {{ isLoading ? t('projects.creating') : t('projects.createNew') }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading && projects.length === 0" class="text-center text-text-muted mt-10">
        {{ t('projects.loading') }}
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="bg-error-softest border border-error-soft text-error px-4 py-3 rounded relative mb-6"
        role="alert">
        <strong class="font-bold">{{ t('projects.loadError') }}</strong>
        <span class="block sm:inline"> {{ error }}</span>
      </div>

      <!-- 项目列表 -->
      <OverlayScrollbarsComponent :options="{
        scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
      }" class="h-[90vh]" defer>
        <div v-if="!isLoading || projects.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="project in projects" :key="project.id" @click="openProject(project.id)"
            class="bg-background-surface rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow">
            <h2 class="text-lg font-semibold text-text-base mb-2">{{ project.name }}</h2>
            <p class="text-sm text-text-secondary mb-3">{{ project.description || t('projects.noDescription') }}</p>
            <div class="text-xs text-text-muted">
              {{ t('projects.lastUpdated') }}: {{ new Date(project.updatedAt).toLocaleString() }}
            </div>
          </div>
        </div>
        <div v-if="!isLoading && projects.length === 0 && !error"
          class="text-center text-text-muted mt-10">
          {{ t('projects.noProjects') }}
        </div>
      </OverlayScrollbarsComponent>
    </div>
  </div>
</template>

<style scoped></style>