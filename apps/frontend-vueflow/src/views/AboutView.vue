<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900">
    <!-- 左侧边栏 -->
    <SideBar />
    <OverlayScrollbarsComponent :options="{
      scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
    }" class="h-screen" defer>

      <!-- 主要内容区域 -->
      <div class="p-6 lg:p-8 max-w-screen-2xl mx-auto transition-all duration-300 ease-in-out"
        :class="themeStore.collapsed ? 'ml-16' : 'ml-64'">
        <div class="mb-10 text-center">
          <h1
            class="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
            关于 ComfyTavern
          </h1>
          <p class="text-xl text-gray-700 dark:text-gray-300 mt-4">
            一个面向创作者和最终用户的 AI 创作与应用平台
          </p>
        </div>

        <!-- 项目描述卡片 -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
            ComfyTavern 不仅仅是一个强大的可视化节点编辑器（基于
            VueFlow），让创作者能够灵活编排复杂的 AI
            工作流。更核心的是，它致力于将这些工作流封装成易于使用、面向特定场景的
            <span class="font-semibold">交互式应用面板（或称"迷你应用"）</span>。这些应用面板（例如：AI
            聊天机器人、互动故事生成器、自动化数据处理工具、创意内容辅助等）使得最终用户无需理解底层节点逻辑，即可直接体验和使用
            AI 功能。平台兼具开发者友好的扩展性，支持自定义节点和应用面板的开发。
          </p>
        </div>

        <!-- 核心特点部分 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center">
              <span class="mr-2 text-blue-500">🔧</span>强大的工作流编排
            </h2>
            <ul class="list-disc list-inside ml-4 text-gray-700 dark:text-gray-300 space-y-2">
              <li>提供基于 VueFlow 的可视化节点编辑器</li>
              <li>丰富的内置节点和易于扩展的自定义节点能力</li>
              <li>专注于创作，简化操作流程，隐藏底层技术复杂度</li>
            </ul>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center">
              <span class="mr-2 text-purple-500">📱</span>即用型 AI 应用面板
            </h2>
            <p class="text-gray-700 dark:text-gray-300 mb-3">
              <strong>核心价值：</strong>将复杂工作流封装成独立的、具有特定用户界面的"应用面板"
            </p>
            <p class="text-gray-700 dark:text-gray-300 mb-3">
              <strong>用户体验：</strong>为最终用户提供直接、友好的交互界面，实现"即开即用"的 AI
              功能体验
            </p>
            <div class="text-gray-700 dark:text-gray-300">
              <p class="font-semibold mb-1">应用场景:</p>
              <ul class="list-disc list-inside ml-4 space-y-1">
                <li>AI 聊天机器人</li>
                <li>互动叙事/视觉小说</li>
                <li>创意辅助工具</li>
                <li>轻量级游戏或模拟器</li>
                <li>自动化任务助手</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 第二行特点 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center">
              <span class="mr-2 text-green-500">🧩</span>开发者友好与扩展性
            </h2>
            <ul class="list-disc list-inside ml-4 text-gray-700 dark:text-gray-300 space-y-2">
              <li>支持 TypeScript 定义节点逻辑</li>
              <li>允许开发者贡献新功能和自定义节点</li>
              <li>未来规划支持更便捷的应用面板开发和集成方式</li>
            </ul>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center">
              <span class="mr-2 text-yellow-500">🎨</span>创作与技术的平衡
            </h2>
            <ul class="list-disc list-inside ml-4 text-gray-700 dark:text-gray-300 space-y-2">
              <li>创作者可通过直观选项调整应用面板的界面风格</li>
              <li>开发者可深入底层，扩展多模态功能或集成更复杂的 AI 模型</li>
            </ul>
          </div>
        </div>

        <!-- 当前状态 -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-10">
          <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
            当前状态 (截至 2025 Q2 初)
          </h2>
          <div class="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg mb-4">
            <p class="text-yellow-800 dark:text-yellow-200 font-medium">
              注意！本项目仍处于早期 Beta 开发阶段，许多核心功能仍在积极迭代中，欢迎反馈和贡献！
            </p>
          </div>

          <ul class="space-y-2 text-gray-700 dark:text-gray-300">
            <li class="flex items-start">
              <span class="text-green-500 mr-2">✅</span>
              <span><strong>基本框架设计：</strong>完成项目整体架构规划。</span>
            </li>
            <li class="flex items-start">
              <span class="text-green-500 mr-2">✅</span>
              <span><strong>前端节点编辑器 (VueFlow)：</strong>核心编辑功能已基本可用。</span>
            </li>
            <li class="flex items-start">
              <span class="text-green-500 mr-2">✅</span>
              <span><strong>后端节点定义与动态加载：</strong>节点定义规范及后端动态加载机制已初步实现。</span>
            </li>
            <li class="flex items-start">
              <span class="text-yellow-500 mr-2">🟡</span>
              <span><strong>工作流执行引擎：</strong>后端执行引擎尚处于早期草稿阶段，功能未完善，未经过充分测试。</span>
            </li>
            <li class="flex items-start">
              <span class="text-red-500 mr-2">❌</span>
              <span><strong>应用面板封装与运行：</strong>将工作流封装为独立"应用面板"的核心机制尚未开始开发。</span>
            </li>
            <li class="flex items-start">
              <span class="text-red-500 mr-2">❌</span>
              <span><strong>移动端打包与适配 (Tauri)：</strong>独立运行的移动端APP，可以不依赖bun环境部署的执行引擎。</span>
            </li>
            <li class="flex items-start">
              <span class="text-red-500 mr-2">❌</span>
              <span><strong>内置 Agent 创作助手：</strong>用于辅助创作者快速创建 AI 应用。</span>
            </li>
          </ul>

          <p class="mt-4 text-gray-700 dark:text-gray-300 font-medium">
            目前 PC 端主要提供 VueFlow 节点编辑器体验。
          </p>
        </div>

        <!-- 技术栈 -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-10">
          <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white">技术栈</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 class="font-bold mb-2 text-gray-800 dark:text-white">前端</h3>
              <p class="text-gray-700 dark:text-gray-300">Vue 3 + TypeScript + Vite</p>
              <p class="text-gray-600 dark:text-gray-400 text-sm mt-1">节点编辑器：Vue Flow</p>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 class="font-bold mb-2 text-gray-800 dark:text-white">后端</h3>
              <p class="text-gray-700 dark:text-gray-300">Bun + Elysia</p>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 class="font-bold mb-2 text-gray-800 dark:text-white">通信</h3>
              <p class="text-gray-700 dark:text-gray-300">WebSocket</p>
              <p class="text-gray-600 dark:text-gray-400 text-sm mt-1">用于实时数据交换</p>
            </div>
          </div>
        </div>

        <!-- 项目仓库链接 -->
        <div class="text-center mb-10">
          <a href="https://github.com/ComfyTavern/comfytavern" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fill-rule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clip-rule="evenodd"></path>
            </svg>
            GitHub 仓库
          </a>
        </div>

        <!-- 页脚 -->
        <div class="text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>© 2025 ComfyTavern. 基于 MIT 许可发布。</p>
        </div>
      </div>
    </OverlayScrollbarsComponent>
  </div>
</template>

<script setup lang="ts">
import SideBar from "./SideBar.vue";
import { computed } from "vue";
import { useThemeStore } from "../stores/theme";
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);
</script>

<style scoped>
/* 添加任何特定样式 */
</style>
