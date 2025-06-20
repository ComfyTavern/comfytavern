<template>
  <div v-if="visible" ref="contextMenuRef"
    class="file-context-menu fixed z-[100] bg-background-surface shadow-xl rounded-md py-1 border border-border-base text-sm min-w-[180px]"
    :style="{ top: adjustedY + 'px', left: adjustedX + 'px' }" data-testid="fm-context-menu-component">
    <ul class="max-h-[70vh] overflow-y-auto">
      <template v-for="(menuItem, index) in items" :key="index">
        <li v-if="menuItem.type === 'divider'" class="my-1 h-px bg-border-base"></li>
        <li v-else-if="!menuItem.hidden">
          <button @click.stop="handleAction(menuItem)" :disabled="menuItem.disabled"
            class="context-menu-button w-full text-left px-3 py-1.5 flex items-center space-x-2" :class="[
              menuItem.danger ? 'text-error hover:bg-error/10' : 'text-text-base hover:bg-primary/10',
              menuItem.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            ]">
            <component v-if="menuItem.icon" :is="getIconComponent(menuItem.icon)" class="h-4 w-4 flex-shrink-0" />
            <span class="flex-grow">{{ menuItem.label }}</span>
            <span v-if="menuItem.shortcut" class="text-xs text-text-muted ml-auto">{{ menuItem.shortcut
              }}</span>
          </button>
        </li>
      </template>
      <li v-if="items.length === 0" class="px-3 py-1.5 text-text-muted italic">
              {{ t('fileManager.browser.contextMenu.noActions') }}
            </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { onClickOutside, useElementBounding, useWindowSize } from '@vueuse/core';

// 定义菜单项的类型
export interface ContextMenuItemAction {
  action: string; // 操作的唯一标识符
  label: string;
  icon?: string; // 图标名称 (来自 Heroicons 或其他库)
  shortcut?: string; // 快捷键提示
  danger?: boolean; // 是否为危险操作 (例如红色文本)
  disabled?: boolean; // 是否禁用
  hidden?: boolean; // 是否隐藏
  type?: 'action'; // 默认为 action
  // 可以添加子菜单等扩展
  // items?: ContextMenuItem[];
}
export interface ContextMenuDivider {
  type: 'divider';
  hidden?: boolean;
}

export type ContextMenuItem = ContextMenuItemAction | ContextMenuDivider;


const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'action', action: string, item?: ContextMenuItemAction): void; // item 是触发操作的菜单项本身
}>();

const { t } = useI18n();
const contextMenuRef = ref<HTMLElement | null>(null);

const { width: windowWidth, height: windowHeight } = useWindowSize();
const { width: menuWidth, height: menuHeight, update: updateMenuBounding } = useElementBounding(contextMenuRef);

const adjustedX = ref(props.x);
const adjustedY = ref(props.y);
const PADDING = 8; // 边缘的最小间距

watch(
  [() => props.visible, () => props.x, () => props.y],
  async ([isVisible, currentX, currentY]) => {
    if (isVisible) {
      // 首先将菜单定位到初始位置，以便正确计算其尺寸
      adjustedX.value = currentX;
      adjustedY.value = currentY;

      await nextTick(); // 等待DOM更新，菜单已渲染
      updateMenuBounding(); // 手动更新边界信息
      await nextTick(); // 确保边界信息已更新

      let finalX = currentX;
      let finalY = currentY;

      const currentMenuWidth = menuWidth.value;
      const currentMenuHeight = menuHeight.value;

      // 检查右侧溢出
      if (currentX + currentMenuWidth + PADDING > windowWidth.value) {
        finalX = windowWidth.value - currentMenuWidth - PADDING;
      }
      // 检查底部溢出
      if (currentY + currentMenuHeight + PADDING > windowHeight.value) {
        finalY = windowHeight.value - currentMenuHeight - PADDING;
      }

      // 确保调整后不会向左或向上溢出（或初始时就溢出）
      adjustedX.value = Math.max(PADDING, finalX);
      adjustedY.value = Math.max(PADDING, finalY);
    }
  },
  { flush: 'post' } // 在DOM更新后执行watch回调
);


onClickOutside(contextMenuRef, () => {
  if (props.visible) {
    emit('close');
  }
});

const handleAction = (menuItem: ContextMenuItemAction) => {
  if (!menuItem.disabled) {
    emit('action', menuItem.action, menuItem);
    emit('close'); // 通常点击后关闭菜单
  }
};


// 动态图标加载 (与 SidebarNav.vue 类似，可以提取到公共工具函数)
const iconComponents: Record<string, any> = {
  FolderOpenIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/FolderOpenIcon')),
  ArrowDownTrayIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/ArrowDownTrayIcon')),
  PencilIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/PencilIcon')),
  ArrowsRightLeftIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/ArrowsRightLeftIcon')),
  ClipboardDocumentIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/ClipboardDocumentIcon')),
  StarIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/StarIcon')),
  // StarSlashIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/StarSlashIcon')), // This icon might not exist
  TrashIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/TrashIcon')),
  ArrowPathIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/ArrowPathIcon')),
  FolderPlusIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/FolderPlusIcon')),
  DocumentDuplicateIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/DocumentDuplicateIcon')), // For Copy
  ScissorsIcon: defineAsyncComponent(() => import('@heroicons/vue/24/outline/ScissorsIcon')), // For Cut
  // 添加更多图标...
};

const getIconComponent = (iconName?: string) => {
  if (!iconName) return null;
  return iconComponents[iconName] || null; // 如果找不到图标，则不渲染
};

</script>

<style scoped>
/* Styles for this component are primarily handled by Tailwind CSS classes in the template. */
/* Specific layout or appearance adjustments can be added here if necessary. */
</style>