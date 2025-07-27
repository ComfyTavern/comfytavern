<template>
  <Teleport to="body">
    <div
      v-if="props.visible"
      class="fixed inset-0 bg-backdrop bg-opacity-[var(--ct-backdrop-opacity)] flex items-center justify-center transition-opacity duration-300"
      :style="{ zIndex: dynamicZIndex }"
      :class="{ 'opacity-0': !showContentTransition, 'opacity-100': showContentTransition }"
      @click="props.closeOnBackdropClick && handleClose()"
    >
      <div
        class="relative transition-all duration-300 flex flex-col w-full"
        :class="[
          props.bare
            ? ''
            : 'bg-background-surface/90 rounded-lg shadow-xl border border-border-base',
          props.dialogClass,
          // 宽度类现在通过 style 应用，但保留默认值以防万一
          !isPixelWidth(props.width) ? props.width : '',
          { 'opacity-0 scale-95': !showContentTransition, 'opacity-100 scale-100': showContentTransition }
        ]"
        :style="{ height: props.height, maxWidth: isPixelWidth(props.width) ? props.width : undefined }"
        @click.stop
      >
        <div v-if="hasHeaderSlot || props.title || props.showCloseButton"
            class="flex justify-between items-center p-4"
            :class="{ 'border-b border-border-base': !props.bare && (hasHeaderSlot || props.title || props.showCloseButton) }"
        >
          <slot name="header">
            <h3 v-if="props.title" class="text-lg font-medium text-text-base">
              {{ props.title }}
            </h3>
            <div v-else></div> <!-- 占位符，保持关闭按钮在右侧 -->
          </slot>
          <button
            v-if="props.showCloseButton"
            @click="handleClose"
            class="text-text-muted hover:text-text-base focus:outline-none"
          >
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-content-area p-4" :class="props.contentClass">
          <slot name="content">
            <!-- 内容将由父组件通过 #content 插槽提供 -->
          </slot>
        </div>

        <!-- 可选的底部按钮区域 -->
        <div v-if="hasFooterSlot" class="p-4 border-t border-border-base flex justify-end space-x-2">
          <slot name="footer"></slot>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, useSlots, computed, nextTick } from 'vue';
import { useUiStore } from '@/stores/uiStore';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  width?: string;
  height?: string; // 修改：模态框固定高度
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  bare?: boolean; // 新增 prop，用于无样式模式
  dialogClass?: string;
  contentClass?: string;
}>(), {
  showCloseButton: true,
  closeOnBackdropClick: true,
  width: 'max-w-md', // 默认宽度
  height: 'auto', // 默认高度调整为auto，除非显式设置
  bare: false, // bare prop 默认值为 false
  dialogClass: '',
  contentClass: '',
});

// 辅助函数，用于判断宽度是像素值还是 Tailwind 类
const isPixelWidth = (width?: string) => {
  return width && /^\d+(px|rem|em|%|vw|vh)$/.test(width);
};

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void; // 当模态框关闭时触发
}>();

const slots = useSlots();
const hasFooterSlot = computed(() => !!slots.footer);
const hasHeaderSlot = computed(() => !!slots.header);

const showContentTransition = ref(false);
const uiStore = useUiStore();
const dynamicZIndex = ref(uiStore.baseZIndex); // 初始化为基础 z-index

watch(() => props.visible, (newValue) => {
  if (newValue) {
    dynamicZIndex.value = uiStore.getNextZIndex();
    // DOM 更新后启动入场动画
    nextTick(() => {
      showContentTransition.value = true;
    });
  } else {
    showContentTransition.value = false;
  }
}, { immediate: true });


function handleClose() {
  showContentTransition.value = false;
  // 等待退场动画完成
  setTimeout(() => {
    emit('update:visible', false);
    emit('close');
  }, 300);
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (props.visible && event.key === 'Escape' && props.showCloseButton) {
    handleClose();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
/* 可以根据需要添加或调整样式 */
.modal-content-area {
  flex-grow: 1; /* 占据剩余空间 */
  overflow-y: auto; /* 内容超出时显示滚动条 */
  min-height: 0; /* 防止 flex item 在内容过少时无法正确收缩，配合 overflow 很重要 */
}
</style>