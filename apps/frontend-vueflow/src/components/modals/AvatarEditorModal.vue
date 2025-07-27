<template>
  <div class="flex flex-col h-full">
    <div class="p-6 flex-grow overflow-y-auto">
      <div class="avatar-editor-content">
        <div class="upload-section">
          <p class="section-title">上传本地图片</p>
          <input type="file" ref="fileInputRef" @change="handleFileChange" accept="image/*" style="display: none;" />
          <button class="px-4 py-2 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50" @click="triggerFileInput">选择文件</button>
          <p v-if="fileName" class="file-name-display">已选择: {{ fileName }}</p>
        </div>

        <div class="url-section">
          <p class="section-title">使用网络链接</p>
          <input type="url" v-model="imageUrl" placeholder="粘贴图片 URL" class="input-field" />
          <button class="ml-2 px-3 py-1.5 text-xs font-medium text-primary bg-primary-soft rounded-md hover:bg-primary-soft/80" @click="loadUrlForPreview" :disabled="!imageUrl">预览URL</button>
        </div>

        <div v-if="previewSrc" class="preview-section">
          <p class="section-title">预览</p>
          <img :src="previewSrc" alt="头像预览" class="avatar-preview-modal" />
        </div>
        <p v-if="errorMsg" class="error-message">{{ errorMsg }}</p>
      </div>
    </div>

    <div class="flex justify-end space-x-3 p-4 bg-background-surface border-t border-border-base">
      <button
        type="button"
        @click="closeModal"
        class="px-4 py-2 text-sm font-medium text-text-secondary bg-background-surface border border-border-base rounded-md hover:bg-neutral-softest transition-colors"
      >
        取消
      </button>
      <button
        @click="saveAvatar"
        :disabled="!selectedFile && !finalImageUrl"
        class="px-4 py-2 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
  currentAvatarUrl?: string;
  onSave: (payload: { file: File }) => void;
  onClose?: () => void;
}>();

const emit = defineEmits(['close-modal']);

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const fileName = ref<string>('');
const imageUrl = ref<string>(''); // 用于网络链接输入
const previewSrc = ref<string | null>(null); // 用于预览图片
const errorMsg = ref<string>('');
const finalImageUrl = ref<string|null>(null); // 用于存储从URL加载并确认的图片

onMounted(() => {
  // 当模态框显示时，重置状态
  selectedFile.value = null;
  fileName.value = '';
  imageUrl.value = props.currentAvatarUrl?.startsWith('http') ? props.currentAvatarUrl : '';
  previewSrc.value = props.currentAvatarUrl || null;
  errorMsg.value = '';
  finalImageUrl.value = props.currentAvatarUrl?.startsWith('http') ? props.currentAvatarUrl : null;
});

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    if (!file.type.startsWith('image/')) {
      errorMsg.value = '请选择图片文件。';
      selectedFile.value = null;
      fileName.value = '';
      previewSrc.value = props.currentAvatarUrl || null; // 重置回当前头像或无
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        errorMsg.value = '图片大小不能超过 5MB。';
        selectedFile.value = null;
        fileName.value = '';
        previewSrc.value = props.currentAvatarUrl || null;
        return;
    }
    selectedFile.value = file;
    fileName.value = file.name;
    imageUrl.value = ''; // 清除 URL 输入
    finalImageUrl.value = null;
    errorMsg.value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      previewSrc.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const loadUrlForPreview = async () => {
  if (!imageUrl.value) {
    errorMsg.value = '请输入图片 URL。';
    return;
  }
  try {
    // 简单的URL验证，可以更复杂
    new URL(imageUrl.value);
    // 尝试加载图片以确认是有效图片URL (可选，但推荐)
    // 为了简单起见，这里直接用作预览源
    previewSrc.value = imageUrl.value;
    selectedFile.value = null; // 清除文件选择
    fileName.value = '';
    finalImageUrl.value = imageUrl.value; // 确认这个URL用于保存
    errorMsg.value = '';
  } catch (e) {
    errorMsg.value = '无效的图片 URL。';
    previewSrc.value = props.currentAvatarUrl || null;
    finalImageUrl.value = null;
  }
};


const closeModal = () => {
  props.onClose?.();
  emit('close-modal');
};

const saveAvatar = async () => {
  errorMsg.value = '';
  if (selectedFile.value) {
    console.log('[AvatarEditorModal] Attempting to save local file:', {
      name: selectedFile.value.name,
      type: selectedFile.value.type,
      size: selectedFile.value.size,
    });
    props.onSave({ file: selectedFile.value });
  } else if (finalImageUrl.value) {
    // 如果是网络URL，前端获取并转为File对象再上传
    try {
      const response = await fetch(finalImageUrl.value);
      if (!response.ok) throw new Error(`获取图片失败: ${response.statusText}`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        throw new Error('链接指向的不是有效的图片类型。');
      }
       if (blob.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('网络图片大小不能超过 5MB。');
      }
      // 从URL中提取文件名或生成一个
      const baseUrl = finalImageUrl.value || ''; // 确保 baseUrl 是字符串
      let filenamePart = baseUrl.substring(baseUrl.lastIndexOf('/') + 1);
      // 移除查询参数等 (确保 filenamePart 在此之后是 string)
      filenamePart = (filenamePart.split('?')[0] || '').split('#')[0] || '';


      const typeParts = blob.type?.split('/');
      const extension = (typeParts && typeParts.length > 1 && typeParts[1]) ? typeParts[1].toLowerCase() : 'png';
      
      const finalName = filenamePart || `avatar.${extension}`;

      const file = new File([blob], finalName, { type: blob.type });
      console.log('[AvatarEditorModal] Attempting to save network file (converted to File object):', {
        name: file.name, // 使用 finalName
        type: file.type,
        size: file.size,
      });
      props.onSave({ file });
    } catch (e: any) {
      console.error("处理网络图片URL失败:", e);
      errorMsg.value = `处理网络图片失败: ${e.message}`;
    }
  } else {
    errorMsg.value = '请选择一个文件或提供一个有效的图片URL。';
  }
};

</script>

<style scoped>
.avatar-editor-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px;
}

.section-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: var(--ct-text-muted);
}

.upload-section, .url-section, .preview-section {
  padding: 10px;
  border: 1px solid var(--ct-border-base); /* 使用标准主题变量 */
  border-radius: 8px;
  background-color: var(--ct-background-surface); /* 使用标准主题变量 */
}

.input-field {
  width: calc(100% - 90px); /* 减去按钮宽度和间距 */
  padding: 8px 12px;
  border: 1px solid var(--ct-border-base); /* 使用标准主题变量 */
  border-radius: 4px;
  background-color: var(--ct-background-base); /* 使用标准主题变量 */
  color: var(--ct-text-base); /* 使用标准主题变量 */
}
.input-field:focus {
  outline: none;
  border-color: var(--ct-primary); /* 使用标准主题变量 */
  box-shadow: 0 0 0 2px hsla(var(--ct-primary-hsl), 0.2); /* 使用 HSL 变量和透明度 */
}


.file-name-display {
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--ct-text-muted);
}

.avatar-preview-modal {
  max-width: 100%;
  max-height: 250px;
  width: auto;
  height: auto;
  display: block;
  margin: 10px auto;
  border-radius: 8px;
  border: 2px solid var(--ct-border-base); /* 使用标准主题变量 */
  object-fit: contain;
}

.error-message {
  color: var(--ct-error); /* 使用标准主题变量 */
  font-size: 0.875rem;
  margin-top: 10px;
  text-align: center;
}

/* 按钮样式现在完全依赖于模板中的 Tailwind CSS 类。 */
</style>