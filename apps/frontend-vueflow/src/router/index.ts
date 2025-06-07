import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import EditorView from '../views/EditorView.vue'
import ProjectListView from '../views/ProjectListView.vue'
import CharacterCardView from '../views/CharacterCardView.vue'
import HomeLayout from '../views/HomeLayout.vue' // 导入新的布局组件
import { useProjectStore } from '../stores/projectStore' // 导入项目 store

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/home', // 根路径重定向到 /home
    },
    {
      path: '/home',
      component: HomeLayout, // 使用主页布局
      children: [
        {
          path: '', // 默认子路由
          name: 'home',
          component: HomeView,
        },
        {
          path: 'projects',
          name: 'projects',
          component: ProjectListView,
        },
        {
          path: 'characters',
          name: 'characters',
          component: CharacterCardView,
        },
        {
          path: 'about',
          name: 'about',
          component: () => import('../views/AboutView.vue'),
        },
        {
          path: 'settings',
          name: 'settings', // 名字统一小写
          component: () => import('../views/SettingsView.vue'),
        },
      ],
    },
    {
      path: '/dialog-demo',
      name: 'dialog-demo',
      component: () => import('../components/common/DialogDemo.vue'),
    },
    {
      path: '/projects/:projectId/editor/:workflowId?', // 添加可选的 workflowId 参数
      name: 'Editor', // 更新路由名称为 Editor
      component: EditorView,
      beforeEnter: async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => { // Prefix unused 'from' with underscore
        const projectId = to.params.projectId as string;
        // 在守卫内部获取 store 实例
        // 注意：这要求 Pinia 实例已在应用入口处创建 (main.ts)
        const projectStore = useProjectStore();

        if (!projectId) {
          console.error('Router Guard: Project ID is missing in route params.');
          // 如果没有项目 ID，重定向到主页或其他安全页面
          return next({ name: 'home' }); // 重定向到 home
        }

        // 如果请求的项目已经是当前加载的项目，则无需重新加载
        if (projectStore.currentProjectId === projectId) {
          console.debug(`Router Guard: Project ${projectId} is already loaded.`);
          return next(); // 允许导航
        }

        console.debug(`Router Guard: Attempting to load project ${projectId}...`);
        try {
          // 调用 store 的 action 来加载项目
          const loaded = await projectStore.loadProject(projectId);

          if (loaded) {
            console.info(`Router Guard: Project ${projectId} loaded successfully.`); // 改为 info
            return next(); // 加载成功，允许导航
          } else {
            console.error(`Router Guard: Failed to load project ${projectId}. Redirecting to home.`);
            // 加载失败，重定向到主页或错误页面
            // TODO: 可以考虑显示一个错误提示给用户
            return next({ name: 'home' }); // 重定向到 home
          }
        } catch (error) {
          console.error(`Router Guard: Error loading project ${projectId}:`, error);
          // 捕获加载过程中的异常，重定向
          // TODO: 可以考虑显示一个错误提示给用户
          return next({ name: 'home' }); // 重定向到 home
        }
      },
    },
  ],
})

export default router
