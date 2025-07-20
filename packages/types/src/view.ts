// packages/types/src/view.ts

/**
 * @fileoverview This file contains shared types for generic view components,
 * such as data lists, tables, and toolbars.
 */

/**
 * 定义列表视图中列的结构。
 * @template T - 数据项的类型。
 */
export interface ColumnDefinition<T = any> {
  /** 数据的键，用于从数据项中提取值。 */
  key: keyof T | string;
  /** 表头显示的标签。 */
  label: string;
  /** 此列是否可排序。 */
  sortable?: boolean;
  /** 列的 CSS 宽度，例如 '50%' 或 '100px'。 */
  width?: string;
}

/**
 * 定义排序配置。
 * @template T - 数据项的类型。
 */
export interface SortConfig<T = any> {
  /** 用于排序的字段键。 */
  field: keyof T | string;
  /** 排序方向。 */
  direction: 'asc' | 'desc';
}

/**
 * 定义筛选配置。
 * 这是一个基础接口，可以根据具体需求进行扩展。
 */
export interface FilterConfig {
  /** 用于全文搜索或模糊匹配的搜索词。 */
  searchTerm: string;
  /** 可以添加其他具体的筛选字段，例如：
   *  type?: 'image' | 'workflow' | 'project';
   *  status?: 'active' | 'archived';
   */
  [key: string]: any;
}

/**
 * 定义工具栏操作按钮的结构。
 */
export interface ToolbarAction {
  /** 操作的唯一标识符。 */
  id: string;
  /** 按钮上显示的文本。 */
  label: string;
  /** 按钮的图标，可以是 Vue 组件或 SVG 字符串。 */
  icon?: any;
  /** 此操作是否被禁用。 */
  disabled?: boolean;
  /** 其他自定义属性。 */
  [key: string]: any;
}

/**
 * 预设的视图显示模式。
 * - 'grid': 网格卡片模式。
 * - 'list': 标准列表模式。
 * - 'compact-list': 紧凑列表模式。
 */
export type DisplayMode = 'grid' | 'list' | 'compact-list';

/**
 * 字段映射，用于将数据项的字段动态地映射到预设视图的特定显示区域。
 * @template T - 数据项的类型。
 */
export interface FieldMapping<T = any> {
  /** 映射到主标题的字段。 */
  title: keyof T | ((item: T) => string);
  /** 映射到描述文本的字段。 */
  description?: keyof T | ((item: T) => string);
  /** 映射到日期显示的字段。 */
  date?: keyof T | ((item: T) => string | number);
  /** 映射到图片 URL 的字段。 */
  imageUrl?: keyof T | ((item: T) => string);
  /** 映射到标签或状态的字段。 */
  tag?: keyof T | ((item: T) => string);
}