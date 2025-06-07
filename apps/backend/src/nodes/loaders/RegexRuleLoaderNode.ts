import type { NodeDefinition } from '@comfytavern/types';
import { promises as fs } from 'fs';
import path from 'path';

// import yaml from 'js-yaml'; // 可选：如果需要支持 YAML

// 假设的正则规则结构 (需要根据实际需求定义)
interface RegexRule {
  pattern: string;
  flags?: string; // e.g., 'g', 'i', 'm'
  target?: string; // 应用目标标识 (可选)
  description?: string;
}

// 基础验证函数 (可以更复杂)
function isValidRegexRuleArray(data: any): data is RegexRule[] {
  if (!Array.isArray(data)) {
    return false;
  }
  // 检查每个规则是否至少有 pattern 属性
  return data.every(item => typeof item === 'object' && item !== null && typeof item.pattern === 'string');
}

class RegexRuleLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const ruleResourcePath = nodeData?.ruleResource;

    if (!ruleResourcePath) {
      console.error(`RegexRuleLoader (${context?.nodeId}): Missing rule resource path.`);
      // Throw error instead of returning
      throw new Error('Rule resource not selected');
    }

    console.log(`RegexRuleLoader (${context?.nodeId}): Loading regex rules from: ${ruleResourcePath}`);

    try {
      // TODO: 确认资源路径格式和加载方式
      const fileContent = await fs.readFile(ruleResourcePath, 'utf-8');
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