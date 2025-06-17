# 前端路由系统详解

本文档详细阐述了 ComfyTavern 前端应用的路由系统，该系统基于 Vue Router 实现，负责管理应用的导航和视图切换。

## 1. 前端路由概览

前端路由的核心配置位于 [`apps/frontend-vueflow/src/router/`](apps/frontend-vueflow/src/router/index.ts:1) 目录，特别是其下的 [`index.ts`](apps/frontend-vueflow/src/router/index.ts:1) 文件。该文件是单页应用（SPA）导航和路由配置的中心。

**Vue Router 的作用**：

Vue Router 是 Vue.js 官方的路由管理器。在 ComfyTavern 项目中，它扮演着至关重要的角色：

*   **客户端路由**：实现不同视图（页面）之间的无刷新切换，提升用户体验。
*   **URL 与组件映射**：将浏览器的 URL 映射到相应的 Vue 组件，使得每个 URL 都有一个对应的视图。
*   **导航控制**：提供编程式导航和声明式导航（通过 `<router-link>`）的能力。
*   **导航守卫**：允许在路由切换的不同阶段执行自定义逻辑，例如权限验证、数据预取等。
*   **参数传递**：支持通过 URL 传递参数，并在组件中获取这些参数。

## 2. 路由配置详解 ([`index.ts`](apps/frontend-vueflow/src/router/index.ts:1))

路由的核心配置在 [`apps/frontend-vueflow/src/router/index.ts`](apps/frontend-vueflow/src/router/index.ts:1) 文件中定义。

### 2.1. 路由实例创建

Vue Router 实例通过 `createRouter` 函数创建：

```typescript
import { createRouter, createWebHistory } from 'vue-router'
// ... 其他导入

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ... 路由表
  ],
})
```

*   **`createRouter(options)`**: 这是 Vue Router v4 创建路由实例的标准方法。
*   **`history: createWebHistory(import.meta.env.BASE_URL)`**:
    *   这指定了路由的历史模式。`createWebHistory` 使用 HTML5 History API 来实现 URL 的改变，这意味着 URL 看起来更“真实”（例如 `https://example.com/users/1` 而不是 `https://example.com/#/users/1`）。
    *   `import.meta.env.BASE_URL` 通常由 Vite 在构建时设置，代表应用的基础路径。
    *   使用 HTML5 History API 模式时，需要服务器端进行相应的配置，以确保在用户直接访问某个深层链接（例如刷新页面或通过书签访问）时，服务器能够正确地返回应用的 `index.html` 文件，而不是返回 404 错误。

### 2.2. 路由表 (`routes` 数组)

`routes` 数组定义了应用中所有的路由规则。每个路由对象通常包含 `path`、`name`、`component` 等属性。

以下是主要的路由配置：

#### 2.2.1. 根路径重定向

```typescript
{
  path: '/',
  redirect: '/home', // 根路径重定向到 /home
}
```

*   **`path: '/'`**: 匹配应用的根路径。
*   **`redirect: '/home'`**: 当用户访问根路径时，会自动重定向到 `/home` 路径。

#### 2.2.2. 主页布局路由 (`/home`)

```typescript
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
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: 'settings/test-panel',
      name: 'settings-test-panel',
      component: () => import('../views/TestPanelView.vue'),
    },
  ],
}
```

*   **`path: '/home'`**: 匹配 `/home` 路径。
*   **`component: HomeLayout`**: 当路径匹配 `/home` 或其子路径时，会首先渲染 [`HomeLayout`](apps/frontend-vueflow/src/views/HomeLayout.vue:1) 组件。这个布局组件内部通常会包含一个 `<router-view />` 来渲染匹配到的子路由组件。
*   **`children`**: 定义了嵌套在 `HomeLayout` 下的子路由。
    *   **`path: ''` (name: `home`)**: 这是 `/home` 路径下的默认子路由。当用户访问 `/home` 时，会渲染 [`HomeView`](apps/frontend-vueflow/src/views/HomeView.vue:1) 组件。
    *   **`path: 'projects'` (name: `projects`)**: 匹配 `/home/projects`，渲染 [`ProjectListView`](apps/frontend-vueflow/src/views/ProjectListView.vue:1) 组件。
    *   **`path: 'characters'` (name: `characters`)**: 匹配 `/home/characters`，渲染 [`CharacterCardView`](apps/frontend-vueflow/src/views/CharacterCardView.vue:1) 组件。
    *   **`path: 'about'` (name: `about`)**: 匹配 `/home/about`，渲染 [`AboutView`](apps/frontend-vueflow/src/views/AboutView.vue:1) 组件。这里使用了动态导入 `() => import('../views/AboutView.vue')`，实现了路由懒加载，即该组件的代码只会在访问此路由时才会被下载和解析。
    *   **`path: 'settings'` (name: `settings`)**: 匹配 `/home/settings`，渲染 [`SettingsView`](apps/frontend-vueflow/src/views/SettingsView.vue:1) 组件（懒加载）。
    *   **`path: 'settings/test-panel'` (name: `settings-test-panel`)**: 匹配 `/home/settings/test-panel`，渲染 [`TestPanelView`](apps/frontend-vueflow/src/views/TestPanelView.vue:1) 组件（懒加载）。

#### 2.2.3. 编辑器路由 (`/projects/:projectId/editor/:workflowId?`)

```typescript
{
  path: '/projects/:projectId/editor/:workflowId?',
  name: 'Editor',
  component: EditorView,
  beforeEnter: async (to, _from, next) => {
    // ... 导航守卫逻辑 ...
  },
}
```

*   **`path: '/projects/:projectId/editor/:workflowId?'`**:
    *   这是一个动态路由，包含两个参数：`projectId` 和 `workflowId`。
    *   `:projectId` 是必需的参数，用于标识当前操作的项目。
    *   `:workflowId?` 是可选参数（由 `?` 标记），用于标识在编辑器中打开的特定工作流。
*   **`name: 'Editor'`**: 为该路由命名为 `Editor`，方便编程式导航。
*   **`component: EditorView`**: 当路径匹配时，渲染 [`EditorView`](apps/frontend-vueflow/src/views/EditorView.vue:1) 组件。
*   **`beforeEnter`**: 这是一个路由独享的守卫。详见下面的“导航守卫”部分。
*   **`meta`**: 此路由当前没有显式定义 `meta` 字段。

### 2.3. 导航守卫 (Navigation Guards)

导航守卫用于在路由导航过程中执行特定的逻辑，例如权限检查、数据加载等。

#### 2.3.1. 全局前置守卫 (`router.beforeEach`)

在 [`apps/frontend-vueflow/src/router/index.ts`](apps/frontend-vueflow/src/router/index.ts:1) 文件中，当前**没有**显式定义全局前置守卫 (`router.beforeEach`)。

#### 2.3.2. 路由独享守卫 (`beforeEnter`)

编辑器路由 (`name: 'Editor'`) 使用了一个 `beforeEnter` 守卫：

```typescript
beforeEnter: async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
  const projectId = to.params.projectId as string;
  const projectStore = useProjectStore(); // 在守卫内部获取 Pinia store 实例

  if (!projectId) {
    console.error('Router Guard: Project ID is missing in route params.');
    return next({ name: 'home' }); // 如果没有项目 ID，重定向到 home
  }

  // 如果请求的项目已经是当前加载的项目，则无需重新加载
  if (projectStore.currentProjectId === projectId) {
    console.debug(`Router Guard: Project ${projectId} is already loaded.`);
    return next(); // 允许导航
  }

  console.debug(`Router Guard: Attempting to load project ${projectId}...`);
  try {
    const loaded = await projectStore.loadProject(projectId); // 调用 store action 加载项目

    if (loaded) {
      console.info(`Router Guard: Project ${projectId} loaded successfully.`);
      return next(); // 加载成功，允许导航
    } else {
      console.error(`Router Guard: Failed to load project ${projectId}. Redirecting to home.`);
      return next({ name: 'home' }); // 加载失败，重定向到 home
    }
  } catch (error) {
    console.error(`Router Guard: Error loading project ${projectId}:`, error);
    return next({ name: 'home' }); // 捕获异常，重定向到 home
  }
},
```

**守卫逻辑解释**：

1.  **获取 `projectId`**: 从目标路由 `to.params` 中获取 `projectId`。
2.  **获取 `projectStore`**: 在守卫内部动态获取 Pinia 的 `projectStore` 实例。
3.  **检查 `projectId` 是否存在**: 如果 `projectId` 缺失，则记录错误并重定向到名为 `home` 的路由。
4.  **检查项目是否已加载**: 如果目标 `projectId` 与 `projectStore.currentProjectId` 相同，说明项目已经加载，直接允许导航 (`next()`)。
5.  **加载项目**: 如果项目未加载或与当前加载的不同，则调用 `projectStore.loadProject(projectId)` 异步加载项目数据。
    *   **加载成功**: 如果 `loadProject` 返回 `true`，则允许导航 (`next()`)。
    *   **加载失败或发生错误**: 如果加载失败或过程中抛出异常，则记录错误并重定向到名为 `home` 的路由。

这个守卫确保在进入编辑器视图之前，相应的项目数据已经被加载到 `projectStore` 中。

#### 2.3.3. 组件内的守卫

目前在 [`apps/frontend-vueflow/src/router/index.ts`](apps/frontend-vueflow/src/router/index.ts:1) 的配置中没有直接体现组件内守卫 (`beforeRouteEnter`, `beforeRouteUpdate`, `beforeRouteLeave`)。这些守卫通常在各自的视图组件内部定义。

## 3. 在应用中使用路由

### 3.1. 注册路由实例

路由实例在应用的主入口文件 [`apps/frontend-vueflow/src/main.ts`](apps/frontend-vueflow/src/main.ts:18) 中被注册到 Vue 应用实例：

```typescript
// apps/frontend-vueflow/src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 导入路由实例
// ... 其他导入

const app = createApp(App)

app.use(router) // 将路由实例注册到 Vue 应用
app.mount('#app')
```

通过 `app.use(router)`，整个应用都可以访问到路由功能。

### 3.2. 声明式导航 (`<router-link>`)

在 Vue 组件的模板中，可以使用 `<router-link>` 组件进行声明式导航。它会被渲染成一个 `<a>` 标签。

**示例**：

```html
<router-link to="/home">前往主页</router-link>
<router-link :to="{ name: 'projects' }">项目列表</router-link>
<router-link :to="{ name: 'Editor', params: { projectId: '123', workflowId: 'abc' } }">
  打开编辑器
</router-link>
```

*   `to` 属性指定目标路由，可以是一个字符串路径，也可以是一个描述目标位置的对象（例如使用 `name` 和 `params`）。

### 3.3. 编程式导航 (`useRouter`)

在 Vue 组件的 `<script setup>` 中，可以通过 `useRouter()` Composable 函数获取路由实例，并使用其方法进行编程式导航。

**示例**：

```typescript
// 在某个 Vue 组件的 <script setup> 中
import { useRouter } from 'vue-router'

const router = useRouter()

function goToAboutPage() {
  router.push('/home/about')
}

function openProjectEditor(projectId: string) {
  router.push({ name: 'Editor', params: { projectId } })
}

function replaceWithSettings() {
  router.replace({ name: 'settings' }) // 替换当前历史记录项
}

function goBack() {
  router.go(-1) // 后退一步
}
```

常用的编程式导航方法包括：

*   `router.push(location)`: 导航到新的 URL，并向历史栈添加一条新记录。
*   `router.replace(location)`: 导航到新的 URL，但替换当前历史记录项，而不是添加新的。
*   `router.go(n)`: 在历史栈中向前或向后移动 `n` 步。

### 3.4. 渲染路由组件 (`<router-view>`)

`<router-view />` 组件是一个函数式组件，用于渲染当前活动路由所匹配到的组件。它通常放置在应用的根组件（如 [`apps/frontend-vueflow/src/App.vue`](apps/frontend-vueflow/src/App.vue:134)）或布局组件中。

在 [`apps/frontend-vueflow/src/App.vue`](apps/frontend-vueflow/src/App.vue:1) 中：

```html
<!-- apps/frontend-vueflow/src/App.vue -->
<template>
  <div class="h-full w-full basic-flow bg-background-base">
    <RouterView />
    <!-- ... 其他全局组件 ... -->
  </div>
</template>
```

当 URL 变化时，`<RouterView />` 会自动渲染与新 URL 匹配的组件。如果路由配置中使用了嵌套路由和布局组件（如 `HomeLayout`），则布局组件内部也会有一个 `<router-view />` 来渲染其子路由对应的组件。