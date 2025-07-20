<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useDialogService } from '@/services/DialogService';
import { useProjectStore } from '@/stores/projectStore';
import type { ProjectMetadata, SortConfig, ColumnDefinition } from '@comfytavern/types';
import DataListView from '@/components/data-list/DataListView.vue';

const router = useRouter();
const { t } = useI18n();
const dialogService = useDialogService();
const projectStore = useProjectStore();

// 使用更稳健的 ref 类型定义
const dataListViewRef = ref<{ refresh: () => void } | null>(null);

// 1. 定义 fetcher 函数
const projectFetcher = async (params: { sort?: SortConfig<ProjectMetadata> }) => {
  // 调用正确的 store action
  await projectStore.fetchAvailableProjects();
  // 从正确的 store state 获取数据
  const projects = [...projectStore.availableProjects];

  // 客户端排序
  if (params.sort) {
    const { field, direction } = params.sort;
    projects.sort((a, b) => {
      const valA = a[field as keyof ProjectMetadata];
      const valB = b[field as keyof ProjectMetadata];

      // 处理 null/undefined 值，将它们排在最后
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      const comparison = valA < valB ? -1 : valA > valB ? 1 : 0;
      return direction === 'asc' ? comparison : -comparison;
    });
  }
  return projects;
};

// 2. 定义排序选项
const sortOptions = [
  { label: t('projects.sort.byName'), field: 'name' },
  { label: t('projects.sort.byDate'), field: 'updatedAt' },
];

// 2.5. 定义列表视图的列
const columns: ColumnDefinition<ProjectMetadata>[] = [
  { key: 'name', label: t('common.name'), sortable: true, width: '30%' },
  { key: 'description', label: t('common.description'), sortable: false, width: '45%' },
  { key: 'updatedAt', label: t('projects.lastUpdated'), sortable: true, width: '25%' },
];

// 3. 定义操作方法
const openProject = (project: ProjectMetadata) => {
  router.push({ name: 'ProjectDashboard', params: { projectId: project.id } });
};

const selectedProjects = ref<ProjectMetadata[]>([]);

const handleSelectionChange = (items: ProjectMetadata[]) => {
  selectedProjects.value = items;
};

const bulkDeleteProjects = async () => {
  if (selectedProjects.value.length === 0) return;

  const confirmed = await dialogService.showConfirm({
    title: t('projects.bulkDeleteDialog.title'),
    message: t('projects.bulkDeleteDialog.message', { count: selectedProjects.value.length }),
    dangerConfirm: true,
    confirmText: t('common.delete'),
  });

  if (confirmed) {
    try {
      await Promise.all(selectedProjects.value.map(p => projectStore.deleteProject(p.id)));
      dialogService.showSuccess(t('projects.deleteSuccess'));
      dataListViewRef.value?.refresh();
      selectedProjects.value = []; // 清空选项
    } catch (error: any) {
      dialogService.showError(error.message || t('projects.errors.deleteFailed'));
    }
  }
};

const promptAndCreateProject = async () => {
  const formValues = await dialogService.showForm({
    title: t('projects.createDialog.title'),
    fields: [
      {
        key: 'name',
        label: t('common.name'),
        type: 'text',
        placeholder: t('projects.createDialog.placeholder'),
        required: true,
      },
      {
        key: 'description',
        label: t('common.description'),
        type: 'textarea',
        placeholder: t('projects.createDialog.descriptionPlaceholder'),
        rows: 3,
      },
    ],
  });

  if (!formValues) return; // 用户取消

  const trimmedProjectName = formValues.name?.trim();
  if (trimmedProjectName) {
    try {
      await projectStore.createProject({
        name: trimmedProjectName,
        description: formValues.description?.trim() || '',
      });
      dataListViewRef.value?.refresh();
      dialogService.showSuccess(t('projects.createSuccess'));
    } catch (error: any) {
      dialogService.showError(error.message || t('projects.errors.createFailed'));
    }
  } else {
    dialogService.showError(t('projects.errors.nameRequired'));
  }
};
</script>
<template>
  <div class="h-full flex flex-col bg-background-base">
    <div class="flex-1 overflow-auto px-6">
      <DataListView ref="dataListViewRef" view-id="project-list" :fetcher="projectFetcher" :sort-options="sortOptions"
        :columns="columns" :initial-sort="{ field: 'updatedAt', direction: 'desc' }" item-key="id"
        @item-dblclick="openProject"
        grid-class="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
        :loading-message="t('projects.loading')" :empty-message="t('projects.noProjects')"
        :error-message="t('projects.loadError')"
        :selectable="true"
        @selection-change="handleSelectionChange"
      >
        <template #header>
          <div class="pt-4 pb-2 flex justify-between items-center">
            <h1 class="text-2xl font-bold text-text-base">{{ t('projects.title') }}</h1>
            <button @click="promptAndCreateProject"
              class="px-4 py-2 bg-primary text-primary-content rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
              {{ t('projects.createNew') }}
            </button>
          </div>
          <div class="border-t border-border-base opacity-60"></div>
        </template>

        <template #toolbar-actions="{ selectedItems }">
          <button
            v-if="selectedItems.length > 0"
            @click="bulkDeleteProjects"
            class="px-3 py-1.5 bg-error text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ t('projects.deleteSelected', { count: selectedItems.length }) }}
          </button>
        </template>

        <template #grid-item="{ item, isSelected }">
          <div class="bg-background-surface rounded-lg shadow p-4 h-full flex flex-col cursor-pointer" :class="{'ring-2 ring-primary': isSelected}">
            <h2 class="text-lg font-semibold text-text-base mb-2 truncate">{{ item.name }}</h2>
            <p class="text-sm text-text-secondary mb-3 flex-grow">{{ item.description || t('projects.noDescription') }}
            </p>
            <div class="text-xs text-text-muted mt-auto">
              {{ t('projects.lastUpdated') }}: {{ new Date(item.updatedAt).toLocaleString() }}
            </div>
          </div>
        </template>

        <template #list-item="{ item }">
          <td class="px-3 py-2.5 text-text-base font-medium whitespace-nowrap cursor-pointer">
            {{ item.name }}
          </td>
          <td class="px-3 py-2.5 text-text-secondary truncate max-w-sm cursor-pointer">
            {{ item.description || t('projects.noDescription') }}
          </td>
          <td class="px-3 py-2.5 text-text-muted whitespace-nowrap cursor-pointer">
            {{ new Date(item.updatedAt).toLocaleString() }}
          </td>
        </template>
      </DataListView>
    </div>
  </div>
</template>

<style scoped>
/* 样式可以保持为空，因为我们已经在模板中处理了所有样式 */
</style>