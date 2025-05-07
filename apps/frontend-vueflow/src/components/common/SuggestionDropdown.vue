<template>
  <Teleport to="body">
    <Transition name="fade">
      <!-- Reverted: Use ul with overflow-y-auto instead of OverlayScrollbarsComponent -->
      <ul v-if="show" ref="dropdownRef"
          :style="{
            top: `${position.y}px`,
            left: `${position.x}px`,
            width: triggerWidth ? `${triggerWidth}px` : 'auto',
            transform: `scale(${props.canvasScale})`,
            transformOrigin: 'top left',
          }"
          class="suggestion-dropdown absolute z-[9999] min-w-[100px] mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg text-gray-900 dark:text-gray-100 text-xs py-1 focus:outline-none"
          tabindex="-1"
          @keydown="handleKeydown"
      >
          <!-- 搜索输入框 -->
          <li
            v-if="searchable"
            class="sticky top-0 bg-white dark:bg-gray-800 px-2 pt-1 pb-1.5 z-10"
          >
            <input
              ref="searchInputRef"
              type="text"
              v-model="searchQuery"
              placeholder="搜索..."
              @keydown.stop
              @mousedown.stop
              class="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </li>
          <!-- 使用 filteredSuggestions -->
          <li
            v-for="(suggestion, index) in filteredSuggestions"
            :key="index"
            @mousedown.prevent="selectSuggestion(suggestion)"
            class="px-3 py-1 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-700 whitespace-nowrap"
            :class="{ 'bg-blue-200 dark:bg-blue-600': index === highlightedIndex }"
            @mouseenter="highlightedIndex = index"
          >
            {{ suggestion }}
          </li>
          <!-- 修改：当过滤后列表为空时显示 -->
          <li
            v-if="!filteredSuggestions || filteredSuggestions.length === 0"
            class="px-3 py-1 text-gray-500 italic"
          >
            {{ searchQuery ? "无匹配结果" : "无建议" }}
          </li>
      </ul>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @component SuggestionDropdown
 * @description 一个通用的建议下拉菜单组件，支持搜索和键盘导航。
 * 它使用 Teleport 将下拉菜单渲染到 body，并使用原生滚动条。
 *
 * @props {Array<string | number>} suggestions - 要显示的建议列表。
 * @props {boolean} show - 控制下拉菜单的可见性。
 * @props {object} position - 下拉菜单的绝对定位 { x, y }。
 * @props {HTMLElement | null} [targetElement] - 可选：触发下拉菜单的元素，用于点击外部检测。
 * @props {number} [triggerWidth] - 可选：触发元素的宽度，用于设置下拉菜单宽度。
 * @props {number} [canvasScale=1] - 可选：画布缩放比例，用于调整下拉菜单的 CSS transform。
 * @props {boolean} [searchable=false] - 可选：是否启用搜索功能。
 *
 * @emits select - 当用户选择一个建议时触发，参数为选中的值。
 * @emits close - 当下拉菜单需要关闭时触发（例如，点击外部、选择建议、按下 Esc）。
 */
import { ref, watch, onBeforeUnmount, nextTick, computed } from "vue";
import { useVueFlow } from "@vue-flow/core";
// Removed OverlayScrollbars imports

interface Props {
  suggestions: (string | number)[];
  show: boolean;
  position: { x: number; y: number };
  targetElement?: HTMLElement | null; // 可选：触发下拉菜单的元素
  triggerWidth?: number; // 触发元素的宽度
  canvasScale?: number; // 可选：用于 CSS transform 的画布缩放比例
  searchable?: boolean; // 是否启用搜索
}

const props = withDefaults(defineProps<Props>(), {
  suggestions: () => [],
  show: false,
  position: () => ({ x: 0, y: 0 }),
  targetElement: null,
  triggerWidth: 0,
  canvasScale: 1, // 默认缩放比例
  searchable: false, // 默认不启用搜索
});

const emit = defineEmits<{
  select: [value: string | number];
  close: []; // 触发 close 事件
}>();

const dropdownRef = ref<HTMLUListElement | null>(null); // 根元素 ul 的引用
// Removed scrollbarRef
const searchInputRef = ref<HTMLInputElement | null>(null); // 搜索输入框的引用
const highlightedIndex = ref(-1);
const searchQuery = ref(""); // 搜索关键词

// Removed theme store logic

// 获取 viewport 以检测缩放变化
const { viewport } = useVueFlow();
const currentZoom = computed(() => viewport.value.zoom);

// 计算过滤后的建议列表
const filteredSuggestions = computed(() => {
  if (!props.searchable || !searchQuery.value) {
    return props.suggestions;
  }
  const query = String(searchQuery.value).toLowerCase();
  // 确保 suggestions 存在且是数组
  if (!Array.isArray(props.suggestions)) {
    return [];
  }
  return props.suggestions.filter((suggestion) => String(suggestion).toLowerCase().includes(query));
});

const selectSuggestion = (suggestion: string | number) => {
  emit("select", suggestion);
  searchQuery.value = ""; // 清空搜索
  emit("close"); // 选择后关闭
};

// 键盘导航处理
const handleKeydown = (event: KeyboardEvent) => {
  if (!props.show) return;

  // 如果焦点在搜索框内，并且不是 Esc 或 Enter 或上下箭头，则不处理导航键
  if (
    document.activeElement === searchInputRef.value &&
    !["Escape", "Enter", "ArrowUp", "ArrowDown"].includes(event.key)
  ) {
    return;
  }

  const currentSuggestions = filteredSuggestions.value; // 使用过滤后的列表

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      // 如果焦点在搜索框且按下箭头，则将焦点移到列表第一项
      if (document.activeElement === searchInputRef.value && currentSuggestions.length > 0) {
        highlightedIndex.value = 0; // 选中第一个
        scrollToHighlighted();
        return; // 阻止默认行为和进一步处理
      }
      if (currentSuggestions.length > 0) {
        highlightedIndex.value = (highlightedIndex.value + 1) % currentSuggestions.length;
        scrollToHighlighted();
      }
      break;
    case "ArrowUp":
      event.preventDefault();
      // 如果焦点在列表第一项且按上箭头，则将焦点移到搜索框
      if (highlightedIndex.value === 0 && document.activeElement !== searchInputRef.value) {
        searchInputRef.value?.focus();
        highlightedIndex.value = -1; // 取消高亮
        return;
      }
      if (currentSuggestions.length > 0) {
        highlightedIndex.value =
          (highlightedIndex.value - 1 + currentSuggestions.length) % currentSuggestions.length;
        scrollToHighlighted();
      }
      break;
    case "Enter":
      event.preventDefault();
      if (highlightedIndex.value !== -1 && highlightedIndex.value < currentSuggestions.length) {
        // 检查索引有效性
        const selectedSuggestion = currentSuggestions[highlightedIndex.value];
        if (selectedSuggestion !== undefined) {
          selectSuggestion(selectedSuggestion);
        } else {
          searchQuery.value = ""; // 清空搜索
          emit("close");
        }
      } else {
        // 如果没有高亮项，但搜索框有内容，可以考虑将当前输入作为新项（如果需要）
        // 否则直接关闭
        searchQuery.value = ""; // 清空搜索
        emit("close");
      }
      break;
    case "Escape":
      event.preventDefault();
      searchQuery.value = ""; // 清空搜索
      emit("close");
      break;
    // 如果焦点不在搜索框，允许输入字符聚焦到搜索框
    default:
      if (
        props.searchable &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        document.activeElement !== searchInputRef.value
      ) {
        searchInputRef.value?.focus();
        // 不需要 preventDefault，让字符输入到框中
      }
      break;
  }
};

// 滚动列表以保持高亮项可见 (使用原生滚动)
const scrollToHighlighted = () => {
  nextTick(() => {
    const listElement = dropdownRef.value; // 获取根 ul 元素
    if (!listElement) return;

    // 计算高亮元素的选择器 (搜索框是第一个 li)
    const itemIndexInDom = highlightedIndex.value + (props.searchable ? 1 : 0);
    const highlightedElement = listElement.children[itemIndexInDom] as HTMLLIElement | undefined;

    if (highlightedElement) {
      // 使用原生滚动逻辑
      const { offsetTop, offsetHeight } = highlightedElement;
      const { scrollTop, clientHeight } = listElement;
      const searchBoxHeight = props.searchable ? (listElement.children[0] as HTMLElement)?.offsetHeight ?? 0 : 0;

      // 考虑搜索框的高度，确保高亮项不被遮挡
      if (offsetTop - searchBoxHeight < scrollTop) {
        listElement.scrollTop = offsetTop - searchBoxHeight;
      } else if (offsetTop + offsetHeight > scrollTop + clientHeight) {
        listElement.scrollTop = offsetTop + offsetHeight - clientHeight;
      }
    }
  });
};

// 处理点击外部关闭下拉菜单的逻辑
const handleClickOutside = (event: MouseEvent) => {
  // const target = event.target as Node; // Removed unused variable
  const dropdownElement = dropdownRef.value; // 现在检查根 ul
  const searchElement = searchInputRef.value;

  // 使用 composedPath 检查事件路径是否包含下拉框或搜索框
  const path = event.composedPath && event.composedPath();
  const isInside = path && path.some(el =>
    (dropdownElement && el === dropdownElement) || (searchElement && el === searchElement)
  );

  // 如果下拉框显示，并且点击事件路径不包含下拉框或搜索框，则关闭
  if (props.show && !isInside) {
    searchQuery.value = ""; // 清空搜索
    emit("close");
  }
};

watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      highlightedIndex.value = -1;
      searchQuery.value = ""; // 打开时清空搜索
      // 使用 setTimeout 将监听器附加推迟到下一个宏任务
      setTimeout(() => {
        // 检查在延迟后下拉框是否仍然是显示的
        if (props.show) {
          document.addEventListener("mousedown", handleClickOutside, true); // 保持 mousedown + 捕获阶段
        }
      }, 0);

      // nextTick 用于处理焦点
      nextTick(() => {
        if (props.searchable) {
          searchInputRef.value?.focus();
        }
      });
    } else {
      // 移除监听器
      document.removeEventListener("mousedown", handleClickOutside, true); // 移除 mousedown + 捕获阶段
    }
  }
);

// 监听缩放变化，如果下拉菜单打开则关闭
watch(currentZoom, (newZoom, oldZoom) => {
  if (newZoom !== oldZoom && props.show) {
    searchQuery.value = ""; // 清空搜索
    emit("close");
  }
});

onBeforeUnmount(() => {
  // 确保移除监听器
  document.removeEventListener("mousedown", handleClickOutside, true); // 移除 mousedown + 捕获阶段
});
</script>

<style scoped>
.suggestion-dropdown {
  /* 可以添加特定样式 */
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>