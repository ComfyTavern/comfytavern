import {
  type NodeDefinition,
  type InputDefinition,
  type OutputDefinition, // 添加 OutputDefinition 导入
  type ChunkPayload, // ChunkPayload.type 将是字符串字面量联合类型
  DataFlowType,
  // ChunkType, // 移除此导入
} from '@comfytavern/types';
// TypeScript 内置 AsyncGenerator, 无需额外导入

// 上下文接口，应与 NodeManager 传递的实际上下文结构匹配或兼容
interface StreamLoggerNodeContext {
  nodeInstance?: { 
    id: string; // 运行时实例的唯一ID
    type: string; // 节点定义中的 type
    [key: string]: any; 
  };
  promptId?: string; // 当前执行的 prompt ID
  // 根据需要可以添加其他上下文属性，如全局配置、服务等
}

// 遵循 TestWidgetsNode.ts 的模式，将执行逻辑放在一个类中
class StreamLoggerNodeImpl {
  static async *execute(
    inputs: { inputStream?: AsyncGenerator<ChunkPayload, any, undefined> },
    context?: StreamLoggerNodeContext
  ): AsyncGenerator<ChunkPayload, void, undefined> { // 现在会 yield ChunkPayload
    
    // 从上下文中获取节点信息，如果上下文未提供，则从定义中回退
    const nodeType = context?.nodeInstance?.type || StreamLoggerNodeDefInternal.type;
    const instanceId = context?.nodeInstance?.id || 'unknown_instance'; // 运行时实例ID
    const promptId = context?.promptId || 'unknown_prompt';
    // 使用节点定义中的 displayName 构造日志前缀，更具可读性
    const loggerPrefix = `[${StreamLoggerNodeDefInternal.displayName}][Prompt:${promptId}][Node:${instanceId}(${nodeType})]`;

    console.log(`${loggerPrefix} Execution started.`);

    // 检查必需的输入流是否存在
    if (!inputs.inputStream) {
      const errorMsg = `${loggerPrefix} Input 'inputStream' is undefined or null. This is a required input.`;
      console.error(errorMsg);
      // 引擎通常会在调用 execute 前验证必需的输入，但这里也抛出错误以确保健壮性
      throw new Error(errorMsg);
    }

    // 验证 inputStream 是否确实是一个 AsyncGenerator
    if (typeof inputs.inputStream[Symbol.asyncIterator] !== 'function') {
      const errorMsg = `${loggerPrefix} Input 'inputStream' is not a valid AsyncGenerator.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      let chunkCount = 0;
      for await (const chunk of inputs.inputStream) {
        chunkCount++;
        let contentSummary = chunk.content;
        
        // 根据 chunk.type（现在是字符串字面量）和 content 类型进行摘要处理
        if (chunk.type === "text_chunk" && typeof chunk.content === 'string') {
          if (chunk.content.length > 100) {
            contentSummary = `"${chunk.content.substring(0, 97)}..." (truncated)`;
          } else {
            contentSummary = `"${chunk.content}"`;
          }
        } else if (typeof chunk.content === 'object' && chunk.content !== null) {
          contentSummary = `{type: ${typeof chunk.content}, keys: [${Object.keys(chunk.content).join(', ')}]}`;
        } else if (chunk.content === null) {
          contentSummary = '(null)';
        } else if (chunk.content === undefined) {
          contentSummary = '(undefined)';
        } else if (typeof chunk.content !== 'string') { // 处理其他非字符串、非对象类型
          contentSummary = `(content type: ${typeof chunk.content}, value: ${String(chunk.content).substring(0,50)})`;
        }
        // 记录接收到的数据块信息
        console.log(`${loggerPrefix} Chunk ${chunkCount}: type='${chunk.type}', content=${contentSummary}`);
        yield chunk; // 将数据块传递到输出流
      }
      console.log(`${loggerPrefix} Stream ended successfully after processing ${chunkCount} chunks.`);
    } catch (error: any) {
      console.error(`${loggerPrefix} Error while processing stream: ${error.message}`, error.stack);
      // 重新抛出错误，以便执行引擎可以捕获并处理
      throw error;
    }
    
    // 流式节点在执行完毕后应返回 void
    return;
  }
}

// 节点定义对象，遵循 NodeDefinition 接口
// 使用 "Internal" 后缀以避免与导出的 "definition" 变量名在模块作用域内冲突
const StreamLoggerNodeDefInternal: NodeDefinition = {
  type: 'StreamLogger', // 节点类型，应唯一
  category: '实用工具', // Functional category
  displayName: '🧻Stream Logger', // 在UI中显示的名称
  description: 'Logs incoming stream chunks to the console for debugging purposes.', // 节点的描述
  // icon: 'HiOutlineTerminal', // 移除 icon 字段，因为它不在 NodeDefinition 类型中
  inputs: { // 定义节点的输入槽
    inputStream: {
      displayName: '流输入',
      dataFlowType: 'STREAM', // 输入类型为流
      required: true, // 此输入是必需的
      description: '输入流，将被记录到控制台',
    } as InputDefinition, // 类型断言，确保符合 InputDefinition
  },
  outputs: { // 定义节点的输出槽
    outputStream: {
      displayName: '流输出',
      dataFlowType: DataFlowType.STREAM, // 输出类型为流
      description: '记录后传出的原始流数据',
    } as OutputDefinition, // 类型断言，确保符合 OutputDefinition
  },
  // isStreamNode: true, // 移除此行，引擎应通过 execute 返回类型判断
  execute: StreamLoggerNodeImpl.execute, // 将实现类的 execute 方法关联到定义
  // configSchema: {}, // 如果节点有配置项，在此定义其 schema
  // configValues: {}, // 节点的默认配置值
};

// 导出节点定义，这是 NodeManager 加载节点的约定
export const definition = StreamLoggerNodeDefInternal;