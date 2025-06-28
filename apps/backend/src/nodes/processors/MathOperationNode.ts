import type { NodeDefinition, NodeModeDefinition } from '@comfytavern/types';
import { DataFlowType } from '@comfytavern/types';

/**
 * 数学运算节点 - 支持多种运算模式
 * 
 * 这个节点展示了如何使用多模式功能，根据用户选择的模式提供不同的输入/输出插槽和执行逻辑。
 */
export class MathOperationNodeImpl {
  // 主执行函数，根据当前模式分发到对应的执行函数
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const currentModeId = context?.nodeData?.currentModeId || 'add';
    
    switch (currentModeId) {
      case 'add':
        return MathOperationNodeImpl.executeAdd(inputs);
      case 'subtract':
        return MathOperationNodeImpl.executeSubtract(inputs);
      case 'multiply':
        return MathOperationNodeImpl.executeMultiply(inputs);
      case 'divide':
        return MathOperationNodeImpl.executeDivide(inputs);
      case 'power':
        return MathOperationNodeImpl.executePower(inputs);
      case 'sqrt':
        return MathOperationNodeImpl.executeSqrt(inputs);
      default:
        return MathOperationNodeImpl.executeAdd(inputs);
    }
  }

  // 加法模式执行函数
  static async executeAdd(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: a + b };
  }

  // 减法模式执行函数
  static async executeSubtract(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: a - b };
  }

  // 乘法模式执行函数
  static async executeMultiply(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: a * b };
  }

  // 除法模式执行函数
  static async executeDivide(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    
    if (b === 0) {
      throw new Error('除数不能为零');
    }
    
    return { result: a / b };
  }

  // 幂运算模式执行函数
  static async executePower(inputs: Record<string, any>): Promise<Record<string, any>> {
    const base = Number(inputs.base || 0);
    const exponent = Number(inputs.exponent || 2);
    return { result: Math.pow(base, exponent) };
  }

  // 平方根模式执行函数
  static async executeSqrt(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    
    if (value < 0) {
      throw new Error('不能对负数进行平方根运算');
    }
    
    return { result: Math.sqrt(value) };
  }
}

// 定义各种模式的共同输出
const commonOutputs = {
  result: {
    dataFlowType: DataFlowType.FLOAT,
    displayName: '结果',
    description: '运算结果'
  }
};

// 定义节点的各种操作模式
const nodeModes: Record<string, NodeModeDefinition> = {
  // 加法模式
  add: {
    id: 'add',
    displayName: '加法',
    description: '将两个数相加',
    inputs: {
      a: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '数值 A',
        description: '第一个操作数',
        required: true
      },
      b: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '数值 B',
        description: '第二个操作数',
        required: true
      }
    },
    outputs: commonOutputs
  },
  
  // 减法模式
  subtract: {
    id: 'subtract',
    displayName: '减法',
    description: '从第一个数中减去第二个数',
    inputs: {
      a: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '被减数',
        description: '要被减的数',
        required: true
      },
      b: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '减数',
        description: '要减去的数',
        required: true
      }
    },
    outputs: commonOutputs
  },
  
  // 乘法模式
  multiply: {
    id: 'multiply',
    displayName: '乘法',
    description: '将两个数相乘',
    inputs: {
      a: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '因数 A',
        description: '第一个因数',
        required: true
      },
      b: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '因数 B',
        description: '第二个因数',
        required: true
      }
    },
    outputs: commonOutputs
  },
  
  // 除法模式
  divide: {
    id: 'divide',
    displayName: '除法',
    description: '用第一个数除以第二个数',
    inputs: {
      a: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '被除数',
        description: '要被除的数',
        required: true
      },
      b: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '除数',
        description: '用于除的数（不能为零）',
        required: true
      }
    },
    outputs: commonOutputs
  },
  
  // 幂运算模式
  power: {
    id: 'power',
    displayName: '幂运算',
    description: '计算底数的指数次幂',
    inputs: {
      base: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '底数',
        description: '要进行幂运算的数',
        required: true
      },
      exponent: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '指数',
        description: '幂的次数',
        required: true,
        config: {
          default: 2
        }
      }
    },
    outputs: commonOutputs
  },
  
  // 平方根模式
  sqrt: {
    id: 'sqrt',
    displayName: '平方根',
    description: '计算数值的平方根',
    inputs: {
      value: {
        dataFlowType: DataFlowType.FLOAT,
        displayName: '数值',
        description: '要计算平方根的数（必须为非负数）',
        required: true
      }
    },
    outputs: commonOutputs
  }
};

// 节点定义
export const definition: NodeDefinition = {
  type: 'MathOperation',
  category: '数学',
  displayName: '数学运算',
  description: '执行各种数学运算（加、减、乘、除、幂、平方根等）',
  
  // 默认模式（加法）的输入/输出
  inputs: nodeModes.add.inputs,
  outputs: nodeModes.add.outputs,
  
  // 执行函数
  execute: MathOperationNodeImpl.execute,
  
  // 配置模式选择器
  configSchema: {
    operationMode: {
      dataFlowType: DataFlowType.STRING,
      displayName: '运算模式',
      description: '选择要执行的数学运算类型',
      required: true,
      config: {
        suggestions: [
          { value: 'add', label: '加法' },
          { value: 'subtract', label: '减法' },
          { value: 'multiply', label: '乘法' },
          { value: 'divide', label: '除法' },
          { value: 'power', label: '幂运算' },
          { value: 'sqrt', label: '平方根' }
        ],
        default: 'add'
      }
    }
  },
  
  // 默认配置值
  configValues: {
    operationMode: 'add'
  },
  
  // 多模式定义
  modes: nodeModes,
  
  // 默认模式
  defaultModeId: 'add'
};