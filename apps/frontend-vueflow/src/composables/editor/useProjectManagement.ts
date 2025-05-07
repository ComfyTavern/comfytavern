import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '../../stores/projectStore';
import type { ProjectMetadata } from '@comfytavern/types';

export function useProjectManagement() {
  const router = useRouter();
  const projectStore = useProjectStore();

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
  const createNewProject = async () => {
    isLoading.value = true; // 可以添加一个全局加载状态或按钮加载状态
    error.value = null;
    try {
      const newProject = await projectStore.createProject();
      if (newProject) {
        // 导航到新项目的编辑器页面
        router.push({ name: 'Editor', params: { projectId: newProject.id } });
      } else {
        console.error('创建新项目失败');
        error.value = '创建新项目失败，请检查后端服务或联系管理员。';
        alert(error.value); // 临时用 alert 提示
      }
    } catch (err) {
      console.error('创建新项目时出错:', err);
      error.value = `创建新项目时出错: ${err instanceof Error ? err.message : String(err)}`;
      alert(error.value); // 临时用 alert 提示
    } finally {
      isLoading.value = false;
    }
  };

  // 打开现有项目
  const openProject = (projectId: string) => {
    router.push({ name: 'Editor', params: { projectId } });
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