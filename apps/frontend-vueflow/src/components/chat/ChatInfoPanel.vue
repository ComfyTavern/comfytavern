<template>
  <div class="chat-info-panel flex flex-col h-full bg-background-surface border-l border-border-base">
    <!-- 标签页切换器 -->
    <div class="flex gap-1 p-2 border-b border-border-base bg-background-base">
      <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id" :class="[
        'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        activeTab === tab.id
          ? 'bg-primary text-primary-content shadow-sm'
          : 'text-text-secondary hover:bg-primary-softest hover:text-text-base'
      ]">
        <component :is="tab.icon" class="w-4 h-4" />
        <span>{{ $t(tab.label) }}</span>
      </button>
    </div>

    <!-- 标签页内容 -->
    <div class="flex-1 overflow-y-auto">
      <!-- 会话信息标签页 -->
      <div v-if="activeTab === 'info'" class="p-4 space-y-6">
        <div v-if="session">
          <!-- 基本信息 -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              {{ $t('chat.sessionInfo') }}
            </h3>

            <!-- 会话标题 -->
            <div class="space-y-2">
              <label class="text-xs text-text-muted">{{ $t('chat.metadata.title') }}</label>
              <div class="flex items-center gap-2">
                <input v-if="isEditingTitle" v-model="editedTitle" @blur="saveTitle" @keyup.enter="saveTitle"
                  @keyup.escape="cancelEditTitle"
                  class="flex-1 px-3 py-1.5 bg-background-base border border-primary rounded-lg focus:outline-none"
                  ref="titleInput" />
                <div v-else class="flex-1 flex items-center gap-2">
                  <span class="text-text-base font-medium">{{ session.title || $t('chat.untitledSession') }}</span>
                  <button @click="startEditTitle" class="p-1 rounded hover:bg-primary-softest transition-colors"
                    v-comfy-tooltip="$t('common.edit')">
                    <PencilIcon class="w-3.5 h-3.5 text-text-secondary" />
                  </button>
                </div>
              </div>
            </div>

            <!-- 统计信息 -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <span class="text-xs text-text-muted">{{ $t('chat.metadata.created') }}</span>
                <p class="text-sm text-text-base">{{ formatDate(session.createdAt) }}</p>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-text-muted">{{ $t('chat.metadata.updated') }}</span>
                <p class="text-sm text-text-base">{{ formatDate(session.updatedAt) }}</p>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-text-muted">{{ $t('chat.metadata.messages') }}</span>
                <p class="text-sm text-text-base font-medium">{{ session.messageCount || 0 }}</p>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-text-muted">{{ $t('chat.metadata.branches') }}</span>
                <p class="text-sm text-text-base font-medium">{{ session.branchCount || 1 }}</p>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-text-muted">{{ $t('chat.metadata.tokens') }}</span>
                <p class="text-sm text-text-base font-medium">{{ formatTokenCount(session.tokenCount || 0) }}</p>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-text-muted">{{ $t('chat.metadata.cost') }}</span>
                <p class="text-sm text-text-base font-medium">${{ (session.estimatedCost || 0).toFixed(4) }}</p>
              </div>
            </div>

            <!-- 描述 -->
            <div class="space-y-2">
              <label class="text-xs text-text-muted">{{ $t('chat.metadata.description') }}</label>
              <textarea v-model="localDescription" @blur="saveDescription"
                :placeholder="$t('chat.descriptionPlaceholder')"
                class="w-full px-3 py-2 bg-background-base border border-border-base rounded-lg focus:outline-none focus:border-primary resize-none"
                rows="3" />
            </div>

            <!-- 标签 -->
            <div class="space-y-2">
              <label class="text-xs text-text-muted">{{ $t('chat.metadata.tags') }}</label>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="tag in session.tags" :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-1 bg-primary-softest text-text-secondary text-xs rounded-md">
                  {{ tag }}
                  <button @click="removeTag(tag)" class="p-0.5 hover:bg-primary-soft rounded transition-colors">
                    <XMarkIcon class="w-3 h-3" />
                  </button>
                </span>
                <button @click="showAddTagDialog"
                  class="px-2 py-1 border border-dashed border-border-base hover:border-primary text-text-muted hover:text-primary text-xs rounded-md transition-colors">
                  <PlusIcon class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- LLM 设置 -->
          <div class="pt-4 space-y-4 border-t border-border-base">
            <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              {{ $t('chat.llmSettings') }}
            </h3>

            <div class="space-y-3">
              <div class="space-y-2">
                <label class="text-xs text-text-muted">{{ $t('chat.settings.model') }}</label>
                <SelectInput v-model="localSettings.model" :suggestions="modelSuggestions"
                  :placeholder="$t('chat.settings.useDefault')" :searchable="true" :apply-canvas-scale="false"
                  size="large" @update:modelValue="saveSettings" />
              </div>

              <div class="space-y-2">
                <label class="text-xs text-text-muted">
                  {{ $t('chat.settings.temperature') }}: {{ localSettings.temperature }}
                </label>
                <input type="range" v-model.number="localSettings.temperature" @change="saveSettings" min="0" max="2"
                  step="0.1" class="w-full" />
              </div>

              <div class="space-y-2">
                <label class="text-xs text-text-muted">
                  {{ $t('chat.settings.maxTokens') }}
                </label>
                <input type="number" v-model.number="localSettings.maxTokens" @change="saveSettings" min="1" max="32000"
                  class="w-full px-3 py-1.5 bg-background-base border border-border-base rounded-lg focus:outline-none focus:border-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 工具箱标签页 -->
      <div v-else-if="activeTab === 'tools'" class="p-4 space-y-4">
        <!-- 工作流管理 -->
        <div class="space-y-3">
          <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            {{ $t('chat.workflowManagement') }}
          </h3>

          <div class="space-y-2">
            <button @click="$emit('edit-workflow')"
              class="w-full flex items-center gap-3 px-3 py-2 bg-background-base hover:bg-primary-softest border border-border-base hover:border-primary rounded-lg transition-all group">
              <WrenchScrewdriverIcon class="w-5 h-5 text-text-secondary group-hover:text-primary" />
              <div class="flex-1 text-left">
                <p class="text-sm text-text-base">{{ $t('chat.editWorkflow') }}</p>
                <p class="text-xs text-text-muted">{{ $t('chat.editWorkflowDesc') }}</p>
              </div>
            </button>

            <button @click="$emit('reset-workflow')"
              class="w-full flex items-center gap-3 px-3 py-2 bg-background-base hover:bg-primary-softest border border-border-base hover:border-warning rounded-lg transition-all group">
              <ArrowPathIcon class="w-5 h-5 text-text-secondary group-hover:text-warning" />
              <div class="flex-1 text-left">
                <p class="text-sm text-text-base">{{ $t('chat.resetWorkflow') }}</p>
                <p class="text-xs text-text-muted">{{ $t('chat.resetWorkflowDesc') }}</p>
              </div>
            </button>
          </div>
        </div>

        <!-- 导出选项 -->
        <div class="space-y-3">
          <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            {{ $t('chat.exportOptions') }}
          </h3>

          <div class="grid grid-cols-2 gap-2">
            <button v-for="format in exportFormats" :key="format.id" @click="$emit('export', format.id)"
              class="px-3 py-2 bg-background-base hover:bg-primary-softest border border-border-base hover:border-primary rounded-lg transition-all">
              <component :is="format.icon" class="w-4 h-4 mx-auto mb-1 text-text-secondary" />
              <p class="text-xs text-text-base">{{ format.label }}</p>
            </button>
          </div>
        </div>

        <!-- 高级功能 -->
        <div class="space-y-3">
          <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            {{ $t('chat.advancedFeatures') }}
          </h3>

          <div class="space-y-2">
            <button @click="$emit('show-templates')"
              class="w-full flex items-center gap-3 px-3 py-2 bg-background-base hover:bg-primary-softest border border-border-base hover:border-primary rounded-lg transition-all">
              <DocumentDuplicateIcon class="w-5 h-5 text-text-secondary" />
              <span class="text-sm text-text-base">{{ $t('chat.workflowTemplates') }}</span>
            </button>

            <button @click="$emit('batch-operations')"
              class="w-full flex items-center gap-3 px-3 py-2 bg-background-base hover:bg-primary-softest border border-border-base hover:border-primary rounded-lg transition-all">
              <QueueListIcon class="w-5 h-5 text-text-secondary" />
              <span class="text-sm text-text-base">{{ $t('chat.batchOperations') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 角色管理标签页 -->
      <div v-else-if="activeTab === 'role'" class="p-4 space-y-4">
        <div class="text-center py-8">
          <UserCircleIcon class="w-16 h-16 mx-auto mb-4 text-text-muted opacity-50" />
          <p class="text-text-secondary">{{ $t('chat.roleFeatureComingSoon') }}</p>
        </div>
      </div>

      <!-- 知识库标签页 -->
      <div v-else-if="activeTab === 'knowledge'" class="p-4 space-y-4">
        <div class="text-center py-8">
          <BookOpenIcon class="w-16 h-16 mx-auto mb-4 text-text-muted opacity-50" />
          <p class="text-text-secondary">{{ $t('chat.knowledgeFeatureComingSoon') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ChatSession } from '@comfytavern/types';
import SelectInput from '../graph/inputs/SelectInput.vue';
import {
  InformationCircleIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  BookOpenIcon,
  PencilIcon,
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  QueueListIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  PhotoIcon,
  DocumentArrowDownIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

// Props
interface Props {
  session: ChatSession | null;
  initialTab?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialTab: 'info'
});

// Emits
const emit = defineEmits<{
  'update-session': [updates: Partial<ChatSession>];
  'edit-workflow': [];
  'reset-workflow': [];
  'show-templates': [];
  'batch-operations': [];
  'export': [format: string];
}>();

// 响应式数据
const activeTab = ref(props.initialTab);
const isEditingTitle = ref(false);
const editedTitle = ref('');
const titleInput = ref<HTMLInputElement>();
const localDescription = ref('');
const localSettings = ref({
  model: '',
  temperature: 0.7,
  maxTokens: 2048
});

// 标签页配置
const tabs = [
  { id: 'info', label: 'chat.sidebar.info', icon: InformationCircleIcon },
  { id: 'tools', label: 'chat.sidebar.tools', icon: WrenchScrewdriverIcon },
  { id: 'role', label: 'chat.sidebar.role', icon: UserCircleIcon },
  { id: 'knowledge', label: 'chat.sidebar.knowledge', icon: BookOpenIcon }
];

// 导出格式配置
const exportFormats = [
  { id: 'json', label: 'JSON', icon: CodeBracketIcon },
  { id: 'markdown', label: 'Markdown', icon: DocumentTextIcon },
  { id: 'pdf', label: 'PDF', icon: DocumentArrowDownIcon },
  { id: 'image', label: 'Image', icon: PhotoIcon }
];

// 可用模型列表（示例）
const availableModels = [
  'chatgpt-4o-latest',
  'deepseek-chat',
  'claude-3-7-sonnet-20250219',
  'claude-sonnet-4-20250514',
  'claude-opus-4-1-20250805',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'grok-4-0709'
];

// 为 SelectInput 准备模型选项
const modelSuggestions = computed(() => {
  // 添加默认选项
  const suggestions = [
    { value: '', label: t('chat.settings.useDefault') },
    ...availableModels.map(model => ({ value: model, label: model }))
  ];
  return suggestions;
});

// 方法
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(2)}M`;
}

function startEditTitle() {
  if (!props.session) return;
  editedTitle.value = props.session.title || '';
  isEditingTitle.value = true;
  nextTick(() => {
    titleInput.value?.focus();
    titleInput.value?.select();
  });
}

function saveTitle() {
  if (!props.session || !isEditingTitle.value) return;

  const newTitle = editedTitle.value.trim();
  if (newTitle && newTitle !== props.session.title) {
    emit('update-session', { title: newTitle });
  }
  isEditingTitle.value = false;
}

function cancelEditTitle() {
  isEditingTitle.value = false;
}

function saveDescription() {
  if (!props.session) return;

  const newDescription = localDescription.value.trim();
  if (newDescription !== props.session.description) {
    emit('update-session', { description: newDescription });
  }
}

function saveSettings() {
  if (!props.session) return;
  emit('update-session', { settings: { ...localSettings.value } });
}

function removeTag(tag: string) {
  if (!props.session || !props.session.tags) return;

  const newTags = props.session.tags.filter(t => t !== tag);
  emit('update-session', { tags: newTags });
}

function showAddTagDialog() {
  // TODO: 实现添加标签对话框
  const newTag = prompt(t('chat.enterNewTag'));
  if (newTag) {
    const tags = props.session?.tags || [];
    if (!tags.includes(newTag)) {
      emit('update-session', { tags: [...tags, newTag] });
    }
  }
}

// 监听会话变化，更新本地状态
watch(() => props.session, (newSession) => {
  if (newSession) {
    localDescription.value = newSession.description || '';
    localSettings.value = {
      model: newSession.settings?.model || '',
      temperature: newSession.settings?.temperature || 0.7,
      maxTokens: newSession.settings?.maxTokens || 2048
    };
  }
}, { immediate: true });

// 监听初始标签页变化
watch(() => props.initialTab, (newTab) => {
  activeTab.value = newTab;
});
</script>

<style scoped>
.chat-info-panel {
  width: 100%;
  min-width: 280px;
  max-width: 380px;
}

/* 自定义滚动条 */
.chat-info-panel ::-webkit-scrollbar {
  width: 6px;
}

.chat-info-panel ::-webkit-scrollbar-track {
  background: transparent;
}

.chat-info-panel ::-webkit-scrollbar-thumb {
  background-color: hsl(var(--ct-border-base-hsl) / 0.3);
  border-radius: 3px;
}

.chat-info-panel ::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--ct-border-base-hsl) / 0.5);
}
</style>