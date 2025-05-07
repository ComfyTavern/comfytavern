import type { NodeDefinition } from '@comfytavern/types';

// 更新后的正则规则结构 (包含 replacement)
interface RegexRule {
  pattern: string;
  replacement: string; // 用于替换匹配项的字符串
  flags?: string; // e.g., 'g', 'i', 'm' (通常需要 'g' 来全局替换)
  target?: string; // 应用目标标识 (可选, 此节点暂不使用)
  description?: string;
}

// 更新后的验证函数 (检查 pattern 和 replacement)
function isValidRegexRuleArray(data: any): data is RegexRule[] {
  if (!Array.isArray(data)) {
    return false;
  }
  // 检查每个规则是否至少有 pattern 和 replacement 字符串
  return data.every(item =>
    typeof item === 'object' &&
    item !== null &&
    typeof item.pattern === 'string' &&
    typeof item.replacement === 'string' // 确保有 replacement
  );
}


class ApplyRegexNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const inputText = inputs?.inputText;
    const regexRules = inputs?.regexRules;

    if (typeof inputText !== 'string') {
      // Throw error instead of returning
      throw new Error('Input text is missing or not a string.');
    }
    if (!isValidRegexRuleArray(regexRules)) {
      // Throw error instead of returning
      throw new Error('Input regex rules are missing or invalid.');
    }

    console.log(`ApplyRegex (${context?.nodeId}): Applying ${regexRules.length} rules to input text.`);

    let currentText = inputText;
    try {
      for (const rule of regexRules) {
        // 创建正则表达式对象
        // 注意：flags 默认为空，如果需要全局替换等，规则中应包含 'g'
        const regex = new RegExp(rule.pattern, rule.flags || '');
        // 应用替换
        currentText = currentText.replace(regex, rule.replacement);
        // 注意: .replace() 默认只替换第一个匹配项，除非 flags 包含 'g'
        // 如果需要所有匹配项都被替换，规则的 flags 必须包含 'g'
        // 或者使用 currentText = currentText.replaceAll(regex, rule.replacement); (需要 ES2021+)
      }

      console.log(`ApplyRegex (${context?.nodeId}): Regex rules applied successfully.`);
      return { outputText: currentText };

    } catch (error: any) {
      console.error(`ApplyRegex (${context?.nodeId}): Error applying regex rule - ${error.message}`);
      // Re-throw the error or throw a new one
      throw new Error(`Error applying regex: ${error.message}`);
    }
  }
}

export const definition: NodeDefinition = {
  type: 'ApplyRegex',
  category: 'Processors', // 功能分类
  displayName: '🔄应用正则',
  description: '将正则表达式规则应用于输入文本',
  width: 300,

  inputs: {
    inputText: {
      type: 'string',
      displayName: '输入文本',
      description: '需要应用正则表达式的文本'
    },
    regexRules: {
      type: 'array',
      displayName: '正则规则',
      description: '从 RegexRuleLoader 加载的规则数组'
    }
  },
  outputs: {
    outputText: {
      type: 'string',
      displayName: '输出文本',
      description: '应用正则表达式后的文本'
    }
    // Removed error output port
  },

  // configSchema: {}, // 暂时不需要配置

  execute: ApplyRegexNodeImpl.execute
};