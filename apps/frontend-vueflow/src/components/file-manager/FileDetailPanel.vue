<template>
  <div
    class="file-detail-panel h-full flex flex-col bg-background-surface border-l border-border-base shadow-lg relative"
    data-testid="fm-detail-panel-component">
    <!-- Resizer Handle -->
    <div
          class="panel-resizer absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary-soft transition-colors duration-150 z-10"
          @mousedown.prevent="startResize" :title="t('fileManager.detailPanel.resize')"></div>
    
        <header class="pl-3 pr-3 py-3 border-b border-border-base flex items-center justify-between flex-shrink-0">
          <h3 class="text-base font-semibold text-text-base truncate ml-1.5" :title="panelTitle">
            <!-- Added ml-1.5 for spacing from resizer -->
            {{ panelTitle }}
          </h3>
          <div class="flex items-center">
            <!-- Tab切换按钮 -->
            <div class="tabs tabs-xs sm:tabs-sm mr-2" v-if="selectedItem">
              <button class="tab tab-lifted tab-xs sm:tab-sm" :class="{ 'tab-active': activeTab === 'properties' }"
                @click="setActiveTab('properties')" :title="t('fileManager.detailPanel.properties')">
                <InformationCircleIcon class="h-4 w-4 sm:h-5 sm:w-5" />
                <span class="hidden sm:inline ml-1">{{ t('fileManager.detailPanel.properties') }}</span>
              </button>
              <button v-if="canPreview" class="tab tab-lifted tab-xs sm:tab-sm"
                :class="{ 'tab-active': activeTab === 'preview' }" @click="setActiveTab('preview')" :title="t('fileManager.detailPanel.preview')">
                <EyeIcon class="h-4 w-4 sm:h-5 sm:w-5" />
                <span class="hidden sm:inline ml-1">{{ t('fileManager.detailPanel.preview') }}</span>
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
              class="p-1.5 rounded-md hover:bg-background-base text-text-muted"
              :title="t('fileManager.detailPanel.close')" :aria-label="t('fileManager.detailPanel.close')">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
        </header>
    
        <div class="panel-content flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <div v-if="!selectedItem" class="text-center text-text-muted py-10">
            <InformationCircleIcon class="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>{{ t('fileManager.detailPanel.noItemSelected') }}</p>
          </div>
    
          <template v-if="selectedItem">
            <!-- 属性视图 -->
            <div v-if="activeTab === 'properties'" class="space-y-3">
              <div class="property-row">
                <label class="property-label">{{ t('fileManager.detailPanel.propName') }}</label>
                <div class="property-value flex items-center">
                  <component :is="selectedItem.itemType === 'directory' ? FolderIcon : getDocumentIcon(selectedItem.name)"
                    class="h-5 w-5 mr-2 text-text-muted flex-shrink-0" />
                  <span class="truncate" :title="selectedItem.name">{{ selectedItem.name }}</span>
                  <!-- TODO: 内联编辑名称 -->
                </div>
              </div>
              <div class="property-row">
                <label class="property-label">{{ t('fileManager.detailPanel.propType') }}</label>
                <span class="property-value">{{ getItemMimeTypeDisplay(selectedItem) }}</span>
              </div>
              <div v-if="selectedItem.itemType === 'file'" class="property-row">
                <label class="property-label">{{ t('fileManager.detailPanel.propSize') }}</label>
                <span class="property-value">{{ formatSize(selectedItem.size) }}</span>
              </div>
              <div class="property-row">
                <label class="property-label">{{ t('fileManager.detailPanel.propPath') }}</label>
                <span class="property-value break-all" :title="selectedItem.logicalPath">{{ selectedItem.logicalPath
                }}</span>
              </div>
              <div class="property-row">
                <label class="property-label">{{ t('fileManager.detailPanel.propLastModified') }}</label>
                <span class="property-value">{{ formatDate(selectedItem.lastModified) }}</span>
              </div>
              <div v-if="selectedItem.isSymlink && selectedItem.targetLogicalPath" class="property-row">
                <label class="property-label">{{ t('fileManager.detailPanel.propSymlinkTarget') }}</label>
                <span class="property-value break-all" :title="selectedItem.targetLogicalPath">{{
                  selectedItem.targetLogicalPath }}</span>
              </div>
              <div class="property-row">
                <label class="property-label">{{ t('fileManager.detailPanel.propWritable') }}</label>
                <span class="property-value">{{ t(selectedItem.isWritable ? 'fileManager.detailPanel.yes' : 'fileManager.detailPanel.no') }}</span>
              </div>
              <div class="property-row">
                <label class="property-label">{{ t('fileManager.detailPanel.propFavorite') }}</label>
                <button @click="toggleFavorite" class="btn btn-xs btn-ghost">
                  <StarIcon class="h-4 w-4 mr-1" :class="isFavorite ? 'text-warning fill-current' : 'text-text-muted'" />
                  {{ t(isFavorite ? 'fileManager.detailPanel.favorited' : 'fileManager.detailPanel.notFavorited') }}
                </button>
              </div>
              <!-- 更多属性... -->
            </div>
    
            <!-- 预览视图 -->
            <div v-if="activeTab === 'preview' && canPreview">
              <div v-if="previewError" class="text-error bg-error-softest p-4 rounded-md">
                <p><strong>{{ t('fileManager.detailPanel.previewFailed') }}</strong></p>
                <p>{{ previewError }}</p>
              </div>
              <div v-else-if="isLoadingPreview" class="text-center py-8">
                <ArrowPathIcon class="h-8 w-8 animate-spin text-primary mx-auto" />
                <p class="mt-2 text-text-muted">{{ t('fileManager.detailPanel.loadingPreview') }}</p>
              </div>
              <template v-else>
                <!-- 图片预览 -->
                <img v-if="previewType === 'image' && previewContent" :src="previewContent" :alt="t('fileManager.detailPanel.preview')"
                  class="max-w-full h-auto rounded-md shadow" />
                <!-- 文本预览 -->
                <pre v-else-if="previewType === 'text' && typeof previewContent === 'string'"
                  class="text-xs bg-background-base p-3 rounded-md overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">{{ previewContent }}</pre>
                <!-- PDF 预览 (可能需要 iframe 或特定库) -->
                <iframe v-else-if="previewType === 'pdf' && previewContent" :src="previewContent"
                  class="w-full h-[70vh] border rounded-md" :title="t('fileManager.detailPanel.preview')"></iframe>
                <div v-else class="text-text-muted">
                  {{ t('fileManager.detailPanel.previewUnsupported') }}
                </div>
              </template>
            </div>

        <!-- 操作视图 (未来扩展) -->
        <!-- <div v-if="activeTab === 'actions'">
          <p class="text-text-muted">相关操作将显示在此处。</p>
        </div> -->
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'; // + onUnmounted
import { useI18n } from 'vue-i18n';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import { useUiStore } from '@/stores/uiStore'; // + 导入 uiStore
import type { FAMItem } from '@comfytavern/types';
import * as fileManagerApi from '@/api/fileManagerApi'; // For potential direct API calls like fetching preview
import {
  InformationCircleIcon, EyeIcon, /* BoltIcon, */ XMarkIcon, FolderIcon, DocumentIcon, StarIcon, ArrowPathIcon,
  PhotoIcon, DocumentTextIcon, CodeBracketIcon, ArchiveBoxIcon, TableCellsIcon, FilmIcon, MusicalNoteIcon
} from '@heroicons/vue/24/outline';

const fileManagerStore = useFileManagerStore();
const uiStore = useUiStore(); // + 初始化 uiStore
const { t } = useI18n();

const selectedItem = computed(() => fileManagerStore.selectedItemForDetail);
const activeTab = computed(() => fileManagerStore.detailPanelActiveTab);

const previewContent = ref<string | null>(null); // Can be URL for images/PDF, or text content
const previewType = ref<'image' | 'text' | 'pdf' | 'unsupported' | null>(null);
const isLoadingPreview = ref(false);
const previewError = ref<string | null>(null);

const panelTitle = computed(() => {
  if (!selectedItem.value) return t('fileManager.detailPanel.title');
  return selectedItem.value.name || t('fileManager.detailPanel.titleForItem');
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
  // fileManagerStore.toggleDetailPanel(false); // 旧逻辑
  uiStore.closeFileManagerDetailPanel(); // 新逻辑，调用 uiStore 的 action
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

const getItemMimeTypeDisplay = (item: FAMItem): string => {
  if (item.itemType === 'directory') return t('fileManager.detailPanel.typeFolder');
  if (item.mimeType) {
    if (item.mimeType.startsWith('image/')) return t('fileManager.detailPanel.typeImage');
    if (item.mimeType.startsWith('text/')) return t('fileManager.detailPanel.typeText');
    if (item.mimeType === 'application/pdf') return t('fileManager.detailPanel.typePdf');
    if (item.mimeType === 'application/zip' || item.mimeType === 'application/x-rar-compressed') return t('fileManager.detailPanel.typeArchive');
    return item.mimeType;
  }
  const ext = item.name.split('.').pop()?.toLowerCase();
  if (ext) return t('fileManager.detailPanel.typeFile', { ext: ext.toUpperCase() });
  return t('fileManager.detailPanel.typeGenericFile');
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

const fetchPreview = async (item: FAMItem) => {
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
            if (!response.ok) throw new Error(t('fileManager.detailPanel.serverError', { error: response.statusText }));
            const text = await response.text();
            // Limit preview size for very large text files
            previewContent.value = text.length > 50000 ? text.substring(0, 50000) + `\n... (${t('fileManager.detailPanel.previewTooLarge')})` : text;
          } else {
            previewType.value = 'unsupported';
          }
        } catch (err) {
          console.error('Error fetching preview:', err);
          previewError.value = (err as Error).message || t('fileManager.detailPanel.previewFailed');
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

// --- Resizing Logic ---
const isResizing = ref(false);
const initialMouseX = ref(0);
const initialPanelWidth = ref(0);

const startResize = (event: MouseEvent) => {
  isResizing.value = true;
  initialMouseX.value = event.clientX;
  initialPanelWidth.value = uiStore.fileManagerDetailPanelWidth;

  document.documentElement.style.cursor = 'col-resize';
  document.documentElement.style.userSelect = 'none';

  document.addEventListener('mousemove', handleResizing);
  document.addEventListener('mouseup', stopResizing);
};

const handleResizing = (event: MouseEvent) => {
  if (!isResizing.value) return;
  const deltaX = event.clientX - initialMouseX.value;
  const newWidth = initialPanelWidth.value - deltaX; // Resizer is on the left, dragging left decreases X (increases width)
  uiStore.setFileManagerDetailPanelWidth(newWidth);
};

const stopResizing = () => {
  if (!isResizing.value) return;
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResizing);
  document.removeEventListener('mouseup', stopResizing);

  document.documentElement.style.cursor = '';
  document.documentElement.style.userSelect = '';
};

onUnmounted(() => {
  if (isResizing.value) {
    stopResizing(); // Clean up global listeners if unmounted during resize
  }
});
</script>

<style scoped>
/* Resizer hover effect is handled by Tailwind classes in the template. */

.property-row {
  @apply flex flex-col sm:flex-row sm:items-center border-b border-border-base/50 pb-2 mb-2;
}

.property-label {
  @apply w-full sm:w-1/3 font-medium text-text-secondary mb-1 sm:mb-0 flex-shrink-0;
}

.property-value {
  @apply w-full sm:w-2/3 text-text-base;
}

/* DaisyUI provides styles for .tabs, .tab, .tab-lifted, .tab-active. */
/* Customizations for DaisyUI tabs, if necessary, should be in shared.css or tailwind.config.js. */

/* .btn-xs and .btn-ghost styles are provided by DaisyUI. */
</style>