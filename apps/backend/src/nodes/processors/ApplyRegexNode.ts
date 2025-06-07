import { z } from 'zod'; // z 仍然需要，因为 NodeDefinition 可能间接使用

import {
    BuiltInSocketMatchCategory, DataFlowType, RegexRuleArraySchema, RegexRuleSchema
} from '@comfytavern/types'; // 导入 Zod schemas 和类型

import type { NodeDefinition, NodeExecutionContext, RegexRule } from "@comfytavern/types"; // 导入 RegexRule 类型
class ApplyRegexNodeImpl {
  static async execute(inputs: Record<string, any>, context: NodeExecutionContext): Promise<Record<string, any>> {
    const inputText = inputs?.inputText as string | undefined;
    const inlineRulesInput = inputs?.inlineRegexRules;
    const loadedRulesInput = inputs?.regexRules;

    if (typeof inputText !== 'string') {
      throw new Error('输入文本缺失或非字符串。');
    }

    // 1. 获取规则
    const inlineRules: RegexRule[] = Array.isArray(inlineRulesInput) ? inlineRulesInput : [];
    const loadedRules: RegexRule[] = Array.isArray(loadedRulesInput) ? loadedRulesInput : [];

    // 2. 校验规则 (直接使用导入的 RegexRuleArraySchema)
    if (inlineRules.length > 0 && !RegexRuleArraySchema.safeParse(inlineRules).success) {
      console.warn(`ApplyRegex (${context?.nodeId}): 内联正则规则校验失败，将尝试过滤有效规则。详情:`, RegexRuleArraySchema.safeParse(inlineRules).error?.format());
      // 不直接抛出错误，而是尝试在合并时过滤掉无效的
    }
    if (loadedRules.length > 0 && !RegexRuleArraySchema.safeParse(loadedRules).success) {
      console.warn(`ApplyRegex (${context?.nodeId}): 加载的正则规则校验失败，将尝试过滤有效规则。详情:`, RegexRuleArraySchema.safeParse(loadedRules).error?.format());
      // 不直接抛出错误
    }

    // 3. 合并与去重 (内联规则优先, 基于 name 去重)
    const finalRules: RegexRule[] = [];
    const ruleNames = new Set<string>();

    // 首先处理内联规则，并确保每个规则都通过 RegexRuleSchema 校验
    for (const rule of inlineRules) {
      const parsedRule = RegexRuleSchema.safeParse(rule);
      if (parsedRule.success && !ruleNames.has(parsedRule.data.name)) {
        finalRules.push(parsedRule.data);
        ruleNames.add(parsedRule.data.name);
      } else if (!parsedRule.success) {
        console.warn(`ApplyRegex (${context?.nodeId}): 跳过无效的内联规则 (校验失败):`, rule, parsedRule.error.format());
      }
    }

    // 然后处理加载的规则，并确保每个规则都通过 RegexRuleSchema 校验
    for (const rule of loadedRules) {
      const parsedRule = RegexRuleSchema.safeParse(rule);
      if (parsedRule.success && !ruleNames.has(parsedRule.data.name)) {
        finalRules.push(parsedRule.data);
        ruleNames.add(parsedRule.data.name);
      } else if (!parsedRule.success) {
        console.warn(`ApplyRegex (${context?.nodeId}): 跳过无效的加载规则 (校验失败):`, rule, parsedRule.error.format());
      }
    }

    if (finalRules.length === 0) {
      console.log(`ApplyRegex (${context?.nodeId}): 没有可应用的有效正则规则。返回原始文本。`);
      return { outputText: inputText };
    }

    console.log(`ApplyRegex (${context?.nodeId}): 应用 ${finalRules.length} 条合并后的规则到输入文本。`);

    let currentText = inputText;
    try {
      for (const rule of finalRules) {
        // 检查规则是否启用 (enabled 默认为 true，如果字段不存在也视为启用)
        if (rule.enabled === false) {
          console.log(`ApplyRegex (${context?.nodeId}): 跳过已禁用的规则 "${rule.name}"`);
          continue;
        }
        // 确保 rule.pattern 和 rule.replacement 是字符串，Zod schema 应该已经保证了
        const regex = new RegExp(rule.pattern, rule.flags || '');
        currentText = currentText.replace(regex, rule.replacement);
      }

      console.log(`ApplyRegex (${context?.nodeId}): 正则规则应用成功。`);
      return { outputText: currentText };

    } catch (error: any) {
      console.error(`ApplyRegex (${context?.nodeId}): 应用正则规则时出错 - ${error.message}`);
      throw new Error(`应用正则时出错: ${error.message}`);
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
      dataFlowType: 'STRING',
      displayName: '输入文本',
      description: '需要应用正则表达式的文本',
      required: true, // inputText 通常是必需的
    },
    inlineRegexRules: {
      displayName: '内联正则规则',
      dataFlowType: DataFlowType.ARRAY, // 存储 RegexRule 对象的数组
      matchCategories: [BuiltInSocketMatchCategory.REGEX_RULE_ARRAY], // ++ 新增，用于前端识别
      description: '直接在节点上编辑的正则表达式规则列表。如果此输入槽连接了数据，则使用连接的值；如果未连接，则可以使用下方按钮编辑并使用此处存储的值。规则将按顺序应用，并与 `加载的正则规则` 输入槽加载的规则合并（内联规则优先，同名去重）。',
      required: false,
      config: { // 保留 config 用于 actions 和 defaultValue
        defaultValue: [],
        // isEditableInline: true, // 这个属性可以移除，由前端根据 matchCategory 判断
      },
      actions: [
        {
          id: 'edit_inline_rules', // 唯一的 action，用于打开 RegexEditorModal
          icon: 'ListBulletIcon', // 前端应映射为实际图标
          tooltip: '编辑内联正则规则',
          handlerType: 'open_panel',
          handlerArgs: {
            panelId: 'RegexEditorModal', // 前端将注册此 ID 的模态框
            panelTitle: '编辑内联正则规则',
            // 上下文将由 BaseNode 传递: { nodeId, inputKey, currentValue }
          }
          // 移除了 showConditionKey，因为当输入槽连接时，actions 按钮默认不显示
        }
        // 移除了内置 JSON 编辑器的 action
      ]
    },
    regexRules: {
      displayName: '正则规则输入',
      dataFlowType: DataFlowType.ARRAY, // 存储 RegexRule 对象的数组
      matchCategories: [BuiltInSocketMatchCategory.REGEX_RULE_ARRAY], // ++ 新增，保持一致性
      description: '通过连接加载的正则表达式规则列表。将与内联规则合并（内联规则优先，同名去重）。',
      required: false,
    }
  },
  outputs: {
    outputText: {
      dataFlowType: 'STRING',
      displayName: '输出文本',
      description: '应用正则表达式后的文本'
    }
    // Removed error output port
  },

  // configSchema: {}, // 暂时不需要配置

  execute: ApplyRegexNodeImpl.execute
};