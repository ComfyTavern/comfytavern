import StringInput from "./StringInput.vue";
import TextAreaInput from "./TextAreaInput.vue";
import NumberInput from "./NumberInput.vue";
import BooleanToggle from "./BooleanToggle.vue";
import SelectInput from "./SelectInput.vue";
import CodeInput from "./CodeInput.vue";
// import EmbeddedGroupSelectorInput from './EmbeddedGroupSelectorInput.vue' // Removed: Obsolete component
import TextDisplay from "./TextDisplay.vue";
import ButtonInput from "./ButtonInput.vue"; // 新增 ButtonInput 导入
import ResourceSelectorInput from "./ResourceSelectorInput.vue"; // 导入资源选择器
import JsonInlineViewer from "./JsonInlineViewer.vue"; // 导入 JSON 内联查看器
import InlineRegexRuleDisplay from "./InlineRegexRuleDisplay.vue"; // ++ 导入内联正则规则显示组件
import {
  DataFlowType,
  BuiltInSocketMatchCategory,
  type DataFlowTypeName,
} from "@comfytavern/types"; // 新增导入 DataFlowTypeName
import type { Component } from "vue"; // 导入 Vue Component 类型

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
};

// 导出类型定义
export interface InputProps {
  modelValue: any;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

export interface NumberInputProps extends InputProps {
  modelValue: number;
  type?: "INTEGER" | "FLOAT";
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectInputProps extends InputProps {
  modelValue: string;
  options: (string | SelectOption)[];
}

// 定义输入类型枚举
export type InputType =
  | "STRING"
  | "INTEGER"
  | "FLOAT"
  | "BOOLEAN"
  | "COMBO"
  | "CODE"
  | "BUTTON"
  | "RESOURCE_SELECTOR"
  | "OBJECT"
  | "JSON"; // Removed: EMBEDDED_GROUP_SELECTOR

// 定义组件获取器类型
// 使用更通用的类型以避免复杂的联合类型问题
type ComponentGetter = (config?: any) => any; // typeof StringInput | ... | typeof ResourceSelectorInput

// 组件注册表 (改为 let 以便扩展)
export let inputComponentMap: Record<string, ComponentGetter> = {
  // 改为 let, 类型改为 string
  STRING: (config?: any) => (config?.multiline ? TextAreaInput : StringInput),
  INTEGER: () => NumberInput,
  FLOAT: () => NumberInput,
  BOOLEAN: () => BooleanToggle,
  COMBO: () => SelectInput,
  CODE: () => CodeInput, // 新增 CODE 类型映射
  BUTTON: () => ButtonInput, // 新增 BUTTON 类型映射
  RESOURCE_SELECTOR: () => ResourceSelectorInput, // 移除 as any
  OBJECT: () => JsonInlineViewer, // 新增 OBJECT 类型映射
  JSON: () => JsonInlineViewer, // 新增 JSON 类型映射 (未来可能使用)
  // 'EMBEDDED_GROUP_SELECTOR': () => EmbeddedGroupSelectorInput // Removed: Obsolete mapping
};

// 注册新的输入组件类型
export const registerInputComponent = (type: string, componentGetter: ComponentGetter) => {
  if (inputComponentMap[type]) {
    console.warn(`Input component type "${type}" is already registered. Overwriting.`);
  }
  inputComponentMap[type] = componentGetter;
};

// 获取适合指定类型的组件
export const getInputComponent = (
  type: DataFlowTypeName, // 使用强类型
  config?: Record<string, any>,
  matchCategories?: string[]
): Component | null => {
  const cats = matchCategories || [];
  const cfg = config || {};

  // 1. 特殊用途的内联组件
  if (type === DataFlowType.WILDCARD && cats.includes(BuiltInSocketMatchCategory.TRIGGER)) {
    return ButtonInput;
  }
  if (type === DataFlowType.ARRAY && cats.includes(BuiltInSocketMatchCategory.REGEX_RULE_ARRAY)) {
    return InlineRegexRuleDisplay;
  }

  // 2. 基于 config.suggestions 和 matchCategories 决定 SelectInput 或让其流向后续处理
  if (
    cfg.suggestions &&
    Array.isArray(cfg.suggestions) &&
    cfg.suggestions.length > 0 &&
    (type === DataFlowType.STRING || type === DataFlowType.INTEGER || type === DataFlowType.FLOAT)
  ) {
    if (cats.includes(BuiltInSocketMatchCategory.COMBO_OPTION)) {
      return SelectInput; // 明确是纯下拉选择
    }
    // 如果不是 COMBO_OPTION，则不在这里返回 SelectInput，
    // 让它自然地进入下面的 switch-case，由 StringInput 或 NumberInput 处理，
    // 因为它们已经支持 suggestions。
  }

  // 3. 根据 DataFlowType 和其他条件选择内联组件
  switch (type) {
    case DataFlowType.STRING:
      if (cats.includes(BuiltInSocketMatchCategory.CODE)) return null; // 代码编辑外部化
      if (cfg.multiline === true) return TextAreaInput; // 多行文本内联编辑
      return StringInput; // 单行文本内联编辑

    case DataFlowType.INTEGER:
    case DataFlowType.FLOAT:
      // NumberInput 会自行处理 suggestions prop
      return NumberInput;

    case DataFlowType.BOOLEAN:
      return BooleanToggle;

    case DataFlowType.OBJECT:
      // 使用现有的 JsonInlineViewer，它已支持内联编辑
      if (cats.includes(BuiltInSocketMatchCategory.JSON)) return JsonInlineViewer;
      return null; // 其他 Object 类型可能需要外部编辑器

    case DataFlowType.ARRAY: // 未被 REGEX_RULE_ARRAY 捕获的
      // 通用数组可能没有标准内联编辑器，依赖外部
      return null;

    case DataFlowType.CONVERTIBLE_ANY:
      return null; // 不直接渲染

    default:
      // 尝试从 inputComponentMap (由 registerInputComponent 填充) 中查找自定义组件
      // 注意：这里的 type 是 DataFlowTypeName，而 inputComponentMap 的键是 string
      // 如果 registerInputComponent 注册时使用的键与 DataFlowTypeName 的值一致，则可以匹配
      if (type in inputComponentMap) {
        const getter = inputComponentMap[type as string];
        if (getter) {
          console.warn(
            `[getInputComponent] Using custom component for type: ${type} from inputComponentMap.`
          );
          return getter(cfg);
        }
      }
      console.warn(
        `[getInputComponent] No specific INLINE component registered or found for DataFlowType: ${type}. Config:`,
        cfg,
        "Categories:",
        cats
      );
      return null;
  }
};

export default {
  install: (app: any) => {
    app.component("StringInput", StringInput);
    app.component("TextAreaInput", TextAreaInput);
    app.component("NumberInput", NumberInput);
    app.component("BooleanToggle", BooleanToggle);
    app.component("SelectInput", SelectInput);
    app.component("CodeInput", CodeInput);
    app.component("TextDisplay", TextDisplay);
    app.component("ButtonInput", ButtonInput); // 新增 ButtonInput 注册
    app.component("ResourceSelectorInput", ResourceSelectorInput); // 新增 ResourceSelectorInput 注册
    app.component("JsonInlineViewer", JsonInlineViewer); // 新增 JsonInlineViewer 注册
    app.component("InlineRegexRuleDisplay", InlineRegexRuleDisplay); // ++ 新增 InlineRegexRuleDisplay 注册
    // app.component('EmbeddedGroupSelectorInput', EmbeddedGroupSelectorInput) // Removed: Obsolete component registration
  },
};
