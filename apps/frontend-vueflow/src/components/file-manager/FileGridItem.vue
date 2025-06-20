<template>
  <div
    class="file-grid-item group relative p-2 rounded-lg hover:bg-background-surface cursor-pointer flex flex-col items-center text-center shadow-sm border border-transparent hover:border-border-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :class="{
      'bg-primary/10 ring-2 ring-primary': isSelected,
      'h-32 sm:h-36': thumbnailSizeClass === 'small', // Adjusted for consistency
      'h-40 sm:h-48': thumbnailSizeClass === 'medium',
      'h-48 sm:h-56': thumbnailSizeClass === 'large',
    }" @click.stop="emit('itemClick', $event, item)" @dblclick.stop="emit('itemDblClick', item)"
    @contextmenu.prevent="emit('itemContextMenu', $event, item)" :data-path="item.logicalPath"
    data-testid="fm-grid-item" role="button" tabindex="0" :aria-label="item.name" :aria-selected="isSelected">
    <div class="absolute top-1.5 left-1.5 z-20">
      <input type="checkbox" :checked="isSelected" @change.stop="emit('toggleSelect', item)" @click.stop
        class="checkbox checkbox-xs sm:checkbox-sm rounded border-border-base text-primary focus:ring-primary ring-offset-background-base bg-background-surface opacity-0 group-hover:opacity-100 focus:opacity-100"
        :class="{ 'opacity-100': isSelected }" aria-label="选择此项目" />
    </div>
    <div class="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
      <button @click.stop="emit('itemContextMenu', $event, item, true)"
        class="p-1 rounded-full text-text-muted hover:bg-background-surface hover:text-text-base"
        v-comfy-tooltip="'更多操作'" aria-label="更多操作">
        <EllipsisVerticalIcon class="h-4 w-4" />
      </button>
    </div>

    <div class="flex flex-col items-center justify-center flex-grow w-full overflow-hidden pt-4">
      <component :is="item.itemType === 'directory' ? FolderIcon : getDocumentIcon(item.name)"
        class="mb-1 flex-shrink-0" :class="[
          iconSizeClass,
          item.itemType === 'directory' ? 'text-primary' : 'text-text-muted'
        ]" aria-hidden="true" />
      <p class="text-xs font-medium text-text-base truncate w-full px-1" v-comfy-tooltip="item.name">
        {{ item.name }}
      </p>
      <p v-if="thumbnailSizeClass !== 'small' && item.itemType === 'file'"
        class="text-xxs text-text-muted">
        {{ formatSize(item.size) }}
      </p>
      <StarIcon v-if="isFavorite" class="h-3 w-3 mt-0.5 text-accent flex-shrink-0" v-comfy-tooltip="'已收藏'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FAMItem } from '@comfytavern/types';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import {
  FolderIcon, DocumentIcon, StarIcon, EllipsisVerticalIcon,
  PhotoIcon, DocumentTextIcon, CodeBracketIcon, ArchiveBoxIcon, TableCellsIcon, FilmIcon, MusicalNoteIcon
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  item: FAMItem;
  isSelected: boolean;
  thumbnailSize: 'small' | 'medium' | 'large';
}>();

const emit = defineEmits<{
  (e: 'itemClick', event: MouseEvent, item: FAMItem): void;
  (e: 'itemDblClick', item: FAMItem): void;
  (e: 'itemContextMenu', event: MouseEvent, item: FAMItem, fromButton?: boolean): void;
  (e: 'toggleSelect', item: FAMItem): void;
}>();

const fileManagerStore = useFileManagerStore();
const isFavorite = computed(() => fileManagerStore.isFavorite(props.item.logicalPath));

// Consistent naming with store/design doc
const thumbnailSizeClass = computed(() => props.thumbnailSize);

const iconSizeClass = computed(() => {
  switch (props.thumbnailSize) {
    case 'small': return 'h-10 w-10 sm:h-12 sm:w-12'; // Slightly larger for small grid items
    case 'medium': return 'h-12 w-12 sm:h-16 sm:w-16';
    case 'large': return 'h-16 w-16 sm:h-20 sm:w-20';
    default: return 'h-16 w-16';
  }
});

const formatSize = (bytes?: number | null): string => {
  if (props.item.itemType === 'directory') return ''; // Grid view might not show size for folders
  if (bytes === null || typeof bytes === 'undefined') return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

</script>

<style scoped>
.file-grid-item {
  /* Ensure consistent height for items in a row if text length varies */
  /* The flex-col and justify-center should help with vertical alignment */
}

/* .text-xxs is now defined in tailwind.config.js */
/* .checkbox styles are provided by DaisyUI or Tailwind's form plugin. */
</style>