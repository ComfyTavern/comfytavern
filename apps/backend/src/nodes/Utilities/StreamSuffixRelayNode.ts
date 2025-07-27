import type { NodeDefinition, ChunkPayload, NodeExecutionContext } from '@comfytavern/types';
import { Stream } from 'node:stream'; // 需要导入 Stream
import { parseEscapedCharacters } from '@comfytavern/utils';

export class StreamSuffixRelayNodeImpl {
  static async* execute(
    inputs: Record<string, any>,
    context: NodeExecutionContext // 添加 context 以便未来使用 promptId 或 nodeId
  ): AsyncGenerator<ChunkPayload, void, undefined> {
    const inputStream = inputs.inputStream as Stream.Readable; // 这是 ExecutionEngine 传过来的
    const suffix = parseEscapedCharacters(typeof inputs.suffix === 'string' ? inputs.suffix : '');
    const nodeId = context.nodeId || 'unknown_stream_suffix_node'; // 从 context 获取 nodeId

    if (!(inputStream instanceof Stream.Readable)) {
      console.error(`[StreamSuffixRelayNode-${nodeId}] Input 'inputStream' is not a Readable stream.`);
      // 可以考虑 yield 一个错误 chunk 或者直接抛错，这里简单结束
      yield { type: 'error_chunk', content: "Input 'inputStream' is not a Readable stream." };
      return;
    }

    console.log(`[StreamSuffixRelayNode-${nodeId}] Execution started. Suffix: "${suffix}"`);

    try {
      // Node.js Readable streams are async iterable by default
      for await (const chunk of inputStream) {
        const typedChunk = chunk as ChunkPayload; // 假设流中的数据已经是 ChunkPayload
        if (typedChunk.type === 'text_chunk') {
          const newContent = typedChunk.content + suffix;
          // console.log(`[StreamSuffixRelayNode-${nodeId}] Relaying text_chunk: "${typedChunk.content}" -> "${newContent}"`);
          yield { ...typedChunk, content: newContent };
        } else {
          // console.log(`[StreamSuffixRelayNode-${nodeId}] Relaying chunk of type: ${typedChunk.type}`);
          yield typedChunk; // 直接透传其他类型的 chunk
        }
      }
      console.log(`[StreamSuffixRelayNode-${nodeId}] Input stream finished.`);
    } catch (error: any) {
      console.error(`[StreamSuffixRelayNode-${nodeId}] Error processing stream:`, error);
      yield { type: 'error_chunk', content: `Error in StreamSuffixRelayNode: ${error.message}` };
    } finally {
      console.log(`[StreamSuffixRelayNode-${nodeId}] Execution finished.`);
      // AsyncGenerator 会在 return 时自动结束，这里不需要显式 yield 一个 finish_reason_chunk，
      // ExecutionEngine 会处理生成器的完成。
    }
  }
}

export const definition: NodeDefinition = {
  type: 'StreamSuffixRelay',
  category: '实用工具',
  displayName: '➡️流后缀接力',
  description: '接收一个文本流，为每个文本块添加指定后缀，然后接力输出流。',

  inputs: {
    inputStream: {
      dataFlowType: 'STRING',
      isStream: true,
      displayName: '输入流',
      description: '要处理的输入文本流',
      required: true,
    },
    suffix: {
      dataFlowType: 'STRING',
      displayName: '后缀',
      description: '要添加到每个文本块末尾的后缀字符串',
      required: false,
      config: {
        default: '---',
        multiline: false,
        placeholder: '输入后缀',
        label: '后缀'
      }
    }
  },

  outputs: {
    outputStream: {
      dataFlowType: 'STRING',
      isStream: true,
      displayName: '输出流',
      description: '添加后缀后的文本流'
    }
  },

  execute: StreamSuffixRelayNodeImpl.execute as any //  as any 是因为 execute 的签名与 NodeDefinitionExecuteFn 有细微差别 (AsyncGenerator vs Promise)
  // ExecutionEngine 会正确处理 AsyncGenerator 类型的 execute
};