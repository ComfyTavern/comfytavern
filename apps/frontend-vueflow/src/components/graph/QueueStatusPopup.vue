<template>
  <div
    class="absolute bottom-full mb-2 right-0 w-80 bg-background-surface border border-border-base rounded-md shadow-lg z-20 p-3"
  >
    <div class="flex justify-between items-center mb-2 pb-2 border-b border-border-base">
      <h3 class="font-semibold text-text-primary">执行队列</h3>
      <button @click="refresh" class="p-1 rounded-md hover:bg-neutral-softest" v-comfy-tooltip="'刷新列表'">
        <ArrowPathIcon class="h-4 w-4" />
      </button>
    </div>

    <div class="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
      <!-- 运行中 -->
      <div>
        <h4 class="text-xs font-bold text-text-secondary uppercase mb-1">运行中 ({{ runningList.length }})</h4>
        <div v-if="runningList.length === 0" class="text-xs text-text-muted px-2 py-1">没有正在运行的任务</div>
        <ul v-else class="space-y-1">
          <li v-for="item in runningList" :key="item.promptId" class="flex items-center justify-between text-sm p-1.5 rounded-md hover:bg-neutral-softest">
            <span class="font-mono text-xs truncate" :title="item.promptId">{{ item.promptId }}</span>
            <button @click="interrupt(item.promptId)" class="ml-2 px-2 py-0.5 text-xs rounded-full text-error-content bg-error hover:bg-error-emphasis transition-colors">
              中断
            </button>
          </li>
        </ul>
      </div>

      <!-- 等待中 -->
      <div>
        <h4 class="text-xs font-bold text-text-secondary uppercase mb-1">等待中 ({{ pendingList.length }})</h4>
        <div v-if="pendingList.length === 0" class="text-xs text-text-muted px-2 py-1">队列为空</div>
        <ul v-else class="space-y-1">
          <li v-for="item in pendingList" :key="item.promptId" class="flex items-center justify-between text-sm p-1.5 rounded-md hover:bg-neutral-softest">
            <span class="font-mono text-xs truncate" :title="item.promptId">{{ item.promptId }}</span>
            <button @click="interrupt(item.promptId)" class="ml-2 px-2 py-0.5 text-xs rounded-full text-warning-content bg-warning hover:bg-warning-emphasis transition-colors">
              取消
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import { useSystemStatusStore } from '@/stores/systemStatusStore';
import type { NanoId } from '@comfytavern/types';

const systemStatusStore = useSystemStatusStore();
const { runningList, pendingList } = storeToRefs(systemStatusStore);

const refresh = async () => {
  await systemStatusStore.fetchExecutionLists();
};

const interrupt = async (promptId: NanoId) => {
  await systemStatusStore.interrupt(promptId);
};

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: hsl(var(--color-neutral-soft));
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--color-neutral));
}
</style>