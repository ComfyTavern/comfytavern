import type { NodeDefinition, UserContext, RegexRule } from '@comfytavern/types'; // + Import UserContext and shared RegexRule
import { famService } from '../../services/FileManagerService'; // + Import famService

// import yaml from 'js-yaml'; // 可选：如果需要支持 YAML

// 使用从 @comfytavern/types 导入的 RegexRule 接口
// 本地 RegexRule 接口定义已移除

// 基础验证函数 (可以更复杂) - 参数类型更新为导入的 RegexRule
function isValidRegexRuleArray(data: any): data is RegexRule[] {
  if (!Array.isArray(data)) {
    return false;
  }
  // 检查每个规则是否至少有 pattern 属性
  return data.every(item =>
    typeof item === 'object' &&
    item !== null &&
    typeof item.pattern === 'string'
    // 可以根据导入的 RegexRule 类型添加更严格的检查
  );
}

class RegexRuleLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const ruleResourcePath = nodeData?.ruleResource as string | undefined; // ruleResource is a string (logical path)

    if (!ruleResourcePath) {
      console.error(`RegexRuleLoader (${context?.nodeId}): Missing rule resource path.`);
      throw new Error('Rule resource not selected');
    }

    const userContext = context?.userContext as UserContext | undefined;
    let userId: string | null = null;
    if (userContext?.currentUser) {
      userId = userContext.currentUser.uid;
    }
    
    if (ruleResourcePath.startsWith('user://') && !userId) {
      console.error(`RegexRuleLoader (${context?.nodeId}): User ID is required for user-specific resource path: ${ruleResourcePath}`);
      throw new Error('User context is required to load this user-specific regex rule set.');
    }

    console.log(`RegexRuleLoader (${context?.nodeId}): Loading regex rules from logical path: ${ruleResourcePath} (User: ${userId || 'shared/system'})`);

    try {
      const fileContent = await famService.readFile(userId, ruleResourcePath, 'utf-8');
      if (typeof fileContent !== 'string') {
        throw new Error('Failed to read rule file content as string.');
      }
      let ruleData;
      // TODO: 添加对不同文件格式的判断和解析 (e.g., YAML)
      // if (ruleResourcePath.endsWith('.yaml') || ruleResourcePath.endsWith('.yml')) {
      //   ruleData = yaml.load(fileContent);
      // } else {
      ruleData = JSON.parse(fileContent); // 默认按 JSON 解析
      // }

      // Validate the structure
      if (!isValidRegexRuleArray(ruleData)) {
        throw new Error('Loaded data is not a valid RegexRule array.');
      }

      console.log(`RegexRuleLoader (${context?.nodeId}): Regex rules loaded and validated successfully.`);
      return { regexRules: ruleData as RegexRule[] };

    } catch (error: any) {
      console.error(`RegexRuleLoader (${context?.nodeId}): Failed to load/parse/validate rules "${ruleResourcePath}" - ${error.message}`);
      // Re-throw the error or throw a new one
      throw new Error(`Failed to load regex rules: ${error.message}`);
    }
  }
}

export const definition: NodeDefinition = {
  type: 'RegexRuleLoader',
  category: 'Loaders',
  displayName: '⚙️加载正则规则',
  description: '从文件加载正则表达式规则',
  width: 300,

  inputs: {},
  outputs: {
    regexRules: {
      dataFlowType: 'ARRAY', // 输出规则数组
      displayName: '正则规则',
      description: '加载的正则表达式规则数组'
    }
    // Removed error output port
  },

  configSchema: {
    ruleResource: {
      dataFlowType: 'STRING', // RESOURCE_SELECTOR value is a string (path/ID)
      displayName: '规则文件',
      description: '选择一个正则表达式规则文件 (JSON/YAML)',
      required: true,
      matchCategories: ['ResourceId', 'FilePath'],
      config: {
        // 需要确认系统中实际的资源类型标识
        acceptedTypes: [
          { value: 'json', label: '规则 (JSON)' },
          { value: 'yaml', label: '规则 (YAML)' },
          // { value: 'regexrule', label: '规则文件' } // 或者可能是这样
        ],
        placeholder: '选择一个规则文件...',
      }
    }
  },

  execute: RegexRuleLoaderNodeImpl.execute
};