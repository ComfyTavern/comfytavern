<template>
  <div :class="[
    'chat-message-group relative group',
    'animate-fadeIn',
    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
  ]" class="flex gap-3">
    <!-- 头像 -->
    <div class="flex-shrink-0">
      <div :class="[
        'w-8 h-8 rounded-lg flex items-center justify-center',
        message.role === 'user'
          ? 'bg-primary/20 text-primary'
          : message.role === 'assistant'
            ? 'bg-secondary/20 text-secondary'
            : 'bg-primary-softest text-text-secondary'
      ]">
        <component :is="roleIcon" class="w-5 h-5" />
      </div>
    </div>

    <!-- 消息内容区 -->
    <div :class="[
      'flex-1 max-w-[70%] space-y-2',
      message.role === 'user' ? 'items-end' : 'items-start'
    ]">
      <!-- 角色标签和时间 -->
      <div :class="[
        'flex items-center gap-2 text-xs text-text-muted',
        message.role === 'user' ? 'justify-end' : 'justify-start'
      ]">
        <span class="font-medium">{{ roleLabel }}</span>
        <span>•</span>
        <span>{{ formatTime(message.createdAt) }}</span>

        <!-- 分叉指示器 -->
        <div v-if="hasForks" class="inline-flex items-center gap-1 ml-2">
          <ArrowsRightLeftIcon class="w-3 h-3" />
          <span>{{ currentForkIndex + 1 }}/{{ totalForks }}</span>
        </div>
      </div>

      <!-- 消息卡片 -->
      <div :class="[
        'relative rounded-lg p-4',
        message.role === 'user'
          ? 'bg-primary text-primary-content'
          : 'bg-background-surface border border-border-base'
      ]">
        <!-- 消息状态指示器 -->
        <div v-if="message.status === 'generating'" class="absolute -top-1 -right-1">
          <div class="w-2 h-2 bg-accent rounded-full animate-pulse" />
        </div>

        <!-- 错误状态 -->
        <div v-if="message.status === 'error'" class="mb-2 p-2 bg-error/10 text-error rounded text-sm">
          <ExclamationTriangleIcon class="w-4 h-4 inline mr-1" />
          {{ message.error || $t('chat.messageError') }}
        </div>

        <!-- 消息内容 -->
        <div v-if="isEditing" class="space-y-2">
          <textarea v-model="editedContent" @blur="saveEdit" @keydown.ctrl.enter="saveEdit" @keydown.escape="cancelEdit"
            class="w-full p-2 bg-background-base text-text-base border border-border-base rounded-lg focus:outline-none focus:border-primary resize-none"
            :rows="Math.min(editedContent.split('\n').length + 1, 10)" ref="editTextarea" />
          <div class="flex gap-2 justify-end">
            <button @click="cancelEdit"
              class="px-3 py-1 text-sm bg-primary-softest hover:bg-primary-soft text-text-secondary rounded-lg transition-colors">
              {{ $t('common.cancel') }}
            </button>
            <button @click="saveEdit"
              class="px-3 py-1 text-sm bg-primary hover:opacity-90 text-primary-content rounded-lg transition-opacity">
              {{ $t('common.save') }}
            </button>
          </div>
        </div>

        <div v-else class="prose prose-sm max-w-none" :class="message.role === 'user' ? 'prose-invert' : ''">
          <!-- 渲染 Markdown 内容 -->
          <div v-if="message.status === 'generating'" class="flex items-center gap-2">
            <span v-html="renderedContent" />
            <span class="inline-block w-2 h-4 bg-current animate-blink" />
          </div>
          <div v-else v-html="renderedContent" />
        </div>

        <!-- 附件列表 -->
        <div v-if="message.attachments && message.attachments.length > 0" class="mt-3 space-y-2">
          <div v-for="attachment in message.attachments" :key="attachment.id"
            class="flex items-center gap-2 p-2 bg-primary-softest rounded-lg">
            <component :is="getAttachmentIcon(attachment.type)" class="w-4 h-4 text-text-secondary" />
            <span class="text-sm text-text truncate">{{ attachment.name }}</span>
            <button @click="$emit('view-attachment', attachment)"
              class="ml-auto p-1 hover:bg-primary-soft rounded transition-colors" v-comfy-tooltip="$t('common.view')">
              <EyeIcon class="w-3.5 h-3.5 text-text-secondary" />
            </button>
          </div>
        </div>
      </div>

      <!-- 操作按钮组 -->
      <div :class="[
        'flex items-center gap-1',
        message.role === 'user' ? 'justify-end' : 'justify-start',
        'opacity-0 group-hover:opacity-100 transition-opacity'
      ]">
        <!-- 分叉切换按钮 -->
        <template v-if="hasForks">
          <button @click="$emit('switch-fork', -1)" :disabled="currentForkIndex === 0"
            class="p-1.5 rounded hover:bg-base-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            v-comfy-tooltip="$t('chat.previousFork')">
            <ChevronLeftIcon class="w-4 h-4 text-text-secondary" />
          </button>
          <button @click="$emit('switch-fork', 1)" :disabled="currentForkIndex === totalForks - 1"
            class="p-1.5 rounded hover:bg-primary-softest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            v-comfy-tooltip="$t('chat.nextFork')">
            <ChevronRightIcon class="w-4 h-4 text-text-secondary" />
          </button>
        </template>

        <!-- 编辑按钮 -->
        <button @click="startEdit" class="p-1.5 rounded hover:bg-base-soft transition-colors"
          v-comfy-tooltip="$t('chat.edit')">
          <PencilIcon class="w-4 h-4 text-text-secondary" />
        </button>

        <!-- 重试按钮 -->
        <button v-if="message.role === 'assistant'" @click="$emit('retry')"
          class="p-1.5 rounded hover:bg-base-soft transition-colors" v-comfy-tooltip="$t('chat.retry')">
          <ArrowPathIcon class="w-4 h-4 text-text-secondary" />
        </button>

        <!-- 复制按钮 -->
        <button @click="copyContent" class="p-1.5 rounded hover:bg-base-soft transition-colors"
          v-comfy-tooltip="$t('common.copy')">
          <ClipboardDocumentIcon class="w-4 h-4 text-text-secondary" />
        </button>

        <!-- 更多操作 -->
        <button @click="showMoreMenu" class="p-1.5 rounded hover:bg-primary-softest transition-colors"
          v-comfy-tooltip="$t('common.more')">
          <EllipsisVerticalIcon class="w-4 h-4 text-text-secondary" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ChatMessageNode } from '@comfytavern/types';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  UserIcon,
  CpuChipIcon,
  CommandLineIcon,
  ArrowsRightLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  EllipsisVerticalIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  DocumentIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  CodeBracketIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

// Props
interface Props {
  message: ChatMessageNode;
  currentForkIndex?: number;
  totalForks?: number;
}

const props = withDefaults(defineProps<Props>(), {
  currentForkIndex: 0,
  totalForks: 1
});

// Emits
const emit = defineEmits<{
  'switch-fork': [direction: number];
  'edit': [content: string];
  'retry': [];
  'delete': [];
  'toggle-enable': [];
  'view-attachment': [attachment: any];
}>();

// 响应式数据
const isEditing = ref(false);
const editedContent = ref('');
const editTextarea = ref<HTMLTextAreaElement>();

// 计算属性
const hasForks = computed(() => props.totalForks > 1);

const roleIcon = computed(() => {
  const iconMap: Record<string, any> = {
    'user': UserIcon,
    'assistant': CpuChipIcon,
    'system': CommandLineIcon
  };
  return iconMap[props.message.role] || UserIcon;
});

const roleLabel = computed(() => {
  const labelMap: Record<string, string> = {
    'user': t('chat.roles.user'),
    'assistant': t('chat.roles.assistant'),
    'system': t('chat.roles.system')
  };
  return labelMap[props.message.role] || props.message.role;
});

const renderedContent = computed(() => {
  // 渲染 Markdown 并清理 HTML
  const content = props.message.content || '';
  const rawHtml = marked(content);
  // marked 可能返回 Promise，但在这里我们只处理同步情况
  if (typeof rawHtml === 'string') {
    return DOMPurify.sanitize(rawHtml);
  }
  // 如果是 Promise（理论上不应该发生），返回空字符串
  return '';
});

// 方法
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return t('common.time.justNow');
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return t('common.time.minutesAgo', { n: minutes });
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return t('common.time.hoursAgo', { n: hours });
  }

  return date.toLocaleTimeString();
}

function startEdit() {
  editedContent.value = props.message.content || '';
  isEditing.value = true;
  nextTick(() => {
    editTextarea.value?.focus();
    editTextarea.value?.select();
  });
}

function saveEdit() {
  const newContent = editedContent.value.trim();
  if (newContent && newContent !== props.message.content) {
    emit('edit', newContent);
  }
  isEditing.value = false;
}

function cancelEdit() {
  isEditing.value = false;
}

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content || '');
    // TODO: 显示复制成功提示
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

function showMoreMenu() {
  // TODO: 实现更多操作菜单
  console.log('Show more menu');
}

function getAttachmentIcon(type: string) {
  const iconMap: Record<string, any> = {
    'image': PhotoIcon,
    'video': VideoCameraIcon,
    'audio': MusicalNoteIcon,
    'code': CodeBracketIcon,
    'document': DocumentIcon
  };
  return iconMap[type] || DocumentIcon;
}
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes blink {

  0%,
  50% {
    opacity: 1;
  }

  51%,
  100% {
    opacity: 0;
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

.animate-blink {
  animation: blink 1s infinite;
}

/* Prose 样式覆盖 */
.prose {
  color: inherit;
}

.prose :where(code):not(:where([class~="not-prose"] *)) {
  background-color: hsl(var(--ct-primary-hsl) / 0.1);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}

.prose :where(pre):not(:where([class~="not-prose"] *)) {
  background-color: hsl(var(--ct-background-surface-hsl));
  border: 1px solid hsl(var(--ct-border-base-hsl) / 0.3);
}

.prose-invert :where(code):not(:where([class~="not-prose"] *)) {
  background-color: rgba(255, 255, 255, 0.1);
}

.prose-invert :where(pre):not(:where([class~="not-prose"] *)) {
  background-color: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.1);
}
</style>