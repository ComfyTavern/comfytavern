<template>
  <nav aria-label="Breadcrumb" class="breadcrumbs-nav flex items-center text-sm" data-testid="fm-breadcrumbs">
    <div v-if="!isEditingPath" class="flex items-center space-x-1 flex-wrap">
      <button v-if="canGoUp" @click="goUpDirectory"
        class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0" v-comfy-tooltip="'返回上一级'"
        aria-label="返回上一级">
        <ArrowUpIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>
      <button v-else class="p-1 rounded flex-shrink-0 opacity-50 cursor-not-allowed" aria-label="已在根目录" disabled>
        <HomeIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>

      <ol role="list" class="flex items-center space-x-1 flex-wrap">
        <li v-for="(segment, index) in breadcrumbs" :key="segment.path + '-' + index">
          <div class="flex items-center">
            <ChevronRightIcon v-if="index > 0 || (index === 0 && canGoUp)"
              class="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mx-0.5" />
            <a href="#" @click.prevent="navigateToSegment(segment.path)" @dblclick.prevent="startPathEdit"
              class="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-800 dark:hover:text-gray-100 truncate max-w-[150px] sm:max-w-[200px]"
              :class="{ 'font-semibold text-gray-800 dark:text-gray-100': index === breadcrumbs.length - 1 }"
              :title="segment.label">
              {{ segment.label }}
            </a>
          </div>
        </li>
      </ol>
      <button @click="startPathEdit" class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 ml-1 flex-shrink-0"
        v-comfy-tooltip="'编辑路径'" aria-label="编辑路径">
        <PencilIcon class="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
      </button>
    </div>

    <div v-else class="flex items-center w-full">
      <input ref="pathInputRef" type="text" v-model="editablePath" @blur="finishPathEdit(false)"
        @keydown.enter="finishPathEdit(true)" @keydown.esc="cancelPathEdit"
        class="input input-sm input-bordered w-full dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        placeholder="输入路径..." />
      <button @click="finishPathEdit(true)" class="btn btn-xs btn-ghost ml-1 text-green-500" v-comfy-tooltip="'确认'">
        <CheckIcon class="h-4 w-4" />
      </button>
      <button @click="cancelPathEdit" class="btn btn-xs btn-ghost ml-1 text-red-500" v-comfy-tooltip="'取消'">
        <XMarkIcon class="h-4 w-4" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import { ArrowUpIcon, ChevronRightIcon, PencilIcon, CheckIcon, XMarkIcon, HomeIcon } from '@heroicons/vue/24/outline';
import { useDialogService } from '@/services/DialogService';

const fileManagerStore = useFileManagerStore();
const dialogService = useDialogService();

const breadcrumbs = computed(() => fileManagerStore.breadcrumbsSegments);
const currentPath = computed(() => fileManagerStore.currentLogicalPath);

const isEditingPath = ref(false);
const editablePath = ref('');
const pathInputRef = ref<HTMLInputElement | null>(null);

const canGoUp = computed(() => {
  const path = currentPath.value;
  if (!path || path.endsWith('://')) return false; // 已经是根协议
  const segments = path.replace(/\/$/, '').split('/');
  // 如果路径是 "user://" 或 "user://folder/"
  // "user:" -> 1 segment after split by '/' if no trailing slash
  // "user:", "" -> 2 segments for "user://"
  // "user:", "folder" -> 2 segments for "user://folder/"
  // We can go up if there's more than just the protocol part.
  // For "user://", segments are ["user:",""]. length 2. Cannot go up.
  // For "user://foo/", segments are ["user:","", "foo"]. length 3. Can go up.
  return segments.length > 2 || (segments.length === 2 && segments[1] !== '');
});


const navigateToSegment = (path: string) => {
  if (isEditingPath.value) return;
  fileManagerStore.navigateTo(path);
};

const goUpDirectory = () => {
  if (isEditingPath.value) return;
  fileManagerStore.goUp();
};

const startPathEdit = async () => {
  editablePath.value = currentPath.value;
  isEditingPath.value = true;
  await nextTick();
  pathInputRef.value?.focus();
  pathInputRef.value?.select();
};

const finishPathEdit = async (navigate: boolean) => {
  if (!isEditingPath.value) return;
  isEditingPath.value = false;
  const newPath = editablePath.value.trim();

  if (navigate && newPath && newPath !== currentPath.value) {
    // 简单的路径有效性检查 (示例)
    if (!newPath.includes('://') || !newPath.endsWith('/')) {
      // 尝试自动修正或提示
      let correctedPath = newPath;
      if (!newPath.includes('://')) {
        // 尝试从当前路径获取协议头
        const currentProto = currentPath.value.split('://')[0];
        if (currentProto && (currentProto === 'user' || currentProto === 'shared' || currentProto === 'system')) {
          correctedPath = `${currentProto}://${newPath.replace(/^\/+/, '')}`;
        } else {
          dialogService.showError('路径格式无效，必须包含协议头 (如 user://)。');
          return;
        }
      }
      if (!correctedPath.endsWith('/')) {
        correctedPath += '/';
      }
      // 再次检查修正后的路径
      if (!correctedPath.includes('://') || !correctedPath.endsWith('/')) {
        dialogService.showError('路径格式无效。示例: user://my/folder/');
        return;
      }
      editablePath.value = correctedPath; // 更新输入框中的值
      // console.log(`Path corrected from "${newPath}" to "${correctedPath}"`);
      if (correctedPath === currentPath.value) return; // 如果修正后与当前路径相同，则不导航
      fileManagerStore.navigateTo(correctedPath);

    } else {
      fileManagerStore.navigateTo(newPath);
    }
  }
};

const cancelPathEdit = () => {
  isEditingPath.value = false;
  editablePath.value = currentPath.value; // 恢复原路径
};

// 当外部路径变化时，如果正在编辑，则取消编辑状态
watch(currentPath, (newVal) => {
  if (isEditingPath.value && newVal !== editablePath.value) {
    isEditingPath.value = false;
  }
});

</script>

<style scoped>
.breadcrumbs-nav {
  min-height: 2.5rem;
  /* 确保在编辑和非编辑模式下高度一致 */
}

.input-sm {
  /* 确保和 FileToolbar 中的搜索框样式一致或相似 */
  @apply py-1 px-2 text-sm rounded-md;
}

.btn-xs {
  /* 确保和 FileToolbar 中的按钮样式一致或相似 */
  @apply px-2 py-0.5 text-xs rounded;
}

.btn-ghost {
  @apply bg-transparent border-transparent shadow-none hover:bg-gray-200 dark:hover:bg-gray-700;
}
</style>