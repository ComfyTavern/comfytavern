<template>
  <div v-if="visible" class="context-menu context-menu-base"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }" @click.stop @mousedown.stop
    @mouseleave="handleMouseLeaveBaseMenu" ref="baseMenuRef">
    <!-- 常规菜单选项 -->
    <div class="context-menu-items">
      <div class="context-menu-item" @mouseenter="handleShowNodeSubMenu" @mouseleave="handleHideNodeSubMenuDelayed"
        ref="addNodeMenuItemRef">
        <span class="icon">+</span> {{ t('graph.menus.context.addNode') }} <span class="submenu-arrow-static">▶</span>
      </div>
      <div class="context-menu-item" @click="handleOpenSearchPanel">
        <span class="icon">🔍</span> {{ t('graph.menus.context.findNode') }}
      </div>
      <div class="context-menu-item" @click="onAddGroup">
        <span class="icon">⊞</span> {{ t('graph.menus.context.addGroupbox') }}
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="onLocalCopy" :class="{ disabled: !hasSelectedNodes }">
        <span class="icon">⎘</span> {{ t('graph.menus.context.copySelectionLocal') }}
      </div>
      <div class="context-menu-item" @click="onSystemCopy" :class="{ disabled: !hasSelectedNodes }">
        <span class="icon">📋</span> {{ t('graph.menus.context.copySelectionClipboard') }}
      </div>
      <div class="context-menu-item" @click="onLocalPaste">
        <span class="icon">📥</span> {{ t('graph.menus.context.pasteLocal') }}
      </div>
      <div class="context-menu-item" @click="onSystemPaste">
        <span class="icon">📲</span> {{ t('graph.menus.context.pasteFromClipboard') }}
      </div>
      <div class="context-menu-item" @click="onDelete" :class="{ disabled: !hasSelectedNodes }">
        <span class="icon">🗑</span> {{ t('graph.menus.context.deleteSelection') }}
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="onSelectAll">
        <span class="icon">☑</span> {{ t('graph.menus.context.selectAll') }}
      </div>
      <div class="context-menu-item" @click="onResetView">
        <span class="icon">⟲</span> {{ t('graph.menus.context.resetView') }}
      </div>
    </div>

    <!-- 节点添加菜单 - 新的级联菜单 (作为子菜单显示) -->
    <CascadingMenu v-if="isAddNodeSubMenuOpen" :items="cascadingMenuItems" :level="1"
      :parent-rect="addNodeMenuItemRef?.getBoundingClientRect()" @select-item="onCascadingNodeSelect"
      @close-all="closeAllContextMenus" @mouseenter="cancelHideNodeSubMenu" @mouseleave="handleHideNodeSubMenuDelayed"
      class="context-submenu" />

    <!-- HierarchicalMenu is now handled by parent component -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import type { XYPosition } from '@vue-flow/core';
import { useNodeStore } from '../../../stores/nodeStore';
import { storeToRefs } from 'pinia';
// import HierarchicalMenu from '@/components/common/HierarchicalMenu.vue'; // 不再直接使用
import CascadingMenu, { type MenuItem as CascadingMenuItemType } from '@/components/common/CascadingMenu.vue';
import type { FrontendNodeDefinition } from '../../../stores/nodeStore';
import { useCanvasClipboard } from '@/composables/canvas/useCanvasClipboard'; // <-- 新增导入

// Props & Emits
const props = defineProps<{
  visible: boolean;
  position: XYPosition;
  hasSelectedNodes: boolean;
  // hasCopiedNodes: boolean; // 不再需要，由 useCanvasClipboard 内部管理
}>();

const emit = defineEmits<{
  (e: 'request-add-node', payload: { fullNodeType: string }): void; // screenPosition 不再需要
  (e: 'add-group'): void;
  // (e: 'copy'): void; // 将由内部处理
  // (e: 'paste'): void; // 将由内部处理
  (e: 'delete'): void;
  (e: 'select-all'): void;
  (e: 'reset-view'): void;
  (e: 'close'): void;
  (e: 'open-node-search-panel'): void; // 新增事件
}>();

// Store
const { t } = useI18n();
const nodeStore = useNodeStore();
const { nodeDefinitions } = storeToRefs(nodeStore);
const loading = ref(false);

// Composables
const { handleLocalCopy, handleLocalPaste, handleSystemCopy, handleSystemPaste } = useCanvasClipboard();

// Refs for Blender-style submenu interaction
const baseMenuRef = ref<HTMLElement | null>(null);
const addNodeMenuItemRef = ref<HTMLElement | null>(null);
const isAddNodeSubMenuOpen = ref(false);
let hideSubMenuTimer: number | null = null;
const SUBMENU_DELAY = 150; // ms, for both open and close to feel natural

// 节点菜单数据
const nodeMenuSections = computed(() => {
  const sections: Record<string, any> = {};

  if (!nodeDefinitions.value) return sections;

  // 按命名空间和分类组织节点
  nodeDefinitions.value
    .filter((node: FrontendNodeDefinition) => {
      // 不显示内部节点
      const fullType = `${node.namespace || 'core'}:${node.type}`;
      return !fullType.includes('io:GroupInput') && !fullType.includes('io:GroupOutput');
    })
    .forEach((node: FrontendNodeDefinition) => {
      const namespace = node.namespace || 'core';
      const category = node.category || t('editorView.unclassified');

      // 初始化命名空间
      if (!sections[namespace]) {
        sections[namespace] = {
          label: namespace,
          categories: {}
        };
      }

      // 初始化分类
      if (!sections[namespace].categories[category]) {
        sections[namespace].categories[category] = {
          label: category,
          items: []
        };
      }

      // 添加节点
      sections[namespace].categories[category].items.push({
        id: `${namespace}:${node.type}`,
        label: node.displayName || node.type,
        description: node.description,
        category: category,
        data: node
      });
    });

  return sections;
});

// 为 CascadingMenu 准备数据
const cascadingMenuItems = computed((): CascadingMenuItemType[] => {
  const transformedItems: CascadingMenuItemType[] = [];
  if (!nodeDefinitions.value) return transformedItems;

  const sections = nodeMenuSections.value;
  const namespaceKeys = Object.keys(sections);

  // 处理单 'core' 命名空间的情况
  if (namespaceKeys.length === 1 && namespaceKeys[0] && namespaceKeys[0].toLowerCase() === 'core') {
    const coreNamespace = sections[namespaceKeys[0]!]; // namespaceKeys[0] is now guaranteed to be a string
    for (const catKey in coreNamespace.categories) {
      const category = coreNamespace.categories[catKey];
      const nodeItems: CascadingMenuItemType[] = category.items.map((node: any) => ({
        id: node.id,
        label: node.label,
        icon: node.icon,
        data: node.data,
      }));
      if (nodeItems.length > 0) {
        transformedItems.push({
          label: category.label,
          children: nodeItems,
        });
      }
    }
  } else { // 多个命名空间或非 'core' 的单个命名空间
    for (const nsKey in sections) {
      const namespace = sections[nsKey];
      const categoryItems: CascadingMenuItemType[] = [];
      for (const catKey in namespace.categories) {
        const category = namespace.categories[catKey];
        const nodeItems: CascadingMenuItemType[] = category.items.map((node: any) => ({
          id: node.id,
          label: node.label,
          data: node.data,
        }));
        if (nodeItems.length > 0) {
          categoryItems.push({
            label: category.label,
            children: nodeItems,
          });
        }
      }
      if (categoryItems.length > 0) {
        transformedItems.push({
          label: namespace.label,
          children: categoryItems,
        });
      }
    }
  }
  return transformedItems;
});


// 组件挂载时加载节点定义
onMounted(async () => {
  loading.value = true;
  await nodeStore.fetchAllNodeDefinitions();
  loading.value = false;
});
// Blender-style submenu logic
const handleShowNodeSubMenu = () => {
  if (hideSubMenuTimer) clearTimeout(hideSubMenuTimer);
  // Small delay to ensure parent-rect is available if menu just appeared
  nextTick(() => {
    if (addNodeMenuItemRef.value?.getBoundingClientRect()) {
      isAddNodeSubMenuOpen.value = true;
    }
  });
};

const handleHideNodeSubMenuDelayed = () => {
  if (hideSubMenuTimer) clearTimeout(hideSubMenuTimer);
  hideSubMenuTimer = window.setTimeout(() => {
    isAddNodeSubMenuOpen.value = false;
  }, SUBMENU_DELAY);
};

const cancelHideNodeSubMenu = () => {
  if (hideSubMenuTimer) clearTimeout(hideSubMenuTimer);
};

const handleMouseLeaveBaseMenu = (event: MouseEvent) => {
  // If mouse leaves the base menu and not moving towards an open submenu, close submenu
  if (isAddNodeSubMenuOpen.value && baseMenuRef.value && !baseMenuRef.value.contains(event.relatedTarget as Node)) {
    // Check if relatedTarget is part of the CascadingMenu. This is tricky.
    // A simpler approach: CascadingMenu itself handles mouseleave to call handleHideNodeSubMenuDelayed.
    // If mouse leaves base menu entirely, and also leaves the submenu, it will close.
  }
  // For now, rely on CascadingMenu's own mouseleave and the item's mouseleave
};


// 处理来自 CascadingMenu 的节点选择
const onCascadingNodeSelect = (item: CascadingMenuItemType) => {
  if (item.id) {
    // emit('add-node', item.id); // 旧的 emit
    emit('request-add-node', { fullNodeType: item.id }); // screenPosition 不再需要
  }
  closeAllContextMenus(); // This will emit 'close'
};


const closeAllContextMenus = () => {
  isAddNodeSubMenuOpen.value = false; // Hide submenu first
  emit('close'); // This will set props.visible to false, hiding everything
};

const handleOpenSearchPanel = () => {
  closeAllContextMenus(); // 关闭当前右键菜单
  // 延迟发出事件，确保 'close' 事件先生效，避免潜在的竞争条件
  nextTick(() => {
    emit('open-node-search-panel');
  });
};

// 基础菜单操作
// 基础菜单操作
const onAddGroup = () => {
  emit('add-group');
  closeAllContextMenus();
};

const onLocalCopy = () => {
  if (!props.hasSelectedNodes) return;
  handleLocalCopy();
  closeAllContextMenus();
};

const onSystemCopy = () => {
  if (!props.hasSelectedNodes) return;
  handleSystemCopy();
  closeAllContextMenus();
};

const onLocalPaste = () => {
  // 内部检查剪贴板是否有内容
  handleLocalPaste();
  closeAllContextMenus();
};

const onSystemPaste = () => {
  // 内部检查剪贴板是否有内容
  handleSystemPaste();
  closeAllContextMenus();
};

const onDelete = () => {
  if (!props.hasSelectedNodes) return;
  emit('delete');
  closeAllContextMenus();
};

const onSelectAll = () => {
  emit('select-all');
  closeAllContextMenus();
};

const onResetView = () => {
  emit('reset-view');
  closeAllContextMenus();
};
</script>

<style scoped>
.context-menu {
  position: fixed;
  min-width: 250px;
  max-height: 75vh;
  overflow-y: auto;
  z-index: 1000;
}

.context-menu-items {
  @apply max-h-[calc(100%-3rem)] overflow-y-auto;
}

.context-menu-item {
  @apply flex items-center px-3 py-2 hover:bg-neutral-softest cursor-pointer;
}

.context-menu-item.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.context-menu-item .icon {
  @apply mr-2 text-text-muted;
}

.submenu-arrow-static {
  @apply ml-auto pl-2 text-xs text-text-secondary;
}

.context-menu-separator {
  @apply my-1 border-t border-gray-200 dark:border-gray-700;
}

.context-menu-footer {
  @apply border-t border-gray-200 dark:border-gray-700 mt-auto sticky bottom-0 bg-inherit;
}
</style>