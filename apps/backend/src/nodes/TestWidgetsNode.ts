import type { NodeDefinition } from '@comfytavern/types'
// Removed: import { nodeManager } from './NodeManager'

export class TestWidgetsNodeImpl {
  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    // 简单地将所有输入值传递到输出
    return {
      string_output: inputs.string_input,
      text_output: inputs.text_input,
      int_output: inputs.int_input,
      float_output: inputs.float_input,
      boolean_output: inputs.boolean_toggle,
      combo_output: inputs.combo_select,
      json_output: inputs.json_input,
      // BUTTON 类型没有直接的输出值，它触发事件
      string_with_suggestions_output: inputs.string_with_suggestions, // Pass through new inputs
      int_with_suggestions_output: inputs.int_with_suggestions,     // Pass through new inputs
      float_with_suggestions_output: inputs.float_with_suggestions  // Pass through new inputs
    }
  }
}

// Renamed export to 'definition' for NodeLoader convention
export const definition: NodeDefinition = {
  type: 'TestWidgets', // Base type name
  // namespace will be inferred as 'core' or 'builtin' by NodeManager based on path (assuming Test is not core)
  category: 'Test', // Functional category
  displayName: '🧪测试组件节点',
  description: '用于测试各种输入组件的节点',

  inputs: {
    string_input: {
      dataFlowType: 'STRING',
      displayName: '单行文本',
      description: '单行文本输入测试',
      required: true,
      config: {
        default: '这是默认文本',
        multiline: false,
        placeholder: '请输入单行文本'
      },
    },
    text_input: {
      dataFlowType: 'STRING',
      displayName: '多行文本',
      description: '多行文本输入测试',
      required: true,
      config: {
        default: '这是默认的\n多行文本',
        multiline: true,
        placeholder: '请输入多行文本'
      }
    },
    int_input: {
      dataFlowType: 'INTEGER',
      displayName: '整数',
      description: '整数输入测试',
      required: true,
      config: {
        default: 10,
        min: 0,
        max: 100,
        step: 1
      },
    },
    float_input: {
      dataFlowType: 'FLOAT',
      displayName: '浮点数',
      description: '浮点数输入测试',
      required: true,
      config: {
        default: 0.5,
        min: 0.0,
        max: 1.0,
        step: 0.01
      },
    },
    boolean_toggle: {
      dataFlowType: 'BOOLEAN',
      displayName: '布尔值',
      description: '布尔值开关测试',
      required: true,
      config: {
        default: true
      },
    },
    combo_select: {
      dataFlowType: 'STRING', // COMBO suggestions are strings
      displayName: '下拉选择',
      description: '下拉选择测试',
      required: true,
      matchCategories: ['ComboOption'],
      config: {
        default: '选项A',
        suggestions: ['选项A', '选项B', '选项C']
      },
    },
    json_input: {
      dataFlowType: 'STRING',
      displayName: 'JSON',
      description: 'JSON输入测试 (代码编辑器)',
      required: false,
      matchCategories: ['Code', 'Json'],
      config: {
        default: JSON.stringify({ "key": "value" }, null, 2),
        language: 'json',
        placeholder: '请输入JSON格式数据'
      },
    },
    // --- 新增带建议的输入 ---
    string_with_suggestions: {
      dataFlowType: 'STRING',
      displayName: '带建议的文本',
      description: '测试带建议列表的文本输入',
      required: false,
      config: {
        default: '默认值',
        placeholder: '输入或选择建议',
        suggestions: ['预设A', '预设B', '另一个预设']
      }
    },
    int_with_suggestions: {
      dataFlowType: 'INTEGER',
      displayName: '带建议的整数',
      description: '测试带建议列表的整数输入',
      required: false,
      config: {
        default: 512,
        min: 64,
        max: 4096,
        step: 64,
        suggestions: [256, 512, 1024, 2048]
      }
    },
    float_with_suggestions: {
      dataFlowType: 'FLOAT',
      displayName: '带建议的浮点数',
      description: '测试带建议列表的浮点数输入',
      required: false,
      config: {
        default: 7.5,
        min: 0.0,
        max: 15.0,
        step: 0.5,
        suggestions: [1.0, 5.0, 7.5, 10.0, 12.5]
      }
    },
    // --- 新增按钮 ---
    button_trigger: {
      dataFlowType: 'WILDCARD',
      displayName: '触发按钮',
      description: '测试按钮组件',
      required: false,
      matchCategories: ['Trigger'],
      config: {
        label: '点我执行操作'
      }
    },

  },

  outputs: {
    string_output: {
      dataFlowType: 'STRING',
      displayName: '单行文本',
      description: '单行文本输出'
    },
    text_output: {
      dataFlowType: 'STRING',
      displayName: '多行文本',
      description: '多行文本输出'
    },
    int_output: {
      dataFlowType: 'INTEGER',
      displayName: '整数',
      description: '整数输出'
    },
    float_output: {
      dataFlowType: 'FLOAT',
      displayName: '浮点数',
      description: '浮点数输出'
    },
    boolean_output: {
      dataFlowType: 'BOOLEAN',
      displayName: '布尔值',
      description: '布尔值输出'
    },
    combo_output: {
      dataFlowType: 'STRING', // Output of a combo is its value
      displayName: '选择项',
      description: '选择项输出'
    },
    json_output: {
      dataFlowType: 'STRING',
      displayName: 'JSON',
      description: 'JSON输出',
      matchCategories: ['Json']
    },

    // --- 新增对应输出 ---
    string_with_suggestions_output: {
      dataFlowType: 'STRING',
      displayName: '带建议文本输出',
      description: '带建议文本的输出值'
    },
    int_with_suggestions_output: {
      dataFlowType: 'INTEGER',
      displayName: '带建议整数输出',
      description: '带建议整数的输出值'
    },
    float_with_suggestions_output: {
      dataFlowType: 'FLOAT',
      displayName: '带建议浮点数输出',
      description: '带建议浮点数的输出值'
    } // 这里是 outputs 对象的结束，不需要逗号
  },

  execute: TestWidgetsNodeImpl.execute
}

// Removed: Node registration is now handled by NodeLoader