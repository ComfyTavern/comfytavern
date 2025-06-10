import StringInput from './StringInput.vue'
import TextAreaInput from './TextAreaInput.vue'
import NumberInput from './NumberInput.vue'
import BooleanToggle from './BooleanToggle.vue'
import SelectInput from './SelectInput.vue'
import CodeInput from './CodeInput.vue'
// import EmbeddedGroupSelectorInput from './EmbeddedGroupSelectorInput.vue' // Removed: Obsolete component
import TextDisplay from './TextDisplay.vue'
import ButtonInput from './ButtonInput.vue' // 新增 ButtonInput 导入
import ResourceSelectorInput from './ResourceSelectorInput.vue' // 导入资源选择器
import JsonInlineViewer from './JsonInlineViewer.vue' // 导入 JSON 内联查看器
import InlineRegexRuleDisplay from './InlineRegexRuleDisplay.vue'; // ++ 导入内联正则规则显示组件
import { DataFlowType, BuiltInSocketMatchCategory } from '@comfytavern/types'; // 新增导入

// 导出组件
export {
  StringInput,
  TextAreaInput,
  NumberInput,
  BooleanToggle,
  SelectInput,
  CodeInput,
  TextDisplay, // Removed EmbeddedGroupSelectorInput from exports
  ButtonInput, // 新增 ButtonInput 导出
  ResourceSelectorInput, // 导出资源选择器
  JsonInlineViewer, // 导出 JSON 内联查看器
  InlineRegexRuleDisplay, // ++ 导出内联正则规则显示组件
}

// 导出类型定义
export interface InputProps {
  modelValue: any
  placeholder?: string
  disabled?: boolean
  hasError?: boolean
  errorMessage?: string
}

export interface NumberInputProps extends InputProps {
  modelValue: number
  type?: 'INTEGER' | 'FLOAT'
  min?: number
  max?: number
  step?: number
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectInputProps extends InputProps {
  modelValue: string
  options: (string | SelectOption)[]
}

// 定义输入类型枚举
export type InputType = 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'COMBO' | 'CODE' | 'BUTTON' | 'RESOURCE_SELECTOR' | 'OBJECT' | 'JSON' // Removed: EMBEDDED_GROUP_SELECTOR

// 定义组件获取器类型
// 使用更通用的类型以避免复杂的联合类型问题
type ComponentGetter = (config?: any) => any // typeof StringInput | ... | typeof ResourceSelectorInput

// 组件注册表 (改为 let 以便扩展)
export let inputComponentMap: Record<string, ComponentGetter> = { // 改为 let, 类型改为 string
  'STRING': (config?: any) => config?.multiline ? TextAreaInput : StringInput,
  'INTEGER': () => NumberInput,
  'FLOAT': () => NumberInput,
  'BOOLEAN': () => BooleanToggle,
  'COMBO': () => SelectInput,
  'CODE': () => CodeInput, // 新增 CODE 类型映射
  'BUTTON': () => ButtonInput, // 新增 BUTTON 类型映射
  'RESOURCE_SELECTOR': () => ResourceSelectorInput, // 移除 as any
  'OBJECT': () => JsonInlineViewer, // 新增 OBJECT 类型映射
  'JSON': () => JsonInlineViewer, // 新增 JSON 类型映射 (未来可能使用)
  // 'EMBEDDED_GROUP_SELECTOR': () => EmbeddedGroupSelectorInput // Removed: Obsolete mapping
}

// 注册新的输入组件类型
export const registerInputComponent = (type: string, componentGetter: ComponentGetter) => {
  if (inputComponentMap[type]) {
    console.warn(`Input component type "${type}" is already registered. Overwriting.`);
  }
  inputComponentMap[type] = componentGetter;
}

// 获取适合指定类型的组件
export const getInputComponent = (type: string, config?: any, matchCategories?: string[]) => { // 增加 matchCategories 参数
  // 优先处理 display_only
  if (config?.display_only) {
    return TextDisplay;
  }

  // 新增：专门处理按钮的逻辑
  // 确保 DataFlowType 和 BuiltInSocketMatchCategory 已导入
  if (type === DataFlowType.WILDCARD && matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)) {
    const getter = inputComponentMap['BUTTON']; // 直接使用 'BUTTON' 键
    return getter ? getter(config) : null;
  }

  // ++ 新增：根据 matchCategories 处理 InlineRegexRuleDisplay
  if (type === DataFlowType.ARRAY && matchCategories?.includes(BuiltInSocketMatchCategory.REGEX_RULE_ARRAY)) {
    return InlineRegexRuleDisplay;
  }

  // 使用修改后的 inputComponentMap
  if (type in inputComponentMap) {
    const getter = inputComponentMap[type]; // 直接使用 type 作为 key
    return getter ? getter(config) : null; // 调用 getter 并处理可能为 null 的情况
  }

  // 特殊处理 OBJECT 类型，确保它们能被正确映射
  // JSON 字符串通常作为 STRING 类型处理，但如果直接有 JSON 类型，也应映射到 JsonInlineViewer
  if (type === DataFlowType.OBJECT || type === 'JSON') { // 'JSON' 是 inputComponentMap 中的键
    const getter = inputComponentMap[type];
    if (getter) {
      return getter(config);
    }
  }

  // 对于未知类型或any类型，不返回任何组件
  if (!type || type === 'any' || type.toLowerCase() === 'any') {
    return null;
  }
  return null; // 不默认使用任何输入组件
}

export default {
  install: (app: any) => {
    app.component('StringInput', StringInput)
    app.component('TextAreaInput', TextAreaInput)
    app.component('NumberInput', NumberInput)
    app.component('BooleanToggle', BooleanToggle)
    app.component('SelectInput', SelectInput)
    app.component('CodeInput', CodeInput)
    app.component('TextDisplay', TextDisplay)
    app.component('ButtonInput', ButtonInput) // 新增 ButtonInput 注册
    app.component('ResourceSelectorInput', ResourceSelectorInput) // 新增 ResourceSelectorInput 注册
    app.component('JsonInlineViewer', JsonInlineViewer) // 新增 JsonInlineViewer 注册
    app.component('InlineRegexRuleDisplay', InlineRegexRuleDisplay) // ++ 新增 InlineRegexRuleDisplay 注册
    // app.component('EmbeddedGroupSelectorInput', EmbeddedGroupSelectorInput) // Removed: Obsolete component registration
  }
}