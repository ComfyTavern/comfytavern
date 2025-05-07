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

  // 根据类型返回隐式默认值
  switch (inputDef.type) {
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
    case 'BUTTON': // Roo: Added BUTTON type, defaults to null
    case 'ANY': // ANY 类型也默认为 null
    case 'CONVERTIBLE_ANY': // 可转换类型，初始没有明确默认值
      return null;
    default:
      // 对于未明确处理的类型，返回 null 以增加健壮性
      // 也可以考虑记录一个警告或抛出错误，但 null 更安全
      // 使用类型断言确保 inputDef.type 是已知类型或 string
      const knownType: string = inputDef.type;
      console.warn(`Unhandled input type "${knownType}" in getEffectiveDefaultValue. Returning null.`);
      return null;
  }
}