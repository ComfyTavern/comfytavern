import { ref } from 'vue';
import type { Ref } from 'vue';
import type { XYPosition } from '@vue-flow/core';

/**
 * 获取事件的客户端坐标，兼容鼠标和触摸事件。
 * @param event - 鼠标事件或触摸事件。
 * @returns 事件的客户端坐标 { x, y }。
 */
const getEventClientPosition = (event: MouseEvent | TouchEvent): XYPosition => {
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
 * Composable 函数，用于计算右键菜单相对于指定容器的位置。
 * @param canvasContainerRef - 对画布容器 DOM 元素的引用。
 * @returns 返回一个包含计算菜单位置函数的对象。
 */
export function useContextMenuPositioning(canvasContainerRef: Ref<HTMLElement | null>) {
  const contextMenuPosition = ref<XYPosition>({ x: 0, y: 0 });

  /**
   * 计算并设置右键菜单的位置。
   * @param event - 触发菜单的鼠标或触摸事件。
   * @returns 计算出的菜单位置 { x, y }，如果无法计算则返回 null。
   */
  const calculateContextMenuPosition = (event: MouseEvent | TouchEvent): XYPosition | null => {
    // 获取原始视口坐标
    const rawPosition = getEventClientPosition(event);
    // 获取画布容器边界
    const canvasRect = canvasContainerRef.value?.getBoundingClientRect();

    if (!canvasRect) {
      console.warn("Canvas container ref not found, cannot calculate relative position.");
      return null;
    }

    // 获取视口尺寸
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 假设菜单的最小宽度为 200px（来自 CSS）
    const MENU_MIN_WIDTH = 200;
    // 假设菜单的最大高度（可以根据实际内容调整）
    const MENU_MAX_HEIGHT = 400;

    // 计算相对于画布的初始坐标
    let x = rawPosition.x - canvasRect.left;
    let y = rawPosition.y - canvasRect.top;

    // 检查右边界
    if (rawPosition.x + MENU_MIN_WIDTH > viewportWidth) {
      x = x - MENU_MIN_WIDTH;
    }

    // 检查底部边界
    if (rawPosition.y + MENU_MAX_HEIGHT > viewportHeight) {
      y = y - MENU_MAX_HEIGHT;
    }

    // 确保不会出现负值
    x = Math.max(0, x);
    y = Math.max(0, y);

    const position = { x, y };
    contextMenuPosition.value = position;
    return position;
  };

  return {
    contextMenuPosition,
    calculateContextMenuPosition,
  };
}