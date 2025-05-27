// apps/frontend-vueflow/src/constants/handleConstants.ts

/**
 * 单条连接线在 Handle 上占据的视觉高度 (px)
 */
export const HANDLE_LINE_HEIGHT = 6;

/**
 * 连接线在 Handle 上的视觉间隙 (px)
 */
export const HANDLE_LINE_GAP = 4; // 从 8 改为 4，减少间隙

/**
 * Handle 自身的上下总内边距 (px)
 * 例如，上下各2px，则此值为4px
 */
export const HANDLE_VERTICAL_PADDING = 4;

/**
 * 仿 Blender 细节：无连接时 Handle 至少为 N 倍单线视觉高度
 * 这个因子决定了即使没有连接，多输入 Handle 的最小高度。
 */
export const MIN_MULTI_HANDLE_HEIGHT_FACTOR = 2;

/**
 * Handle 的宽度 (px)
 * 用于计算跑道形 Handle 的圆角半径 (通常是宽度的一半)。
 */
export const HANDLE_WIDTH = 12;