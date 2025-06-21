<template>
  <div class="llm-config-manager">
    <div class="flex h-full text-text-base">
      <!-- Sidebar -->
      <aside class="w-36 p-4 bg-background-base/15 rounded-l-lg border-r border-border-base">
        <nav>
          <ul>
            <li>
              <a @click="activeTab = 'channels'" :class="[
                'block p-2 rounded cursor-pointer transition-colors',
                {
                  'bg-primary text-primary-content': activeTab === 'channels',
                  'hover:bg-primary-softest': activeTab !== 'channels',
                },
              ]">
                API 渠道
              </a>
            </li>
            <li class="mt-2">
              <a @click="activeTab = 'models'" :class="[
                'block p-2 rounded cursor-pointer transition-colors',
                {
                  'bg-primary text-primary-content': activeTab === 'models',
                  'hover:bg-primary-softest': activeTab !== 'models',
                },
              ]">
                激活模型
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 p-6 bg-background-base/15 rounded-r-lg min-w-0">
        <div v-if="activeTab === 'channels'">
          <ApiChannelList />
        </div>
        <div v-if="activeTab === 'models'">
          <h2 class="text-2xl font-bold mb-4 text-text-base">激活模型管理</h2>
          <!-- Activated Model Management Component will go here -->
          <p>这里将是激活模型管理的组件。</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useLlmConfigStore } from "@/stores/llmConfigStore";
import ApiChannelList from "./ApiChannelList.vue";

type Tab = "channels" | "models";

const activeTab = ref<Tab>("channels");
const llmConfigStore = useLlmConfigStore();

onMounted(() => {
  llmConfigStore.fetchChannels();
  llmConfigStore.fetchModels();
});
</script>

<style scoped>
.llm-config-manager {
  /* The parent container in SettingsLayout will handle sizing */
  height: 100%;
  width: 100%;
}
</style>
