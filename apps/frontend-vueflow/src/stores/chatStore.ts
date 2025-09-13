import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { 
  ChatHistoryTree, 
  ChatMessageNode, 
  ChatSession,
  ExportFormat 
} from '@comfytavern/types';
import { useProjectStore } from './projectStore';
import { useWorkflowInvocation } from '../services/WorkflowInvocationService';
import { useDialogService } from '../services/DialogService';
import { useApi } from '../utils/api';

export const useChatStore = defineStore('chat', () => {
  // 核心状态
  const chatHistoryTree = ref<ChatHistoryTree | null>(null);
  const currentMode = ref<'immersive' | 'edit'>('immersive');
  const activeSessionId = ref<string | null>(null);
  const sessionList = ref<ChatSession[]>([]);
  const chatWorkflowPath = ref<string>('');
  const isLoading = ref(false);
  const leftSidebarVisible = ref(true);
  const rightSidebarVisible = ref(true);
  const rightSidebarActiveTab = ref<string>('info');

  // 服务依赖
  const projectStore = useProjectStore();
  const dialogService = useDialogService();
  const { invoke } = useWorkflowInvocation();
  const { get, post, put, del } = useApi();

  // 计算属性
  const currentProjectId = computed(() => projectStore.currentProjectId);
  
  const chatWorkflowFullPath = computed(() => {
    if (!currentProjectId.value) return '';
    return `user://projects/${currentProjectId.value}/workflows/_apps/chat/main.json`;
  });

  const getChatNodes = computed(() => {
    if (!chatHistoryTree.value) return [];
    
    if (currentMode.value === 'immersive') {
      // 在沉浸模式下，返回当前主干路径上已启用的节点
      const activeLeaf = chatHistoryTree.value.activeLeafId;
      if (!activeLeaf) return [];
      return getLinearContext(activeLeaf);
    } else {
      // 在编辑模式下，返回所有节点（用于树状图显示）
      const rootIds = chatHistoryTree.value.rootNodeIds;
      if (!rootIds || rootIds.length === 0) return [];
      const firstRootId = rootIds[0];
      if (!firstRootId) return [];
      return getAllNodesAsArray(firstRootId);
    }
  });

  // Actions - 初始化
  async function initialize(projectId: string): Promise<void> {
    // 重置状态
    sessionList.value = [];
    activeSessionId.value = null;
    chatHistoryTree.value = null;
    // 项目ID由计算属性从projectStore获取，无需手动设置
    console.log('[ChatStore] Initialized for project:', projectId);
  }

  async function ensureChatWorkflow(_projectId: string): Promise<void> {
    // 使用已有的 ensureChatWorkflowExists 方法
    // projectId 参数保留用于接口一致性，但实际使用 computed 属性中的 currentProjectId
    await ensureChatWorkflowExists();
  }

  // Actions - 会话管理
  async function loadChatSession(sessionId: string): Promise<void> {
    if (!currentProjectId.value) {
      console.error('[ChatStore] Cannot load session without project ID');
      return;
    }

    isLoading.value = true;
    try {
      const response = await get<ChatHistoryTree>(`/chat/${sessionId}/tree?projectId=${currentProjectId.value}`);
      chatHistoryTree.value = response;
      activeSessionId.value = sessionId;
    } catch (error) {
      console.error('[ChatStore] Failed to load chat session:', error);
      dialogService.showError('加载会话失败', '无法加载聊天会话，请稍后重试。');
    } finally {
      isLoading.value = false;
    }
  }

  async function createNewSession(metadata?: Partial<ChatSession>): Promise<string | null> {
    if (!currentProjectId.value) {
      console.error('[ChatStore] Cannot create session without project ID');
      return null;
    }

    isLoading.value = true;
    try {
      const response = await post<ChatSession>('/chat/sessions', {
        projectId: currentProjectId.value,
        ...metadata
      });
      
      // 添加到会话列表
      sessionList.value.unshift(response);
      
      // 创建初始化的聊天历史树
      const rootNode: ChatMessageNode = {
        id: 'root',
        parentId: null,
        role: 'system',
        content: '会话开始',
        createdAt: new Date().toISOString(),
        children: [],
        isEnabled: true,
        metadata: {}
      };
      
      chatHistoryTree.value = {
        sessionId: response.id,
        rootNodeIds: [rootNode.id],
        nodes: { [rootNode.id]: rootNode },
        activeLeafId: rootNode.id,
        version: 1,
        metadata: {
          title: response.title || '新会话',
          description: response.description,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
          tokenCount: 0,
          tags: response.tags,
          settings: response.settings
        }
      };
      
      activeSessionId.value = response.id;
      return response.id;
    } catch (error) {
      console.error('[ChatStore] Failed to create new session:', error);
      dialogService.showError('创建会话失败', '无法创建新会话，请稍后重试。');
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteSession(sessionId: string): Promise<boolean> {
    try {
      await del(`/chat/sessions/${sessionId}`);
      
      // 从列表中移除
      const index = sessionList.value.findIndex(s => s.id === sessionId);
      if (index !== -1) {
        sessionList.value.splice(index, 1);
      }
      
      // 如果删除的是当前会话，清空状态
      if (activeSessionId.value === sessionId) {
        activeSessionId.value = null;
        chatHistoryTree.value = null;
      }
      
      return true;
    } catch (error) {
      console.error('[ChatStore] Failed to delete session:', error);
      dialogService.showError('删除失败', '无法删除会话，请稍后重试。');
      return false;
    }
  }

  async function renameSession(sessionId: string, newName: string): Promise<void> {
    try {
      await put(`/chat/sessions/${sessionId}/metadata`, { name: newName });
      
      // 更新本地列表
      const session = sessionList.value.find(s => s.id === sessionId);
      if (session) {
        session.title = newName;
      }
      
      // 更新当前会话元数据
      if (chatHistoryTree.value?.sessionId === sessionId && chatHistoryTree.value.metadata) {
        chatHistoryTree.value.metadata.title = newName;
      }
    } catch (error) {
      console.error('[ChatStore] Failed to rename session:', error);
      dialogService.showError('重命名失败', '无法重命名会话，请稍后重试。');
    }
  }

  async function loadSessionList(): Promise<void> {
    if (!currentProjectId.value) {
      console.error('[ChatStore] Cannot load session list without project ID');
      return;
    }

    isLoading.value = true;
    try {
      const response = await get<ChatSession[]>(`/chat/sessions?projectId=${currentProjectId.value}`);
      sessionList.value = response;
    } catch (error) {
      console.error('[ChatStore] Failed to load session list:', error);
      dialogService.showError('加载失败', '无法加载会话列表，请稍后重试。');
    } finally {
      isLoading.value = false;
    }
  }

  function searchSessions(query: string): ChatSession[] {
    const lowerQuery = query.toLowerCase();
    return sessionList.value.filter(session =>
      session.title?.toLowerCase().includes(lowerQuery) ||
      session.description?.toLowerCase().includes(lowerQuery)
    );
  }

  async function exportSession(sessionId: string, format: ExportFormat): Promise<void> {
    try {
      const response = await post(`/chat/sessions/${sessionId}/export`, { format });
      // 处理导出的文件下载
      // TODO: 实现文件下载逻辑
      console.log('Export response:', response);
    } catch (error) {
      console.error('[ChatStore] Failed to export session:', error);
      dialogService.showError('导出失败', '无法导出会话，请稍后重试。');
    }
  }

  async function importSession(file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await post<ChatSession>('/chat/sessions/import', formData);
      
      // 添加到会话列表
      sessionList.value.unshift(response);
      
      dialogService.showSuccess('导入成功', '会话已成功导入。');
    } catch (error) {
      console.error('[ChatStore] Failed to import session:', error);
      dialogService.showError('导入失败', '无法导入会话，请检查文件格式。');
    }
  }

  // Actions - 工作流管理
  async function ensureChatWorkflowExists(): Promise<void> {
    if (!currentProjectId.value) {
      console.error('[ChatStore] Cannot ensure workflow without project ID');
      return;
    }

    chatWorkflowPath.value = chatWorkflowFullPath.value;

    try {
      // 先尝试获取项目的工作流列表，检查是否存在聊天工作流
      const workflows = await get<any[]>(`/projects/${currentProjectId.value}/workflows`);
      const chatWorkflow = workflows.find(w => w.id === '_apps_chat_main');
      
      if (!chatWorkflow) {
        // 如果不存在，使用现有的工作流创建API
        console.log('[ChatStore] Chat workflow not found, creating from template...');
        
        // 导入模板数据
        const templateModule = await import('@/data/ChatWorkflowTemplate.json');
        const template = templateModule.default;
        
        // 使用现有的工作流创建API
        const workflowData = {
          id: '_apps_chat_main',
          name: template.name || '聊天默认工作流',
          description: template.description || 'ComfyTavern 聊天模块的默认工作流',
          nodes: template.nodes || [],
          edges: template.edges || [],
          viewport: template.viewport || { x: 0, y: 0, zoom: 1 },
          interfaceInputs: template.interfaceInputs || {},
          interfaceOutputs: template.interfaceOutputs || {},
          referencedWorkflows: template.referencedWorkflows || [],
          metadata: {
            isSystemWorkflow: true,
            workflowType: 'chat',
            version: template.version || '1.0.0'
          }
        };
        
        await post(`/projects/${currentProjectId.value}/workflows`, workflowData);
        
        console.log('[ChatStore] Chat workflow created successfully');
      } else {
        console.log('[ChatStore] Chat workflow already exists');
      }
    } catch (error: any) {
      console.error('[ChatStore] Failed to ensure chat workflow exists:', error);
      
      // 如果是因为工作流不存在，尝试创建
      if (error.response?.status === 404) {
        try {
          console.log('[ChatStore] Attempting to create chat workflow after 404...');
          
          const templateModule = await import('@/data/ChatWorkflowTemplate.json');
          const template = templateModule.default;
          
          const workflowData = {
            id: '_apps_chat_main',
            name: template.name || '聊天默认工作流',
            description: template.description || 'ComfyTavern 聊天模块的默认工作流',
            nodes: template.nodes || [],
            edges: template.edges || [],
            viewport: template.viewport || { x: 0, y: 0, zoom: 1 },
            interfaceInputs: template.interfaceInputs || {},
            interfaceOutputs: template.interfaceOutputs || {},
            referencedWorkflows: template.referencedWorkflows || [],
            metadata: {
              isSystemWorkflow: true,
              workflowType: 'chat',
              version: template.version || '1.0.0'
            }
          };
          
          await post(`/projects/${currentProjectId.value}/workflows`, workflowData);
          console.log('[ChatStore] Chat workflow created successfully after 404');
        } catch (createError) {
          console.error('[ChatStore] Failed to create chat workflow:', createError);
          // 不显示错误对话框，允许用户继续使用其他功能
        }
      }
    }
  }

  async function resetChatWorkflow(): Promise<void> {
    if (!currentProjectId.value) {
      console.error('[ChatStore] Cannot reset workflow without project ID');
      return;
    }

    const confirmed = await dialogService.showConfirm({
      title: '重置工作流',
      message: '您确定要将聊天工作流重置为默认模板吗？这将覆盖您的所有自定义修改。',
      dangerConfirm: true
    });

    if (!confirmed) return;

    try {
      // 导入模板数据
      const templateModule = await import('@/data/ChatWorkflowTemplate.json');
      const template = templateModule.default;
      
      // 使用现有的工作流更新API来重置工作流
      const workflowData = {
        id: '_apps_chat_main',
        name: template.name || '聊天默认工作流',
        description: template.description || 'ComfyTavern 聊天模块的默认工作流',
        nodes: template.nodes || [],
        edges: template.edges || [],
        viewport: template.viewport || { x: 0, y: 0, zoom: 1 },
        interfaceInputs: template.interfaceInputs || {},
        interfaceOutputs: template.interfaceOutputs || {},
        referencedWorkflows: template.referencedWorkflows || [],
        metadata: {
          isSystemWorkflow: true,
          workflowType: 'chat',
          version: template.version || '1.0.0'
        }
      };
      
      // 使用PUT更新现有工作流
      await put(`/projects/${currentProjectId.value}/workflows/_apps_chat_main`, workflowData);
      
      dialogService.showSuccess('重置成功', '聊天工作流已重置为默认模板。');
    } catch (error) {
      console.error('[ChatStore] Failed to reset chat workflow:', error);
      dialogService.showError('重置失败', '无法重置聊天工作流，请稍后重试。');
    }
  }

  // Actions - 消息发送与编辑
  async function sendMessage(content: string, parentId: string | null = null): Promise<void> {
    if (!activeSessionId.value || !chatHistoryTree.value) {
      console.error('[ChatStore] Cannot send message without active session');
      return;
    }

    // 确保工作流存在
    await ensureChatWorkflowExists();

    // 构建线性上下文
    const activeLeaf = chatHistoryTree.value.activeLeafId || parentId;
    if (!activeLeaf) {
      console.error('[ChatStore] No active leaf node to build context from');
      return;
    }
    const context = getLinearContext(activeLeaf);
    
    // 添加新消息到上下文
    context.push({
      role: 'user',
      content: content
    });

    try {
      // 调用工作流
      const invocationResult = await invoke({
        mode: 'saved',
        targetId: chatWorkflowPath.value,
        inputs: {
          chat_history: context,
          llm_config: JSON.stringify({
            temperature: 0.7,
            max_tokens: 2048
          })
        },
        source: 'panel'
      });

      if (invocationResult) {
        const { executionId } = invocationResult;
        console.log(`[ChatStore] Workflow execution started: ${executionId}`);
        
        // TODO: 监听流式输出并更新聊天界面
      }
    } catch (error) {
      console.error('[ChatStore] Failed to send message:', error);
      dialogService.showError('发送失败', '消息发送失败，请稍后重试。');
    }
  }

  // Actions - 节点操作
  function updateNodeState(nodeId: string, isEnabled: boolean): void {
    if (!chatHistoryTree.value || !chatHistoryTree.value.nodes[nodeId]) {
      console.error(`[ChatStore] Node ${nodeId} not found`);
      return;
    }

    chatHistoryTree.value.nodes[nodeId].isEnabled = isEnabled;
    chatHistoryTree.value.version++;
    
    // TODO: 同步到后端
  }

  function pruneBranch(nodeId: string): void {
    if (!chatHistoryTree.value) return;
    
    // TODO: 实现剪枝逻辑
    console.log('[ChatStore] Prune branch:', nodeId);
  }

  function graftBranch(sourceNodeId: string, targetNodeId: string): void {
    if (!chatHistoryTree.value) return;
    
    // TODO: 实现嫁接逻辑
    console.log('[ChatStore] Graft branch:', sourceNodeId, '->', targetNodeId);
  }

  function switchTrunk(leafNodeId: string): void {
    if (!chatHistoryTree.value) return;
    
    chatHistoryTree.value.activeLeafId = leafNodeId;
    chatHistoryTree.value.version++;
    
    // TODO: 同步到后端
  }

  // 辅助函数
  function getLinearContext(activeLeafId: string): any[] {
    if (!chatHistoryTree.value) return [];
    
    const context: any[] = [];
    let currentId: string | null = activeLeafId;
    
    // 从叶节点向上遍历到根节点，收集启用的节点
    const path: ChatMessageNode[] = [];
    while (currentId) {
      const currentNode: ChatMessageNode | undefined = chatHistoryTree.value.nodes[currentId];
      if (!currentNode) break;
      
      if (currentNode.isEnabled && currentNode.role !== 'system') {
        path.unshift(currentNode);
      }
      currentId = currentNode.parentId;
    }
    
    // 转换为LLM需要的格式
    for (const node of path) {
      context.push({
        role: node.role,
        content: node.content
      });
    }
    
    return context;
  }

  function getAllNodesAsArray(rootId: string): ChatMessageNode[] {
    if (!chatHistoryTree.value) return [];
    
    const nodes: ChatMessageNode[] = [];
    const visited = new Set<string>();
    
    function traverse(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = chatHistoryTree.value!.nodes[nodeId];
      if (!node) return;
      
      nodes.push(node);
      
      for (const childId of node.children) {
        traverse(childId);
      }
    }
    
    traverse(rootId);
    return nodes;
  }

  // UI控制
  function toggleLeftSidebar(): void {
    leftSidebarVisible.value = !leftSidebarVisible.value;
  }

  function toggleRightSidebar(): void {
    rightSidebarVisible.value = !rightSidebarVisible.value;
  }

  function setRightSidebarTab(tab: string): void {
    rightSidebarActiveTab.value = tab;
  }

  return {
    // 状态
    chatHistoryTree,
    currentMode,
    activeSessionId,
    sessionList,
    chatWorkflowPath,
    isLoading,
    leftSidebarVisible,
    rightSidebarVisible,
    rightSidebarActiveTab,
    
    // 计算属性
    currentProjectId,
    chatWorkflowFullPath,
    getChatNodes,
    
    // Actions - 初始化
    initialize,
    ensureChatWorkflow,
    
    // Actions - 会话管理
    loadChatSession,
    createNewSession,
    deleteSession,
    renameSession,
    loadSessionList,
    searchSessions,
    exportSession,
    importSession,
    
    // Actions - 工作流管理
    ensureChatWorkflowExists,
    resetChatWorkflow,
    
    // Actions - 消息发送与编辑
    sendMessage,
    
    // Actions - 节点操作
    updateNodeState,
    pruneBranch,
    graftBranch,
    switchTrunk,
    
    // 辅助函数
    getLinearContext,
    
    // UI控制
    toggleLeftSidebar,
    toggleRightSidebar,
    setRightSidebarTab
  };
});