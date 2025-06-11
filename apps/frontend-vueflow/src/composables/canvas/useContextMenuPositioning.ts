import { ref } from 'vue';
import type { Ref } from 'vue';
import type { XYPosition } from '@vue-flow/core';

/**
 * 获取事件的客户端坐标，兼容鼠标和触摸事件。
 * @param event - 鼠标事件或触摸事件。
 * @returns 事件的客户端坐标 { x, y }。
 */
export const getEventClientPosition = (event: MouseEvent | TouchEvent): XYPosition => {
  // 检查是否为触摸事件
  if ('touches' in event && event.touches && event.touches.length > 0 && event.touches[0]) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  }

  // 否则当作鼠标事件处理
  return {
    x: (event as MouseEvent).clientX,
    y: (event as MouseEvent).clientY
  };
};

/**
 * Composable 函数，用于计算右键菜单相对于视口的位置。
 * @param _canvasContainerRef - 对画布容器 DOM 元素的引用 (当前未使用，但保留以备将来可能需要基于容器的逻辑)。
 * @returns 返回一个包含计算菜单位置函数的对象。
 */
export function useContextMenuPositioning(_canvasContainerRef: Ref<HTMLElement | null>) {
  const contextMenuPosition = ref<XYPosition>({ x: 0, y: 0 });

  /**
   * 计算并设置右键菜单在视口中的位置。
   * @param event - 触发菜单的鼠标或触摸事件。
   * @param menuWidth - 菜单的预估宽度 (默认 250px)。
   * @param menuHeight - 菜单的预估高度 (默认 300px)。
   * @returns 计算出的菜单视口位置 { x, y }。
   */
  const calculateContextMenuPosition = (
    event: MouseEvent | TouchEvent,
    menuWidth: number = 250,
    menuHeight: number = 300
  ): XYPosition => {
    const rawPosition = getEventClientPosition(event); // 原始视口坐标

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = rawPosition.x;
    let y = rawPosition.y;

    // 调整 X 坐标
    // 如果菜单右边缘超出视口，则尝试将菜单放在点击点的左侧
    if (x + menuWidth > viewportWidth) {
      x = rawPosition.x - menuWidth;
    }
    // 如果向左移动后，菜单左边缘仍然超出视口 (例如，菜单非常宽或点击点非常靠近左边缘)
    // 或者初始点击就使得菜单左边在视口外 (虽然不太可能，但作为保险)
    if (x < 0) {
      x = 0; // 将菜单左边缘贴紧视口左边缘
    }
    // 最后，确保菜单的右边缘不会因为之前的调整而再次超出视口
    // (例如，如果菜单比视口还宽，x 会被设为 0，这里会确保它不会是负的 menuWidth)
    x = Math.min(x, viewportWidth - menuWidth);
    x = Math.max(0, x); // 确保 x 不为负

    // 调整 Y 坐标
    // 如果菜单下边缘超出视口，则尝试将菜单放在点击点的上侧
    if (y + menuHeight > viewportHeight) {
      y = rawPosition.y - menuHeight;
    }
    // 如果向上移动后，菜单上边缘仍然超出视口
    if (y < 0) {
      y = 0; // 将菜单上边缘贴紧视口上边缘
    }
    // 最后，确保菜单的下边缘不会再次超出视口
    y = Math.min(y, viewportHeight - menuHeight);
    y = Math.max(0, y); // 确保 y 不为负

    const position = { x, y };
    contextMenuPosition.value = position;
    return position;
  };

  return {
    contextMenuPosition,
    calculateContextMenuPosition,
  };
}