<template>
  <div
    class="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-950 dark:to-gray-800 perspective-1200 overflow-x-hidden">

    <!-- 左侧边栏 -->
    <SideBar />
    <OverlayScrollbarsComponent :options="{
      scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
    }" class="h-screen scroll-smooth" defer id="scrollContainer" ref="scrollContainerRef">
      <!-- 主要内容区域 -->
      <div class="transition-all duration-500 ease-in-out" :class="[
        themeStore.collapsed
          ? 'ml-16 w-[calc(100%-4rem)]'
          : 'ml-64 w-[calc(100%-16rem)]'
      ]">
        <!-- 内容居中容器 -->
        <div class="mx-auto max-w-[1280px] p-6 lg:p-12">
          <!-- 标题部分 -->
          <div class="mb-16 text-center relative py-10 overflow-hidden rounded-2xl" ref="titleSection">
            <h1 class="relative z-10 text-5xl sm:text-6xl lg:text-7xl font-extrabold py-3">
              <span
                class="fancy-title-wrapper relative inline-block transform hover:scale-105 transition-transform duration-300">
                <span class="fancy-title fancy-title-first">关于</span>
              </span>
              <span
                class="fancy-title-wrapper ml-3 relative inline-block transform hover:scale-105 transition-transform duration-300">
                <span class="fancy-title fancy-title-second">ComfyTavern</span>
              </span>
            </h1>
            <p
              class="text-xl lg:text-2xl text-gray-700 dark:text-gray-300 mt-6 max-w-3xl mx-auto transform transition-all duration-700 motion-safe:hover:translate-x-1 fancy-underline inline-block px-4">
              一个面向创作者和最终用户的 AI 创作与应用平台
            </p>
          </div>

          <!-- 项目描述卡片 -->
          <div class="fancy-card-container mb-16 perspective-card" ref="descriptionCard">
            <div
              class="fancy-card bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 lg:p-8 transform transition-transform duration-500 motion-safe:hover:scale-[1.02] relative overflow-hidden">
              <div
                class="card-flare absolute inset-0 opacity-0 hover:opacity-15 transition-opacity duration-700 pointer-events-none">
              </div>
              <div class="fancy-border absolute inset-0 rounded-2xl pointer-events-none"></div>
              <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 text-lg lg:text-xl relative z-10">
                <span
                  class="inline-block hover:scale-105 transition-transform duration-300 text-purple-600 dark:text-purple-400 font-semibold">ComfyTavern</span>
                不仅仅是一个强大的可视化节点编辑器（基于
                <span
                  class="inline-block hover:scale-105 transition-transform duration-300 text-green-600 dark:text-green-400 font-semibold">VueFlow</span>），让创作者能够灵活编排复杂的
                AI
                工作流。更核心的是，它致力于将这些工作流封装成易于使用、面向特定场景的
                <span class="relative inline-block group">
                  <span
                    class="font-semibold relative z-10 tech-text text-purple-600 dark:text-purple-400">交互式应用面板（或称"迷你应用"）</span>
                  <span
                    class="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 dark:from-purple-400 dark:to-blue-400 transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></span>
                </span>。
              </p>
              <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 text-lg lg:text-xl relative z-10">
                这些应用面板（例如：AI
                聊天机器人、互动故事生成器、自动化数据处理工具、创意内容辅助等）使得最终用户无需理解底层节点逻辑，即可直接体验和使用
                AI 功能。平台兼具开发者友好的扩展性，支持自定义节点和应用面板的开发。</p>
            </div>
          </div>

          <!-- 核心特点部分 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-10 mb-20">
            <div
              class="feature-card bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-xl p-7 lg:p-8 transform transition-all duration-500 motion-safe:hover:-translate-y-2 motion-safe:hover:shadow-2xl relative overflow-hidden group"
              ref="featureCard1">
              <div
                class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100">
              </div>
              <div
                class="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/30 rounded-2xl transition-colors duration-500 pointer-events-none">
              </div>
              <div
                class="icon-pulse absolute -top-4 -left-4 w-20 h-20 bg-blue-500/10 dark:bg-blue-400/10 rounded-full transform scale-0 group-hover:scale-125 transition-transform duration-700 ease-out pointer-events-none">
              </div>

              <h2 class="text-2xl lg:text-3xl font-bold mb-5 text-gray-800 dark:text-white flex items-center">
                <span class="tech-icon mr-3 text-blue-500 text-4xl">🔧</span>
                <span class="tech-text">强大的工作流编排</span>
              </h2>
              <ul class="space-y-3 text-gray-700 dark:text-gray-300">
                <li v-for="(item, index) in workflowFeatures" :key="index"
                  class="flex items-start transform transition-all hover:translate-x-1.5 duration-300 hover:text-blue-600 dark:hover:text-blue-400">
                  <svg class="w-6 h-6 text-blue-500 mr-2.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>

            <div
              class="feature-card bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-xl p-7 lg:p-8 transform transition-all duration-500 motion-safe:hover:-translate-y-2 motion-safe:hover:shadow-2xl relative overflow-hidden group"
              ref="featureCard2">
              <div
                class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 to-pink-500 transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100">
              </div>
              <div
                class="absolute inset-0 border-2 border-transparent group-hover:border-purple-500/30 rounded-2xl transition-colors duration-500 pointer-events-none">
              </div>
              <div
                class="icon-pulse absolute -top-4 -left-4 w-20 h-20 bg-purple-500/10 dark:bg-purple-400/10 rounded-full transform scale-0 group-hover:scale-125 transition-transform duration-700 ease-out pointer-events-none">
              </div>

              <h2 class="text-2xl lg:text-3xl font-bold mb-5 text-gray-800 dark:text-white flex items-center">
                <span class="tech-icon mr-3 text-purple-500 text-4xl">📱</span>
                <span class="tech-text">即用型 AI 应用面板</span>
              </h2>

              <div class="space-y-4 text-gray-700 dark:text-gray-300">
                <div
                  class="flex items-start group/item transform transition-transform hover:translate-x-1.5 duration-300">
                  <svg class="w-6 h-6 text-purple-500 mr-2.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z">
                    </path>
                  </svg>
                  <div>
                    <strong
                      class="text-gray-900 dark:text-white group-hover/item:text-purple-600 dark:group-hover/item:text-purple-400 transition-colors">核心价值：</strong>
                    <span>将复杂工作流封装成独立的、具有特定用户界面的"应用面板"</span>
                  </div>
                </div>

                <div
                  class="flex items-start group/item transform transition-transform hover:translate-x-1.5 duration-300">
                  <svg class="w-6 h-6 text-purple-500 mr-2.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z">
                    </path>
                  </svg>
                  <div>
                    <strong
                      class="text-gray-900 dark:text-white group-hover/item:text-purple-600 dark:group-hover/item:text-purple-400 transition-colors">用户体验：</strong>
                    <span>为最终用户提供直接、友好的交互界面，实现"即开即用"的 AI 功能体验</span>
                  </div>
                </div>

                <div class="mt-5">
                  <p class="font-semibold text-gray-900 dark:text-white mb-2.5 pl-3 border-l-2 border-purple-500">应用场景:
                  </p>
                  <div class="grid grid-cols-2 gap-2.5 ml-4">
                    <div v-for="(scene, index) in appScenes" :key="index" :class="scene.colorClass"
                      class="scene-chip px-3.5 py-2 rounded-lg text-sm flex items-center transform transition-all hover:scale-105 hover:-rotate-1 duration-300 shadow-sm hover:shadow-md">
                      <span class="mr-1.5 text-base">{{ scene.icon }}</span> {{ scene.name }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 第二行特点 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-10 mb-20">
            <div
              class="feature-card bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-xl p-7 lg:p-8 transform transition-all duration-500 motion-safe:hover:-translate-y-2 motion-safe:hover:shadow-2xl relative overflow-hidden group"
              ref="featureCard3">
              <div
                class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 to-emerald-500 transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100">
              </div>
              <div
                class="absolute inset-0 border-2 border-transparent group-hover:border-green-500/30 rounded-2xl transition-colors duration-500 pointer-events-none">
              </div>
              <div
                class="icon-pulse absolute -top-4 -left-4 w-20 h-20 bg-green-500/10 dark:bg-green-400/10 rounded-full transform scale-0 group-hover:scale-125 transition-transform duration-700 ease-out pointer-events-none">
              </div>

              <h2 class="text-2xl lg:text-3xl font-bold mb-5 text-gray-800 dark:text-white flex items-center">
                <span class="tech-icon mr-3 text-green-500 text-4xl">🧩</span>
                <span class="tech-text">开发者友好与扩展性</span>
              </h2>
              <ul class="space-y-3 text-gray-700 dark:text-gray-300">
                <li v-for="(item, index) in devFeatures" :key="index"
                  class="flex items-start transform transition-all hover:translate-x-1.5 duration-300 hover:text-green-600 dark:hover:text-green-400">
                  <svg class="w-6 h-6 text-green-500 mr-2.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>

            <div
              class="feature-card bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-xl p-7 lg:p-8 transform transition-all duration-500 motion-safe:hover:-translate-y-2 motion-safe:hover:shadow-2xl relative overflow-hidden group"
              ref="featureCard4">
              <div
                class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100">
              </div>
              <div
                class="absolute inset-0 border-2 border-transparent group-hover:border-yellow-500/30 rounded-2xl transition-colors duration-500 pointer-events-none">
              </div>
              <div
                class="icon-pulse absolute -top-4 -left-4 w-20 h-20 bg-yellow-500/10 dark:bg-yellow-400/10 rounded-full transform scale-0 group-hover:scale-125 transition-transform duration-700 ease-out pointer-events-none">
              </div>

              <h2 class="text-2xl lg:text-3xl font-bold mb-5 text-gray-800 dark:text-white flex items-center">
                <span class="tech-icon mr-3 text-yellow-500 text-4xl">🎨</span>
                <span class="tech-text">创作与技术的平衡</span>
              </h2>
              <ul class="space-y-3 text-gray-700 dark:text-gray-300">
                <li v-for="(item, index) in balanceFeatures" :key="index"
                  class="flex items-start transform transition-all hover:translate-x-1.5 duration-300 hover:text-yellow-600 dark:hover:text-yellow-400">
                  <svg class="w-6 h-6 text-yellow-500 mr-2.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- 当前状态 -->
          <div
            class="status-section bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 lg:p-10 mb-20 transform transition-all duration-500 hover:scale-[1.01] relative"
            ref="statusSection">
            <h2 class="text-2xl lg:text-3xl font-bold mb-6 text-gray-800 dark:text-white inline-flex items-center">
              <span class="text-3xl mr-3 rocket-icon">🚀</span>
              当前状态 <span
                class="ml-2 text-sm lg:text-base bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-1.5 px-3.5 rounded-full">截至
                2025 Q2 初</span>
            </h2>

            <div
              class="bg-yellow-100/50 dark:bg-yellow-900/40 p-5 rounded-xl mb-8 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm">
              <p class="text-yellow-800 dark:text-yellow-200 font-medium flex items-center text-sm lg:text-base">
                <svg class="w-5 h-5 lg:w-6 lg:h-6 mr-2.5 flex-shrink-0" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                  </path>
                </svg>
                注意！本项目仍处于早期 Beta 开发阶段，许多核心功能仍在积极迭代中，欢迎反馈和贡献！
              </p>
            </div>

            <ul class="space-y-4 text-gray-700 dark:text-gray-300">
              <li v-for="(status, index) in projectStatus" :key="index" :class="[
                'flex items-start p-3.5 rounded-lg transform transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 shadow-sm hover:shadow-md',
                status.type === 'done' ? 'border-l-4 border-green-500' :
                  status.type === 'wip' ? 'border-l-4 border-yellow-500' :
                    'border-l-4 border-red-500 opacity-80 hover:opacity-100'
              ]">
                <span :class="[
                  'mr-3 mt-0.5 text-xl lg:text-2xl flex-shrink-0',
                  status.type === 'done' ? 'text-green-500' :
                    status.type === 'wip' ? 'text-yellow-500' :
                      'text-red-500'
                ]">{{ status.icon }}</span>
                <div>
                  <strong class="text-gray-900 dark:text-white">{{ status.title }}</strong>
                  <span class="block text-sm text-gray-600 dark:text-gray-400">{{ status.description }}</span>
                </div>
              </li>
            </ul>

            <p
              class="mt-8 text-gray-700 dark:text-gray-300 font-medium bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg inline-flex items-center shadow-sm">
              <span class="text-blue-600 dark:text-blue-400 text-xl mr-2">👨‍💻</span> 目前 PC 端主要提供 VueFlow 节点编辑器体验。
            </p>
          </div>

          <!-- 技术栈 -->
          <div
            class="tech-stack-section bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 lg:p-10 mb-20 relative overflow-hidden"
            ref="techStackSection">
            <div
              class="absolute -top-24 -right-24 w-56 h-56 bg-gradient-to-br from-blue-500/5 to-purple-500/5 dark:from-blue-400/10 dark:to-purple-400/10 rounded-full blur-3xl pointer-events-none">
            </div>
            <div
              class="absolute -bottom-24 -left-24 w-56 h-56 bg-gradient-to-br from-green-500/5 to-blue-500/5 dark:from-green-400/10 dark:to-blue-400/10 rounded-full blur-3xl pointer-events-none">
            </div>

            <h2 class="text-2xl lg:text-3xl font-bold mb-8 text-gray-800 dark:text-white inline-flex items-center">
              <span class="text-3xl mr-3 gear-icon">⚙️</span>
              技术栈
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <div v-for="(tech, index) in techStack" :key="index" :class="tech.gradientClass"
                class="p-6 rounded-xl shadow-lg transform transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl group relative overflow-hidden">
                <div
                  class="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl">
                </div>
                <div class="flex items-center mb-3.5">
                  <div :class="tech.iconBgClass"
                    class="w-12 h-12 rounded-full flex items-center justify-center mr-3.5 group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <svg class="w-7 h-7" :class="tech.iconColorClass" xmlns="http://www.w3.org/2000/svg" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" v-html="tech.iconPath"></svg>
                  </div>
                  <h3 class="font-bold text-lg lg:text-xl text-gray-800 dark:text-white">{{ tech.name }}</h3>
                </div>
                <p class="text-gray-700 dark:text-gray-300 flex flex-wrap items-center gap-2">
                  <span v-for="(item, i) in tech.items" :key="i" :class="tech.pillClass"
                    class="tech-pill px-2.5 py-1 rounded-md text-sm shadow-sm">{{ item }}</span>
                </p>
                <p v-if="tech.subtext" class="text-gray-600 dark:text-gray-400 text-sm mt-3.5 flex items-center">
                  <span class="mr-1.5">{{ tech.subtextPrefix }}</span>
                  <span :class="tech.subPillClass" class="tech-pill px-2.5 py-1 rounded-md text-sm shadow-sm">{{
                    tech.subtext }}</span>
                </p>
              </div>
            </div>
          </div>

          <!-- 项目仓库链接 -->
          <div class="text-center mb-16" ref="githubLink">
            <a href="https://github.com/ComfyTavern/comfytavern" target="_blank" rel="noopener noreferrer"
              class="github-button inline-flex items-center px-8 py-4 bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-700 dark:to-gray-600 text-white font-semibold rounded-lg hover:shadow-xl transform transition-all duration-300 hover:scale-105 group relative overflow-hidden">
              <span
                class="absolute inset-0 bg-white/10 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></span>
              <svg class="w-6 h-6 mr-2.5 transform transition-transform duration-300 group-hover:rotate-[360deg]"
                fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fill-rule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clip-rule="evenodd"></path>
              </svg>
              GitHub 仓库
            </a>
          </div>

          <!-- 页脚 -->
          <div
            class="text-center text-gray-600 dark:text-gray-400 text-sm py-8 border-t border-gray-200 dark:border-gray-700/50">
            <p>© {{ new Date().getFullYear() }} ComfyTavern. 基于 MIT 许可发布。</p>
            <p class="mt-1">由充满热情的开发者用 ❤️ 打造</p>
          </div>
        </div>
      </div>
    </OverlayScrollbarsComponent>
  </div>
</template>

<script setup lang="ts">
import SideBar from "./SideBar.vue";
import { computed, onMounted, ref } from "vue";
import { useThemeStore } from "../stores/theme";
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

const scrollContainerRef = ref<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);

// 用于滚动触发动画的 refs
const titleSection = ref<HTMLElement | null>(null);
const descriptionCard = ref<HTMLElement | null>(null);
const featureCard1 = ref<HTMLElement | null>(null);
const featureCard2 = ref<HTMLElement | null>(null);
const featureCard3 = ref<HTMLElement | null>(null);
const featureCard4 = ref<HTMLElement | null>(null);
const statusSection = ref<HTMLElement | null>(null);
const techStackSection = ref<HTMLElement | null>(null);
const githubLink = ref<HTMLElement | null>(null);

const workflowFeatures = [
  '提供基于 VueFlow 的可视化节点编辑器',
  '丰富的内置节点和易于扩展的自定义节点能力',
  '支持类似Blender节点组的嵌套工作流能力',
  '专注于创作，简化操作流程，隐藏底层技术复杂度',
  '支持对部分节点的输出设置实时预览',
];

const appScenes = [
  { name: 'AI 聊天机器人', icon: '💬', colorClass: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
  { name: '互动叙事/视觉小说', icon: '📖', colorClass: 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' },
  { name: '创意辅助工具', icon: '🎨', colorClass: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  { name: '轻量级游戏', icon: '🎮', colorClass: 'bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300' },
  { name: '自动化任务助手', icon: '🤖', colorClass: 'bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 col-span-2 md:col-span-1' },
  { name: '以及更多...', icon: '🤗', colorClass: 'bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300' },
];

const devFeatures = [
  '支持 TypeScript 定义节点逻辑',
  '允许开发者贡献新功能和自定义节点',
  '未来规划支持更便捷的应用面板开发和集成方式',
];

const balanceFeatures = [
  '创作者可通过直观选项调整应用面板的界面风格',
  '开发者可深入底层，扩展多模态功能或集成更复杂的 AI 模型',
];

const projectStatus = [
  { type: 'done', icon: '✅', title: '基本框架设计：', description: '完成项目整体架构规划。' },
  { type: 'done', icon: '✅', title: '前端节点编辑器 (VueFlow)：', description: '核心编辑功能已基本可用。' },
  { type: 'done', icon: '✅', title: '后端节点定义与动态加载：', description: '节点定义规范及后端动态加载机制已初步实现。' },
  { type: 'wip', icon: '🟡', title: '工作流执行引擎：', description: '后端执行引擎尚处于早期草稿阶段，功能未完善，未经过充分测试。' },
  { type: 'todo', icon: '❌', title: '应用面板封装与运行：', description: '将工作流封装为独立"应用面板"的核心机制尚未开始开发。' },
  { type: 'todo', icon: '❌', title: '移动端打包与适配 (Tauri)：', description: '独立运行的移动端APP，可以不依赖bun环境部署的执行引擎。' },
  { type: 'todo', icon: '❌', title: '内置 Agent 创作助手：', description: '用于辅助创作者快速创建 AI 应用。' },
];

const techStack = [
  {
    name: '前端',
    items: ['Vue 3', 'TypeScript', 'Vite'],
    subtextPrefix: '节点编辑器:',
    subtext: 'Vue Flow',
    iconPath: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />',
    gradientClass: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30',
    iconBgClass: 'bg-blue-100 dark:bg-blue-900/60',
    iconColorClass: 'text-blue-600 dark:text-blue-400',
    pillClass: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    subPillClass: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
  },
  {
    name: '后端',
    items: ['Bun', 'Elysia'],
    iconPath: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />',
    gradientClass: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30',
    iconBgClass: 'bg-green-100 dark:bg-green-900/60',
    iconColorClass: 'text-green-600 dark:text-green-400',
    pillClass: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  },
  {
    name: '通信',
    items: ['WebSocket'],
    subtextPrefix: '用于:',
    subtext: '实时数据交换',
    iconPath: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />',
    gradientClass: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30',
    iconBgClass: 'bg-purple-100 dark:bg-purple-900/60',
    iconColorClass: 'text-purple-600 dark:text-purple-400',
    pillClass: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
    subPillClass: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300',
  },
];

onMounted(() => {
  const observerOptions = {
    root: scrollContainerRef.value?.osInstance()?.elements().viewport, // 使用 OverlayScrollbars 的视口
    rootMargin: '0px',
    threshold: 0.1 // 当元素10%可见时触发
  };

  const observerCallback = (entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in-up');
      }
    });
  };

  const observer = new IntersectionObserver(observerCallback, observerOptions);

  const elementsToObserve = [
    titleSection.value,
    descriptionCard.value,
    featureCard1.value,
    featureCard2.value,
    featureCard3.value,
    featureCard4.value,
    statusSection.value,
    techStackSection.value,
    githubLink.value,
  ];

  elementsToObserve.forEach(el => {
    if (el) observer.observe(el);
  });

  // 清理
  return () => {
    elementsToObserve.forEach(el => {
      if (el) observer.unobserve(el);
    });
  };
});
</script>

<style scoped>
/* 透视效果，用于3D悬停 */
.perspective-1200 {
  perspective: 1200px;
}

.perspective-card {
  transform-style: preserve-3d;
}

.fancy-card:hover {
  transform: rotateX(var(--rotateX, 0deg)) rotateY(var(--rotateY, 0deg)) scale(1.02);
}

/* 新的标题特效样式 */
.fancy-title-wrapper {
  position: relative;
  display: inline-block;
  z-index: 10;
}

.fancy-title {
  position: relative;
  display: inline-block;
  letter-spacing: 0.01em;
  font-weight: 800;
  text-transform: uppercase;
}

.fancy-title-first {
  color: #729cff;
  font-size: 60px;
  text-shadow: 0 0 5px rgba(129, 140, 248, 0.5),
    0 0 10px rgba(129, 140, 248, 0.3),
    0 0 15px rgba(129, 140, 248, 0.2);
  animation: title-float 3s ease-in-out infinite alternate;
}

.fancy-title-second {
  background: linear-gradient(to right, #3b82f6, #8b5cf6, #6366f1);
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  text-shadow: 0 0 5px rgba(99, 102, 241, 0.3),
    0 0 10px rgba(99, 102, 241, 0.2);
  animation: gradient-shift 3s ease-in-out infinite alternate;
}

/* 直接在标题上应用背景光晕效果，而不是单独的元素 */
.fancy-title-wrapper::after {
  content: '';
  position: absolute;
  width: 120%;
  height: 120%;
  top: -10%;
  left: -10%;
  z-index: -1;
  filter: blur(35px);
  opacity: 0.15;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%,
      rgba(129, 140, 248, 0.4),
      rgba(99, 102, 241, 0.2) 50%,
      transparent 100%);
  animation: glow-pulse 4s ease-in-out infinite alternate;
}

/* 亮色模式下降低不透明度 */
:root:not(.dark) .fancy-title-wrapper::after {
  opacity: 0.08;
}

@keyframes gradient-shift {
  0% {
    background-position: 0% center;
  }

  100% {
    background-position: 100% center;
  }
}

@keyframes title-float {
  0% {
    transform: translateY(0px);
  }

  100% {
    transform: translateY(-5px);
  }
}

@keyframes glow-pulse {
  0% {
    opacity: 0.08;
    transform: scale(0.95);
  }

  100% {
    opacity: 0.18;
    transform: scale(1.05);
  }
}

/* 暗色模式下稍微增强光晕效果 */
.dark .fancy-title-wrapper::after {
  opacity: 0.2;
  background: radial-gradient(circle at 50% 50%,
      rgba(129, 140, 248, 0.5),
      rgba(99, 102, 241, 0.3) 50%,
      transparent 100%);
}

.dark .fancy-title-first {
  color: #f8f9fa;
  text-shadow: 0 0 8px rgba(165, 180, 252, 0.6),
    0 0 15px rgba(129, 140, 248, 0.4),
    0 0 20px rgba(99, 102, 241, 0.2);
}

/* Fancy文本渐变和动画 */
.fancy-text {
  animation: hue-rotate 10s infinite linear;
}

@keyframes hue-rotate {
  to {
    filter: hue-rotate(360deg);
  }
}

/* 副标题下划线动画 */
.fancy-underline {
  position: relative;
  padding-bottom: 0.25rem;
}

.fancy-underline::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, #3b82f6, #a855f7);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
}

.fancy-underline:hover::after {
  transform: scaleX(1);
}

.dark .fancy-underline::after {
  background: linear-gradient(90deg, #60a5fa, #c084fc);
}


/* 卡片炫光边框和光晕 */
.fancy-card .fancy-border {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 1.2rem;
  /* 明确设置圆角 */
  /* 使用渐变背景代替border-image，这样可以保持圆角 */
  background: conic-gradient(from var(--angle, 0deg), #007cf0, #00dfd8, #ff0080, #007cf0);
  animation: spin 5s linear infinite;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.5s;
  /* 关键: 使用mask创建一个中空的圆角矩形 */
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  /* 边框宽度 */
  padding: 3px;
  box-shadow: 0 0 8px rgba(0, 164, 255, 0.2);
  /* 增强发光效果 */
}

.fancy-card:hover .fancy-border {
  opacity: 0.8;
}

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes spin {
  to {
    --angle: 360deg;
  }
}

.fancy-card .card-flare {
  background: radial-gradient(circle at var(--flare-x, 50%) var(--flare-y, 50%),
      rgba(255, 255, 255, 0.3),
      rgba(255, 255, 255, 0) 60%);
  border-radius: inherit;
}

.dark .fancy-card .card-flare {
  background: radial-gradient(circle at var(--flare-x, 50%) var(--flare-y, 50%),
      rgba(200, 200, 255, 0.15),
      rgba(200, 200, 255, 0) 60%);
}

/* 特点卡片图标脉冲 */
.icon-pulse {
  /* 默认不执行动画 */
  transform: scale(0);
  opacity: 0;
  transition: transform 0.7s ease-out, opacity 0.7s ease-out;
}

.feature-card:hover .icon-pulse {
  animation: pulse-effect 2s infinite cubic-bezier(0.66, 0, 0, 1);
}

@keyframes pulse-effect {

  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }

  50% {
    transform: scale(1.2);
    opacity: 0.2;
  }
}

/* 技术文本样式 */
.tech-text {
  font-family: 'Orbitron', sans-serif;
  /* 引入一个科技感的字体，需要在main.ts或index.html中引入 */
  letter-spacing: 0.5px;
}

.tech-icon {
  transition: transform 0.3s ease-out;
}

.feature-card:hover .tech-icon {
  transform: rotateY(180deg) scale(1.1);
}

/* 应用场景小标签 */
.scene-chip {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.dark .scene-chip {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 状态部分火箭图标动画 */
.rocket-icon {
  animation: rocket-launch 3s infinite ease-in-out;
}

@keyframes rocket-launch {
  0% {
    transform: translateY(0) rotate(-5deg);
  }

  50% {
    transform: translateY(-8px) rotate(5deg);
  }

  100% {
    transform: translateY(0) rotate(-5deg);
  }
}

/* 技术栈齿轮图标动画 */
.gear-icon {
  animation: spin-gear 8s linear infinite;
}

@keyframes spin-gear {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* 技术栈药丸样式 */
.tech-pill {
  transition: all 0.2s ease-in-out;
}

.tech-pill:hover {
  transform: translateY(-1px) scale(1.03);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.dark .tech-pill:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

/* GitHub 按钮 */
.github-button:hover svg {
  filter: drop-shadow(0 0 5px currentColor);
}

/* 滚动淡入动画 */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
  opacity: 0;
  /* Start hidden */
}

/* 动态背景 */
.animated-gradient-bg {
  background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
  background-size: 400% 400%;
  animation: gradient-animation 15s ease infinite;
}

.dark .animated-gradient-bg {
  background: linear-gradient(-45deg, #1e293b, #334155, #0f172a, #475569);
  background-size: 400% 400%;
  animation: gradient-animation 20s ease infinite;
}

@keyframes gradient-animation {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

/* 确保在小屏幕上动画不会过于突兀 */
@media (max-width: 768px) {
  .glitch-text {
    font-size: 2.5rem;
    /* 调整小屏幕上的字体大小 */
  }

  .fancy-card:hover {
    transform: scale(1.01);
    /* 减小悬停缩放 */
  }

  .feature-card:hover {
    transform: translateY(-4px);
    /* 减小悬停位移 */
  }
}
</style>
