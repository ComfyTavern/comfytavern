<template>
  <div class="chat-sidebar flex flex-col h-full bg-background-surface border-r border-border-base">
    <!-- 顶部操作栏 -->
    <div class="flex items-center justify-between p-4 border-b border-border-base">
      <h2 class="text-lg font-semibold text-text-base">{{ $t('chat.sidebar.sessions') }}</h2>
      <div class="flex gap-2">
        <button @click="$emit('create-session')"
          class="p-2 rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity"
          v-comfy-tooltip="$t('chat.newSession')">
          <PlusIcon class="w-5 h-5" />
        </button>
        <button @click="$emit('import-session')"
          class="p-2 rounded-lg bg-background-base hover:bg-primary-softest transition-colors"
          v-comfy-tooltip="$t('chat.importSession')">
          <ArrowUpTrayIcon class="w-5 h-5 text-text-secondary" />
        </button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="p-4 border-b border-border-base/30">
      <div class="relative">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
        <input v-model="searchQuery" type="text" :placeholder="$t('chat.searchSessions')"
          class="w-full pl-10 pr-4 py-2 bg-background-base border border-border-base rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-text-muted"
          @input="handleSearch" />
      </div>
    </div>

    <!-- 会话分组切换 -->
    <div v-if="showGroupTabs" class="flex gap-1 p-2 border-b border-border-base/30">
      <button v-for="group in sessionGroups" :key="group.id" @click="activeGroup = group.id" :class="[
        'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        activeGroup === group.id
          ? 'bg-primary text-primary-content'
          : 'text-text-secondary hover:bg-primary-softest'
      ]">
        {{ $t(group.label) }}
        <span class="ml-1 text-xs opacity-70">({{ group.count }})</span>
      </button>
    </div>

    <!-- 会话列表 -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="isLoading" class="flex items-center justify-center p-8">
        <div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>

      <div v-else-if="filteredSessions.length === 0" class="p-8 text-center">
        <ChatBubbleLeftRightIcon class="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
        <p class="text-text-secondary">{{ $t('chat.noSessions') }}</p>
      </div>

      <div v-else class="p-2 space-y-1">
        <ChatSessionCard v-for="session in paginatedSessions" :key="session.id" :session="session"
          :is-active="activeSessionId === session.id" @click="$emit('select-session', session.id)"
          @menu="showSessionMenu(session)" @delete="handleDeleteSession(session)" @rename="handleRenameSession(session)"
          @export="handleExportSession(session)" />
      </div>

      <!-- 加载更多按钮 -->
      <div v-if="hasMore" class="p-4">
        <button @click="loadMore"
          class="w-full py-2 text-sm text-text-secondary hover:text-text-base bg-primary-softest hover:bg-primary-soft rounded-lg transition-colors">
          {{ $t('common.loadMore') }}
        </button>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="p-3 border-t border-border-base bg-background-surface/50">
      <div class="flex items-center justify-between text-xs text-text-muted">
        <span>{{ $t('chat.sessionCount', { count: totalSessions }) }}</span>
        <button @click="$emit('show-settings')" class="p-1 hover:bg-primary-softest rounded transition-colors"
          v-comfy-tooltip="$t('common.settings')">
          <Cog6ToothIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ChatSession } from '@comfytavern/types';
import ChatSessionCard from './ChatSessionCard.vue';
import {
  PlusIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon
} from '@heroicons/vue/24/outline';

// Props
interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading?: boolean;
  showGroupTabs?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  showGroupTabs: false
});

// Emits
const emit = defineEmits<{
  'create-session': [];
  'import-session': [];
  'select-session': [sessionId: string];
  'delete-session': [session: ChatSession];
  'rename-session': [session: ChatSession, newName: string];
  'export-session': [session: ChatSession, format: string];
  'show-settings': [];
  'search': [query: string];
}>();

// 响应式数据
const searchQuery = ref('');
const activeGroup = ref('all');
const pageSize = 20;
const currentPage = ref(1);

// 会话分组
const sessionGroups = computed(() => [
  { id: 'all', label: 'chat.groups.all', count: props.sessions.length },
  { id: 'recent', label: 'chat.groups.recent', count: recentSessions.value.length },
  { id: 'starred', label: 'chat.groups.starred', count: starredSessions.value.length }
]);

// 计算属性
const filteredSessions = computed(() => {
  let sessions = [...props.sessions];

  // 按分组过滤
  if (activeGroup.value === 'recent') {
    sessions = recentSessions.value;
  } else if (activeGroup.value === 'starred') {
    sessions = starredSessions.value;
  }

  // 按搜索词过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    sessions = sessions.filter(session =>
      session.title?.toLowerCase().includes(query) ||
      session.description?.toLowerCase().includes(query) ||
      session.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }

  return sessions;
});

const recentSessions = computed(() => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return props.sessions.filter(s => new Date(s.lastActivity) > oneWeekAgo);
});

const starredSessions = computed(() => {
  return props.sessions.filter(s => s.metadata?.starred);
});

const paginatedSessions = computed(() => {
  const start = 0;
  const end = currentPage.value * pageSize;
  return filteredSessions.value.slice(start, end);
});

const hasMore = computed(() => {
  return paginatedSessions.value.length < filteredSessions.value.length;
});

const totalSessions = computed(() => props.sessions.length);

// 方法
function handleSearch() {
  emit('search', searchQuery.value);
  currentPage.value = 1; // 重置分页
}

function loadMore() {
  currentPage.value++;
}

function showSessionMenu(session: ChatSession) {
  // 显示会话右键菜单
  console.log('Show menu for session:', session);
}

function handleDeleteSession(session: ChatSession) {
  emit('delete-session', session);
}

function handleRenameSession(session: ChatSession) {
  // 弹出重命名对话框
  const newName = prompt('请输入新名称:', session.title);
  if (newName && newName !== session.title) {
    emit('rename-session', session, newName);
  }
}

function handleExportSession(session: ChatSession) {
  emit('export-session', session, 'json');
}

// 监听搜索词变化，重置分页
watch(searchQuery, () => {
  currentPage.value = 1;
});

// 监听分组变化，重置分页
watch(activeGroup, () => {
  currentPage.value = 1;
});
</script>

<style scoped>
.chat-sidebar {
  width: 100%;
  min-width: 280px;
  max-width: 380px;
}

/* 自定义滚动条 */
.chat-sidebar ::-webkit-scrollbar {
  width: 6px;
}

.chat-sidebar ::-webkit-scrollbar-track {
  background: transparent;
}

.chat-sidebar ::-webkit-scrollbar-thumb {
  background-color: hsl(var(--ct-border-base-hsl) / 0.3);
  border-radius: 3px;
}

.chat-sidebar ::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--ct-border-base-hsl) / 0.5);
}
</style>