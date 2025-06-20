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
 * Composable 函数，用于计算右键菜单相对于其容器的位置。
 * @param canvasContainerRef - 对画布容器 DOM 元素的引用。
 * @returns 返回一个包含计算菜单位置函数的对象。
 */
export function useContextMenuPositioning(canvasContainerRef: Ref<HTMLElement | null>) {
  const contextMenuPosition = ref<XYPosition>({ x: 0, y: 0 });

  /**
   * 计算并设置右键菜单相对于其容器的位置。
   * @param event - 触发菜单的鼠标或触摸事件。
   * @param menuWidth - 菜单的预估宽度 (默认 250px)。
   * @param menuHeight - 菜单的预估高度 (默认 300px)。
   * @returns 计算出的菜单相对于容器的位置 { x, y }。
   */
  const calculateContextMenuPosition = (
    event: MouseEvent | TouchEvent,
    menuWidth: number = 250,
    menuHeight: number = 300
  ): XYPosition => {
    const containerRect = canvasContainerRef.value?.getBoundingClientRect();
    if (!containerRect) {
      console.warn("[useContextMenuPositioning] Canvas container ref not available for positioning.");
      // 返回一个安全的回退值，或者基于原始事件的视口位置
      return getEventClientPosition(event);
    }

    const rawPosition = getEventClientPosition(event); // 原始视口坐标

    // 将视口坐标转换为相对于容器的坐标
    const relativeX = rawPosition.x - containerRect.left;
    const relativeY = rawPosition.y - containerRect.top;

    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    let x = relativeX;
    let y = relativeY;

    // 调整 X 坐标 (现在是相对于容器)
    // 如果菜单右边缘超出容器，则尝试将菜单放在点击点的左侧
    if (x + menuWidth > containerWidth) {
      x = relativeX - menuWidth;
    }
    // 如果向左移动后，菜单左边缘仍然超出容器
    if (x < 0) {
      x = 0; // 将菜单左边缘贴紧容器左边缘
    }
    // 最后，确保菜单的右边缘不会因为之前的调整而再次超出容器
    x = Math.min(x, containerWidth - menuWidth);
    x = Math.max(0, x); // 确保 x 不为负

    // 调整 Y 坐标 (现在是相对于容器)
    // 如果菜单下边缘超出容器，则尝试将菜单放在点击点的上侧
    if (y + menuHeight > containerHeight) {
      y = relativeY - menuHeight;
    }
    // 如果向上移动后，菜单上边缘仍然超出容器
    if (y < 0) {
      y = 0; // 将菜单上边缘贴紧容器上边缘
    }
    // 最后，确保菜单的下边缘不会再次超出容器
    y = Math.min(y, containerHeight - menuHeight);
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