<template>
  <div class="chat-view flex h-full w-full bg-background-base">
    <!-- 左侧边栏 - 会话列表 -->
    <ChatSidebar
      v-show="chatStore.leftSidebarVisible"
      :sessions="chatStore.sessionList"
      :active-session-id="chatStore.activeSessionId"
      :is-loading="chatStore.isLoading"
      @create-session="createNewSession"
      @import-session="showImportDialog"
      @select-session="selectSession"
      @delete-session="deleteSession"
      @rename-session="renameSession"
      @export-session="exportSession"
      @show-settings="showSettings"
      @search="handleSearch"
    />

    <!-- 中央主聊天区域 -->
    <div class="flex-1 flex flex-col">
      <!-- 顶部工具栏 -->
      <div class="chat-toolbar flex items-center justify-between border-b border-border-base px-4 py-2 bg-background-surface">
        <div class="flex items-center gap-2">
          <button
            @click="chatStore.toggleLeftSidebar"
            class="p-2 rounded-lg hover:bg-primary-softest transition-colors"
            v-comfy-tooltip="$t('sidebar.toggleSidebar')"
          >
            <Bars3Icon class="h-5 w-5 text-text-secondary" />
          </button>
          <div class="text-lg font-medium text-text-base">
            {{ currentSessionTitle }}
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <!-- 模式切换 -->
          <div class="inline-flex rounded-lg border border-border-base">
            <button
              @click="chatStore.currentMode = 'immersive'"
              :class="[
                'px-3 py-1.5 text-sm font-medium transition-colors',
                chatStore.currentMode === 'immersive' 
                  ? 'bg-primary text-primary-content' 
                  : 'text-text-secondary hover:bg-primary-softest'
              ]"
            >
              {{ $t('chat.immersiveMode') }}
            </button>
            <button
              @click="chatStore.currentMode = 'edit'"
              :class="[
                'px-3 py-1.5 text-sm font-medium transition-colors',
                chatStore.currentMode === 'edit' 
                  ? 'bg-primary text-primary-content' 
                  : 'text-text-secondary hover:bg-primary-softest'
              ]"
            >
              {{ $t('chat.editMode') }}
            </button>
          </div>
          
          <button
            @click="chatStore.toggleRightSidebar"
            class="p-2 rounded-lg hover:bg-primary-softest transition-colors"
            v-comfy-tooltip="$t('sidebar.toggleSidebar')"
          >
            <InformationCircleIcon class="h-5 w-5 text-text-secondary" />
          </button>
        </div>
      </div>

      <!-- 消息列表区域 -->
      <div class="flex-1 overflow-y-auto p-4" ref="messageContainer">
        <div v-if="!chatStore.activeSessionId" class="flex items-center justify-center h-full text-text-muted">
          <div class="text-center">
            <ChatBubbleLeftRightIcon class="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>{{ $t('chat.noSessions') }}</p>
            <button 
              @click="createNewSession" 
              class="mt-4 px-4 py-2 bg-primary text-primary-content rounded-lg hover:opacity-90 transition-opacity"
            >
              {{ $t('chat.newSession') }}
            </button>
          </div>
        </div>
        
        <div v-else-if="chatStore.currentMode === 'immersive'">
          <!-- 沉浸模式消息列表 -->
          <div class="space-y-4 max-w-4xl mx-auto">
            <ChatMessageGroup
              v-for="node in linearMessages"
              :key="node.id"
              :message="node"
              :current-fork-index="getCurrentForkIndex(node)"
              :total-forks="getTotalForks(node)"
              @switch-fork="(direction) => switchFork(node, direction)"
              @edit="(content) => editMessage(node, content)"
              @retry="retryMessage(node)"
              @delete="deleteMessage(node)"
              @view-attachment="viewAttachment"
            />
          </div>
        </div>
        
        <div v-else>
          <!-- 编辑模式 - 树状图 -->
          <div class="h-full w-full">
            <!-- TODO: 集成 VueFlow 或其他图表库显示聊天历史树 -->
            <p class="text-center text-text-muted p-8">
              {{ $t('common.placeholder', { content: '聊天历史树状图编辑器' }) }}
            </p>
          </div>
        </div>
      </div>

      <!-- 底部输入区域 -->
      <ChatInputArea
        v-model="inputMessage"
        :placeholder="$t('chat.inputPlaceholder')"
        :disabled="isSending"
        :is-loading="isSending"
        :enable-markdown="true"
        :enable-voice-input="false"
        @send="handleSendMessage"
        @typing="handleTyping"
        @paste="handlePaste"
      />
    </div>

    <!-- 右侧边栏 - 会话信息与工具 -->
    <ChatInfoPanel
      v-show="chatStore.rightSidebarVisible"
      :session="currentSession"
      :initial-tab="chatStore.rightSidebarActiveTab"
      @update-session="updateSession"
      @edit-workflow="editWorkflow"
      @reset-workflow="resetWorkflow"
      @show-templates="showTemplatesDialog"
      @batch-operations="showBatchOperations"
      @export="(format: string) => currentSession && exportSession(currentSession, format)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '@/stores/chatStore';
import { useDialogService } from '@/services/DialogService';
import { useRouter, useRoute } from 'vue-router';
import type { ChatSession, ChatMessageNode } from '@comfytavern/types';

// 导入聊天组件
import ChatSidebar from '@/components/chat/ChatSidebar.vue';
import ChatMessageGroup from '@/components/chat/ChatMessageGroup.vue';
import ChatInputArea from '@/components/chat/ChatInputArea.vue';
import ChatInfoPanel from '@/components/chat/ChatInfoPanel.vue';

// Heroicons
import {
  Bars3Icon,
  InformationCircleIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/vue/24/outline';

// Store和服务
const chatStore = useChatStore();
const dialogService = useDialogService();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

// 响应式数据
const inputMessage = ref('');
const isSending = ref(false);
const messageContainer = ref<HTMLDivElement>();

// 计算属性
const currentSession = computed<ChatSession | null>(() => {
  if (!chatStore.activeSessionId) return null;
  return chatStore.sessionList.find(s => s.id === chatStore.activeSessionId) || null;
});

const currentSessionTitle = computed(() => {
  return currentSession.value?.title || t('chat.newSession');
});

const linearMessages = computed(() => {
  return chatStore.getChatNodes;
});

// 方法
async function createNewSession() {
  const name = await dialogService.showInput({
    title: t('chat.newSession'),
    message: t('common.name'),
    initialValue: t('chat.newSession')
  });
  
  if (name) {
    const sessionId = await chatStore.createNewSession({ title: name });
    if (sessionId) {
      await chatStore.loadChatSession(sessionId);
    }
  }
}

async function selectSession(sessionId: string) {
  await chatStore.loadChatSession(sessionId);
}

function showImportDialog() {
  dialogService.showInfo(t('common.comingSoon'), t('chat.importFeatureComingSoon'));
}

async function deleteSession(session: ChatSession) {
  const confirmed = await dialogService.showConfirm({
    title: t('common.confirmDelete'),
    message: t('chat.confirmDeleteSession', { name: session.title }),
    dangerConfirm: true
  });
  
  if (confirmed) {
    await chatStore.deleteSession(session.id);
  }
}

async function renameSession(session: ChatSession, newName: string) {
  await chatStore.renameSession(session.id, newName);
}

function exportSession(session: ChatSession, format: string) {
  chatStore.exportSession(session.id, format as any);
}

function showSettings() {
  router.push({ name: 'ProjectSettings', params: { projectId: route.params.projectId } });
}

function handleSearch(query: string) {
  // 搜索功能已由 ChatSidebar 内部处理
  console.log('Search query:', query);
}

async function handleSendMessage(message: string, attachments: any[]) {
  if (!message.trim() || isSending.value) return;
  
  isSending.value = true;
  try {
    // chatStore.sendMessage 现在接受 content 和 parentId
    await chatStore.sendMessage(message, null);
    // TODO: 处理附件
    if (attachments.length > 0) {
      console.log('附件待处理:', attachments);
    }
    
    // 滚动到底部
    if (messageContainer.value) {
      setTimeout(() => {
        messageContainer.value!.scrollTop = messageContainer.value!.scrollHeight;
      }, 100);
    }
  } finally {
    isSending.value = false;
  }
}

function handleTyping(isTyping: boolean) {
  // TODO: 实现输入状态同步
  console.log('Typing:', isTyping);
}

function handlePaste(files: File[]) {
  // TODO: 处理粘贴的文件
  console.log('Pasted files:', files);
}

function getCurrentForkIndex(_node: ChatMessageNode): number {
  // TODO: 从聊天历史树中获取当前分叉索引
  return 0;
}

function getTotalForks(_node: ChatMessageNode): number {
  // TODO: 从聊天历史树中获取总分叉数
  return 1;
}

function switchFork(node: ChatMessageNode, direction: number) {
  // TODO: 实现分叉切换
  console.log('Switch fork:', node, direction);
}

async function editMessage(node: ChatMessageNode, content: string) {
  // TODO: 实现编辑消息功能
  console.log('编辑消息:', node.id, content);
}

async function retryMessage(node: ChatMessageNode) {
  // TODO: 实现重试消息功能
  console.log('重试消息:', node.id);
}

async function deleteMessage(node: ChatMessageNode) {
  const confirmed = await dialogService.showConfirm({
    title: t('common.confirmDelete'),
    message: t('chat.confirmDeleteMessage'),
    dangerConfirm: true
  });
  
  if (confirmed) {
    // TODO: 实现删除消息功能
    console.log('删除消息:', node.id);
  }
}

function viewAttachment(attachment: any) {
  // TODO: 实现附件查看
  console.log('View attachment:', attachment);
}

async function updateSession(updates: Partial<ChatSession>) {
  if (currentSession.value) {
    // TODO: 实现更新会话元数据功能
    console.log('更新会话:', currentSession.value.id, updates);
  }
}

function editWorkflow() {
  router.push({
    name: 'ProjectEditor',
    params: { 
      projectId: route.params.projectId,
      workflowId: '_apps_chat_main'
    }
  });
}

async function resetWorkflow() {
  const confirmed = await dialogService.showConfirm({
    title: t('chat.resetWorkflow'),
    message: t('chat.confirmResetWorkflow'),
    dangerConfirm: true
  });
  
  if (confirmed) {
    await chatStore.resetChatWorkflow();
  }
}

function showTemplatesDialog() {
  dialogService.showInfo(t('common.comingSoon'), t('chat.templatesFeatureComingSoon'));
}

function showBatchOperations() {
  dialogService.showInfo(t('common.comingSoon'), t('chat.batchOperationsFeatureComingSoon'));
}

// 生命周期
onMounted(async () => {
  try {
    const projectId = route.params.projectId as string;
    
    // 初始化 chatStore
    await chatStore.initialize(projectId);
    
    // 检查并创建专用工作流（如果不存在）
    await chatStore.ensureChatWorkflow(projectId);
    
    // 加载会话列表
    await chatStore.loadSessionList();
    
    // 如果没有活动会话，选择第一个或创建新会话
    if (!chatStore.activeSessionId) {
      if (chatStore.sessionList.length > 0) {
        const firstSession = chatStore.sessionList[0];
        if (firstSession) {
          await chatStore.loadChatSession(firstSession.id);
        }
      } else {
        // 如果没有会话，自动创建一个
        const sessionId = await chatStore.createNewSession({
          title: t('chat.newSession')
        });
        if (sessionId) {
          await chatStore.loadChatSession(sessionId);
        }
      }
    }
  } catch (error) {
    console.error('初始化聊天页面失败:', error);
    dialogService.showError(t('chat.initError'), t('chat.initErrorDesc'));
  }
});
</script>

<style scoped>
.chat-view {
  height: calc(100vh - var(--header-height, 0px));
}

/* 自定义滚动条 */
.chat-view ::-webkit-scrollbar {
  width: 6px;
}

.chat-view ::-webkit-scrollbar-track {
  background: transparent;
}

.chat-view ::-webkit-scrollbar-thumb {
  background-color: hsl(var(--ct-border-base-hsl) / 0.3);
  border-radius: 3px;
}

.chat-view ::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--ct-border-base-hsl) / 0.5);
}
</style>