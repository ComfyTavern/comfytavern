<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import CharacterCard from './CharacterCard.vue'; // 复用现有的卡片组件
import { sillyTavernService } from '../services/SillyTavernService';
import type { CharacterCardUI } from '@comfytavern/types';

// 角色列表
const characters = ref<CharacterCardUI[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
// const previewLimit = 3; // 不再限制预览数量，改为横向滚动

onMounted(async () => {
  isLoading.value = true;
  error.value = null;
  try {
    // 加载所有角色卡
    const allCharacters = await sillyTavernService.getCharacterCards();
    // 可以添加排序逻辑，比如按收藏或最近使用排序
    // 这里暂时只取前几个
    characters.value = allCharacters;
  } catch (err) {
    console.error('加载角色卡预览失败:', err);
    error.value = `加载角色卡预览失败: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    isLoading.value = false;
  }
});

// 计算用于预览的角色列表 (现在包含所有卡片，用于滚动)
const previewCharacters = computed(() => {
  // 优先显示收藏的角色
  const favoriteCharacters = characters.value.filter(c => c.favorite);
  const otherCharacters = characters.value.filter(c => !c.favorite);
  // 合并所有卡片
  return [...favoriteCharacters, ...otherCharacters];
});
</script>

<template>
  <div>
    <!-- 加载状态 -->
    <div v-if="isLoading" class="text-center text-gray-500 dark:text-gray-400">
      正在加载角色卡...
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
      role="alert">
      <strong class="font-bold">加载错误:</strong>
      <span class="block sm:inline"> {{ error }}</span>
    </div>

    <!-- 角色卡片横向滚动区域 -->
    <div v-if="!isLoading && previewCharacters.length > 0" class="relative">
      <div class="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide p-4">
        <CharacterCard v-for="character in previewCharacters" :key="character.id" :name="character.name"
          :description="character.description" :image="character.image" :creator-comment="character.creatorComment"
          :character-version="character.characterVersion" :create-date="character.createDate" :tags="character.tags"
          :creator="character.creator" :talkativeness="character.talkativeness" :favorite="character.favorite"
          variant="compact" class="flex-shrink-0" />
      </div>
      <!-- 右侧渐变遮罩 -->
      <div
        class="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-gray-100 dark:from-gray-800 to-transparent pointer-events-none">
      </div>
    </div>
    <div v-if="!isLoading && characters.length === 0 && !error" class="text-center text-gray-500 dark:text-gray-400">
      没有找到角色卡。
    </div>
    <div v-if="!isLoading && characters.length > 0 && !error" class="mt-4 text-right">
      <router-link to="/characters" class="text-blue-500 hover:underline">查看全部角色卡 &rarr;</router-link>
    </div>
  </div>
</template>

<style scoped>
/* 隐藏滚动条但保留功能 */
.scrollbar-hide {
  -ms-overflow-style: none;
  /* IE and Edge */
  scrollbar-width: none;
  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
  /* Chrome, Safari and Opera */
}

/* 确保卡片在 flex 容器中高度一致 */
.h-full {
  height: 100%;
}
</style>