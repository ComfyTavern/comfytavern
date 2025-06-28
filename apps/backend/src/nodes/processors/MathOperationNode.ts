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
    const clamp = !!inputs.clamp; // 从输入槽读取钳制状态

    // 使用映射实现更清晰的分发逻辑
    const executionMap: Record<string, (inputs: Record<string, any>) => Promise<Record<string, any>>> = {
      'add': MathOperationNodeImpl.executeAdd,
      'subtract': MathOperationNodeImpl.executeSubtract,
      'multiply': MathOperationNodeImpl.executeMultiply,
      'divide': MathOperationNodeImpl.executeDivide,
      'power': MathOperationNodeImpl.executePower,
      'sqrt': MathOperationNodeImpl.executeSqrt,
      'inverse_sqrt': MathOperationNodeImpl.executeInverseSqrt,
      'logarithm': MathOperationNodeImpl.executeLogarithm,
      'absolute': MathOperationNodeImpl.executeAbsolute,
      'exp': MathOperationNodeImpl.executeExp,
      'min': MathOperationNodeImpl.executeMin,
      'max': MathOperationNodeImpl.executeMax,
      'lessThan': MathOperationNodeImpl.executeLessThan,
      'greaterThan': MathOperationNodeImpl.executeGreaterThan,
      'sign': MathOperationNodeImpl.executeSign,
      'round': MathOperationNodeImpl.executeRound,
      'floor': MathOperationNodeImpl.executeFloor,
      'ceil': MathOperationNodeImpl.executeCeil,
      'truncate': MathOperationNodeImpl.executeTruncate,
      'fraction': MathOperationNodeImpl.executeFraction,
      'modulo': MathOperationNodeImpl.executeModulo,
      'sin': MathOperationNodeImpl.executeSine,
      'cos': MathOperationNodeImpl.executeCosine,
      'tan': MathOperationNodeImpl.executeTangent,
      'asin': MathOperationNodeImpl.executeAsin,
      'acos': MathOperationNodeImpl.executeAcos,
      'atan': MathOperationNodeImpl.executeAtan,
      'atan2': MathOperationNodeImpl.executeAtan2,
      'sinh': MathOperationNodeImpl.executeSinh,
      'cosh': MathOperationNodeImpl.executeCosh,
      'tanh': MathOperationNodeImpl.executeTanh,
      'to_radians': MathOperationNodeImpl.executeToRadians,
      'to_degrees': MathOperationNodeImpl.executeToDegrees,
      'multiply_add': MathOperationNodeImpl.executeMultiplyAdd,
    };

    const executor = executionMap[currentModeId] || MathOperationNodeImpl.executeAdd;
    const result = await executor(inputs);

    if (clamp && result && typeof result.result === 'number') {
      result.result = Math.max(0, Math.min(1, result.result));
    }

    return result;
  }

  // --- 基础运算 ---
  static async executeAdd(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: a + b };
  }

  static async executeSubtract(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: a - b };
  }

  static async executeMultiply(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: a * b };
  }
  
  static async executeMultiplyAdd(inputs: Record<string, any>): Promise<Record<string, any>> {
    const val1 = Number(inputs.val1 || 0);
    const val2 = Number(inputs.val2 || 0);
    const val3 = Number(inputs.val3 || 0);
    return { result: val1 * val2 + val3 };
  }

  static async executeDivide(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    if (b === 0) { throw new Error('除数不能为零'); }
    return { result: a / b };
  }

  // --- 函数 ---
  static async executePower(inputs: Record<string, any>): Promise<Record<string, any>> {
    const base = Number(inputs.base || 0);
    const exponent = Number(inputs.exponent || 2);
    return { result: Math.pow(base, exponent) };
  }

  static async executeSqrt(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    if (value < 0) { throw new Error('不能对负数进行平方根运算'); }
    return { result: Math.sqrt(value) };
  }
  
  static async executeInverseSqrt(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    if (value <= 0) { throw new Error('输入值必须为正数'); }
    return { result: 1 / Math.sqrt(value) };
  }

  static async executeLogarithm(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 1);
    const base = Number(inputs.base || Math.E);
    if (value <= 0 || base <= 0 || base === 1) { return { result: NaN }; }
    return { result: Math.log(value) / Math.log(base) };
  }

  static async executeAbsolute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.abs(value) };
  }
  
  static async executeExp(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.exp(value) };
  }

  // --- 比较 ---
  static async executeMin(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: Math.min(a, b) };
  }

  static async executeMax(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: Math.max(a, b) };
  }

  static async executeLessThan(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: a < b ? 1 : 0 };
  }

  static async executeGreaterThan(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    return { result: a > b ? 1 : 0 };
  }

  static async executeSign(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.sign(value) };
  }

  // --- 舍入 ---
  static async executeRound(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.round(value) };
  }

  static async executeFloor(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.floor(value) };
  }

  static async executeCeil(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.ceil(value) };
  }

  static async executeTruncate(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.trunc(value) };
  }

  static async executeFraction(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    const result = value - Math.trunc(value);
    return { result: value < 0 ? 1 + result : result };
  }

  static async executeModulo(inputs: Record<string, any>): Promise<Record<string, any>> {
    const a = Number(inputs.a || 0);
    const b = Number(inputs.b || 0);
    if (b === 0) { throw new Error('模数不能为零'); }
    return { result: a % b };
  }

  // --- 三角函数 ---
  static async executeSine(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.sin(value) };
  }

  static async executeCosine(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.cos(value) };
  }

  static async executeTangent(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.tan(value) };
  }
  
  static async executeAsin(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.asin(value) };
  }

  static async executeAcos(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.acos(value) };
  }

  static async executeAtan(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.atan(value) };
  }
  
  static async executeAtan2(inputs: Record<string, any>): Promise<Record<string, any>> {
    const y = Number(inputs.y || 0);
    const x = Number(inputs.x || 0);
    return { result: Math.atan2(y, x) };
  }
  
  static async executeSinh(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.sinh(value) };
  }

  static async executeCosh(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.cosh(value) };
  }

  static async executeTanh(inputs: Record<string, any>): Promise<Record<string, any>> {
    const value = Number(inputs.value || 0);
    return { result: Math.tanh(value) };
  }

  // --- 转换 ---
  static async executeToRadians(inputs: Record<string, any>): Promise<Record<string, any>> {
    const degrees = Number(inputs.degrees || 0);
    return { result: degrees * (Math.PI / 180) };
  }

  static async executeToDegrees(inputs: Record<string, any>): Promise<Record<string, any>> {
    const radians = Number(inputs.radians || 0);
    return { result: radians * (180 / Math.PI) };
  }
}

// --- 定义 ---

const commonOutputs = { result: { dataFlowType: DataFlowType.FLOAT, displayName: '结果' } };
const singleInput = { value: { dataFlowType: DataFlowType.FLOAT, displayName: '数值', required: true } };
const dualInput = {
  a: { dataFlowType: DataFlowType.FLOAT, displayName: '数值 A', required: true },
  b: { dataFlowType: DataFlowType.FLOAT, displayName: '数值 B', required: true }
};
const multiplyAddInput = {
  val1: { dataFlowType: DataFlowType.FLOAT, displayName: '数值 A', required: true },
  val2: { dataFlowType: DataFlowType.FLOAT, displayName: '数值 B', required: true },
  val3: { dataFlowType: DataFlowType.FLOAT, displayName: '数值 C', required: true }
};
const clampInput = {
  clamp: {
    dataFlowType: DataFlowType.BOOLEAN,
    displayName: '钳制 (0-1)',
    description: '将结果限制在0-1范围。可以连接布尔值。',
    required: false,
    config: { default: false }
  }
};


const nodeModes: Record<string, NodeModeDefinition> = {
  // 函数
  add: { id: 'add', displayName: '相加', description: '将两个数相加', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },
  subtract: { id: 'subtract', displayName: '相减', description: '从第一个数中减去第二个数', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },
  multiply: { id: 'multiply', displayName: '相乘', description: '将两个数相乘', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },
  multiply_add: {
    id: 'multiply_add',
    displayName: '乘后再加',
    description: '计算 (A * B) + C',
    inputs: {...multiplyAddInput, ...clampInput},
    outputs: commonOutputs
  },
  divide: { id: 'divide', displayName: '相除', description: '用第一个数除以第二个数', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },
  power: { id: 'power', displayName: '幂', description: '计算底数的指数次幂', inputs: { base: { ...singleInput.value, displayName: '底数' }, exponent: { ...singleInput.value, displayName: '指数', config: { default: 2 } }, ...clampInput }, outputs: commonOutputs },
  logarithm: { id: 'logarithm', displayName: '对数', description: '计算一个数的对数', inputs: { value: { ...singleInput.value, config: { default: 1 } }, base: { ...singleInput.value, displayName: '底数', config: { default: Math.E } }, ...clampInput }, outputs: commonOutputs },
  sqrt: { id: 'sqrt', displayName: '平方根', description: '计算数值的平方根', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  inverse_sqrt: { id: 'inverse_sqrt', displayName: '平方根取倒', description: '计算平方根的倒数', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  absolute: { id: 'absolute', displayName: '绝对值', description: '计算一个数的绝对值', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  exp: { id: 'exp', displayName: '指数', description: '计算 e 的指数次幂', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  
  // 比较
  min: { id: 'min', displayName: '最小值', description: '比较两个数并返回较小的值', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },
  max: { id: 'max', displayName: '最大值', description: '比较两个数并返回较大的值', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },
  lessThan: { id: 'lessThan', displayName: '小于', description: '如果 A 小于 B，则返回1，否则返回0', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },
  greaterThan: { id: 'greaterThan', displayName: '大于', description: '如果 A 大于 B，则返回1，否则返回0', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },
  sign: { id: 'sign', displayName: '符号', description: '提取数值的符号', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  
  // 舍入
  round: { id: 'round', displayName: '四舍五入', description: '将数值四舍五入到最接近的整数', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  floor: { id: 'floor', displayName: '向下取整', description: '返回小于或等于指定数值的最大整数', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  ceil: { id: 'ceil', displayName: '向上取整', description: '返回大于或等于指定数值的最小整数', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  truncate: { id: 'truncate', displayName: '截断', description: '移除数值的小数部分', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  fraction: { id: 'fraction', displayName: '分数', description: '仅保留数值的小数部分', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  modulo: { id: 'modulo', displayName: '模数', description: '返回两个数相除的余数', inputs: {...dualInput, ...clampInput}, outputs: commonOutputs },

  // 三角函数
  sin: { id: 'sin', displayName: '正弦', description: '计算一个数的正弦值（输入为弧度）', inputs: { value: { ...singleInput.value, displayName: '数值 (弧度)' }, ...clampInput }, outputs: commonOutputs },
  cos: { id: 'cos', displayName: '余弦', description: '计算一个数的余弦值（输入为弧度）', inputs: { value: { ...singleInput.value, displayName: '数值 (弧度)' }, ...clampInput }, outputs: commonOutputs },
  tan: { id: 'tan', displayName: '正切', description: '计算一个数的正切值（输入为弧度）', inputs: { value: { ...singleInput.value, displayName: '数值 (弧度)' }, ...clampInput }, outputs: commonOutputs },
  asin: { id: 'asin', displayName: '反正弦', description: '计算一个数的反正弦值（结果为弧度）', inputs: { value: { ...singleInput.value, displayName: '数值 (-1 to 1)' }, ...clampInput }, outputs: commonOutputs },
  acos: { id: 'acos', displayName: '反余弦', description: '计算一个数的反余弦值（结果为弧度）', inputs: { value: { ...singleInput.value, displayName: '数值 (-1 to 1)' }, ...clampInput }, outputs: commonOutputs },
  atan: { id: 'atan', displayName: '反正切', description: '计算一个数的反正切值（结果为弧度）', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  atan2: { id: 'atan2', displayName: '反正切2', description: '返回点(x, y)到x轴正半轴的逆时针旋转角度（弧度）', inputs: { y: { ...singleInput.value, displayName: 'Y' }, x: { ...singleInput.value, displayName: 'X' }, ...clampInput }, outputs: commonOutputs },
  sinh: { id: 'sinh', displayName: '双曲正弦', description: '计算一个数的双曲正弦值', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  cosh: { id: 'cosh', displayName: '双曲余弦', description: '计算一个数的双曲余弦值', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  tanh: { id: 'tanh', displayName: '双曲正切', description: '计算一个数的双曲正切值', inputs: {...singleInput, ...clampInput}, outputs: commonOutputs },
  
  // 转换
  to_radians: { id: 'to_radians', displayName: '到弧度', description: '将角度转换为弧度', inputs: { degrees: { ...singleInput.value, displayName: '角度' }, ...clampInput }, outputs: commonOutputs },
  to_degrees: { id: 'to_degrees', displayName: '到角度', description: '将弧度转换为角度', inputs: { radians: { ...singleInput.value, displayName: '弧度' }, ...clampInput }, outputs: commonOutputs },
};

export const definition: NodeDefinition = {
  type: 'MathOperation',
  category: '数学',
  displayName: '数学运算',
  description: '执行各种数学运算',
  inputs: nodeModes.add.inputs,
  outputs: nodeModes.add.outputs,
  execute: MathOperationNodeImpl.execute,
  
  configSchema: {
    operationMode: {
      dataFlowType: DataFlowType.STRING,
      displayName: '运算模式',
      required: true,
      matchCategories: ["ComboOption"],
      config: {
        searchable: true,
        suggestions: [
          { value: 'add', label: '函数/相加' },
          { value: 'subtract', label: '函数/相减' },
          { value: 'multiply', label: '函数/相乘' },
          { value: 'multiply_add', label: '函数/乘后再加' },
          { value: 'divide', label: '函数/相除' },
          { value: 'power', label: '函数/幂' },
          { value: 'logarithm', label: '函数/对数' },
          { value: 'sqrt', label: '函数/平方根' },
          { value: 'inverse_sqrt', label: '函数/平方根取倒' },
          { value: 'absolute', label: '函数/绝对值' },
          { value: 'exp', label: '函数/指数' },
          { value: 'min', label: '比较/最小值' },
          { value: 'max', label: '比较/最大值' },
          { value: 'lessThan', label: '比较/小于' },
          { value: 'greaterThan', label: '比较/大于' },
          { value: 'sign', label: '比较/符号' },
          { value: 'round', label: '舍入/四舍五入' },
          { value: 'floor', label: '舍入/向下取整' },
          { value: 'ceil', label: '舍入/向上取整' },
          { value: 'truncate', label: '舍入/截断' },
          { value: 'fraction', label: '舍入/分数' },
          { value: 'modulo', label: '舍入/模数' },
          { value: 'sin', label: '三角函数/正弦' },
          { value: 'cos', label: '三角函数/余弦' },
          { value: 'tan', label: '三角函数/正切' },
          { value: 'asin', label: '三角函数/反正弦' },
          { value: 'acos', label: '三角函数/反余弦' },
          { value: 'atan', label: '三角函数/反正切' },
          { value: 'atan2', label: '三角函数/反正切2' },
          { value: 'sinh', label: '三角函数/双曲正弦' },
          { value: 'cosh', label: '三角函数/双曲余弦' },
          { value: 'tanh', label: '三角函数/双曲正切' },
          { value: 'to_radians', label: '转换/到弧度' },
          { value: 'to_degrees', label: '转换/到角度' },
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