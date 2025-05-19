import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ProjectMetadata } from '@comfytavern/types';
import { ProjectMetadataSchema } from '@comfytavern/types'; // 导入 Zod schema
import { useApi } from '@/utils/api'; // 导入 useApi，它应该包含 get 和 post 方法

export const useProjectStore = defineStore('project', () => {
  const currentProjectId = ref<string | null>(null);
  const currentProjectMetadata = ref<ProjectMetadata | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const availableProjects = ref<ProjectMetadata[]>([]); // 新增：存储项目列表
  const { get, post } = useApi(); // 获取封装的 get 和 post 方法

  async function loadProject(projectId: string): Promise<boolean> { // Return a promise indicating success/failure
    if (!projectId) {
      console.error('Project ID cannot be empty.');
      error.value = 'Project ID cannot be empty.';
      currentProjectId.value = null;
      currentProjectMetadata.value = null;
      return Promise.resolve(false); // Return a resolved promise with false
    }

    isLoading.value = true;
    error.value = null;
    currentProjectMetadata.value = null; // 清空旧数据

    try {
      console.debug(`Attempting to load project metadata for ID: ${projectId}`);
      // 使用封装的 get 方法，它会自动处理 baseURL
      const data = await get<ProjectMetadata>(`/projects/${encodeURIComponent(projectId)}/metadata`);
      // axios 在状态码非 2xx 时会抛出错误，所以不需要手动检查 response.ok

      // axios 自动解析 JSON，data 就是解析后的对象
      // console.debug('Received project metadata:', data);

      // 使用 Zod 验证数据
      const validationResult = ProjectMetadataSchema.safeParse(data);
      if (!validationResult.success) {
        console.error('Project metadata validation failed:', validationResult.error.flatten());
        throw new Error('Invalid project metadata received from server.');
      }

      // 验证成功，更新 store
      currentProjectId.value = projectId; // 使用传入的 ID
      currentProjectMetadata.value = validationResult.data;
      console.info('Project metadata loaded and validated successfully:', currentProjectMetadata.value); // 改为 info

      // Return true on success
      return true;

    } catch (err: any) { // axios 错误对象可能包含 response
      console.error('Failed to load project metadata:', err.response?.data || err.message || err);
      error.value = err.response?.data?.error || err.message || 'An unknown error occurred while loading project metadata.';
      currentProjectId.value = null; // 出错时重置 ID
      currentProjectMetadata.value = null;
      // Return false on error
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // 新增：获取项目列表
  async function fetchAvailableProjects(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await get<ProjectMetadata[]>('/projects'); // 调用 GET /api/projects
      // 可以在这里添加 Zod 验证，如果需要的话，例如使用 z.array(ProjectMetadataSchema)
      availableProjects.value = data;
      console.debug('Available projects loaded:', availableProjects.value);
    } catch (err: any) {
      console.error('Failed to load available projects:', err.response?.data || err.message || err);
      error.value = err.response?.data?.error || err.message || 'An unknown error occurred while loading projects.';
      availableProjects.value = []; // 出错时清空列表
    } finally {
      isLoading.value = false;
    }
  }

  // 新增：创建新项目
  async function createProject(projectData: { name: string }): Promise<ProjectMetadata | null> {
    isLoading.value = true;
    error.value = null;
    try {
      // POST /api/projects 接受一个包含 name 字段的对象
      const newProject = await post<ProjectMetadata>('/projects', projectData); // 调用 POST /api/projects

      // 使用 Zod 验证返回的数据
      const validationResult = ProjectMetadataSchema.safeParse(newProject);
      if (!validationResult.success) {
        console.error('New project metadata validation failed:', validationResult.error.flatten());
        throw new Error('Invalid project metadata received after creation.');
      }

      console.info('New project created:', validationResult.data); // 改为 info
      // 创建成功后，可以选择重新获取列表或直接添加到现有列表
      // 这里选择重新获取列表以保证数据一致性
      await fetchAvailableProjects();
      return validationResult.data; // 返回创建的项目元数据

    } catch (err: any) {
      console.error('Failed to create project:', err.response?.data || err.message || err);
      error.value = err.response?.data?.error || err.message || 'An unknown error occurred while creating the project.';
      return null; // 创建失败返回 null
    } finally {
      isLoading.value = false;
    }
  }


  // 暴露状态和 action
  return {
    currentProjectId,
    currentProjectMetadata,
    availableProjects, // 暴露项目列表
    isLoading,
    error,
    loadProject,
    fetchAvailableProjects, // 暴露获取列表 action
    createProject, // 暴露创建项目 action
  };
});