import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import type { Placement, Middleware } from '@floating-ui/vue';
import { offset, flip, shift, autoUpdate, useFloating } from '@floating-ui/vue';

// 默认的 Tooltip 选项
const DEFAULT_TOOLTIP_OPTIONS = {
  placement: 'top' as Placement,
  width: 'auto' as string | number, // + 新增 width 选项，默认为 auto
  maxWidth: '300px' as string | number, // 可以是数字 (px) 或字符串
  delayShow: 150, // 毫秒
  delayHide: 100, // 毫秒
  interactive: false,
  showCopyButton: false,
  triggerType: 'hover' as 'hover' | 'click' | 'focus' | Array<'hover' | 'click' | 'focus'>,
  offsetValue: 12,
  // 更多选项可以根据需要添加，例如自定义class等
};

export interface TooltipOptions {
  placement: Placement;
  width?: string | number; // + 新增 width 选项
  maxWidth: string | number;
  delayShow: number;
  delayHide: number;
  interactive: boolean;
  showCopyButton: boolean;
  triggerType: 'hover' | 'click' | 'focus' | Array<'hover' | 'click' | 'focus'>;
  offsetValue: number;
  // 可以添加其他特定于 TooltipRenderer 的选项
  customClass?: string;
}

export const useTooltipStore = defineStore('tooltip', () => {
  const isVisible = ref(false);
  const content = ref('');
  const targetElement = shallowRef<HTMLElement | null>(null); // 使用 shallowRef 优化性能
  const options = ref<TooltipOptions>({ ...DEFAULT_TOOLTIP_OPTIONS });
  const floatingElement = shallowRef<HTMLElement | null>(null); // TooltipRenderer 的根元素

  let showTimeout: ReturnType<typeof setTimeout> | null = null;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearTimeouts = () => {
    if (showTimeout) clearTimeout(showTimeout);
    if (hideTimeout) clearTimeout(hideTimeout);
    showTimeout = null;
    hideTimeout = null;
  };

  // @floating-ui 相关逻辑
  const middleware = computed((): Middleware[] => [
    offset(options.value.offsetValue),
    flip(),
    shift({ padding: 5 }),
  ]);

  const { floatingStyles, update: updateFloatingUiPosition } = useFloating(
    targetElement, // targetElement 会被 watch 并触发更新
    floatingElement,
    {
      placement: computed(() => options.value.placement),
      middleware,
      whileElementsMounted: autoUpdate, // 自动更新位置
    }
  );

  const setFloatingElement = (el: HTMLElement | null) => {
    floatingElement.value = el;
  };

  const show = (payload: {
    targetElement: HTMLElement;
    content: string;
    options?: Partial<TooltipOptions>;
  }) => {
    clearTimeouts();

    // 合并传入的选项和默认选项
    const newOptions = {
      ...DEFAULT_TOOLTIP_OPTIONS,
      ...payload.options,
    };

    // 只有当目标元素、内容或关键选项变化时才更新
    // 避免不必要的 targetElement.value 设置，除非真的变了
    if (targetElement.value !== payload.targetElement) {
      targetElement.value = payload.targetElement;
    }
    content.value = payload.content;
    options.value = newOptions;


    if (newOptions.delayShow > 0) {
      showTimeout = setTimeout(() => {
        isVisible.value = true;
        // isVisible 变化后，floatingElement 可能才渲染出来，此时再强制更新一下位置
        // 或者 TooltipRenderer 内部 onMounted 时调用 updateFloatingUiPosition
      }, newOptions.delayShow);
    } else {
      isVisible.value = true;
    }
  };

  const hide = (forceImmediate: boolean = false) => {
    clearTimeouts();
    if (forceImmediate || options.value.delayHide <= 0) {
      isVisible.value = false;
      // 重置 targetElement 可能是个好主意，以避免旧引用
      // targetElement.value = null; // 考虑是否需要，如果 autoUpdate 依赖它
    } else {
      hideTimeout = setTimeout(() => {
        isVisible.value = false;
        // targetElement.value = null;
      }, options.value.delayHide);
    }
  };

  // 当 Tooltip 不可见时，清除目标元素，以停止 autoUpdate
  // watch(isVisible, (visible) => {
  //   if (!visible) {
  //     targetElement.value = null; // 这会导致 autoUpdate 停止
  //   }
  // });
  // 注意：如果在这里将 targetElement.value 设为 null，
  // 那么下一次 show 时，如果 targetElement 相同，useFloating 可能不会重新正确计算。
  // autoUpdate 应该在 whileElementsMounted 时自行处理。
  // 或者，在 hide 之后，如果需要，可以手动调用 updateFloatingUiPosition 一次来“重置”它（如果它还持有旧的引用）。
  // 更稳妥的做法是确保 useFloating 的 target 是响应式的，并且在 targetElement.value 变为 null 时，它能正确处理。

  return {
    // State
    isVisible,
    content,
    targetElement, // 只读暴露，修改通过 actions
    options,       // 只读暴露
    floatingElement, // 只读暴露
    floatingStyles,

    // Actions
    show,
    hide,
    setFloatingElement,
    updateFloatingUiPosition, // 暴露以便 TooltipRenderer 在 mounted 时调用
    clearTimeouts, // 暴露以便指令在 unmount 时调用
  };
});

// 导出类型供外部使用
export type { TooltipOptions as GlobalTooltipOptions };