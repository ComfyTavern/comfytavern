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
    />
    <ButtonGroupInput
      v-else-if="itemConfig.type === 'button-group'"
      v-model="currentValue"
      :id="itemConfig.key"
      :options="itemConfig.options || []"
      class="w-full"
      size="large"
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
import ButtonGroupInput from '@/components/graph/inputs/ButtonGroupInput.vue'; // 新增导入

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
  async set(newValue) {
    const oldValue = settingsStore.getSetting(props.itemConfig.key, props.itemConfig.defaultValue);
    if (props.itemConfig.onSave) {
      try {
        const saveResult = await props.itemConfig.onSave(props.itemConfig.key, newValue, oldValue);
        // 根据 saveResult 的约定处理
        // 如果 onSave 返回 { success: false } 或直接的 false，则认为外部保存失败，可能不继续更新 settingsStore
        // 如果 onSave 成功处理了持久化，并且不需要 settingsStore 再存一份，它可以返回 false 来阻止 settingsStore 更新
        // 这里我们假设：如果 onSave 存在，它全权负责保存。如果它没抛异常且没返回明确的 false 或 {success: false}，
        // 我们仍然更新 settingsStore 作为一种UI状态的同步（除非 onSave 的契约另有规定）。
        // 对于 user.nickname，onSave 会更新 authStore，settingsStore 的更新将通过 watch authStore.currentUser.username 来完成。
        // 因此，如果 onSave 成功，我们可能不希望在这里直接更新 settingsStore，以避免冲突或重复。
        // 让我们约定：如果 onSave 存在并成功执行（未抛错，未返回 false 或 {success: false}），则它已处理保存。
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
  max-width: 320px; /* 限制一下最大宽度，避免在宽屏上过长 */
}
</style>