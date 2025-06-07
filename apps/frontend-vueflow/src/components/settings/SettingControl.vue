<template>
  <div class="setting-control">
    <!-- 根据 type 渲染不同控件，并绑定 v-model -->
    <StringInput
      v-if="itemConfig.type === 'string'"
      v-model="currentValue"
      :id="itemConfig.key"
      class="w-full"
    />
    <TextAreaInput
      v-else-if="itemConfig.type === 'textarea'"
      v-model="currentValue"
      :id="itemConfig.key"
      class="w-full"
    />
    <NumberInput
      v-else-if="itemConfig.type === 'number'"
      v-model="currentValue"
      :id="itemConfig.key"
      :min="itemConfig.min"
      :max="itemConfig.max"
      :step="itemConfig.step"
      class="w-full"
    />
    <BooleanToggle
      v-else-if="itemConfig.type === 'boolean'"
      v-model="currentValue"
      :id="itemConfig.key"
    />
    <SelectInput
      v-else-if="itemConfig.type === 'select'"
      v-model="currentValue"
      :id="itemConfig.key"
      :suggestions="itemConfig.options || []"
      class="w-full"
    />
    <p v-else>咕？未知的控件类型: {{ itemConfig.type }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SettingItemConfig } from '@/types/settings';
import { useSettingsStore } from '@/stores/settingsStore';

// 导入 graph/inputs 下的真实组件
import StringInput from '@/components/graph/inputs/StringInput.vue';
import TextAreaInput from '@/components/graph/inputs/TextAreaInput.vue';
import NumberInput from '@/components/graph/inputs/NumberInput.vue';
import BooleanToggle from '@/components/graph/inputs/BooleanToggle.vue';
import SelectInput from '@/components/graph/inputs/SelectInput.vue';

const props = defineProps<{
  itemConfig: SettingItemConfig;
}>();

const settingsStore = useSettingsStore();
// TODO: 处理 itemConfig.storeName，支持绑定到不同的 store

// **核心：计算属性实现 v-model 与 store 的双向绑定**
const currentValue = computed({
  get() {
    // 从 store 读取，如果 store 里没有，则使用配置的默认值
    return settingsStore.getSetting(props.itemConfig.key, props.itemConfig.defaultValue);
  },
  set(newValue) {
    // 写入 store，store 内部处理持久化
    settingsStore.updateSetting(props.itemConfig.key, newValue);
  },
});
</script>

<style scoped>
.setting-control {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

/* 确保输入控件有合适的样式 */
.w-full {
  width: 100%;
  max-width: 320px; /* 限制一下最大宽度，避免在宽屏上过长 */
}
</style>