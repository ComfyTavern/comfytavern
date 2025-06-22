import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProjectListView from '../views/ProjectListView.vue'
import CharacterCardView from '../views/CharacterCardView.vue'
import FileManagerPage from '../views/FileManagerPage.vue' // 导入文件管理器页面
import HomeLayout from '../views/HomeLayout.vue' // 导入新的布局组件
import { useProjectStore } from '../stores/projectStore' // 导入项目 store
// 导入新组件和视图
import ProjectLayout from '../views/ProjectLayout.vue' // 导入新的项目布局
import ProjectDashboardView from '../views/ProjectDashboardView.vue'
import EditorView from '../views/EditorView.vue'

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
          path: 'settings/:section?', // 添加可选的 section 参数
          name: 'settings', // 名字统一小写
          component: () => import('../views/SettingsView.vue'),
          props: true, // 将路由参数作为 props 传递给组件
        },
        {
          path: 'settings/test-panel', // 新增测试面板路由
          name: 'settings-test-panel',
          component: () => import('../views/TestPanelView.vue'),
        },
        {
          path: 'files', // 文件管理器路由
          name: 'files',
          component: FileManagerPage,
        },
      ],
    },
    // 新的项目根路由
    {
      path: '/project/:projectId',
      component: ProjectLayout, // 使用项目布局容器
      beforeEnter: async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
        const projectId = to.params.projectId as string
        const projectStore = useProjectStore()

        if (!projectId) {
          console.error('Router Guard: Project ID is missing in route params.')
          return next({ name: 'home' })
        }

        // 只有在项目未加载或切换项目时才加载
        if (projectStore.currentProjectId !== projectId) {
          try {
            const loaded = await projectStore.loadProject(projectId)
            if (!loaded) {
              console.error(`Router Guard: Failed to load project ${projectId}. Redirecting to home.`)
              return next({ name: 'home' })
            }
          } catch (error) {
            console.error(`Router Guard: Error loading project ${projectId}:`, error)
            return next({ name: 'home' })
          }
        }
        // 加载成功或已加载，放行
        return next()
      },
      children: [
        {
          path: '',
          name: 'ProjectRoot', // 根路径名
          redirect: to => ({ name: 'ProjectDashboard', params: { projectId: to.params.projectId } }),
        },
        // 仪表盘子路由
        {
          path: 'dashboard',
          name: 'ProjectDashboard',
          component: ProjectDashboardView,
        },
        // 编辑器子路由
        {
          path: 'editor/:workflowId?',
          name: 'ProjectEditor',
          component: EditorView,
        },
        // 未来可以添加更多子路由，如 'scenes', 'settings' 等
      ],
    },
  ],
})

export default router
