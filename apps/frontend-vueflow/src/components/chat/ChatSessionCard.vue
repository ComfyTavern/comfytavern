<template>
  <div @click="$emit('click')" @contextmenu.prevent="showContextMenu" :class="[
    'group relative p-3 rounded-lg cursor-pointer transition-all duration-200',
    isActive
      ? 'bg-primary/10 border border-primary/30'
      : 'hover:bg-primary-softest border border-transparent hover:border-border-base/30'
  ]">
    <!-- 会话内容 -->
    <div class="flex items-start gap-3">
      <!-- 会话图标 -->
      <div :class="[
        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
        isActive ? 'bg-primary/20 text-primary' : 'bg-primary-softest text-text-secondary'
      ]">
        <component :is="sessionIcon" class="w-5 h-5" />
      </div>

      <!-- 会话信息 -->
      <div class="flex-1 min-w-0">
        <!-- 标题行 -->
        <div class="flex items-start justify-between gap-2">
          <h3 :class="[
            'font-medium truncate transition-colors',
            isActive ? 'text-primary' : 'text-text-base'
          ]">
            {{ session.title || $t('chat.untitledSession') }}
          </h3>

          <!-- 时间戳 -->
          <span class="flex-shrink-0 text-xs text-text-muted">
            {{ formatTime(session.lastActivity) }}
          </span>
        </div>

        <!-- 描述/最后消息 -->
        <p class="mt-1 text-sm text-text-secondary line-clamp-2">
          {{ session.lastMessage || session.description || $t('chat.noMessages') }}
        </p>

        <!-- 元数据标签 -->
        <div class="mt-2 flex items-center gap-2">
          <!-- 消息计数 -->
          <span class="inline-flex items-center gap-1 text-xs text-text-muted">
            <ChatBubbleLeftIcon class="w-3 h-3" />
            {{ session.messageCount || 0 }}
          </span>

          <!-- 分支计数 -->
          <span v-if="session.branchCount > 1" class="inline-flex items-center gap-1 text-xs text-text-muted">
            <ArrowsRightLeftIcon class="w-3 h-3" />
            {{ session.branchCount }}
          </span>

          <!-- Token 使用量 -->
          <span v-if="session.tokenCount" class="inline-flex items-center gap-1 text-xs text-text-muted">
            <HashtagIcon class="w-3 h-3" />
            {{ formatTokenCount(session.tokenCount) }}
          </span>

          <!-- 标签 -->
          <div v-if="session.tags && session.tags.length > 0" class="flex gap-1">
            <span v-for="tag in session.tags.slice(0, 2)" :key="tag"
              class="px-1.5 py-0.5 text-xs bg-primary-softest text-text-secondary rounded">
              {{ tag }}
            </span>
            <span v-if="session.tags.length > 2"
              class="px-1.5 py-0.5 text-xs bg-primary-softest text-text-muted rounded">
              +{{ session.tags.length - 2 }}
            </span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
        <button @click="showMenu" class="p-1.5 rounded hover:bg-primary-soft transition-colors"
          v-comfy-tooltip="$t('common.more')">
          <EllipsisVerticalIcon class="w-4 h-4 text-text-secondary" />
        </button>
      </div>
    </div>

    <!-- 活跃指示器 -->
    <div v-if="isActive" class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r" />

    <!-- 未读标记 -->
    <div v-if="session.unreadCount && session.unreadCount > 0"
      class="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-content text-xs rounded-full flex items-center justify-center font-medium">
      {{ session.unreadCount > 9 ? '9+' : session.unreadCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ChatSession } from '@comfytavern/types';
import {
  ChatBubbleLeftRightIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  SparklesIcon,
  EllipsisVerticalIcon,
  ArrowsRightLeftIcon,
  HashtagIcon,
  DocumentTextIcon,
  CommandLineIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

// Props
interface Props {
  session: ChatSession;
  isActive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false
});

// Emits
const emit = defineEmits<{
  'click': [];
  'menu': [];
  'delete': [];
  'rename': [];
  'export': [];
}>();

// 计算属性
const sessionIcon = computed(() => {
  // 根据会话类型或角色返回不同图标
  const type = props.session.type || 'chat';
  const iconMap: Record<string, any> = {
    'chat': ChatBubbleLeftRightIcon,
    'roleplay': UserIcon,
    'creative': SparklesIcon,
    'document': DocumentTextIcon,
    'code': CommandLineIcon
  };
  return iconMap[type] || ChatBubbleLeftRightIcon;
});

// 方法
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('common.time.justNow');
  if (minutes < 60) return t('common.time.minutesAgo', { n: minutes });
  if (hours < 24) return t('common.time.hoursAgo', { n: hours });
  if (days < 7) return t('common.time.daysAgo', { n: days });

  return date.toLocaleDateString();
}

function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function showMenu() {
  emit('menu');
}

function showContextMenu(_event: MouseEvent) {
  // 显示右键菜单
  emit('menu');
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>