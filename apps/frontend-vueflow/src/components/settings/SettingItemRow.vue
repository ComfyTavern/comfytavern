<template>
  <div class="setting-item-row" :class="[{ 'avatar-row': itemConfig.type === 'avatar' }, { 'is-compact': isCompact }]">
    <div class="label-area">
      <label :for="itemConfig.key" class="item-label">{{ itemConfig.label }}</label>
      <p v-if="itemConfig.description" class="item-description">{{ itemConfig.description }}</p>
    </div>

    <!-- Avatar Control -->
    <div v-if="itemConfig.type === 'avatar'" class="control-area avatar-control-area">
      <button class="btn btn-secondary btn-sm" @click="handleUploadAvatar">
        {{ t('settings.avatar.edit') }}
      </button>
      <img
        :src="displayedAvatarUrl"
        :alt="t('settings.avatar.preview_alt')"
        class="avatar-preview"
        @error="onAvatarError"
      />
    </div>

    <!-- Default Control -->
    <div v-else class="control-area">
      <SettingControl :item-config="itemConfig" />
    </div>
    <!--
    <div class="action-area">
      <button @click="resetToDefault" v-comfy-tooltip="'恢复默认值'">
        <Icon name="rotate-2" />
      </button>
    </div>
    -->
  </div>

  <!-- Avatar Editor Modal -->
  <AvatarEditorModal
    :is-visible="isAvatarEditorVisible"
    :current-avatar-url="currentUser?.avatarUrl"
    @close="isAvatarEditorVisible = false"
    @save-avatar="handleSaveAvatar"
  />
</template>

<script setup lang="ts">
// import { computed } from 'vue'; // 移除未使用的导入
import type { SettingItemConfig } from '@/types/settings';
import SettingControl from './SettingControl.vue';
import { useAuthStore } from '@/stores/authStore';
import { storeToRefs } from 'pinia';
import { computed, ref, onMounted, inject } from 'vue'; // + 导入 onMounted
import AvatarEditorModal from '@/components/modals/AvatarEditorModal.vue';
import { IsSettingsCompactKey } from '@/constants/injectionKeys';
import { uploadAvatar as apiUploadAvatar } from '@/api/userProfileApi';
import { getBackendBaseUrl } from '@/utils/urlUtils';
import { useI18n } from 'vue-i18n';
// import { useUiStore } from '@/stores/uiStore';

// eslint-disable-next-line no-unused-vars
const props = defineProps<{
  itemConfig: SettingItemConfig;
}>();

// eslint-disable-next-line @typescript-eslint/no-unused-expressions, no-unused-expressions
props.itemConfig; // 确保 props 被 TypeScript 插件认为是读取过的

const { t } = useI18n();
const authStore = useAuthStore();
const isCompact = inject(IsSettingsCompactKey, ref(false));
const { currentUser } = storeToRefs(authStore);
// console.log('[SettingItemRow] Initial currentUser from store (at setup):', JSON.parse(JSON.stringify(currentUser.value)));

const defaultAvatarPath = '/img/default-avatar.png'; // 前端静态默认头像

const displayedAvatarUrl = computed(() => {
  const userAvatar = currentUser.value?.avatarUrl;
  // console.log('[SettingItemRow] displayedAvatarUrl computed: currentUser.avatarUrl is:', userAvatar);
  if (userAvatar) {
    if (userAvatar.startsWith('http://') || userAvatar.startsWith('https://') || userAvatar.startsWith('data:')) {
      // console.log('[SettingItemRow] displayedAvatarUrl: Returning full or data URI:', userAvatar);
      return userAvatar;
    }
    const backendBase = getBackendBaseUrl();
    const fullUrl = `${backendBase}${userAvatar}`;
    // console.log('[SettingItemRow] displayedAvatarUrl: Constructed full URL from relative path:', fullUrl);
    return fullUrl;
  }
  // console.log('[SettingItemRow] displayedAvatarUrl: Falling back to default frontend path:', defaultAvatarPath);
  return defaultAvatarPath;
});

onMounted(() => {
  // console.log('[SettingItemRow] onMounted: currentUser from store:', JSON.parse(JSON.stringify(currentUser.value)));
  // console.log('[SettingItemRow] onMounted: displayedAvatarUrl value is:', displayedAvatarUrl.value);
});

const onAvatarError = (event: Event) => {
  const imgElement = event.target as HTMLImageElement;
  // 如果当前 src 已经是前端的默认头像路径，并且加载失败，则不再尝试，以避免循环
  // 同时也处理一种情况：如果 displayedAvatarUrl 计算出的后端完整路径也加载失败，
  // 那么第一次 @error 会尝试加载 defaultAvatarPath。如果 defaultAvatarPath 也失败，则进入这里的 else。
  // 检查当前 src 是否已经是默认头像路径，或者是否包含它（考虑到可能的查询参数等，虽然这里不太可能）
  // 使用 endsWith 更精确，假设 defaultAvatarPath 是固定的相对路径
  // 检查 imgElement.src 是否已经是最终的 defaultAvatarPath
  // 注意：imgElement.src 会是完整的 URL，例如 http://localhost:5573/img/default-avatar.png
  if (imgElement.src !== `${window.location.origin}${defaultAvatarPath}`) {
    imgElement.src = defaultAvatarPath; // 尝试加载前端默认头像
  } else {
    // 如果前端默认头像也加载失败
    console.warn(`前端默认头像 (${defaultAvatarPath}) 也加载失败。`);
    // 可以在这里做进一步处理，比如显示一个破损的图片图标或者CSS占位符
    // imgElement.style.visibility = 'hidden'; // 例如
  }
};

const handleUploadAvatar = () => {
  isAvatarEditorVisible.value = true; // 打开模态框
};

const isAvatarEditorVisible = ref(false);
// const uiStore = useUiStore(); // (可选)

const handleSaveAvatar = async (payload: { file?: File }) => {
  if (!payload.file) {
    // uiStore.showToast({ type: 'error', message: '没有提供头像文件。'});
    console.error('没有提供头像文件。');
    return;
  }

  try {
    // uiStore.showLoading('正在上传头像...');
    const response = await apiUploadAvatar(payload.file);
    if (response.success && response.avatarUrl) {
      await authStore.fetchUserContext(); // 修正：使用 fetchUserContext
      // uiStore.showToast({ type: 'success', message: '头像上传成功！'});
      // console.log('[SettingItemRow] 头像上传成功，用户上下文已刷新。新的 avatarUrl (相对):', response.avatarUrl);
      // console.log('[SettingItemRow] displayedAvatarUrl 计算结果应为:', displayedAvatarUrl.value);
      isAvatarEditorVisible.value = false;
    } else {
      // uiStore.showToast({ type: 'error', message: response.message || '头像上传失败。'});
      console.error('头像上传失败:', response.message);
    }
  } catch (error: any) {
    // uiStore.showToast({ type: 'error', message: error.message || '上传头像时发生错误。'});
    console.error('上传头像时发生错误:', error);
  } finally {
    // uiStore.hideLoading();
  }
};


// const settingsStore = useSettingsStore();
// const resetToDefault = () => {
//   settingsStore.updateSetting(props.itemConfig.key, props.itemConfig.defaultValue);
// };
</script>

<style scoped>
.setting-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px; /* 默认垂直内边距增加一些 */
}

.setting-item-row.avatar-row {
  padding-top: 16px; /* 头像行上下padding大一些 */
  padding-bottom: 16px;
  align-items: flex-start; /* 头像行内容垂直顶部对齐 */
}

.label-area {
  flex: 2; /* 占据2/3的空间 */
  padding-right: 24px;
  min-width: 0; /* 允许文本截断 */
}
.setting-item-row.avatar-row .label-area {
  padding-top: 4px; /* 微调头像行标签的垂直位置，使其与头像预览大致对齐 */
}


.item-label {
  font-size: 1rem;
  font-weight: 500;
  color: var(--ct-text-base);
}

.item-description {
  font-size: 0.875rem;
  color: var(--ct-text-muted);
  margin-top: 6px;
}

.control-area {
  flex: 1; /* 占据1/3的空间 */
  flex-shrink: 0;
  min-width: 220px; /* 设置合理的最小宽度，确保控件不会过小 */
  max-width: 400px; /* 设置最大宽度，避免在超宽屏幕上过度拉伸 */
  display: flex;
  justify-content: flex-end;
  align-items: center; /* 默认控件垂直居中 */
}

/* 响应式设计：在较小屏幕上调整布局 */
.setting-item-row.is-compact {
  flex-direction: column;
  align-items: stretch;
  padding: 8px;
}

.setting-item-row.is-compact.avatar-row {
  flex-direction: row; /* 头像行保持水平布局 */
  align-items: flex-start;
}

.setting-item-row.is-compact .label-area {
  flex: none;
  padding-right: 0;
  padding-bottom: 12px;
}

.setting-item-row.is-compact.avatar-row .label-area {
  flex: 2;
  padding-right: 16px;
  padding-bottom: 0;
}

.setting-item-row.is-compact .control-area {
  flex: none;
  min-width: auto;
  max-width: none;
  justify-content: stretch;
}

.setting-item-row.is-compact.avatar-row .control-area {
  flex: 1;
}

.avatar-control-area {
  display: flex;
  align-items: center;
  gap: 16px; /* 头像和按钮之间的间距 */
}

.avatar-preview {
  width: 80px; /* 预览尺寸 */
  height: 80px;
  border-radius: 50%; /* 圆形 */
  /* border-radius: 0.5rem; */ /* 圆角矩形 */
  object-fit: cover; /* 保证图片不变形 */
  background-color: var(--ct-background-surface); /* 图片加载前的背景色 */
  border: 2px solid var(--ct-border-base); /* 使用标准主题变量 */
}

/* 自定义 .btn, .btn-secondary, .btn-sm 样式已移除，依赖全局 Tailwind/DaisyUI */

</style>