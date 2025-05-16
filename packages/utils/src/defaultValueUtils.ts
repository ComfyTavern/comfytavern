import type { InputDefinition } from '@comfytavern/types';

/**
 * 获取输入定义的有效默认值。
 * 如果显式设置了 defaultValue，则返回该值。
 * 否则，根据输入类型返回隐式默认值。
 *
 * @param inputDef 输入定义对象
 * @returns 输入的有效默认值
 */
export function getEffectiveDefaultValue(inputDef: InputDefinition): any {
  // 检查 config 中是否存在显式默认值
  if (inputDef.config?.default !== undefined) {
    return inputDef.config.default;
  }

  // 规范化类型为大写，以处理潜在的大小写不一致问题
  const typeNormalized = String(inputDef.type).toUpperCase();

  // 根据类型返回隐式默认值
  switch (typeNormalized) {
    case 'STRING':
    case 'CODE': // CODE 类型也默认为空字符串
      return '';
    case 'INT':
      return 0;
    case 'FLOAT':
      return 0.0;
    case 'BOOLEAN':
      return false;
    case 'COMBO':
      // 注意：现在统一使用 suggestions，并且它在 config 内部
      if (Array.isArray(inputDef.config?.suggestions) && inputDef.config.suggestions.length > 0) {
        // 返回第一个建议的值
        return inputDef.config.suggestions[0];
      }
      // 如果 suggestions 不可用或为空，则返回空字符串
      return '';
    case 'IMAGE':
    case 'BUTTON':
    case 'ANY': // ANY 类型也默认为 null
    case 'CONVERTIBLE_ANY': // 可转换类型，初始没有明确默认值
    case 'RESOURCE_SELECTOR': // 新增：资源选择器默认为 null
      return null;
    case 'HISTORY': // 新增：历史记录默认为空数组
      return [];
    case 'API_SETTINGS': // 新增：API 设置默认为一个具体结构或空对象
      // 基于 packages/types/src/node.ts 中的 APISettings 接口
      return { use_env_vars: false, base_url: '', api_key: '' };
    case 'OBJECT': // 新增：通用对象默认为空对象
      return {};
    case 'ARRAY': // 新增：通用数组默认为空数组
      return [];
    default:
      // 对于未明确处理的类型，返回 null 以增加健壮性
      // 使用原始类型和规范化后的类型进行日志记录
      console.warn(`Unhandled input type "${inputDef.type}" (normalized: "${typeNormalized}") in getEffectiveDefaultValue. Returning null.`);
      return null;
  }
}