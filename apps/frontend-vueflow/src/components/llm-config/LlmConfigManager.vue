<template>
  <div class="llm-config-manager h-full w-full">
    <div class="flex h-full bg-background-base/15 rounded-lg">
      <!-- Channel List Container -->
      <div
        :class="[
          'transition-all duration-300 ease-in-out border-r border-border-base',
          isDetailPanelOpen ? 'w-1/3 min-w-[400px]' : 'w-full',
        ]"
      >
        <ChannelListWrapper
          :is-detail-open="isDetailPanelOpen"
          @create-channel="handleCreateChannel"
          @edit-channel="handleEditChannel"
          @show-detail="handleShowDetail"
          @selection-change="handleSelectionChange"
        />
      </div>

      <!-- Detail Panel -->
      <div v-if="isDetailPanelOpen" class="w-2/3 min-w-0 transition-all duration-300 ease-in-out">
        <ApiChannelDetailView
          :channel-id="selectedChannelId"
          @close="handleCloseDetail"
          @channel-saved="handleChannelSaved"
        />
      </div>
    </div>

    <!-- Edit Channel Modal (for quick edits) -->
    <div v-if="editingChannel" ref="editModalContainer">
      <!-- Modal will be rendered here by uiStore -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { ApiCredentialConfig } from "@comfytavern/types";
import { useLlmConfigStore } from "@/stores/llmConfigStore";
import { useUiStore } from "@/stores/uiStore";
import ChannelListWrapper from "./ChannelListWrapper.vue";
import ApiChannelDetailView from "./ApiChannelDetailView.vue";
import ApiChannelForm from "./ApiChannelForm.vue";
import type { ApiChannelFormData } from "./ApiChannelForm.vue";

// Store
const llmConfigStore = useLlmConfigStore();
const uiStore = useUiStore();

// State
const selectedChannelId = ref<string | null>(null);
const isDetailPanelOpen = ref(false);
const selectedChannels = ref<ApiCredentialConfig[]>([]);
const editingChannel = ref<ApiCredentialConfig | null>(null);
let activeEditModalId: string | null = null;

// Event Handlers
const handleCreateChannel = () => {
  // For new channels, open the detail panel with no channel ID
  selectedChannelId.value = null;
  isDetailPanelOpen.value = true;
};

const handleEditChannel = (channel: ApiCredentialConfig) => {
  // Open modal for quick edits
  editingChannel.value = channel;
  activeEditModalId = uiStore.openModal({
    component: ApiChannelForm,
    props: {
      initialData: channel,
      onSubmit: handleEditFormSubmit,
      onCancel: closeEditModal,
    },
    modalProps: {
      title: "编辑 API 渠道",
      width: "max-w-2xl",
      showCloseIcon: true,
    },
  });
};

const handleShowDetail = (channelId: string) => {
  selectedChannelId.value = channelId;
  isDetailPanelOpen.value = true;
};

const handleCloseDetail = () => {
  isDetailPanelOpen.value = false;
  selectedChannelId.value = null;
};

const handleSelectionChange = (channels: ApiCredentialConfig[]) => {
  selectedChannels.value = channels;
};

const handleChannelSaved = (channel: ApiCredentialConfig) => {
  // When a channel is saved in the detail panel, update the selected channel ID
  if (channel.id) {
    selectedChannelId.value = channel.id;
  }
  // Refresh the channel list to show the updated data
  llmConfigStore.fetchChannels();
};

// Modal handlers
const closeEditModal = () => {
  if (activeEditModalId) {
    uiStore.closeModal(activeEditModalId);
  }
  editingChannel.value = null;
  activeEditModalId = null;
};

const handleEditFormSubmit = async (formData: ApiChannelFormData) => {
  try {
    if (editingChannel.value && editingChannel.value.id) {
      // Update existing channel
      const dataToUpdate = { ...formData, id: editingChannel.value.id };
      await llmConfigStore.updateChannel(dataToUpdate as ApiCredentialConfig);

      // If the edited channel is currently shown in detail panel, refresh it
      if (selectedChannelId.value === editingChannel.value.id) {
        // The detail panel will automatically reload when we refresh the store
        await llmConfigStore.fetchChannels();
      }

      closeEditModal();
    }
  } catch (error) {
    // Error handling is done in the store
    console.error("编辑渠道失败:", error);
  }
};

// Initialize
onMounted(async () => {
  // Load initial data
  await Promise.all([
    llmConfigStore.fetchChannels(),
    llmConfigStore.fetchModels(),
    llmConfigStore.fetchProviders(),
  ]);
});
</script>

<style scoped>
.llm-config-manager {
  /* Ensure the container takes full available space */
  container-type: inline-size;
}

/* Responsive behavior for smaller screens */
@container (max-width: 768px) {
  .llm-config-manager .flex {
    flex-direction: column;
  }

  .llm-config-manager .w-1\/3,
  .llm-config-manager .w-2\/3 {
    width: 100% !important;
    min-width: 0 !important;
  }

  .llm-config-manager .border-r {
    border-right: none;
    border-bottom: 1px solid var(--border-base);
  }
}
</style>
