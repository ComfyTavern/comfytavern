<template>
  <BaseModal :visible="visible" title="文件上传管理器" @close="handleClose" modal-class="w-full max-w-2xl"
    :close-on-backdrop="!isUploading" data-testid="fm-upload-manager-modal">
    <div class="p-4 sm:p-6 space-y-4 text-sm">
      <div v-if="!filesToUpload || filesToUpload.length === 0"
        class="text-center py-8 text-text-muted">
        <CloudArrowUpIcon class="h-16 w-16 mx-auto mb-3 opacity-50 text-text-muted" />
        <p>没有待上传的文件。</p>
        <p class="text-xs mt-1">您可以通过文件管理器的“上传”按钮选择文件。</p>
      </div>

      <div v-else class="space-y-3">
        <div class="flex justify-between items-center mb-3">
          <p class="text-text-base">
            目标路径: <strong class="font-mono">{{ targetPathDisplay }}</strong>
          </p>
          <div v-if="overallProgress > 0 && overallProgress < 100 && !allUploadsCompletedOrFailed"
            class="text-xs text-info">
            总体进度: {{ overallProgress.toFixed(0) }}%
          </div>
          <div v-if="allUploadsCompletedOrFailed && !isUploading" class="text-xs">
            <span v-if="successfulUploadsCount === filesToUpload.length"
              class="text-success">全部上传成功!</span>
            <span v-else class="text-warning">{{ successfulUploadsCount }} / {{
              filesToUpload.length }} 个成功</span>
          </div>
        </div>

        <!-- 总体进度条 (可选) -->
        <progress v-if="isUploading || (overallProgress > 0 && overallProgress < 100)"
          class="progress progress-info w-full h-2" :value="overallProgress" max="100"></progress>

        <div class="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          <div v-for="fileEntry in uploadQueue" :key="fileEntry.id"
            class="p-2.5 border rounded-md border-border-base bg-background-base">
            <div class="flex items-center justify-between">
              <div class="flex items-center overflow-hidden">
                <component :is="getFileIcon(fileEntry.file.name)"
                  class="h-6 w-6 mr-2 text-text-muted flex-shrink-0" />
                <div class="truncate">
                  <p class="font-medium text-text-base truncate" :title="fileEntry.file.name">
                    {{ fileEntry.file.name }}
                  </p>
                  <p class="text-xs text-text-muted">
                    {{ formatFileSize(fileEntry.file.size) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center space-x-2 flex-shrink-0 ml-2">
                <span v-if="fileEntry.status === 'uploading'" class="text-xs text-info">
                  {{ fileEntry.progress.toFixed(0) }}%
                </span>
                <CheckCircleIcon v-if="fileEntry.status === 'success'"
                  class="h-5 w-5 text-success" />
                <XCircleIcon v-if="fileEntry.status === 'error'" class="h-5 w-5 text-error"
                  v-comfy-tooltip="fileEntry.error || '上传失败'" />
                <ClockIcon v-if="fileEntry.status === 'pending'" class="h-5 w-5 text-text-muted"
                  v-comfy-tooltip="'等待上传'" />
                <PauseCircleIcon v-if="fileEntry.status === 'paused'"
                  class="h-5 w-5 text-warning" v-comfy-tooltip="'已暂停'" />

                <!-- 单个文件操作按钮 (未来扩展) -->
                <!-- <button v-if="fileEntry.status === 'pending' || fileEntry.status === 'error'" @click="retryUpload(fileEntry.id)" class="btn btn-xs btn-ghost">重试</button> -->
                <!-- <button v-if="fileEntry.status === 'uploading'" @click="pauseUpload(fileEntry.id)" class="btn btn-xs btn-ghost">暂停</button> -->
                <!-- <button v-if="fileEntry.status === 'paused'" @click="resumeUpload(fileEntry.id)" class="btn btn-xs btn-ghost">继续</button> -->
                <button v-if="canCancel(fileEntry)" @click="cancelUpload(fileEntry.id)"
                  class="btn btn-xs btn-ghost text-error hover:bg-error/10"
                  v-comfy-tooltip="'取消上传'">
                  <XMarkIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
            <progress v-if="fileEntry.status === 'uploading'" class="progress progress-info w-full h-1 mt-1"
              :value="fileEntry.progress" max="100"></progress>
            <p v-if="fileEntry.status === 'error'" class="text-xs text-error mt-1 truncate"
              :title="fileEntry.error || undefined">
              错误: {{ fileEntry.error }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center p-3 bg-background-surface rounded-b-md">
        <div>
          <button v-if="hasPendingOrPaused" @click="startAllUploads" class="btn btn-sm btn-success mr-2"
            :disabled="isUploading">
            <PlayIcon class="h-5 w-5 mr-1.5" />
            全部开始
          </button>
          <!-- <button
            v-if="isUploading && !allPaused"
            @click="pauseAllUploads"
            class="btn btn-sm btn-warning mr-2"
          >
            <PauseIcon class="h-5 w-5 mr-1.5" />
            全部暂停
          </button> -->
        </div>
        <button @click="handleClose" class="btn btn-sm btn-ghost" :disabled="isUploading && !allowCloseWhenUploading">
          {{ closeButtonText }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'; // nextTick was removed, PauseIcon was removed
import BaseModal from '@/components/common/BaseModal.vue';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import * as fileManagerApi from '@/api/fileManagerApi';
import {
  CloudArrowUpIcon, CheckCircleIcon, XCircleIcon, ClockIcon, PauseCircleIcon, PlayIcon, XMarkIcon, // PauseIcon removed
  DocumentIcon, PhotoIcon, DocumentTextIcon, CodeBracketIcon, ArchiveBoxIcon, TableCellsIcon, FilmIcon, MusicalNoteIcon
} from '@heroicons/vue/24/outline';
import { nanoid } from "nanoid";

interface UploadFileEntry {
  id: string; // Unique ID for this entry
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'paused' | 'cancelled';
  progress: number; // 0-100
  error?: string | null;
  // xhr?: XMLHttpRequest; // For aborting, not used with useApi directly
}

const props = defineProps<{
  visible: boolean;
  filesToUpload: FileList | null; // Files passed from the trigger
  targetPath: string; // Target directory logical path
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'uploadsFinished', results: { successCount: number, errorCount: number }): void;
}>();

const fileManagerStore = useFileManagerStore();
const uploadQueue = ref<UploadFileEntry[]>([]);
const isUploading = ref(false); // True if any file is actively being uploaded or in queue to be auto-started
const allowCloseWhenUploading = ref(false); // Or make it a prop

const targetPathDisplay = computed(() => props.targetPath || fileManagerStore.currentLogicalPath || '未知路径');

const overallProgress = computed(() => {
  if (uploadQueue.value.length === 0) return 0;
  const totalSize = uploadQueue.value.reduce((sum, entry) => sum + entry.file.size, 0);
  if (totalSize === 0) return 0; // Avoid division by zero if all files are empty
  const uploadedSize = uploadQueue.value.reduce((sum, entry) => {
    return sum + (entry.file.size * entry.progress) / 100;
  }, 0);
  return (uploadedSize / totalSize) * 100;
});

const successfulUploadsCount = computed(() => uploadQueue.value.filter(f => f.status === 'success').length);
const failedUploadsCount = computed(() => uploadQueue.value.filter(f => f.status === 'error').length);
// const pendingUploadsCount = computed(() => uploadQueue.value.filter(f => f.status === 'pending').length); // Unused

const allUploadsCompletedOrFailed = computed(() => {
  return uploadQueue.value.length > 0 && uploadQueue.value.every(f => f.status === 'success' || f.status === 'error' || f.status === 'cancelled');
});

const hasPendingOrPaused = computed(() => {
  return uploadQueue.value.some(f => f.status === 'pending' || f.status === 'paused');
});

const closeButtonText = computed(() => {
  if (isUploading.value && !allowCloseWhenUploading.value) return "上传中...";
  if (allUploadsCompletedOrFailed.value) return "完成";
  return "关闭";
});


watch(() => props.visible, (newVal) => {
  if (newVal && props.filesToUpload) {
    initializeQueue(props.filesToUpload);
    // Optionally auto-start uploads if modal becomes visible with files
    // nextTick(() => startAllUploads());
  } else if (!newVal) {
    // Reset queue or handle ongoing uploads if modal is closed externally
    // For simplicity, we might just cancel ongoing ones or let them finish if allowCloseWhenUploading is true
    if (isUploading.value && !allowCloseWhenUploading.value) {
      // console.warn("UploadManagerModal closed externally while uploads are in progress.");
      // Potentially pause or cancel all
    }
  }
});

const initializeQueue = (files: FileList) => {
  uploadQueue.value = Array.from(files).map(file => ({
    id: nanoid(), // Generate unique ID
    file,
    status: 'pending',
    progress: 0,
    error: null,
  }));
  isUploading.value = false; // Reset uploading state
};

const processFileUpload = async (entry: UploadFileEntry) => {
  if (entry.status !== 'pending' && entry.status !== 'paused') return; // Only process pending/paused

  const formData = new FormData();
  formData.append('files', entry.file, entry.file.name); // 'files' must match backend

  entry.status = 'uploading';
  entry.progress = 0; // Reset progress if retrying
  entry.error = null;
  isUploading.value = true; // Global uploading flag
  let progressIntervalId: ReturnType<typeof setInterval> | undefined = undefined;

  try {
    // fileManagerApi.writeFile does not support progress reporting directly with useApi
    // For progress, a more direct axios instance or fetch with ReadableStream would be needed.
    // This is a simplified version without granular progress for each file via API.
    // We'll simulate progress or just mark as 100% on success.

    // Simulate progress for demo
    let p = 0;
    progressIntervalId = setInterval(() => {
      if (entry.status !== 'uploading') {
        if (progressIntervalId) clearInterval(progressIntervalId);
        return;
      }
      p += 10;
      if (p <= 100) {
        entry.progress = p;
      } else {
        // Don't let simulated progress complete it, actual API call will
      }
    }, 100);


    await fileManagerApi.writeFile(props.targetPath || fileManagerStore.currentLogicalPath, formData);
    if (progressIntervalId) clearInterval(progressIntervalId); // Stop simulation
    entry.progress = 100;
    entry.status = 'success';
  } catch (err) {
    if (progressIntervalId) clearInterval(progressIntervalId); // Stop simulation
    entry.status = 'error';
    entry.error = (err as Error).message || '未知上传错误';
    console.error(`Failed to upload ${entry.file.name}:`, err);
  } finally {
    // Check if all uploads are done
    if (uploadQueue.value.every(e => e.status === 'success' || e.status === 'error' || e.status === 'cancelled')) {
      isUploading.value = false;
      emit('uploadsFinished', { successCount: successfulUploadsCount.value, errorCount: failedUploadsCount.value });
      fileManagerStore.fetchItems(); // Refresh file list in the background
    }
    // Trigger next upload if in sequential mode (not implemented here, assumes parallel or manual start)
  }
};

const startAllUploads = () => {
  uploadQueue.value.forEach(entry => {
    if (entry.status === 'pending' || entry.status === 'paused') {
      processFileUpload(entry);
    }
  });
};

const cancelUpload = (id: string) => {
  const entry = uploadQueue.value.find(e => e.id === id);
  if (entry && (entry.status === 'pending' || entry.status === 'uploading' || entry.status === 'paused')) {
    // If using XHR, entry.xhr.abort();
    entry.status = 'cancelled';
    entry.progress = 0;
    // Check if this was the last active upload
    if (!uploadQueue.value.some(e => e.status === 'uploading' || e.status === 'pending' || e.status === 'paused')) {
      isUploading.value = false;
    }
  }
};
const canCancel = (entry: UploadFileEntry) => {
  return entry.status === 'pending' || entry.status === 'uploading' || entry.status === 'paused';
};


const handleClose = () => {
  if (isUploading.value && !allowCloseWhenUploading.value) {
    // Optionally confirm if user wants to cancel ongoing uploads
    // For now, just prevent closing or allow based on prop
    return;
  }
  emit('close');
  // Reset state if modal is closed and uploads are done or cancelled
  if (!isUploading.value) {
    uploadQueue.value = [];
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return DocumentIcon;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return PhotoIcon;
  if (['txt', 'md', 'log', 'json', 'xml', 'yaml', 'ini'].includes(ext)) return DocumentTextIcon;
  if (['js', 'ts', 'html', 'css', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'rb', 'sh'].includes(ext)) return CodeBracketIcon;
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return ArchiveBoxIcon;
  if (['csv', 'xls', 'xlsx'].includes(ext)) return TableCellsIcon;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return FilmIcon;
  if (['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(ext)) return MusicalNoteIcon;
  return DocumentIcon;
};

</script>

<style scoped>
/* .progress* and .btn* styles are provided by DaisyUI. */
/* In the template, classes like 'progress progress-info', 'btn btn-sm', etc., are used directly. */
</style>