import { useAdapterStore } from '@/stores/adapterStore';
import { useWorkflowInvocation } from './WorkflowInvocationService';
import type { InvocationRequest, InvocationResponse } from '@comfytavern/types';
import { useTabStore } from '@/stores/tabStore';
import { useWorkflowStore } from '@/stores/workflowStore';

/**
 * 结构化错误，用于适配器相关的操作失败时抛出。
 */
export class AdapterError extends Error {
  constructor(
    public code:
      | 'ADAPTER_NOT_FOUND'
      | 'INVALID_SOURCE_PATH'
      | 'TRANSFORMER_EXECUTION_FAILED'
      | 'VALIDATION_FAILED'
      | 'WORKFLOW_INVOCATION_FAILED',
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}


/**
 * API 适配器管理器 - Composable 版本
 *
 * 这是一个纯粹的前端数据准备与转换层。
 * 它的核心职责是：接收来自应用层（如应用面板）的请求，
 * 如果需要，则使用预定义的 API 适配器 (ApiAdapter) 规则进行数据格式转换，
 * 最终将转换后的原生输入值传递给 WorkflowInvocationService 来执行。
 */
export function useApiAdapterManager() {
  const adapterStore = useAdapterStore();
  const tabStore = useTabStore();
  const workflowStore = useWorkflowStore();
  const { invoke: invokeWorkflow } = useWorkflowInvocation();

  /**
   * 根据映射规则转换输入数据
   */
  const transform = (
    inputs: Record<string, any>,
    mappingRules: Record<string, any>
  ): Record<string, any> => {
    const transformed: Record<string, any> = {};
    console.log('执行转换, 输入:', inputs, '规则:', mappingRules);

    for (const targetKey in mappingRules) {
      const rule = mappingRules[targetKey];
      if (inputs[rule.sourcePath]) {
        transformed[targetKey] = inputs[rule.sourcePath];
      } else {
        transformed[targetKey] = rule.defaultValue;
      }
    }

    console.log('转换结果:', transformed);
    return transformed;
  };

  /**
   * 核心调用方法，处理原生和适配器模式的调用。
   */
  const invoke = async (request: InvocationRequest): Promise<InvocationResponse> => {
    if (request.mode === 'native') {
      const targetWorkflowId = request.workflowId!;
      const openedTab = tabStore.tabs.find(
        (tab) => tab.type === 'workflow' && tab.associatedId === targetWorkflowId
      );

      // 关键修正: 只有当标签页存在且其工作流已加载时，才使用 'live' 模式
      const isLiveMode = openedTab && workflowStore.isTabLoaded(openedTab.internalId);

      try {
        let result;
        if (isLiveMode) {
          console.log(`[ApiAdapterManager] Invoking in 'live' mode for tab: ${openedTab.internalId}`);
          result = await invokeWorkflow({
            mode: 'live',
            targetId: openedTab.internalId,
            inputs: request.inputs,
            source: 'panel',
          });
        } else {
          console.log(`[ApiAdapterManager] Invoking in 'saved' mode for workflow: ${targetWorkflowId}`);
          result = await invokeWorkflow({
            mode: 'saved',
            targetId: targetWorkflowId,
            inputs: request.inputs,
            source: 'panel',
          });
        }

        if (!result) {
          throw new Error('工作流服务未能返回执行ID。');
        }
        return { executionId: result.executionId };
      } catch (error) {
        throw new AdapterError(
          'WORKFLOW_INVOCATION_FAILED',
          `原生工作流调用失败: ${(error as Error).message}`,
          { originalError: error }
        );
      }
    } else if (request.mode === 'adapter') {
      const adapter = adapterStore.getAdapter(request.adapterId!);
      if (!adapter) {
        throw new AdapterError(
          'ADAPTER_NOT_FOUND',
          `未找到ID为 "${request.adapterId!}" 的适配器`
        );
      }

      const transformedInputs = transform(request.inputs, adapter.requestMapping);
      const targetWorkflowId = adapter.targetWorkflowId;
      const openedTab = tabStore.tabs.find(
        (tab) => tab.type === 'workflow' && tab.associatedId === targetWorkflowId
      );
      const isLiveMode = openedTab && workflowStore.isTabLoaded(openedTab.internalId);
      
      try {
        let result;
        if (isLiveMode) {
          result = await invokeWorkflow({
            mode: 'live',
            targetId: openedTab.internalId,
            inputs: transformedInputs,
            source: 'panel',
          });
        } else {
          result = await invokeWorkflow({
            mode: 'saved',
            targetId: targetWorkflowId,
            inputs: transformedInputs,
            source: 'panel',
          });
        }

        if (!result) {
          throw new Error('工作流服务未能返回执行ID。');
        }
        return { executionId: result.executionId };
      } catch (error) {
        throw new AdapterError(
          'WORKFLOW_INVOCATION_FAILED',
          `适配器工作流调用失败: ${(error as Error).message}`,
          { originalError: error }
        );
      }
    } else {
      throw new Error(`未知的调用模式: ${request.mode!}`);
    }
  };

  /**
   * 离线测试适配器的转换逻辑。
   */
  const testAdapterTransform = async (
    adapterId: string,
    sampleData: any
  ): Promise<{
    success: boolean;
    result?: Record<string, any>;
    error?: AdapterError;
  }> => {
    const adapter = adapterStore.getAdapter(adapterId);
    if (!adapter) {
      const error = new AdapterError('ADAPTER_NOT_FOUND', `未找到ID为 "${adapterId}" 的适配器`);
      return { success: false, error };
    }

    try {
      const result = transform(sampleData, adapter.requestMapping);
      return { success: true, result };
    } catch (e: any) {
      const error = new AdapterError(
        'TRANSFORMER_EXECUTION_FAILED',
        `转换器执行失败: ${e.message}`,
        { originalError: e }
      );
      return { success: false, error };
    }
  };

  return { invoke, testAdapterTransform };
}