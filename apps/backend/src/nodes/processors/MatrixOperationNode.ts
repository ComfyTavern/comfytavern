import type { NodeDefinition, NodeModeDefinition } from '@comfytavern/types';
import { DataFlowType } from '@comfytavern/types';
import { create, all, isMatrix, type MathJsStatic, type Matrix } from 'mathjs';

const math = create(all) as MathJsStatic;

/**
 * 矩阵运算节点
 */
export class MatrixOperationNodeImpl {
  // 主执行函数
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const currentModeId = context?.nodeData?.currentModeId || 'add';

    const executionMap: Record<string, (inputs: Record<string, any>) => Promise<Record<string, any>>> = {
      'add': MatrixOperationNodeImpl.executeAdd,
      'subtract': MatrixOperationNodeImpl.executeSubtract,
      'multiply': MatrixOperationNodeImpl.executeMultiply,
      'transpose': MatrixOperationNodeImpl.executeTranspose,
      'invert': MatrixOperationNodeImpl.executeInvert,
      'det': MatrixOperationNodeImpl.executeDeterminant,
    };

    const executor = executionMap[currentModeId] || MatrixOperationNodeImpl.executeAdd;
    return executor(inputs);
  }

  private static parseMatrix(input: any): Matrix | number | null {
    if (input === null || input === undefined) return null;
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return (isMatrix(parsed) || Array.isArray(parsed)) ? math.matrix(parsed) : parsed;
      } catch (e) {
        const num = Number(input);
        if (!isNaN(num)) return num;
        throw new Error('无效的JSON矩阵格式或数字字符串');
      }
    }
    if (typeof input === 'number') {
      return input;
    }
    return math.matrix(input);
  }

  private static formatResult(result: any): any {
    if (isMatrix(result)) {
      return result.toJSON().data;
    }
    return result; // 结果可能是标量
  }

  // --- 矩阵运算 ---
  static async executeAdd(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = MatrixOperationNodeImpl.parseMatrix(inputs.a);
    const b = MatrixOperationNodeImpl.parseMatrix(inputs.b);
    if (a === null || b === null) throw new Error('输入矩阵A和B是必需的');
    const result = math.add(a, b);
    return { result: MatrixOperationNodeImpl.formatResult(result) };
  }

  static async executeSubtract(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = MatrixOperationNodeImpl.parseMatrix(inputs.a);
    const b = MatrixOperationNodeImpl.parseMatrix(inputs.b);
    if (a === null || b === null) throw new Error('输入矩阵A和B是必需的');
    const result = math.subtract(a, b);
    return { result: MatrixOperationNodeImpl.formatResult(result) };
  }

  static async executeMultiply(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = MatrixOperationNodeImpl.parseMatrix(inputs.a);
    const b = MatrixOperationNodeImpl.parseMatrix(inputs.b);
    if (a === null || b === null) throw new Error('输入矩阵A和B是必需的');
    const result = math.multiply(a, b);
    return { result: MatrixOperationNodeImpl.formatResult(result) };
  }

  static async executeTranspose(inputs: Record<string, any>): Promise<Record<string, any>> {
    const matrix = MatrixOperationNodeImpl.parseMatrix(inputs.matrix);
    if (matrix === null || typeof matrix === 'number') throw new Error('输入必须是矩阵');
    const result = math.transpose(matrix);
    return { result: MatrixOperationNodeImpl.formatResult(result) };
  }

  static async executeInvert(inputs: Record<string, any>): Promise<Record<string, any>> {
    const matrix = MatrixOperationNodeImpl.parseMatrix(inputs.matrix);
    if (matrix === null || typeof matrix === 'number') throw new Error('输入必须是矩阵');
    const result = math.inv(matrix);
    return { result: MatrixOperationNodeImpl.formatResult(result) };
  }

  static async executeDeterminant(inputs: Record<string, any>): Promise<Record<string, any>> {
    const matrix = MatrixOperationNodeImpl.parseMatrix(inputs.matrix);
    if (matrix === null || typeof matrix === 'number') throw new Error('输入必须是矩阵');
    const result = math.det(matrix);
    return { result }; // 行列式是单个值
  }
}

// --- 定义 ---

const matrixType = { dataFlowType: DataFlowType.OBJECT, matchCategories: ['Matrix'], displayName: '矩阵' };

const commonOutputs = { result: { ...matrixType, displayName: '结果' } };
const singleInput = { matrix: { ...matrixType, required: true } };
const dualInput = {
  a: { ...matrixType, displayName: '矩阵 A', required: true, config: { default: '[[1, 0], [0, 1]]' } },
  b: { ...matrixType, displayName: '矩阵 B', required: true, config: { default: '[[1, 0], [0, 1]]' } }
};

const nodeModes: Record<string, NodeModeDefinition> = {
  add: { id: 'add', displayName: '相加', description: '将两个矩阵或标量相加', inputs: dualInput, outputs: { result: { displayName: '结果', dataFlowType: DataFlowType.WILDCARD, description: '输出可以是矩阵或标量' } } },
  subtract: { id: 'subtract', displayName: '相减', description: '将两个矩阵或标量相减', inputs: dualInput, outputs: { result: { displayName: '结果', dataFlowType: DataFlowType.WILDCARD, description: '输出可以是矩阵或标量' } } },
  multiply: { id: 'multiply', displayName: '相乘', description: '将两个矩阵、向量或标量相乘', inputs: dualInput, outputs: { result: { displayName: '结果', dataFlowType: DataFlowType.WILDCARD, description: '输出可以是矩阵或标量（例如向量点积）' } } },
  transpose: { id: 'transpose', displayName: '转置', description: '计算矩阵的转置', inputs: singleInput, outputs: commonOutputs },
  invert: { id: 'invert', displayName: '求逆', description: '计算方阵的逆', inputs: singleInput, outputs: commonOutputs },
  det: { id: 'det', displayName: '行列式', description: '计算方阵的行列式', inputs: singleInput, outputs: { result: { dataFlowType: DataFlowType.FLOAT, displayName: '行列式' } } },
};

export const definition: NodeDefinition = {
  type: 'MatrixOperation',
  category: '数学',
  displayName: '矩阵运算',
  description: '执行各种矩阵运算',
  inputs: nodeModes.add.inputs,
  outputs: nodeModes.add.outputs,
  execute: MatrixOperationNodeImpl.execute,

  configSchema: {
    operationMode: {
      dataFlowType: DataFlowType.STRING,
      displayName: '运算模式',
      required: true,
      matchCategories: ["ComboOption"],
      config: {
        searchable: true,
        suggestions: [
          { value: 'add', label: '矩阵/相加' },
          { value: 'subtract', label: '矩阵/相减' },
          { value: 'multiply', label: '矩阵/相乘' },
          { value: 'transpose', label: '矩阵/转置' },
          { value: 'invert', label: '矩阵/求逆' },
          { value: 'det', label: '矩阵/行列式' },
        ],
        default: 'add'
      }
    }
  },

  configValues: { operationMode: 'add' },
  modes: nodeModes,
  defaultModeId: 'add',
  modeConfigKey: 'operationMode'
};