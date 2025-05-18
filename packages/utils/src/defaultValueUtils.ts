import type { InputDefinition, DataFlowTypeName } from '@comfytavern/types';
// 如果选择使用 DataFlowType.STRING 这样的形式，需要导入 DataFlowType
// import { DataFlowType } from '@comfytavern/types';

/**
 * 获取输入定义的有效默认值。
 * 优先顺序：
 * 1. `inputDef.config.default` (如果已定义)
 * 2. 如果 `inputDef.config.suggestions` 是非空数组 (处理旧 'COMBO' 逻辑)
 * 3. 基于 `inputDef.dataFlowType` 的类型特定默认值
 * 4. `null` 作为最终回退
 *
 * @param inputDef 输入定义对象
 * @returns 解析出的默认值
 */
export function getEffectiveDefaultValue(inputDef: InputDefinition): any { // 返回类型改回 any
  // 1. 优先使用 inputDef.config.default (如果已定义)
  if (inputDef.config?.default !== undefined) {
    return inputDef.config.default;
  }

  // 2. 处理旧 'COMBO' 类型的逻辑: 如果 suggestions 非空，则使用第一个 suggestion
  //    这优先于基于 dataFlowType 的 switch 判断。
  if (Array.isArray(inputDef.config?.suggestions) && inputDef.config.suggestions.length > 0) {
    return inputDef.config.suggestions[0];
  }

  // 3. 基于 inputDef.dataFlowType 的类型特定默认值
  switch (inputDef.dataFlowType as DataFlowTypeName) {
    case 'STRING': // 覆盖旧的 CODE, IMAGE (URL/Base64), RESOURCE_SELECTOR
      // 根据简化要求，统一返回 ''
      // 如果需要特定语义类型 (如 ImageReference, ResourceId) 返回 null，
      // 可在此处添加 `if (inputDef.matchCategories?.includes('ImageReference')) return null;`
      return '';
    case 'INTEGER':
      return 0;
    case 'FLOAT':
      return 0.0;
    case 'BOOLEAN':
      return false;
    case 'OBJECT': // 覆盖旧的 API_SETTINGS
      // 根据简化要求，统一返回 {}
      // 如果 LlmConfig 等需要特定结构，可在此处添加检查
      return {};
    case 'ARRAY': // 覆盖旧的 HISTORY
      return [];
    case 'BINARY':
      return null; // 或者 new ArrayBuffer(0)
    case 'WILDCARD': // 覆盖旧的 BUTTON
      return null;
    case 'CONVERTIBLE_ANY':
      return null;
    default:
      // 对于未知或未显式处理的 dataFlowType，记录警告并返回 null
      // eslint-disable-next-line no-console
      console.warn(
        `[getEffectiveDefaultValue] 未知或未处理的 dataFlowType "${inputDef.dataFlowType}". 将返回 null.`,
        inputDef,
      );
      return null; // 最终回退
  }
}