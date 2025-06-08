<template>
  <div class="dialog-container">
    <!-- 动态渲染当前活动的对话框 -->
    <component
      v-if="dialogService.activeDialog"
      :is="dialogService.activeDialog.component"
      v-bind="dialogService.activeDialog.props"
    />

    <!-- 按位置分组渲染通知 -->
    <!--
      为每个可能的通知位置创建一个容器。
      每个容器将负责在该特定位置堆叠通知。
    -->
    <template v-for="position in allToastPositions" :key="position">
      <div :class="getPositionContainerClasses(position)" class="fixed flex z-[9999] pointer-events-none">
        <!--
          内部的 div 用于实际的 flex 堆叠，并允许 pointer-events-auto 用于 toast 本身。
          pointer-events-none 在外层容器上，这样它不会阻挡下面的内容。
          ToastNotification 组件本身应该有 pointer-events-auto。
        -->
        <transition-group
          name="toast-stack"
          tag="div"
          :class="getToastStackClasses(position)"
          class="pointer-events-auto"
        >
          <template v-for="toast in getToastsByPosition(position)" :key="toast.id">
            <!--
              传递给 ToastNotification 的 props 来自 dialogService.toasts[n].props
              其中包含了 visible, title, message, type, duration, position, onClose, 'onUpdate:visible'
            -->
            <ToastNotification v-bind="toast.props" />
          </template>
        </transition-group>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// import { computed } from 'vue'; // 'computed' 已声明，但从未读取其值。
import { useDialogService, type ToastPosition } from '@/services/DialogService';
import ToastNotification from './ToastNotification.vue';

const dialogService = useDialogService();

// 所有可能的通知位置，用于创建容器
const allToastPositions: ToastPosition[] = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right'
];

// 根据位置获取通知列表
const getToastsByPosition = (position: ToastPosition) => {
  // DialogService 中的 toast.props.position 可能未定义，默认为 'top-right'
  return dialogService.toasts.filter(toast => (toast.props.position || 'top-right') === position);
};

// 获取不同位置的外部固定定位容器的 Tailwind 类
const getPositionContainerClasses = (position: ToastPosition): string[] => {
  const baseClasses = ['p-4']; // 添加一些内边距，避免通知紧贴屏幕边缘
  switch (position) {
    case 'top-left':
      return [...baseClasses, 'top-0', 'left-0', 'items-start'];
    case 'top-center':
      return [...baseClasses, 'top-0', 'left-1/2', '-translate-x-1/2', 'items-center'];
    case 'top-right':
      return [...baseClasses, 'top-0', 'right-0', 'items-end'];
    case 'bottom-left':
      return [...baseClasses, 'bottom-0', 'left-0', 'items-start'];
    case 'bottom-center':
      return [...baseClasses, 'bottom-0', 'left-1/2', '-translate-x-1/2', 'items-center'];
    case 'bottom-right':
      return [...baseClasses, 'bottom-0', 'right-0', 'items-end'];
    default: // 默认 top-right
      return [...baseClasses, 'top-0', 'right-0', 'items-end'];
  }
};

// 获取内部堆叠容器的 Tailwind 类 (flex 方向和间距)
const getToastStackClasses = (position: ToastPosition): string[] => {
  const baseStackClasses = ['flex', 'gap-2']; // 使用 gap 来控制间距
  if (position.startsWith('top-')) {
    // 对于顶部位置，新通知通常希望在最上方（如果数组是 push 新的）
    // 或者最下方（如果数组是 unshift 新的）。
    // DialogService.toasts.push()，新通知在数组末尾。
    // flex-col: 新通知在下。 flex-col-reverse: 新通知在上。
    return [...baseStackClasses, 'flex-col-reverse']; // 新通知在视觉顶部
  } else { // bottom-*
    return [...baseStackClasses, 'flex-col']; // 新通知在视觉底部
  }
};

</script>

<style>
/* 过渡动画 - 可以根据需要调整 */
.toast-stack-move,
.toast-stack-enter-active,
.toast-stack-leave-active {
  transition: all 0.3s ease-in-out;
}

.toast-stack-enter-from,
.toast-stack-leave-to {
  opacity: 0;
  transform: scale(0.9); /* 示例动画：缩小消失/出现 */
}

/* 可选：确保离开的元素在动画期间保持布局 */
.toast-stack-leave-active {
  /* position: absolute;  会导致其他元素立即跳动，通常不需要，除非有特殊布局 */
}
</style>