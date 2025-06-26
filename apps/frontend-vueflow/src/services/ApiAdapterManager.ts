import { useAdapterStore } from '@/stores/adapterStore';
import { workflowInvocationService } from './WorkflowInvocationService';
import type { InvocationRequest, InvocationResponse } from '@comfytavern/types';
import { useTabStore } from '@/stores/tabStore';

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
 * API 适配器管理器
 * 
 * 这是一个纯粹的前端数据准备与转换层。
 * 它的核心职责是：接收来自应用层（如应用面板）的请求，
 * 如果需要，则使用预定义的 API 适配器 (ApiAdapter) 规则进行数据格式转换，
 * 最终将转换后的原生输入值传递给 WorkflowInvocationService 来执行。
 */
export class ApiAdapterManager {
  private adapterStore = useAdapterStore();
  private tabStore = useTabStore();
  // 直接使用导入的单例
  private invocationService = workflowInvocationService;

  constructor() {
    // 可以在这里初始化，比如预加载适配器
    this.adapterStore.fetchAdapters();
  }

  /**
   * 核心调用方法，处理原生和适配器模式的调用。
   * @param request 调用请求
   * @returns 调用响应，包含 executionId
   */
  public async invoke(request: InvocationRequest): Promise<InvocationResponse> {
    if (request.mode === 'native') {
      // 原生模式，检查是否有实时预览
      // usePanelApiHost 已确保 workflowId 存在
      const targetWorkflowId = request.workflowId!;
      const openedTab = this.tabStore.tabs.find(
        (tab) => tab.type === 'workflow' && tab.associatedId === targetWorkflowId
      );

      try {
        let result;
        if (openedTab) {
          // 实时预览模式
          result = await this.invocationService.invoke({
            mode: 'live',
            targetId: openedTab.internalId,
            inputs: request.inputs,
            source: 'panel',
          });
        } else {
          // 普通保存模式
          result = await this.invocationService.invoke({
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
      // 适配器模式，执行转换逻辑
      // usePanelApiHost 已确保 adapterId 存在
      const adapter = this.adapterStore.getAdapter(request.adapterId!);
      if (!adapter) {
        throw new AdapterError(
          'ADAPTER_NOT_FOUND',
          `未找到ID为 "${request.adapterId!}" 的适配器`
        );
      }

      // TODO: 在这里执行请求映射和转换
      // 这是一个简化版本，仅做直接传递
      const transformedInputs = this.transform(request.inputs, adapter.requestMapping);
      const targetWorkflowId = adapter.targetWorkflowId;
      const openedTab = this.tabStore.tabs.find(
        (tab) => tab.type === 'workflow' && tab.associatedId === targetWorkflowId
      );
      
      try {
        let result;
        if (openedTab) {
          // 实时预览模式
          result = await this.invocationService.invoke({
            mode: 'live',
            targetId: openedTab.internalId,
            inputs: transformedInputs,
            source: 'panel',
          });
        } else {
          // 普通保存模式
          result = await this.invocationService.invoke({
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
      // request.mode 在 usePanelApiHost 中已确保存在
      throw new Error(`未知的调用模式: ${request.mode!}`);
    }
  }

  /**
   * 根据映射规则转换输入数据
   * @param inputs 原始输入
   * @param mappingRules 映射规则
   * @returns 转换后的输入
   */
  private transform(
    inputs: Record<string, any>,
    mappingRules: Record<string, any>
  ): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    // 简化的转换逻辑，实际应处理 sourcePath, transformer, defaultValue 等
    console.log('执行转换, 输入:', inputs, '规则:', mappingRules);

    for (const targetKey in mappingRules) {
      const rule = mappingRules[targetKey];
      // 注意：这里的实现非常简化，仅用于演示结构。
      // 真正的实现需要一个健壮的路径解析器（如 lodash.get）和转换器执行逻辑。
      if (inputs[rule.sourcePath]) {
        transformed[targetKey] = inputs[rule.sourcePath];
      } else {
        transformed[targetKey] = rule.defaultValue;
      }
    }

    console.log('转换结果:', transformed);
    return transformed;
  }
  
  /**
   * 离线测试适配器的转换逻辑。
   * @param adapterId 适配器ID
   * @param sampleData 示例输入数据
   * @returns 转换结果或错误
   */
  public async testAdapterTransform(
    adapterId: string,
    sampleData: any
  ): Promise<{
    success: boolean;
    result?: Record<string, any>;
    error?: AdapterError;
  }> {
    const adapter = this.adapterStore.getAdapter(adapterId);
    if (!adapter) {
      const error = new AdapterError('ADAPTER_NOT_FOUND', `未找到ID为 "${adapterId}" 的适配器`);
      return { success: false, error };
    }

    try {
      // TODO: 实现完整的转换逻辑，包括模板、函数等
      const result = this.transform(sampleData, adapter.requestMapping);
      
      // TODO: 添加与目标工作流接口的验证逻辑
      
      return { success: true, result };
    } catch (e: any) {
      const error = new AdapterError(
        'TRANSFORMER_EXECUTION_FAILED',
        `转换器执行失败: ${e.message}`,
        { originalError: e }
      );
      return { success: false, error };
    }
  }
}

// 使用单例模式导出
let instance: ApiAdapterManager | null = null;

export function useApiAdapterManager(): ApiAdapterManager {
  if (!instance) {
    instance = new ApiAdapterManager();
  }
  return instance;
}