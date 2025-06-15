// 定义主题系统相关的 TypeScript 接口

/**
 * CSS 变量键值对映射。
 * @example { "--ct-primary": "#ff0000" }
 */
export interface CssVariableMap {
  [key: string]: string;
}

/**
 * 主题的特定变体（如亮色或暗色模式）的定义。
 */
export interface ThemeVariant {
  /** 包含该变体所有 CSS 变量及其值的映射。 */
  variables: CssVariableMap;
  // 未来可扩展其他特定于变体的配置，如字体、特定组件覆盖等。
}

/**
 * 单个主题预设的完整定义。
 */
export interface ThemePreset {
  /** 主题的唯一标识符，例如 "ocean-blue"。 */
  id: string;
  /** 用户可见的主题名称，例如 "海洋之蓝"。 */
  name: string;
  /** 标记是否为不可删除的系统基础主题（例如默认亮/暗主题）。 */
  isSystemTheme?: boolean;
  /** 包含亮色和暗色模式下的主题变体定义。 */
  variants: {
    light: ThemeVariant;
    dark: ThemeVariant;
  };
  /** 主题的元数据，可选。 */
  metadata?: {
    author?: string;
    description?: string;
    version?: string;
  };
}