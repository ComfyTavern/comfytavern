<template>
  <div class="chat-input-area bg-background-base border-t border-border-base">
    <!-- 附件预览区 -->
    <div v-if="attachments.length > 0" class="px-4 pt-3 pb-2 border-b border-border-base/30">
      <div class="flex items-center gap-2 flex-wrap">
        <div v-for="(attachment, index) in attachments" :key="attachment.id"
          class="inline-flex items-center gap-1.5 px-2 py-1 bg-primary-softest rounded-lg">
          <component :is="getAttachmentIcon(attachment.type)" class="w-4 h-4 text-text-secondary" />
          <span class="text-sm text-text-base max-w-[150px] truncate">{{ attachment.name }}</span>
          <button @click="removeAttachment(index)" class="p-0.5 hover:bg-primary-soft rounded transition-colors"
            v-comfy-tooltip="$t('common.remove')">
            <XMarkIcon class="w-3 h-3 text-text-muted" />
          </button>
        </div>
      </div>
    </div>

    <!-- 输入提示区 -->
    <div v-if="isTyping" class="px-4 py-2 text-xs text-text-muted">
      <span class="inline-flex items-center gap-1">
        <span class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 0ms" />
        <span class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 150ms" />
        <span class="w-1 h-1 bg-current rounded-full animate-bounce" style="animation-delay: 300ms" />
        <span class="ml-1">{{ typingUser }} {{ $t('chat.isTyping') }}</span>
      </span>
    </div>

    <!-- 主输入区 -->
    <div class="p-4">
      <div class="flex gap-2 max-w-4xl mx-auto">
        <!-- 左侧工具栏 -->
        <div class="flex flex-col gap-1">
          <!-- 上传按钮 -->
          <button @click="showUploadMenu" class="p-2 rounded-lg hover:bg-base-soft transition-colors"
            v-comfy-tooltip="$t('chat.attachFile')">
            <PaperClipIcon class="w-5 h-5 text-text-secondary" />
          </button>

          <!-- 表情按钮 -->
          <button @click="showEmojiPicker" class="p-2 rounded-lg hover:bg-base-soft transition-colors"
            v-comfy-tooltip="$t('chat.insertEmoji')">
            <FaceSmileIcon class="w-5 h-5 text-text-secondary" />
          </button>

          <!-- 模板按钮 -->
          <button @click="showTemplates" class="p-2 rounded-lg hover:bg-primary-softest transition-colors"
            v-comfy-tooltip="$t('chat.insertTemplate')">
            <DocumentTextIcon class="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <!-- 文本输入区 -->
        <div class="flex-1 relative">
          <textarea ref="textareaRef" v-model="message" @input="handleInput" @keydown="handleKeyDown"
            @paste="handlePaste" :placeholder="placeholder" :disabled="disabled" :class="[
              'w-full px-4 py-3 pr-12',
              'bg-background-surface border border-border-base rounded-lg',
              'focus:outline-none focus:border-primary',
              'resize-none transition-all',
              'placeholder:text-text-muted',
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            ]" :style="{ height: textareaHeight }" />

          <!-- 字符计数 -->
          <div v-if="showCharCount" class="absolute bottom-2 right-2 text-xs text-text-muted">
            {{ message.length }} / {{ maxLength }}
          </div>

          <!-- Markdown 预览切换 -->
          <button v-if="enableMarkdown" @click="togglePreview"
            class="absolute top-2 right-2 p-1 rounded hover:bg-primary-softest transition-colors"
            v-comfy-tooltip="showPreview ? $t('chat.hidePreview') : $t('chat.showPreview')">
            <EyeIcon v-if="!showPreview" class="w-4 h-4 text-text-muted" />
            <EyeSlashIcon v-else class="w-4 h-4 text-text-muted" />
          </button>
        </div>

        <!-- 右侧操作区 -->
        <div class="flex flex-col justify-between">
          <!-- 发送按钮 -->
          <button @click="handleSend" :disabled="!canSend" :class="[
            'px-4 py-3 rounded-lg font-medium transition-all',
            canSend
              ? 'bg-primary hover:bg-primary/90 text-primary-content'
              : 'bg-primary-softest text-text-muted cursor-not-allowed'
          ]">
            <div class="flex items-center gap-2">
              <PaperAirplaneIcon class="w-5 h-5 -rotate-45" />
              <span>{{ sendButtonText }}</span>
            </div>
          </button>

          <!-- 快捷操作 -->
          <div class="flex gap-1 mt-2">
            <!-- 清空按钮 -->
            <button @click="clearInput" :disabled="!message"
              class="p-1.5 rounded hover:bg-primary-softest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              v-comfy-tooltip="$t('common.clear')">
              <XCircleIcon class="w-4 h-4 text-text-muted" />
            </button>

            <!-- 语音输入 -->
            <button v-if="enableVoiceInput" @click="toggleVoiceInput" :class="[
              'p-1.5 rounded transition-colors',
              isRecording
                ? 'bg-error/20 text-error animate-pulse'
                : 'hover:bg-primary-softest'
            ]" v-comfy-tooltip="isRecording ? $t('chat.stopRecording') : $t('chat.startRecording')">
              <MicrophoneIcon class="w-4 h-4" :class="isRecording ? '' : 'text-text-muted'" />
            </button>
          </div>
        </div>
      </div>

      <!-- Markdown 预览区 -->
      <div v-if="showPreview && message"
        class="mt-3 max-w-4xl mx-auto p-4 bg-background-surface border border-border-base rounded-lg">
        <div class="prose prose-sm max-w-none" v-html="renderedMarkdown" />
      </div>

      <!-- 快捷提示 -->
      <div class="mt-2 max-w-4xl mx-auto flex items-center justify-between text-xs text-text-muted">
        <div class="flex items-center gap-3">
          <span>{{ $t('chat.shortcuts.send') }}: Ctrl+Enter</span>
          <span>{{ $t('chat.shortcuts.newLine') }}: Shift+Enter</span>
          <span v-if="enableMarkdown">{{ $t('chat.shortcuts.preview') }}: Ctrl+P</span>
        </div>

        <div v-if="lastSentTime" class="flex items-center gap-1">
          <ClockIcon class="w-3 h-3" />
          <span>{{ $t('chat.lastSent') }}: {{ formatTime(lastSentTime) }}</span>
        </div>
      </div>
    </div>

    <!-- 上传菜单弹出层 -->
    <div v-if="showUploadMenuFlag" @click="showUploadMenuFlag = false"
      class="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/50">
      <div @click.stop class="bg-background-base border border-border-base rounded-lg shadow-lg p-4 space-y-2">
        <h3 class="text-sm font-semibold text-text-base mb-3">{{ $t('chat.uploadType') }}</h3>
        <button v-for="type in uploadTypes" :key="type.id" @click="handleUpload(type.id)"
          class="w-full flex items-center gap-3 px-3 py-2 hover:bg-primary-softest rounded-lg transition-colors">
          <component :is="type.icon" class="w-5 h-5 text-text-secondary" />
          <span class="text-sm text-text-base">{{ $t(type.label) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  PaperClipIcon,
  FaceSmileIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  XCircleIcon,
  MicrophoneIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon,
  PhotoIcon,
  DocumentIcon,
  CodeBracketIcon,
  LinkIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

// Props
interface Props {
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  showCharCount?: boolean;
  enableMarkdown?: boolean;
  enableVoiceInput?: boolean;
  minRows?: number;
  maxRows?: number;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  maxLength: 4096,
  showCharCount: true,
  enableMarkdown: true,
  enableVoiceInput: false,
  minRows: 2,
  maxRows: 10,
  isLoading: false
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string];
  'send': [message: string, attachments: any[]];
  'typing': [isTyping: boolean];
  'paste': [files: File[]];
}>();

// 响应式数据
const message = ref(props.modelValue);
const attachments = ref<any[]>([]);
const showPreview = ref(false);
const isRecording = ref(false);
const showUploadMenuFlag = ref(false);
const textareaRef = ref<HTMLTextAreaElement>();
const textareaHeight = ref('auto');
const isTyping = ref(false);
const typingUser = ref('');
const lastSentTime = ref<Date | null>(null);

// 上传类型配置
const uploadTypes = [
  { id: 'image', label: 'chat.upload.image', icon: PhotoIcon },
  { id: 'document', label: 'chat.upload.document', icon: DocumentIcon },
  { id: 'code', label: 'chat.upload.code', icon: CodeBracketIcon },
  { id: 'link', label: 'chat.upload.link', icon: LinkIcon }
];

// 计算属性
const canSend = computed(() => {
  return !props.disabled && !props.isLoading && (message.value.trim() || attachments.value.length > 0);
});

const sendButtonText = computed(() => {
  if (props.isLoading) return t('chat.sending');
  return t('chat.send');
});

const renderedMarkdown = computed(() => {
  if (!message.value) return '';
  const rawHtml = marked(message.value) as string;
  return DOMPurify.sanitize(rawHtml);
});

// 方法
function handleInput() {
  adjustTextareaHeight();
  emit('update:modelValue', message.value);

  // 触发输入状态
  if (!isTyping.value) {
    isTyping.value = true;
    emit('typing', true);

    // 3秒后自动取消输入状态
    setTimeout(() => {
      isTyping.value = false;
      emit('typing', false);
    }, 3000);
  }
}

function adjustTextareaHeight() {
  if (!textareaRef.value) return;

  textareaRef.value.style.height = 'auto';
  const scrollHeight = textareaRef.value.scrollHeight;
  const minHeight = props.minRows * 24;
  const maxHeight = props.maxRows * 24;

  const height = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
  textareaHeight.value = `${height}px`;
}

function handleKeyDown(event: KeyboardEvent) {
  // Ctrl/Cmd + Enter 发送
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    handleSend();
  }
  // Shift + Enter 换行（默认行为）
  else if (event.shiftKey && event.key === 'Enter') {
    // 默认行为
  }
  // Ctrl/Cmd + P 切换预览
  else if ((event.ctrlKey || event.metaKey) && event.key === 'p' && props.enableMarkdown) {
    event.preventDefault();
    togglePreview();
  }
  // Enter 发送（可选配置）
  else if (event.key === 'Enter' && !event.shiftKey) {
    // 如果配置为 Enter 直接发送
    // event.preventDefault();
    // handleSend();
  }
}

function handlePaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files || []);
  if (files.length > 0) {
    emit('paste', files);
    handleFiles(files);
  }
}

function handleSend() {
  if (!canSend.value) return;

  const messageToSend = message.value.trim();
  const attachmentsToSend = [...attachments.value];

  emit('send', messageToSend, attachmentsToSend);

  // 清空输入
  message.value = '';
  attachments.value = [];
  lastSentTime.value = new Date();

  // 重置高度
  nextTick(() => {
    adjustTextareaHeight();
  });
}

function clearInput() {
  message.value = '';
  attachments.value = [];
  adjustTextareaHeight();
}

function togglePreview() {
  showPreview.value = !showPreview.value;
}

function toggleVoiceInput() {
  isRecording.value = !isRecording.value;
  // TODO: 实现语音输入
}

function showUploadMenu() {
  showUploadMenuFlag.value = true;
}

function showEmojiPicker() {
  // TODO: 实现表情选择器
  console.log('Show emoji picker');
}

function showTemplates() {
  // TODO: 实现模板选择
  console.log('Show templates');
}

function handleUpload(type: string) {
  showUploadMenuFlag.value = false;

  // 创建文件选择器
  const input = document.createElement('input');
  input.type = 'file';

  // 根据类型设置接受的文件格式
  switch (type) {
    case 'image':
      input.accept = 'image/*';
      break;
    case 'document':
      input.accept = '.pdf,.doc,.docx,.txt,.md';
      break;
    case 'code':
      input.accept = '.js,.ts,.py,.java,.cpp,.c,.html,.css,.json';
      break;
  }

  input.onchange = (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    handleFiles(files);
  };

  input.click();
}

function handleFiles(files: File[]) {
  files.forEach(file => {
    attachments.value.push({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: getFileType(file),
      file: file
    });
  });
}

function getFileType(file: File): string {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.name.match(/\.(js|ts|py|java|cpp|c|html|css|json)$/i)) return 'code';
  return 'document';
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1);
}

function getAttachmentIcon(type: string) {
  const iconMap: Record<string, any> = {
    'image': PhotoIcon,
    'code': CodeBracketIcon,
    'document': DocumentIcon,
    'link': LinkIcon
  };
  return iconMap[type] || DocumentIcon;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  message.value = newValue;
  nextTick(() => {
    adjustTextareaHeight();
  });
});

// 初始化高度
nextTick(() => {
  adjustTextareaHeight();
});
</script>

<style scoped>
.chat-input-area {
  position: relative;
}

/* 自定义滚动条 */
textarea::-webkit-scrollbar {
  width: 6px;
}

textarea::-webkit-scrollbar-track {
  background: transparent;
}

textarea::-webkit-scrollbar-thumb {
  background-color: hsl(var(--ct-border-base-hsl) / 0.3);
  border-radius: 3px;
}

textarea::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--ct-border-base-hsl) / 0.5);
}
</style>