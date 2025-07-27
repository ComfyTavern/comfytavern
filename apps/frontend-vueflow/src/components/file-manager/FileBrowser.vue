<template>
  <div class="file-browser flex flex-col h-full" data-testid="fm-file-browser">
    <!-- 面包屑导航 -->
    <header class="breadcrumbs-container px-2 py-1.5 border-b border-border-base bg-background-surface flex-shrink-0">
      <Breadcrumbs />
    </header>

    <!-- 文件/目录列表区域 -->
    <div class="file-list-container flex-1 overflow-auto relative" @contextmenu.prevent="showContextMenu"
      data-testid="fm-file-list-container">
      <div v-if="isLoading"
        class="loading-overlay absolute inset-0 flex items-center justify-center bg-background-base opacity-75 z-10">
        <ArrowPathIcon class="h-8 w-8 animate-spin text-primary" />
      </div>

      <div v-if="!isLoading && filteredItems.length === 0"
              class="empty-folder-placeholder p-8 text-center text-text-muted">
              <InformationCircleIcon class="h-12 w-12 mx-auto mb-2" />
              <p>{{ t('fileManager.browser.emptyFolder') }}</p>
              <button v-if="isFilterActive" @click="clearFilters" class="btn btn-sm btn-outline mt-4">{{ t('fileManager.browser.clearFilters') }}</button>
            </div>

      <!-- 列表视图 -->
      <table v-if="!isLoading && viewSettings.mode === 'list' && filteredItems.length > 0"
        class="min-w-full divide-y divide-border-base text-sm">
        <thead class="bg-background-surface sticky top-0 z-[5]">
          <tr>
            <th scope="col" class="px-3 py-2.5 text-left font-semibold text-text-base w-10">
              <input type="checkbox" @change="toggleSelectAll" :checked="allSelected"
                :indeterminate="someSelected && !allSelected" class="checkbox checkbox-xs sm:checkbox-sm rounded border-2 border-border-base text-primary focus:ring-primary ring-offset-background-base bg-background-surface" />
            </th>
            <!-- 根据 viewSettings.visibleColumns 动态生成表头 -->
            <th v-for="column in visibleColumnsList" :key="column.key" scope="col"
              @click="changeSort(column.key as any)"
              class="px-3 py-2.5 text-left font-semibold text-text-base cursor-pointer hover:bg-background-base"
              :class="column.widthClass">
              <div class="flex items-center">
                {{ column.label }}
                <span v-if="viewSettings.sortField === column.key" class="ml-1">
                  <ArrowUpIcon v-if="viewSettings.sortDirection === 'asc'" class="h-3 w-3" />
                  <ArrowDownIcon v-else class="h-3 w-3" />
                </span>
              </div>
            </th>
            <th scope="col" class="relative px-3 py-2.5 w-12">
                          <span class="sr-only">{{ t('common.actions') }}</span>
                        </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-base bg-background-base">
          <FileListItem v-for="item in filteredItems" :key="item.logicalPath" :item="item"
            :is-selected="isSelected(item)" :visible-columns="viewSettings.visibleColumns.map(String)"
            @item-click="handleItemClick" @item-dbl-click="handleItemDblClick" @item-context-menu="showItemContextMenu"
            @toggle-select="toggleSelectItem" />
        </tbody>
      </table>

      <!-- 网格视图 -->
      <div v-if="!isLoading && viewSettings.mode === 'grid' && filteredItems.length > 0"
        class="grid gap-3 sm:gap-4 p-2 sm:p-4" :class="{
          'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9': viewSettings.thumbnailSize === 'small',
          'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7': viewSettings.thumbnailSize === 'medium',
          'grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6': viewSettings.thumbnailSize === 'large',
        }">
        <FileGridItem v-for="item in filteredItems" :key="item.logicalPath" :item="item" :is-selected="isSelected(item)"
          :thumbnail-size="viewSettings.thumbnailSize" @item-click="handleItemClick"
          @item-dbl-click="handleItemDblClick" @item-context-menu="showItemContextMenu"
          @toggle-select="toggleSelectItem" />
      </div>

      <!-- 右键上下文菜单 -->
      <FileContextMenu :visible="contextMenu.visible" :x="contextMenu.x" :y="contextMenu.y" :items="contextMenu.items"
        @close="hideContextMenu" @action="handleContextMenuAction" ref="contextMenuRef" />
      <!-- The old div-based context menu is now replaced by FileContextMenu component -->
      <!-- Ensure contextMenuRef is correctly used by onClickOutside if it's meant for the new component -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFileManagerStore, type ViewSettings } from '@/stores/fileManagerStore';
import { useUiStore } from '@/stores/uiStore';
import MoveModal from './modals/MoveModal.vue';
import type { FAMItem } from '@comfytavern/types'; // 统一类型 FAMItem 从 @comfytavern/types 导入
// import { onClickOutside } from '@vueuse/core'; // onClickOutside is handled by FileContextMenu itself
import {
  ArrowPathIcon, InformationCircleIcon,
  ArrowUpIcon, ArrowDownIcon
  // FolderIcon, DocumentIcon, EllipsisVerticalIcon are used in child components
} from '@heroicons/vue/24/outline';
import Breadcrumbs from './Breadcrumbs.vue';
import FileListItem from './FileListItem.vue';
import FileGridItem from './FileGridItem.vue';
import FileContextMenu from './FileContextMenu.vue';

const fileManagerStore = useFileManagerStore();
const uiStore = useUiStore();
const { t } = useI18n();

const isLoading = computed(() => fileManagerStore.isLoading);
const filteredItems = computed(() => fileManagerStore.filteredItems);
const viewSettings = computed(() => fileManagerStore.viewSettings);
const selectedItemPaths = computed(() => fileManagerStore.selectedItemPaths);
const isFilterActive = computed(() => fileManagerStore.isFilterActive);

const allSelected = computed(() =>
  filteredItems.value.length > 0 && selectedItemPaths.value.length === filteredItems.value.length
);
const someSelected = computed(() =>
  selectedItemPaths.value.length > 0 && selectedItemPaths.value.length < filteredItems.value.length
);

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  items: [] as any[], // TODO: 定义上下文菜单项类型
  targetItem: null as FAMItem | null, // 右键点击的目标项目
});

const clickTimeout = ref<number | null>(null);
const DOUBLE_CLICK_DELAY = 250; // ms, 可调整

const contextMenuRef = ref<HTMLElement | null>(null); // Typed for FileContextMenu component's root element
// onClickOutside should now target the FileContextMenu component's root element.
// This is typically handled by passing the ref to FileContextMenu or FileContextMenu handling it internally.
// For now, we assume FileContextMenu handles its own click-outside, or we adjust this.
// If FileContextMenu emits 'close' on its own click-outside, then this specific onClickOutside here might be redundant
// or needs to be coordinated. Let's assume FileContextMenu handles it.
// onClickOutside(contextMenuRef, () => hideContextMenu(), { ignore: ['.file-list-container'] });

const visibleColumnsList = computed(() => {
  // 基于 viewSettings.visibleColumns 和预定义列信息生成
  const allCols: Record<string, { label: string, widthClass?: string }> = {
    name: { label: t('common.name'), widthClass: 'w-2/5' },
    size: { label: t('fileManager.browser.colSize'), widthClass: 'w-1/5' },
    lastModified: { label: t('fileManager.browser.colDate'), widthClass: 'w-1/5' },
    itemType: { label: t('common.type'), widthClass: 'w-1/5' },
    // 可以添加更多列定义
  };
  return (viewSettings.value.visibleColumns || ['name', 'size', 'lastModified', 'itemType']).map(key => ({
    key,
    label: allCols[key]?.label || key.toString(),
    widthClass: allCols[key]?.widthClass || '',
  }));
});

// formatSize and formatDate are now in FileListItem.vue and FileGridItem.vue
// const formatSize = (bytes?: number | null) => { ... };
// const formatDate = (timestamp?: number | null) => { ... };

const isSelected = (item: FAMItem) => {
  return selectedItemPaths.value.includes(item.logicalPath);
};

const toggleSelectAll = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.checked) {
    fileManagerStore.setSelectedItemPaths(filteredItems.value.map((item: FAMItem) => item.logicalPath));
  } else {
    fileManagerStore.clearSelection();
  }
};

const toggleSelectItem = (item: FAMItem) => {
  const currentSelection = [...selectedItemPaths.value];
  const index = currentSelection.indexOf(item.logicalPath);
  if (index > -1) {
    currentSelection.splice(index, 1);
  } else {
    currentSelection.push(item.logicalPath);
  }
  fileManagerStore.setSelectedItemPaths(currentSelection);
};

const handleItemClick = (event: MouseEvent, item: FAMItem) => {
  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value);
    clickTimeout.value = null;
    // This is likely part of a double-click, which will be handled by handleItemDblClick.
    // We return here to prevent single-click logic from executing.
    return;
  }

  clickTimeout.value = window.setTimeout(() => {
    if (event.ctrlKey || event.metaKey) { // Ctrl/Cmd click for multi-select
      toggleSelectItem(item);
    } else if (event.shiftKey && selectedItemPaths.value.length > 0) { // Shift click for range select
      const lastSelectedPath = selectedItemPaths.value[selectedItemPaths.value.length - 1];
      const lastSelectedIndex = filteredItems.value.findIndex((i: FAMItem) => i.logicalPath === lastSelectedPath);
      const currentIndex = filteredItems.value.findIndex((i: FAMItem) => i.logicalPath === item.logicalPath);

      if (lastSelectedIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex);
        const end = Math.max(lastSelectedIndex, currentIndex);
        const rangePaths = filteredItems.value.slice(start, end + 1).map((i: FAMItem) => i.logicalPath);
        // 合并现有选择和范围选择，去重
        fileManagerStore.setSelectedItemPaths(Array.from(new Set([...selectedItemPaths.value, ...rangePaths])));
      } else { // Fallback to single select if range calculation fails
        fileManagerStore.setSelectedItemPaths([item.logicalPath]);
      }
    } else { // Single click
      fileManagerStore.setSelectedItemPaths([item.logicalPath]);
    }
    clickTimeout.value = null;
  }, DOUBLE_CLICK_DELAY);
};

const handleItemDblClick = (item: FAMItem) => {
  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value);
    clickTimeout.value = null;
  }

  if (item.itemType === 'directory') {
    fileManagerStore.navigateTo(item.logicalPath);
  } else {
    // TODO: 打开文件预览或执行默认操作
    console.log('Double clicked file:', item.name);
    fileManagerStore.downloadFile(item); // 示例：双击下载文件
  }
};

const showContextMenu = (event: MouseEvent) => {
  // 检查是否点击在项目上，如果不是，则显示空白区域的上下文菜单
  const targetElement = event.target as HTMLElement;
  const itemElement = targetElement.closest('[data-path]');
  if (!itemElement) {
    showBlankContextMenu(event);
  }
  // 如果点击在项目上，则由项目的 @contextmenu 处理
};

const showItemContextMenu = (event: MouseEvent, item: FAMItem, fromButton = false) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    items: generateItemContextActions(item), // 生成基于项目的操作
    targetItem: item,
  };
  if (fromButton) { // 如果是从省略号按钮点击，确保菜单位置正确
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    contextMenu.value.x = rect.left;
    contextMenu.value.y = rect.bottom + 2;
  }
};
const showBlankContextMenu = (event: MouseEvent) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    items: generateBlankContextActions(), // 生成空白区域的操作
    targetItem: null,
  };
};


const hideContextMenu = () => {
  contextMenu.value.visible = false;
  contextMenu.value.targetItem = null;
};

const generateItemContextActions = (item: FAMItem): any[] => {
  const actions = [];
  actions.push({ label: t('fileManager.browser.contextMenu.open'), action: 'open', icon: 'FolderOpenIcon' });
  if (item.itemType === 'file') {
    actions.push({ label: t('fileManager.browser.contextMenu.download'), action: 'download', icon: 'ArrowDownTrayIcon' });
  }
  actions.push({ label: t('fileManager.browser.contextMenu.rename'), action: 'rename', icon: 'PencilIcon' });
  actions.push({ label: t('fileManager.browser.contextMenu.moveTo'), action: 'move', icon: 'ArrowsRightLeftIcon' });
  actions.push({ label: t('fileManager.browser.contextMenu.copyPath'), action: 'copyPath', icon: 'ClipboardDocumentIcon' });
  if (fileManagerStore.isFavorite(item.logicalPath)) {
    actions.push({ label: t('fileManager.browser.contextMenu.removeFromFavorites'), action: 'unfavorite', icon: 'StarSlashIcon' });
  } else {
    actions.push({ label: t('fileManager.browser.contextMenu.addToFavorites'), action: 'favorite', icon: 'StarIcon' });
  }
  actions.push({ type: 'divider' });
  actions.push({ label: t('fileManager.browser.contextMenu.delete'), action: 'delete', icon: 'TrashIcon', danger: true });
  return actions;
};

const generateBlankContextActions = (): any[] => {
  const actions = [];
  actions.push({ label: t('fileManager.browser.contextMenu.refresh'), action: 'refresh', icon: 'ArrowPathIcon' });
  actions.push({ label: t('fileManager.browser.contextMenu.newFolder'), action: 'createDirectory', icon: 'FolderPlusIcon' });
  if (fileManagerStore.clipboard && fileManagerStore.clipboard.sourcePaths.length > 0) {
    actions.push({ label: t('fileManager.browser.contextMenu.paste'), action: 'paste', icon: 'ClipboardDocumentIcon' });
  }
  // actions.push({ label: '显示设置', action: 'viewSettings', icon: 'CogIcon' });
  return actions;
};

// The 'item' parameter from emit is ContextMenuItemAction, but our logic relies on contextMenu.value.targetItem (FAMListItem)
const handleContextMenuAction = (action: string, _menuItem?: import('./FileContextMenu.vue').ContextMenuItemAction) => {
  const targetFileItem = contextMenu.value.targetItem; // This is the FAMListItem we care about
  const selectedItemsFromStore = fileManagerStore.selectedItems;
  hideContextMenu();
  // console.log('Context menu action:', action, 'on target file item:', targetFileItem, 'triggered by menu item:', _menuItem);

  switch (action) {
    case 'open':
      if (targetFileItem) handleItemDblClick(targetFileItem);
      break;
    case 'download':
      if (targetFileItem && targetFileItem.itemType === 'file') fileManagerStore.downloadFile(targetFileItem);
      break;
    case 'rename':
      if (targetFileItem) fileManagerStore.renameItem(targetFileItem);
      break;
    case 'delete':
      // If context menu was triggered on a specific item, prioritize that.
      // Otherwise, if triggered on blank space but items are selected, delete selected.
      // If triggered on an item that is part of a multi-selection, delete all selected.
      let itemsToDelete: FAMItem[] = [];
      if (targetFileItem) {
        // If the target item is part of the current selection, delete all selected items.
        // Otherwise, just delete the target item.
        if (selectedItemsFromStore.some((sel: FAMItem) => sel.logicalPath === targetFileItem.logicalPath)) {
          itemsToDelete = selectedItemsFromStore;
        } else {
          itemsToDelete = [targetFileItem];
        }
      } else if (selectedItemsFromStore.length > 0) { // Context menu on blank space, but items are selected
        itemsToDelete = selectedItemsFromStore;
      }
      if (itemsToDelete.length > 0) fileManagerStore.deleteItems(itemsToDelete);
      break;
    case 'move':
      const itemsToMove = targetFileItem ? (selectedItemsFromStore.some((sel: FAMItem) => sel.logicalPath === targetFileItem.logicalPath) ? selectedItemsFromStore : [targetFileItem]) : selectedItemsFromStore;
      if (itemsToMove.length > 0) {
        uiStore.openModal({
          component: MoveModal,
          props: {
            itemsToMove,
            onConfirmMove: (items: FAMItem[], targetPath: string) => {
              fileManagerStore.moveItems(items, targetPath);
              // The modal will be closed by its internal logic on success
            },
          },
          modalProps: {
            title: t('fileManager.moveModal.title'),
            width: 'max-w-lg',
            showCloseIcon: true,
          },
        });
      }
      break;
    case 'copyPath':
      if (targetFileItem) navigator.clipboard.writeText(targetFileItem.logicalPath).then(() => console.log('Path copied'));
      break;
    case 'favorite':
      if (targetFileItem) fileManagerStore.addToFavorites(targetFileItem.logicalPath);
      break;
    case 'unfavorite':
      if (targetFileItem) fileManagerStore.removeFromFavorites(targetFileItem.logicalPath);
      break;
    case 'refresh':
      fileManagerStore.fetchItems();
      break;
    case 'createDirectory':
      fileManagerStore.createDirectory();
      break;
    case 'paste':
      fileManagerStore.pasteFromClipboard();
      break;
    // ... 其他操作
  }
};

const changeSort = (field: ViewSettings['sortField']) => {
  let direction = viewSettings.value.sortDirection;
  if (viewSettings.value.sortField === field) {
    direction = direction === 'asc' ? 'desc' : 'asc';
  } else {
    direction = 'asc';
  }
  fileManagerStore.updateViewSettings({ sortField: field, sortDirection: direction });
};

const clearFilters = () => {
  fileManagerStore.clearFilters();
};

// 键盘导航 (简化示例)
const handleKeydown = (event: KeyboardEvent) => {
  if (contextMenu.value.visible) { // 如果上下文菜单可见，ESC关闭它
    if (event.key === 'Escape') {
      hideContextMenu();
      event.preventDefault();
    }
    return;
  }

  // 确保焦点在文件列表区域内才响应键盘事件
  // const container = document.querySelector('[data-testid="fm-file-list-container"]');
  // if (!container || !container.contains(document.activeElement) && document.activeElement !== container) {
  //   return;
  // }


  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault();
      navigateSelection(event.key === 'ArrowDown' ? 1 : -1);
      break;
    case 'Enter':
      if (selectedItemPaths.value.length === 1) {
        const item = filteredItems.value.find((i: FAMItem) => i.logicalPath === selectedItemPaths.value[0]);
        if (item) {
          handleItemDblClick(item);
          event.preventDefault();
        }
      }
      break;
    case 'Delete':
    case 'Backspace': // Mac上常用Backspace删除
      if (selectedItemPaths.value.length > 0) {
        fileManagerStore.deleteItems(); // deleteItems 会处理 selectedItems
        event.preventDefault();
      }
      break;
    case 'Escape':
      if (contextMenu.value.visible) { // 如果上下文菜单可见，优先关闭它
        hideContextMenu();
      } else {
        fileManagerStore.clearSelection();
      }
      event.preventDefault();
      break;
    // TODO: Ctrl+A (全选), Ctrl+C, Ctrl+X, Ctrl+V
  }
};

const navigateSelection = (direction: 1 | -1) => {
  const items = filteredItems.value;
  if (items.length === 0) return;

  let currentIndex = -1;
  if (selectedItemPaths.value.length > 0) {
    // 确保 selectedItemPaths[0] 存在于 filteredItems 中
    const firstSelectedPath = selectedItemPaths.value[0];
    currentIndex = items.findIndex((i: FAMItem) => i.logicalPath === firstSelectedPath);
  }

  let nextIndex: number;
  if (currentIndex === -1) { // No current selection
    nextIndex = direction === 1 ? 0 : items.length - 1; // Select first or last
  } else {
    nextIndex = currentIndex + direction;
  }

  // Clamp index to bounds (or could implement cycling)
  nextIndex = Math.max(0, Math.min(nextIndex, items.length - 1));

  const nextItem = items[nextIndex];
  if (nextItem) {
    fileManagerStore.setSelectedItemPaths([nextItem.logicalPath]);
    // Scroll into view
    const itemElement = document.querySelector(`[data-path="${CSS.escape(nextItem.logicalPath)}"]`);
    itemElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};


onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  // 确保在组件挂载时，如果 store 中已有路径，则加载数据
  if (fileManagerStore.currentLogicalPath && fileManagerStore.items.length === 0 && !fileManagerStore.isLoading) {
    fileManagerStore.fetchItems();
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value);
  }
});

</script>

<style scoped>
.file-browser {
  /* styles */
}

.loading-overlay {
  /* styles */
}

.empty-folder-placeholder {
  /* styles */
}

.context-menu-item {
  @apply block w-full text-left px-3 py-1.5 hover:bg-background-surface cursor-pointer;
}

.text-xxs {
  font-size: 0.65rem;
  /* 示例 */
  line-height: 0.85rem;
}
</style>