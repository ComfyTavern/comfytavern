import { MarkerType } from "@vue-flow/core";
import { DataFlowType } from "@comfytavern/types"; // 替换 SocketType 为 DataFlowType
import type { EdgeStyleProps } from "../../types/workflowTypes";

// 辅助函数：从 CSS 变量获取颜色值
function getCssVariableValue(variableName: string, fallbackColor: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // 在非浏览器环境（如 SSR 或测试）中提供回退
    return fallbackColor;
  }
  try {
    // 从 :root 获取计算后的样式
    const computedStyle = getComputedStyle(document.documentElement);
    const value = computedStyle.getPropertyValue(variableName)?.trim();
    return value || fallbackColor; // 如果变量未定义或为空，返回回退色
  } catch (error) {
    console.error(`Error getting CSS variable ${variableName}:`, error);
    return fallbackColor; // 出错时返回回退色
  }
}

/**
 * 根据边的源类型、目标类型和主题计算动态样式属性。
 * @param sourceType 源插槽类型 (应为 SocketType 中的值)
 * @param targetType 目标插槽类型 (应为 SocketType 中的值)
 * @param isDark 是否为暗色模式
 * @returns 包含 animated, style, markerEnd 的对象
 */
export function getEdgeStyleProps(
  sourceType: string,
  targetType: string,
  isDark: boolean,
  isStream?: boolean
): EdgeStyleProps {
  let edgeAnimated = false;
  let colorSet = ''; // 颜色将从 CSS 变量获取
  let strokeDasharray: string | undefined = undefined;

  if (isStream) {
    edgeAnimated = true;
    strokeDasharray = "5 5";
  }

  const themeSuffix = isDark ? 'dark' : 'light';
  const defaultFallbackColor = isDark ? '#6B7280' : '#9CA3AF'; // 硬编码的回退默认色

  // 优先使用 sourceType 来决定颜色，除非它是 Any 类型
  const primaryType =
    sourceType !== DataFlowType.WILDCARD && sourceType !== DataFlowType.CONVERTIBLE_ANY
      ? sourceType
      : targetType !== DataFlowType.WILDCARD && targetType !== DataFlowType.CONVERTIBLE_ANY
      ? targetType
      : null;

  if (primaryType) {
    // 其他已知类型
    // 将 SocketType (大写) 转换为 CSS 变量名中的小写部分
    const typeLower = primaryType.toLowerCase();
    const varName = `--handle-color-${typeLower}-${themeSuffix}`;
    // 为其他类型提供一个通用的回退色，或者可以根据类型提供不同的回退
    const fallbackColor = defaultFallbackColor;
    colorSet = getCssVariableValue(varName, fallbackColor);
  }

  // 如果 primaryType 是 null (两端都是 Any) 或未知类型，则使用默认颜色变量
  if (!colorSet) {
    const defaultVarName = `--handle-color-default-${themeSuffix}`;
    colorSet = getCssVariableValue(defaultVarName, defaultFallbackColor);
  }


  const edgeStyle: Record<string, any> = {
    stroke: colorSet, // 使用从 CSS 变量获取的颜色
    strokeWidth: 2,
  };
  if (strokeDasharray) {
    edgeStyle.strokeDasharray = strokeDasharray;
  }

  return {
    animated: edgeAnimated,
    style: edgeStyle,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 15,
      height: 15,
      color: colorSet, // 标记颜色与线条颜色一致
    },
  };
}

/**
 * Composable 函数，提供边样式相关的工具。
 */
export function useEdgeStyles() {
  return {
    getEdgeStyleProps,
  };
}
