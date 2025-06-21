<template>
  <div class="setting-control">
    <!-- 根据 type 渲染不同控件，并绑定 v-model -->
    <StringInput
      v-if="itemConfig.type === 'string'"
      v-model="currentValue"
      :id="itemConfig.key"
      class="w-full"
      size="large"
    />
    <TextAreaInput
      v-else-if="itemConfig.type === 'textarea'"
      v-model="currentValue"
      :id="itemConfig.key"
      class="w-full"
      size="large"
    />
    <NumberInput
      v-else-if="itemConfig.type === 'number'"
      v-model="currentValue"
      :id="itemConfig.key"
      :min="itemConfig.min"
      :max="itemConfig.max"
      :step="itemConfig.step"
      class="w-full"
      size="large"
    />
    <BooleanToggle
      v-else-if="itemConfig.type === 'boolean'"
      v-model="currentValue"
      :id="itemConfig.key"
      size="large"
    />
    <SelectInput
      v-else-if="itemConfig.type === 'select'"
      v-model="currentValue"
      :id="itemConfig.key"
      :suggestions="itemConfig.options || []"
      class="w-full"
      size="large"
      :apply-canvas-scale="false"
    />
    <ButtonGroupInput
      v-else-if="itemConfig.type === 'button-group'"
      v-model="currentValue"
      :id="itemConfig.key"
      :options="itemConfig.options || []"
      class="w-full"
      size="large"
    />
    <!-- 咕咕：添加 action-button 类型处理 -->
    <ButtonInput
      v-else-if="itemConfig.type === 'action-button'"
      :label="itemConfig.buttonText || t('settings.actions.default_action_button_text')"
      :disabled="itemConfig.disabled"
      @click="itemConfig.onClick ? itemConfig.onClick() : () => {}"
      class="w-full"
    />
    <p v-else>咕？未知的控件类型: {{ itemConfig.type }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SettingItemConfig } from '@/types/settings';
import { useSettingsStore } from '@/stores/settingsStore';
import { useI18n } from 'vue-i18n'; // + 咕咕：添加 useI18n 导入

// 导入 graph/inputs 下的真实组件
import StringInput from '@/components/graph/inputs/StringInput.vue';
import TextAreaInput from '@/components/graph/inputs/TextAreaInput.vue';
import NumberInput from '@/components/graph/inputs/NumberInput.vue';
import BooleanToggle from '@/components/graph/inputs/BooleanToggle.vue';
import SelectInput from '@/components/graph/inputs/SelectInput.vue';
import ButtonGroupInput from '@/components/graph/inputs/ButtonGroupInput.vue'; // 新增导入
import ButtonInput from '@/components/graph/inputs/ButtonInput.vue'; // + 咕咕：添加 ButtonInput 导入

const props = defineProps<{
  itemConfig: SettingItemConfig;
}>();

const { t } = useI18n(); // + 咕咕：添加 i18n
const settingsStore = useSettingsStore();
// TODO: 处理 itemConfig.storeName，支持绑定到不同的 store

// **核心：计算属性实现 v-model 与 store 的双向绑定**
const currentValue = computed({
  get() {
    // 从 store 读取，如果 store 里没有，则使用配置的默认值
    return settingsStore.getSetting(props.itemConfig.key, props.itemConfig.defaultValue);
  },
  async set(newValue) {
    const oldValue = settingsStore.getSetting(props.itemConfig.key, props.itemConfig.defaultValue);
    if (props.itemConfig.onSave) {
      try {
        const saveResult = await props.itemConfig.onSave(props.itemConfig.key, newValue, oldValue);
        if (typeof saveResult === 'boolean' && !saveResult) {
          console.debug(`[SettingControl] onSave for ${props.itemConfig.key} returned false, skipping settingsStore update.`);
          return; // 外部保存逻辑指示不要更新 settingsStore
        }
        if (typeof saveResult === 'object' && saveResult !== null && 'success' in saveResult && !saveResult.success) {
          console.debug(`[SettingControl] onSave for ${props.itemConfig.key} indicated failure, skipping settingsStore update.`);
          // 可以在这里触发一个通知，显示 saveResult.message
          return; // 外部保存逻辑指示失败
        }
        // 如果 onSave 成功，并且我们还想让 settingsStore 也存一份（比如作为回退或通用配置），则取消下面这行注释。
        // 但对于 user.nickname，其权威值在 authStore，settingsStore 的同步应由监听 authStore 变化来完成。
        // settingsStore.updateSetting(props.itemConfig.key, newValue);
      } catch (error) {
        console.error(`[SettingControl] Error during onSave for ${props.itemConfig.key}:`, error);
        // 保存失败，不更新 store，并可能需要通知用户
        return;
      }
    } else {
      // 没有 onSave，正常更新 settingsStore
      settingsStore.updateSetting(props.itemConfig.key, newValue);
    }
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
  /* 移除固定的 max-width，让控件能够适应容器宽度 */
  /* max-width: 320px; */
}
</style>