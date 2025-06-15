<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
// import SideBar from './SideBar.vue'; // SideBar 由 HomeLayout 提供
import { useThemeStore } from '../stores/theme'; // 导入 theme store
import CharacterCard from '../components/CharacterCard.vue';
import { sillyTavernService } from '../services/SillyTavernService';
import type { CharacterCardUI } from '@comfytavern/types';
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";

// 角色列表
const characters = ref<CharacterCardUI[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const themeStore = useThemeStore(); // 获取 theme store 实例
const isDark = computed(() => themeStore.isDark);

onMounted(async () => {
  isLoading.value = true;
  error.value = null;
  try {
    // 使用 SillyTavernService 加载角色卡
    characters.value = await sillyTavernService.getCharacterCards();
  } catch (err) {
    console.error('加载角色卡失败:', err);
    error.value = `加载角色卡失败: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900">
    <!-- 左侧边栏 由 HomeLayout 提供 -->
    <!-- <SideBar /> -->

    <!-- 主要内容区域, HomeLayout 会处理 padding-left -->
    <div class="p-4 lg:p-6 max-w-screen-2xl mx-auto transition-all duration-300 ease-in-out">
      <!-- :class="themeStore.collapsed ? 'ml-16' : 'ml-64'" REMOVED -->
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-6">我的角色卡</h1>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="text-center text-gray-500 dark:text-gray-400 mt-10">
        正在加载角色卡...
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6"
        role="alert">
        <strong class="font-bold">加载错误:</strong>
        <span class="block sm:inline"> {{ error }}</span>
      </div>

      <OverlayScrollbarsComponent :options="{
        scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
      }" class="h-screen" defer>
        <!-- 角色卡片网格 -->
        <div v-if="!isLoading && characters.length > 0" class="flex flex-wrap gap-6">
          <CharacterCard v-for="character in characters" :key="character.id" :name="character.name"
            :description="character.description" :image="character.image" :creator-comment="character.creatorComment"
            :character-version="character.characterVersion" :create-date="character.createDate" :tags="character.tags"
            :creator="character.creator" :talkativeness="character.talkativeness" :favorite="character.favorite" />
        </div>
        <div v-if="!isLoading && characters.length === 0 && !error"
          class="text-center text-gray-500 dark:text-gray-400 mt-10">
          没有找到角色卡。
        </div>
      </OverlayScrollbarsComponent>
    </div>
  </div>
</template>

<style scoped></style>