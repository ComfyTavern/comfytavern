import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '../../stores/projectStore';
import type { ProjectMetadata } from '@comfytavern/types';
import { useDialogService } from '../../services/DialogService'; // 导入 DialogService

export function useProjectManagement() {
  const router = useRouter();
  const projectStore = useProjectStore();
  const dialogService = useDialogService(); // 获取 DialogService 实例

  const projects = ref<ProjectMetadata[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 加载项目列表
  const fetchProjects = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      await projectStore.fetchAvailableProjects();
      projects.value = projectStore.availableProjects;
    } catch (err) {
      console.error('加载项目列表失败:', err);
      error.value = `加载项目列表失败: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      isLoading.value = false;
    }
  };

  // 创建新项目并导航
  const createNewProject = async (projectName: string) => {
    if (!projectName || projectName.trim() === '') {
      console.error('项目名称不能为空');
      error.value = '项目名称不能为空。';
      dialogService.showError(error.value); // 替换 alert
      return; // 提前返回，不执行后续操作
    }
    isLoading.value = true; // 可以添加一个全局加载状态或按钮加载状态
    error.value = null;
    try {
      // 将项目名称传递给 store action
      const newProject = await projectStore.createProject({ name: projectName });
      if (newProject) {
        // 导航到新项目的根页面
        router.push({ name: 'ProjectRoot', params: { projectId: newProject.id } });
      } else {
        console.error('创建新项目失败');
        error.value = '创建新项目失败，请检查后端服务或联系管理员。';
        dialogService.showError(error.value); // 替换 alert
      }
    } catch (err) {
      console.error('创建新项目时出错:', err);
      error.value = `创建新项目时出错: ${err instanceof Error ? err.message : String(err)}`;
      dialogService.showError(error.value); // 替换 alert
    } finally {
      isLoading.value = false;
    }
  };

  // 打开现有项目
  const openProject = (projectId: string) => {
    router.push({ name: 'ProjectRoot', params: { projectId } });
  };

  // 在 Composable 挂载时自动加载项目
  onMounted(fetchProjects);

  return {
    projects,
    isLoading,
    error,
    fetchProjects, // 也可暴露给外部手动刷新
    createNewProject,
    openProject,
  };
}