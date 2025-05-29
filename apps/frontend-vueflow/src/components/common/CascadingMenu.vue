<template>
  <div class="cascading-menu context-menu-base" :style="menuStyle" @mouseleave="handleMouseLeaveMenu" ref="menuElement">
    <ul>
      <li v-for="(item, index) in items" :key="item.label + index" @mouseenter="onItemEnter(item, index, $event)"
        @mouseleave="onItemLeave(item)" @click.stop="onItemClick(item)" :class="{
          'has-submenu': item.children && item.children.length > 0,
          'disabled': item.disabled,
          'separator': item.separator,
          'active': activeItemIndex === index && item.children && item.children.length > 0
        }" class="context-menu-item">
        <template v-if="item.separator">
          <hr class="context-menu-separator-line" />
        </template>
        <template v-else>
          <span class="icon" v-if="item.icon">{{ item.icon }}</span>
          <span class="label">{{ item.label }}</span>
          <span class="submenu-arrow" v-if="item.children && item.children.length > 0">▶</span>
        </template>

        <CascadingMenu v-if="item.children && item.children.length > 0 && activeItemIndex === index"
          :items="item.children" :level="level + 1" :parent-rect="activeItemElement?.getBoundingClientRect()"
          @select-item="onSubMenuItemSelect" @close-all="closeAllMenus" ref="activeSubMenu" />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import type { PropType, CSSProperties } from 'vue';

// 定义菜单项接口
export interface MenuItem {
  id?: string;
  label: string;
  icon?: string;
  action?: (item: MenuItem) => void;
  children?: MenuItem[];
  disabled?: boolean;
  separator?: boolean;
  data?: any; // 原始数据，例如节点定义
}

const props = defineProps({
  items: {
    type: Array as PropType<MenuItem[]>,
    required: true,
  },
  level: {
    type: Number,
    default: 0,
  },
  parentRect: {
    type: Object as PropType<DOMRect | null>,
    default: null,
  },
});

const emit = defineEmits(['selectItem', 'closeAll']);

const menuElement = ref<HTMLElement | null>(null);
const activeItemIndex = ref<number | null>(null);
const activeItemElement = ref<HTMLElement | null>(null);
const activeSubMenu = ref<{ menuElement: HTMLElement | null } | null>(null); // Ref for the active submenu component

let leaveTimeout: number | null = null;
const SUBMENU_CLOSE_DELAY = 500; // 鼠标移开关闭子菜单的延迟 (ms)
let openTimeout: number | null = null;


const menuStyle = computed((): CSSProperties => {
  if (props.level === 0) {
    // 根菜单的位置由 ContextMenu.vue 控制
    return { zIndex: 1000 + props.level };
  }
  if (!props.parentRect || !menuElement.value) {
    // 默认回退，通常不应该发生
    return { position: 'fixed' as 'fixed', top: '0px', left: '100%', zIndex: 1000 + props.level };
  }

  let topVal = props.parentRect.top;
  let leftVal = props.parentRect.right - 2; // -2px for slight overlap

  // 简易屏幕边缘检测和调整
  const menuNode = menuElement.value;
  const menuWidth = menuNode.offsetWidth || 200; // 估算或实际宽度
  const menuHeight = menuNode.offsetHeight || 300; // 估算或实际高度

  if (leftVal + menuWidth > window.innerWidth) {
    leftVal = props.parentRect.left - menuWidth + 2; // +2px for slight overlap
  }
  if (topVal + menuHeight > window.innerHeight) {
    topVal = window.innerHeight - menuHeight - 5; // -5px for some padding
    if (topVal < 0) topVal = 5;
  }
  if (topVal < 0) topVal = 5; // Ensure it's not off-screen at the top


  return {
    position: 'fixed' as 'fixed', // Explicitly cast to literal 'fixed'
    top: `${topVal}px`,
    left: `${leftVal}px`,
    zIndex: 1000 + props.level,
  };
});

const onItemEnter = (item: MenuItem, index: number, event: MouseEvent) => {
  if (leaveTimeout) {
    clearTimeout(leaveTimeout);
    leaveTimeout = null;
  }
  if (openTimeout) {
    clearTimeout(openTimeout);
  }

  if (item.disabled || item.separator) {
    // 如果是禁用项或分隔符，则关闭任何已打开的子菜单
    if (activeItemIndex.value !== null) {
      activeItemIndex.value = null;
      activeItemElement.value = null;
    }
    return;
  }
  if (item.disabled || item.separator) {
    if (activeItemIndex.value !== null) {
      activeItemIndex.value = null;
      activeItemElement.value = null;
    }
    return;
  }

  if (item.children && item.children.length > 0) {
    activeItemIndex.value = index;
    activeItemElement.value = event.currentTarget as HTMLElement;
  } else {
    // 如果当前项没有子菜单，则关闭任何已打开的同级子菜单
    activeItemIndex.value = null;
    // activeItemElement.value = null; // activeItemElement 应该只在打开新子菜单时设置
  }
};

const onItemLeave = (_item: MenuItem) => {
  if (openTimeout) {
    clearTimeout(openTimeout);
    openTimeout = null;
  }
  // 使用延迟关闭，以便用户可以将鼠标移到子菜单上
  leaveTimeout = window.setTimeout(() => {
    // 检查鼠标是否在子菜单内部，这比较复杂，暂时简化
    // 如果 activeSubMenu.value 存在并且其 DOM 元素包含了当前鼠标事件的相关目标，则不关闭
    // 这是一个简化的检查，更健壮的方案需要监听子菜单的 mouseenter/leave
    if (activeSubMenu.value?.menuElement?.contains(document.elementFromPoint(lastMouseEvent.clientX, lastMouseEvent.clientY))) {
      return;
    }
    activeItemIndex.value = null;
    activeItemElement.value = null;
  }, SUBMENU_CLOSE_DELAY);
};

const handleMouseLeaveMenu = () => {
  // 当鼠标离开整个菜单组件（包括其子菜单）时，尝试关闭
  // 这个逻辑需要更精细，以避免在移向子菜单时意外关闭
  // onItemLeave 已经有延迟，这里可能不需要特别处理，除非是为了根菜单
  if (props.level === 0) { // 只在根菜单上处理
    // console.log('Mouse left root menu');
    // emit('closeAll'); // 可能会太激进
  }
};


const onItemClick = (item: MenuItem) => {
  if (item.disabled || item.separator) return;

  if (item.action) {
    item.action(item);
    emit('closeAll');
  } else if (!item.children || item.children.length === 0) {
    // 叶子节点，没有特定 action，则视为选择
    emit('selectItem', item);
    // closeAllMenus(); // selectItem 应该由顶层 ContextMenu 处理关闭
  }
  // 如果有子菜单，点击通常不执行操作，悬停已处理打开
};

const onSubMenuItemSelect = (item: MenuItem) => {
  emit('selectItem', item); // 冒泡给父级
};

const closeAllMenus = () => {
  activeItemIndex.value = null;
  activeItemElement.value = null;
  emit('closeAll'); // 冒泡给父级
};

// 追踪最后鼠标事件，用于 onItemLeave 延迟关闭时的判断
let lastMouseEvent: MouseEvent;
const trackMouse = (event: MouseEvent) => {
  lastMouseEvent = event;
};

onMounted(() => {
  document.addEventListener('mousemove', trackMouse);
  // 确保初次渲染后 menuStyle 能正确计算（特别是宽度和高度）
  nextTick(() => {
    if (menuElement.value && props.level > 0) {
      // 强制重新计算样式，如果需要
      // (通常 Vue 的响应式系统会自动处理)
    }
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', trackMouse);
  if (leaveTimeout) clearTimeout(leaveTimeout);
  if (openTimeout) clearTimeout(openTimeout);
});

defineExpose({ menuElement });
</script>

<style scoped>
.cascading-menu {
  min-width: 220px;
  /* 根据内容调整 */
  /* 使用 context-menu-base 的样式 */
}

.cascading-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* .context-menu-item 来自 ContextMenu.vue 的共享样式，这里可以复用或定义类似的 */
.cascading-menu li.context-menu-item {
  display: flex;
  align-items: center;
  position: relative;
  /* 为了子菜单定位和箭头定位 */
  /* 确保文字颜色继承或在此处明确设置 */
  @apply text-gray-800 dark:text-gray-100;
  /* 尝试更亮的颜色 */
}

.cascading-menu li.context-menu-item .icon {
  margin-right: 0.5rem;
  /* color: #888; */
}

.cascading-menu li.context-menu-item .label {
  flex-grow: 1;
}

.cascading-menu li.context-menu-item .submenu-arrow {
  margin-left: auto;
  padding-left: 0.75rem;
  font-size: 0.8em;
  /* color: #888; */
}

.cascading-menu li.context-menu-item.active {
  /* background-color: #e0e0e0; */
  /* dark:bg-gray-700 is good from original context menu */
  @apply bg-gray-100 dark:bg-gray-700;
}

.cascading-menu li.separator {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  height: auto;
  /* 覆盖 context-menu-item 可能设置的固定高度 */
  cursor: default;
}

.cascading-menu li.separator:hover {
  background-color: transparent !important;
  /* 确保分隔符的悬停效果被覆盖 */
}

.context-menu-separator-line {
  /* 来自 ContextMenu.vue 的样式 */
  @apply my-1 border-t border-gray-200 dark:border-gray-700;
  margin-left: -0.75rem;
  /* px-3 from context-menu-item */
  margin-right: -0.75rem;
}
</style>