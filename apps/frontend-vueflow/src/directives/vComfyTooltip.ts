import type { Directive, DirectiveBinding } from 'vue';
import { useTooltipStore, type GlobalTooltipOptions } from '@/stores/tooltipStore';

// 用于存储每个元素的事件监听器和配置，以便在卸载时正确移除
interface ElementData {
  listeners: Record<string, EventListener>;
  options: Partial<GlobalTooltipOptions>;
  content: string;
  // isClickTriggeredVisible?: boolean; // 用于 click 触发类型，暂时由 store isVisible 和 targetElement 判断
}
const elementDataMap = new WeakMap<HTMLElement, ElementData>();

function getParsedBinding(binding: DirectiveBinding): { content: string; options: Partial<GlobalTooltipOptions> } {
  let content: string;
  let options: Partial<GlobalTooltipOptions> = {};

  if (typeof binding.value === 'string') {
    content = binding.value;
  } else if (typeof binding.value === 'object' && binding.value !== null && !Array.isArray(binding.value)) { // 确保不是数组
    content = binding.value.content || '';
    options = { ...binding.value };
    delete (options as any).content; // 从 options 中移除 content
  } else {
    content = String(binding.value ?? ''); // 处理 null/undefined 或其他意外类型
  }
  return { content, options };
}

function addEventListeners(el: HTMLElement, data: ElementData) {
  const tooltipStore = useTooltipStore();
  // 从 data.options 获取 triggerType，如果未定义，则从 store 的默认选项获取
  const defaultTriggerType = useTooltipStore().options.triggerType; // 获取 Pinia store 内部的默认值
  const trigger = data.options.triggerType || defaultTriggerType;
  const triggers = Array.isArray(trigger) ? trigger : [trigger];

  data.listeners = {}; // 重置监听器

  const showTooltip = () => {
    // 确保在调用 show 之前，el 仍然在 DOM 中 (虽然 mounted 保证了这一点)
    if (!el.isConnected) return;
    // 新增：检查 content 是否为空或仅包含空白
    if (!data.content || data.content.trim() === '') {
      return; // 如果内容为空，则不显示 tooltip
    }
    tooltipStore.show({
      targetElement: el,
      content: data.content,
      options: data.options, // 传递解析后的、特定于此元素的选项
    });
  };

  const hideTooltip = () => {
    // 只有当 Tooltip 当前目标是此元素时才隐藏，避免错误关闭其他元素的 Tooltip
    if (tooltipStore.targetElement === el) {
      tooltipStore.hide();
    }
  };

  if (triggers.includes('hover')) {
    data.listeners.mouseenter = showTooltip;
    data.listeners.mouseleave = hideTooltip;
    el.addEventListener('mouseenter', data.listeners.mouseenter);
    el.addEventListener('mouseleave', data.listeners.mouseleave);
  }

  if (triggers.includes('focus')) {
    data.listeners.focusin = showTooltip;
    data.listeners.focusout = hideTooltip;
    el.addEventListener('focusin', data.listeners.focusin);
    el.addEventListener('focusout', data.listeners.focusout);
  }

  if (triggers.includes('click')) {
    data.listeners.click = (event: Event) => {
      event.stopPropagation(); // 阻止事件冒泡，避免意外触发外部点击隐藏逻辑
      if (!el.isConnected) return;
      if (tooltipStore.isVisible && tooltipStore.targetElement === el) {
        tooltipStore.hide(true); // 立即隐藏
      } else {
        tooltipStore.show({
          targetElement: el,
          content: data.content,
          options: data.options,
        });
      }
    };
    el.addEventListener('click', data.listeners.click);
    // 注意: 点击外部隐藏逻辑主要由 TooltipRenderer 和/或 tooltipStore 内部处理。
    // TooltipRenderer 在 interactive=false 时，点击自身也会隐藏。
    // 如果需要更严格的“点击外部隐藏”，tooltipStore 可能需要一个全局 document click 监听器，
    // 当 click 触发的 tooltip 可见时激活。
  }
}

function removeEventListeners(el: HTMLElement) {
  const data = elementDataMap.get(el);
  if (data && data.listeners) {
    for (const eventName in data.listeners) {
      const listener = data.listeners[eventName];
      if (typeof listener === 'function') { // 确保 listener 是一个函数
        el.removeEventListener(eventName, listener);
      }
    }
    data.listeners = {}; // 清空监听器记录
  }
}

export const vComfyTooltip: Directive<HTMLElement, any> = {
  mounted(el, binding) {
    const { content, options } = getParsedBinding(binding);
    const data: ElementData = { listeners: {}, options, content };
    elementDataMap.set(el, data);
    addEventListeners(el, data);
  },
  updated(el, binding) {
    const oldData = elementDataMap.get(el);
    if (!oldData) { // 如果没有旧数据，则视为新挂载
      const { content, options } = getParsedBinding(binding);
      const newData: ElementData = { listeners: {}, options, content };
      elementDataMap.set(el, newData);
      addEventListeners(el, newData);
      return;
    }

    const { content, options } = getParsedBinding(binding);
    const contentChanged = oldData.content !== content;
    // 简单比较 options 对象。对于深层对象，可能需要更复杂的比较。
    const optionsChanged = JSON.stringify(oldData.options) !== JSON.stringify(options);

    if (contentChanged || optionsChanged) {
      oldData.content = content;
      oldData.options = options; // 更新存储的选项

      // 如果选项（特别是 triggerType）发生变化，需要重新绑定事件监听器
      if (optionsChanged) {
        removeEventListeners(el);
        addEventListeners(el, oldData);
      }

      // 如果 Tooltip 当前是由此元素触发显示的，则更新其内容/选项
      const tooltipStore = useTooltipStore();
      if (tooltipStore.isVisible && tooltipStore.targetElement === el) {
        tooltipStore.show({ // show 方法会处理选项的合并
          targetElement: el,
          content: oldData.content,
          options: oldData.options,
        });
      }
    }
  },
  beforeUnmount(el) {
    const tooltipStore = useTooltipStore();
    // 如果 Tooltip 当前是由此元素触发显示的，则立即隐藏它
    if (tooltipStore.isVisible && tooltipStore.targetElement === el) {
      tooltipStore.hide(true);
    }
    // 确保清除与此元素相关的任何待处理计时器（如果 store 中有特定于 target 的计时器管理）
    // tooltipStore.clearTimeoutsForTarget(el); // 假设有这样的方法，或 clearTimeouts() 足够通用
    tooltipStore.clearTimeouts(); // 通用清除

    removeEventListeners(el);
    elementDataMap.delete(el);
  },
};

// 建议在 main.ts 中全局注册:
// import { vComfyTooltip } from './directives/vComfyTooltip';
// const app = createApp(App);
// app.directive('comfy-tooltip', vComfyTooltip);
// ...