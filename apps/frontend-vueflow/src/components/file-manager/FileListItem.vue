<template>
  <tr class="file-list-item hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
    :class="{ 'bg-blue-50 dark:bg-blue-900/50': isSelected }" @click.stop="emit('itemClick', $event, item)"
    @dblclick.stop="emit('itemDblClick', item)" @contextmenu.prevent="emit('itemContextMenu', $event, item)"
    :data-path="item.logicalPath" data-testid="fm-list-item">
    <td class="px-3 py-2 whitespace-nowrap w-10">
      <input type="checkbox" :checked="isSelected" @change.stop="emit('toggleSelect', item)" @click.stop
        class="checkbox checkbox-xs sm:checkbox-sm rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-500 dark:ring-offset-gray-800 dark:bg-gray-700" />
    </td>

    <!-- Dynamically rendered columns based on viewSettings.visibleColumns -->
    <template v-for="columnKey in visibleColumns" :key="columnKey">
      <td v-if="columnKey === 'name'" class="px-3 py-2 whitespace-nowrap text-sm" :class="getColumnWidthClass('name')">
        <div class="flex items-center">
          <component :is="item.itemType === 'directory' ? FolderIcon : getDocumentIcon(item.name)"
            class="h-5 w-5 mr-2 text-gray-400 dark:text-gray-500 flex-shrink-0"
            :class="{ 'text-blue-500 dark:text-blue-400': item.itemType === 'directory' }" />
          <span class="font-medium text-gray-900 dark:text-gray-100 truncate" :title="item.name">
            {{ item.name }}
          </span>
          <StarIcon v-if="isFavorite" class="h-3.5 w-3.5 ml-1.5 text-yellow-400 flex-shrink-0"
            v-comfy-tooltip="'已收藏'" />
        </div>
      </td>

      <td v-else-if="columnKey === 'size'" class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
        :class="getColumnWidthClass('size')">
        {{ formatSize(item.size) }}
      </td>

      <td v-else-if="columnKey === 'lastModified'"
        class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
        :class="getColumnWidthClass('lastModified')">
        {{ formatDate(item.lastModified) }}
      </td>

      <td v-else-if="columnKey === 'itemType'"
        class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
        :class="getColumnWidthClass('itemType')">
        {{ item.itemType === 'directory' ? '文件夹' : getItemMimeTypeDisplay(item) }}
      </td>

      <!-- Placeholder for other custom columns -->
      <td v-else class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
        :class="getColumnWidthClass(columnKey)">
        {{ safelyGetItemProperty(item, columnKey) }}
      </td>
    </template>

    <td class="px-3 py-2 whitespace-nowrap text-right text-sm font-medium w-12">
      <button @click.stop="emit('itemContextMenu', $event, item, true)"
        class="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
        v-comfy-tooltip="'更多操作'">
        <EllipsisVerticalIcon class="h-5 w-5" />
      </button>
    </td>
  </tr>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FAMItem } from '@comfytavern/types';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import {
  FolderIcon, DocumentIcon, StarIcon, EllipsisVerticalIcon,
  PhotoIcon, DocumentTextIcon, CodeBracketIcon, ArchiveBoxIcon, TableCellsIcon, FilmIcon, MusicalNoteIcon // Example icons
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  item: FAMItem;
  isSelected: boolean;
  visibleColumns: string[]; // Array of column keys to display
}>();

const emit = defineEmits<{
  (e: 'itemClick', event: MouseEvent, item: FAMItem): void;
  (e: 'itemDblClick', item: FAMItem): void;
  (e: 'itemContextMenu', event: MouseEvent, item: FAMItem, fromButton?: boolean): void;
  (e: 'toggleSelect', item: FAMItem): void;
}>();

const fileManagerStore = useFileManagerStore();
const isFavorite = computed(() => fileManagerStore.isFavorite(props.item.logicalPath));

const formatSize = (bytes?: number | null): string => {
  if (props.item.itemType === 'directory') return '-';
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
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return new Date(timestamp).toLocaleDateString(); // Fallback
  }
};

const getItemMimeTypeDisplay = (item: FAMItem): string => {
  if (item.itemType === 'directory') return '文件夹';
  if (item.mimeType) {
    if (item.mimeType.startsWith('image/')) return '图片';
    if (item.mimeType.startsWith('text/')) return '文本文档';
    if (item.mimeType === 'application/pdf') return 'PDF 文档';
    if (item.mimeType === 'application/zip' || item.mimeType === 'application/x-rar-compressed') return '压缩文件';
    // Add more specific types
    return item.mimeType.split('/')[1] || item.mimeType.split('/')[0] || '文件';
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

// Helper to get column width class, assuming pre-defined classes in FileBrowser or global styles
const columnWidths: Record<string, string> = {
  name: 'w-2/5 min-w-[200px]',
  size: 'w-1/5 min-w-[80px]',
  lastModified: 'w-1/5 min-w-[150px]',
  itemType: 'w-1/5 min-w-[100px]',
};
const getColumnWidthClass = (columnKey: string): string => {
  return columnWidths[columnKey] || 'w-auto';
};

// This is a placeholder. In a real scenario, you'd have a more robust way
// to map columnKey to item properties or custom render functions.
const safelyGetItemProperty = (item: FAMItem, key: string): string => {
  const value = (item as any)[key];
  if (value === null || typeof value === 'undefined') return '-';
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 30) + "..."; // Simple object display
  return String(value);
};

</script>

<style scoped>
/* .checkbox styles are provided by DaisyUI or Tailwind's form plugin. */

.file-list-item:hover .group-hover\:opacity-100 {
  opacity: 1;
}
</style>