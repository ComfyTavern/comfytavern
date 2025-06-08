<template>
  <Teleport to="body">
    <div
      v-if="props.visible"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-opacity duration-300"
      :style="{ zIndex: 1100 }"
      :class="{ 'opacity-0': !showContentTransition, 'opacity-100': showContentTransition }"
      @click="props.closeOnBackdropClick && handleClose()"
    >
      <div
        class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col"
        :class="{ 'opacity-0 scale-95': !showContentTransition, 'opacity-100 scale-100': showContentTransition }"
        :style="{ width: props.width || 'max-w-md', height: props.height }"
        @click.stop
      >
        <div v-if="props.title || props.showCloseButton" class="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 v-if="props.title" class="text-lg font-medium text-gray-900 dark:text-gray-100">
            {{ props.title }}
          </h3>
          <div v-else></div> <!-- 占位符，保持关闭按钮在右侧 -->
          <button
            v-if="props.showCloseButton"
            @click="handleClose"
            class="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 focus:outline-none"
          >
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-content-area p-2">
          <slot>
            <!-- 默认插槽，用于插入自定义组件 -->
            <component v-if="_contentDefinition && _contentDefinition.component" :is="_contentDefinition.component" v-bind="_contentDefinition.props" />
          </slot>
        </div>

        <!-- 可选的底部按钮区域 -->
        <div v-if="hasFooterSlot" class="p-4 border-t dark:border-gray-700 flex justify-end space-x-2">
          <slot name="footer"></slot>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, useSlots, type Component as VueComponent, computed, nextTick } from 'vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  width?: string;
  height?: string; // 修改：模态框固定高度
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  // 用于内部渲染 DialogService 传递过来的组件
  _contentDefinition?: { component: VueComponent, props?: Record<string, any> };
}>(), {
  showCloseButton: true,
  closeOnBackdropClick: true,
  width: 'max-w-md', // 默认宽度
  height: '75vh', // 默认固定高度，可以根据需要调整
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void; // 当模态框关闭时触发
}>();

const slots = useSlots();
const hasFooterSlot = computed(() => !!slots.footer);

const showContentTransition = ref(false);

watch(() => props.visible, (newValue) => {
  if (newValue) {
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