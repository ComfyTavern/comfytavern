<template>
  <div class="file-detail-panel h-full flex flex-col bg-white dark:bg-gray-800 border-l dark:border-gray-700 shadow-lg"
    data-testid="fm-detail-panel-component">
    <header class="p-3 border-b dark:border-gray-700 flex items-center justify-between flex-shrink-0">
      <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100 truncate" :title="panelTitle">
        {{ panelTitle }}
      </h3>
      <div class="flex items-center">
        <!-- Tab切换按钮 -->
        <div class="tabs tabs-xs sm:tabs-sm mr-2" v-if="selectedItem">
          <button class="tab tab-lifted tab-xs sm:tab-sm" :class="{ 'tab-active': activeTab === 'properties' }"
            @click="setActiveTab('properties')" v-comfy-tooltip="'属性'">
            <InformationCircleIcon class="h-4 w-4 sm:h-5 sm:w-5" />
            <span class="hidden sm:inline ml-1">属性</span>
          </button>
          <button v-if="canPreview" class="tab tab-lifted tab-xs sm:tab-sm"
            :class="{ 'tab-active': activeTab === 'preview' }" @click="setActiveTab('preview')" v-comfy-tooltip="'预览'">
            <EyeIcon class="h-4 w-4 sm:h-5 sm:w-5" />
            <span class="hidden sm:inline ml-1">预览</span>
          </button>
          <!-- <button
            class="tab tab-lifted tab-xs sm:tab-sm"
            :class="{ 'tab-active': activeTab === 'actions' }"
            @click="setActiveTab('actions')"
            v-comfy-tooltip="'操作'"
          >
            <BoltIcon class="h-4 w-4 sm:h-5 sm:w-5" />
            <span class="hidden sm:inline ml-1">操作</span>
          </button> -->
        </div>
        <button @click="closePanel"
          class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          v-comfy-tooltip="'关闭面板'" aria-label="关闭面板">
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>
    </header>

    <div class="panel-content flex-1 overflow-y-auto p-4 space-y-4 text-sm">
      <div v-if="!selectedItem" class="text-center text-gray-500 dark:text-gray-400 py-10">
        <InformationCircleIcon class="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>未选择任何项目</p>
      </div>

      <template v-if="selectedItem">
        <!-- 属性视图 -->
        <div v-if="activeTab === 'properties'" class="space-y-3">
          <div class="property-row">
            <label class="property-label">名称:</label>
            <div class="property-value flex items-center">
              <component :is="selectedItem.itemType === 'directory' ? FolderIcon : getDocumentIcon(selectedItem.name)"
                class="h-5 w-5 mr-2 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span class="truncate" :title="selectedItem.name">{{ selectedItem.name }}</span>
              <!-- TODO: 内联编辑名称 -->
            </div>
          </div>
          <div class="property-row">
            <label class="property-label">类型:</label>
            <span class="property-value">{{ selectedItem.itemType === 'directory' ? '文件夹' :
              getItemMimeTypeDisplay(selectedItem) }}</span>
          </div>
          <div v-if="selectedItem.itemType === 'file'" class="property-row">
            <label class="property-label">大小:</label>
            <span class="property-value">{{ formatSize(selectedItem.size) }}</span>
          </div>
          <div class="property-row">
            <label class="property-label">路径:</label>
            <span class="property-value break-all" :title="selectedItem.logicalPath">{{ selectedItem.logicalPath
              }}</span>
          </div>
          <div class="property-row">
            <label class="property-label">最后修改:</label>
            <span class="property-value">{{ formatDate(selectedItem.lastModified) }}</span>
          </div>
          <div v-if="selectedItem.isSymlink && selectedItem.targetLogicalPath" class="property-row">
            <label class="property-label">符号链接目标:</label>
            <span class="property-value break-all" :title="selectedItem.targetLogicalPath">{{
              selectedItem.targetLogicalPath }}</span>
          </div>
          <div class="property-row">
            <label class="property-label">可写:</label>
            <span class="property-value">{{ selectedItem.isWritable ? '是' : '否' }}</span>
          </div>
          <div class="property-row">
            <label class="property-label">收藏:</label>
            <button @click="toggleFavorite" class="btn btn-xs btn-ghost">
              <StarIcon class="h-4 w-4 mr-1" :class="isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-400'" />
              {{ isFavorite ? '已收藏' : '未收藏' }}
            </button>
          </div>
          <!-- 更多属性... -->
        </div>

        <!-- 预览视图 -->
        <div v-if="activeTab === 'preview' && canPreview">
          <div v-if="previewError" class="text-red-500 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/30 rounded-md">
            <p><strong>预览失败:</strong></p>
            <p>{{ previewError }}</p>
          </div>
          <div v-else-if="isLoadingPreview" class="text-center py-8">
            <ArrowPathIcon class="h-8 w-8 animate-spin text-blue-500 mx-auto" />
            <p class="mt-2 text-gray-500 dark:text-gray-400">正在加载预览...</p>
          </div>
          <template v-else>
            <!-- 图片预览 -->
            <img v-if="previewType === 'image' && previewContent" :src="previewContent" alt="文件预览"
              class="max-w-full h-auto rounded-md shadow" />
            <!-- 文本预览 -->
            <pre v-else-if="previewType === 'text' && typeof previewContent === 'string'"
              class="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">{{ previewContent }}</pre>
            <!-- PDF 预览 (可能需要 iframe 或特定库) -->
            <iframe v-else-if="previewType === 'pdf' && previewContent" :src="previewContent"
              class="w-full h-[70vh] border rounded-md" title="PDF预览"></iframe>
            <div v-else class="text-gray-500 dark:text-gray-400">
              此文件类型不支持预览，或预览内容为空。
            </div>
          </template>
        </div>

        <!-- 操作视图 (未来扩展) -->
        <!-- <div v-if="activeTab === 'actions'">
          <p class="text-gray-500 dark:text-gray-400">相关操作将显示在此处。</p>
        </div> -->
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import type { FAMListItem } from '@/api/fileManagerApi';
import * as fileManagerApi from '@/api/fileManagerApi'; // For potential direct API calls like fetching preview
import {
  InformationCircleIcon, EyeIcon, /* BoltIcon, */ XMarkIcon, FolderIcon, DocumentIcon, StarIcon, ArrowPathIcon,
  PhotoIcon, DocumentTextIcon, CodeBracketIcon, ArchiveBoxIcon, TableCellsIcon, FilmIcon, MusicalNoteIcon
} from '@heroicons/vue/24/outline';

const fileManagerStore = useFileManagerStore();

const selectedItem = computed(() => fileManagerStore.selectedItemForDetail);
const activeTab = computed(() => fileManagerStore.detailPanelActiveTab);

const previewContent = ref<string | null>(null); // Can be URL for images/PDF, or text content
const previewType = ref<'image' | 'text' | 'pdf' | 'unsupported' | null>(null);
const isLoadingPreview = ref(false);
const previewError = ref<string | null>(null);

const panelTitle = computed(() => {
  if (!selectedItem.value) return '详情';
  return selectedItem.value.name || '项目详情';
});

const isFavorite = computed(() => selectedItem.value && fileManagerStore.isFavorite(selectedItem.value.logicalPath));

const canPreview = computed(() => {
  if (!selectedItem.value || selectedItem.value.itemType === 'directory') return false;
  const mime = selectedItem.value.mimeType?.toLowerCase();
  const name = selectedItem.value.name.toLowerCase();
  if (mime?.startsWith('image/')) return true;
  if (mime?.startsWith('text/')) return true;
  if (mime === 'application/pdf') return true;
  if (['.md', '.json', '.xml', '.log', '.py', '.js', '.ts', '.css', '.html'].some(ext => name.endsWith(ext))) return true; // Common text-based extensions
  return false;
});

const setActiveTab = (tab: 'properties' | 'preview' | 'actions') => {
  fileManagerStore.setDetailPanelTab(tab);
};

const closePanel = () => {
  fileManagerStore.toggleDetailPanel(false);
};

const toggleFavorite = () => {
  if (!selectedItem.value) return;
  if (isFavorite.value) {
    fileManagerStore.removeFromFavorites(selectedItem.value.logicalPath);
  } else {
    fileManagerStore.addToFavorites(selectedItem.value.logicalPath);
  }
};

const formatSize = (bytes?: number | null): string => {
  if (bytes === null || typeof bytes === 'undefined') return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (timestamp?: number | null): string => {
  if (!timestamp) return '-';
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch (e) {
    return new Date(timestamp).toLocaleDateString();
  }
};

const getItemMimeTypeDisplay = (item: FAMListItem): string => {
  if (item.itemType === 'directory') return '文件夹';
  if (item.mimeType) {
    if (item.mimeType.startsWith('image/')) return '图片';
    if (item.mimeType.startsWith('text/')) return '文本文档';
    if (item.mimeType === 'application/pdf') return 'PDF 文档';
    if (item.mimeType === 'application/zip' || item.mimeType === 'application/x-rar-compressed') return '压缩文件';
    return item.mimeType;
  }
  const ext = item.name.split('.').pop()?.toLowerCase();
  if (ext) return `${ext.toUpperCase()} 文件`;
  return '文件';
};

const getDocumentIcon = (filename: string) => {
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

const fetchPreview = async (item: FAMListItem) => {
  if (!canPreview.value || !item || item.itemType === 'directory') {
    previewType.value = 'unsupported';
    previewContent.value = null;
    return;
  }

  isLoadingPreview.value = true;
  previewError.value = null;
  previewContent.value = null;

  const mime = item.mimeType?.toLowerCase();
  const name = item.name.toLowerCase();

  try {
    if (mime?.startsWith('image/')) {
      previewType.value = 'image';
      // For images, the "preview content" could be a direct URL if the FAM system provides one,
      // or a base64 data URL if we fetch the blob and convert it.
      // Assuming getDownloadFileLink gives a direct link or a link that can be used in <img> src.
      previewContent.value = await fileManagerApi.getDownloadFileLink(item.logicalPath);
    } else if (mime === 'application/pdf') {
      previewType.value = 'pdf';
      // For PDFs, use a direct link or a data URL that the iframe can load.
      // Browsers can typically render PDFs in an iframe if the Content-Disposition is not 'attachment'.
      previewContent.value = await fileManagerApi.getDownloadFileLink(item.logicalPath);
      // Alternatively, if getDownloadFileLink returns a link that forces download,
      // you might need a specific backend endpoint that serves the PDF inline,
      // or use a library like PDF.js for client-side rendering.
    } else if (mime?.startsWith('text/') || ['.md', '.json', '.xml', '.log', '.py', '.js', '.ts', '.css', '.html'].some(ext => name.endsWith(ext))) {
      previewType.value = 'text';
      // Fetch text content. This might need a specific API endpoint like getFileContentAsString
      // For now, let's assume getDownloadFileLink can be fetched and read as text.
      // This is a simplified example; direct blob fetching and reading is more robust.
      const response = await fetch(await fileManagerApi.getDownloadFileLink(item.logicalPath));
      if (!response.ok) throw new Error(`服务器错误: ${response.statusText}`);
      const text = await response.text();
      // Limit preview size for very large text files
      previewContent.value = text.length > 50000 ? text.substring(0, 50000) + "\n... (文件过大，仅显示部分内容)" : text;
    } else {
      previewType.value = 'unsupported';
    }
  } catch (err) {
    console.error('Error fetching preview:', err);
    previewError.value = (err as Error).message || '加载预览失败。';
    previewType.value = 'unsupported';
  } finally {
    isLoadingPreview.value = false;
  }
};

watch(
  [selectedItem, activeTab], // Watch an array of refs/computed directly
  ([newItem, newTab], [_oldItem, _oldTab]) => { // Prefix unused old values with underscore
    // newItem will be the new value of selectedItem.value (FAMListItem | null)
    // newTab will be the new value of activeTab.value ('properties' | 'preview' | 'actions' | null)
    if (newTab === 'preview' && newItem) {
      fetchPreview(newItem);
    } else {
      // Clear preview when not on preview tab or no item selected
      previewContent.value = null;
      previewType.value = null;
      isLoadingPreview.value = false;
      previewError.value = null;
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.property-row {
  @apply flex flex-col sm:flex-row sm:items-center border-b border-gray-100 dark:border-gray-700/50 pb-2 mb-2;
}

.property-label {
  @apply w-full sm:w-1/3 font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-0 flex-shrink-0;
}

.property-value {
  @apply w-full sm:w-2/3 text-gray-800 dark:text-gray-200;
}

/* For DaisyUI-like tabs */
.tabs .tab {
  @apply px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm;
}

.tab-lifted.tab-active {
  @apply bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 border-b-transparent rounded-t-md;
  /* Simulate uplift */
  transform: translateY(-1px);
}

.tab:not(.tab-active) {
  border-bottom-width: 1px;
  /* Ensure non-active tabs have a bottom border to align with active one */
}

.btn-xs {
  @apply px-2 py-0.5 text-xs rounded;
}

.btn-ghost {
  @apply bg-transparent border-transparent shadow-none hover:bg-gray-200 dark:hover:bg-gray-700;
}
</style>