<template>
  <div class="p-8 flex flex-col h-full">
    <div class="flex items-center justify-between flex-wrap gap-x-4 flex-shrink-0 mb-4">
      <div class="flex items-baseline gap-x-4">
        <h1 class="text-2xl font-bold text-text-base">面板配置</h1>
        <p class="text-text-secondary">{{ panelId }}</p>
      </div>
      <!-- 操作按钮区域 -->
      <div class="flex items-center gap-x-3">
        <button @click="goBack"
          class="px-4 py-2 font-medium border border-border-base/50 text-text-base bg-background-surface rounded-md hover:bg-primary/30 transition-colors">
          返回
        </button>
        <button @click="saveChanges" :disabled="panelStore.isSavingDefinition || !isDirty"
          class="px-4 py-2 font-medium text-primary-content bg-primary rounded-md hover:bg-primary/70 disabled:opacity-50 disabled:cursor-not-allowed disabled:border flex items-center">
          <IconSpinner v-if="panelStore.isSavingDefinition" class="w-5 h-5 animate-spin mr-2" />
          <span>保存更改</span>
        </button>
      </div>
    </div>

    <!-- 胶囊标签页导航 -->
    <nav class="flex-shrink-0 mb-4">
      <ul class="flex items-center gap-x-2">
        <li v-for="tab in tabs" :key="tab.id">
          <button
            @click="activeTabId = tab.id"
            :class="[
              'px-4 py-2 text-sm font-semibold rounded-full transition-colors focus:outline-none',
              activeTabId === tab.id
                ? 'bg-primary text-primary-content'
                : 'bg-background-surface text-text-secondary hover:bg-primary/30 hover:text-text-base',
            ]"
          >
            {{ tab.label }}
          </button>
        </li>
      </ul>
    </nav>

    <!-- 主体内容区 -->
    <div class="flex-grow min-h-0 rounded-2xl border border-border-base/50 overflow-hidden">
      <div v-if="isLoading" class="p-6 text-center">正在加载...</div>
      <div v-else-if="!panelDef" class="p-6 text-center text-error">无法加载面板定义。</div>
      <component
        v-else
        :is="activeTabComponent"
        :project-id="projectId"
        :panel-id="panelId"
        :panel-definition="panelDef"
        :initial-bindings="panelDef.workflowBindings || []"
        @update:bindings="handleBindingsUpdate"
        class="h-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted, markRaw } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePanelStore } from '@/stores/panelStore';
import type { PanelDefinition, PanelWorkflowBinding } from '@comfytavern/types';
import { klona } from 'klona';
import IconSpinner from '@/components/icons/IconSpinner.vue';

// 咕咕：为了简单起见，暂时在组件内定义。后续可以提取到单独的文件或i18n中。
const tabs = ref([
  {
    id: "general",
    label: "面板设置",
    component: markRaw(defineAsyncComponent(() => import("@/components/panel/PanelGeneralSettings.vue"))),
  },
  {
    id: "workflows",
    label: "工作流绑定",
    component: markRaw(defineAsyncComponent(() => import("@/components/panel/PanelWorkflowBinder.vue"))),
  },
  {
    id: "content",
    label: "内容管理",
    component: markRaw(defineAsyncComponent(() => import("@/components/panel/PanelContentManager.vue"))),
  },
]);

const route = useRoute();
const router = useRouter();
const panelStore = usePanelStore();

const projectId = computed(() => route.params.projectId as string);
const panelId = computed(() => route.params.panelId as string);

const activeTabId = ref("general");

const isLoading = ref(true);
const panelDef = ref<PanelDefinition | null>(null);
const originalPanelDef = ref<PanelDefinition | null>(null);

const isDirty = computed(() => {
  if (!panelDef.value || !originalPanelDef.value) {
    return false;
  }
  // 使用 JSON 字符串比较来检查对象是否发生变化，这是一种简单且无依赖的方法。
  return JSON.stringify(panelDef.value) !== JSON.stringify(originalPanelDef.value);
});


const activeTabComponent = computed(() => {
  const activeTab = tabs.value.find((tab) => tab.id === activeTabId.value);
  // 直接返回异步组件定义，Vue的<component>可以处理它
  return activeTab ? activeTab.component : null;
});

const handleBindingsUpdate = (newBindings: PanelWorkflowBinding[]) => {
  if (panelDef.value) {
    panelDef.value.workflowBindings = newBindings;
  }
};

const saveChanges = async () => {
  if (!panelDef.value || !isDirty.value) return;
  await panelStore.savePanelDefinition(projectId.value, panelDef.value);
  // 保存后重新同步原始状态
  originalPanelDef.value = klona(panelDef.value);
};

const goBack = () => {
  router.back();
};

onMounted(async () => {
  isLoading.value = true;
  const data = await panelStore.fetchPanelDefinition(projectId.value, panelId.value);
  panelDef.value = data;
  originalPanelDef.value = klona(data); // 存储原始副本用于比较
  isLoading.value = false;
});
</script>
