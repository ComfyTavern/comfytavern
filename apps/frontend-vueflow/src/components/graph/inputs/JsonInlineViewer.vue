<template>
  <div class="key-value-editor-pro">
    <div v-if="!hasItems && !editableItems.length" class="empty-state">
      点击下方按钮添加键值对
    </div>
    <div class="kv-list-scroll-container" @wheel.stop.passive>
      <div v-for="(item, index) in editableItems" :key="item.id" class="kv-pair">
        <input
          type="text"
          :value="item.key"
          @change="updateKey(index, ($event.target as HTMLInputElement).value)"
          @blur="handleKeyBlur(index, ($event.target as HTMLInputElement).value)"
          class="key-input"
          placeholder="键"
          :aria-label="`Key for item ${index + 1}`"
        />
        <span class="separator">:</span>
        <input
          type="text"
          :value="stringifyValue(item.value)"
          @blur="handleValueBlur(index, ($event.target as HTMLInputElement).value)"
          class="value-input"
          placeholder="值"
          :aria-label="`Value for item ${index + 1}`"
        />
       <button @click="removeItem(index)" class="remove-button" v-comfy-tooltip="'移除此项'">&times;</button>
     </div>
   </div>
   <button @click="addItem" class="add-button" v-comfy-tooltip="'添加新的键值对'">+ 添加键值对</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, type PropType } from 'vue';
import type { InputDefinition } from '@comfytavern/types'; // 保留以备将来使用或类型提示

interface EditableItem {
  id: string; // 用于 v-for 的唯一 key
  key: string;
  value: any;
}

const props = defineProps({
  modelValue: {
    type: [Object, String] as PropType<Record<string, any> | string>,
    required: true,
  },
  nodeId: { type: String, default: '' },
  inputKey: { type: String, default: '' },
  inputDefinition: { type: Object as PropType<InputDefinition>, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue', 'blur']);

const editableItems = ref<EditableItem[]>([]);

const convertEditableItemsToObject = (items: EditableItem[]): Record<string, any> => {
  return items.reduce((acc, item) => {
    if (item.key.trim() !== '') {
      acc[item.key] = item.value;
    }
    return acc;
  }, {} as Record<string, any>);
};

const parseModelValueToEditableItems = (value: Record<string, any> | string): EditableItem[] => {
  let obj: Record<string, any> = {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        obj = parsed;
      }
    } catch (e) { /* console.warn('[JsonInlineViewer] 无法解析 modelValue 字符串:', value, e); */ }
  } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    obj = { ...value };
  }
  return Object.entries(obj).map(([k, v], index) => ({
    id: `item-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`,
    key: k,
    value: v,
  }));
};

watch(
  () => props.modelValue,
  (newValue) => {
    const currentInternalObject = convertEditableItemsToObject(editableItems.value);
    let newObjectRepresentation;
    if (typeof newValue === 'string') {
      try { newObjectRepresentation = JSON.parse(newValue); } catch { newObjectRepresentation = {}; }
    } else {
      newObjectRepresentation = JSON.parse(JSON.stringify(newValue || {}));
    }
    if (JSON.stringify(currentInternalObject) !== JSON.stringify(newObjectRepresentation)) {
      editableItems.value = parseModelValueToEditableItems(newValue);
    }
  },
  { immediate: true, deep: true }
);

const hasItems = computed(() => {
  // 检查转换后的对象是否有键，而不是 editableItems 数组的长度，因为空键的项不会被转换
  return Object.keys(convertEditableItemsToObject(editableItems.value)).length > 0;
});

const stringifyValue = (val: any): string => {
  if (typeof val === 'string') return val;
  if (val === null) return 'null';
  if (typeof val === 'object' || typeof val === 'boolean' || typeof val === 'number') {
    try { return JSON.stringify(val); } catch { return '[无法序列化的对象]'; }
  }
  return String(val);
};

const parseInputValue = (strVal: string): any => {
  const trimmed = strVal.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  const num = Number(trimmed);
  if (!isNaN(num) && String(num) === trimmed && trimmed !== '') return num;
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { return JSON.parse(trimmed); } catch (e) { /* 解析失败则保持为字符串 */ }
  }
  return strVal;
};

const emitUpdate = () => {
  const newObject = convertEditableItemsToObject(editableItems.value);
  emit('update:modelValue', newObject); // 用于 v-model 更新

  // 发出 blur 事件，供 BaseNode 等父组件记录历史
  // BaseNode 的 handleComponentBlur 期望接收一个字符串作为事件的 payload
  try {
    const newObjectString = JSON.stringify(newObject);
    emit('blur', newObjectString);
  } catch (e) {
    console.warn('[JsonInlineViewer] 无法序列化对象以发出 blur 事件:', newObject, e);
    // 发送一个空对象字符串或错误指示符作为回退
    emit('blur', '{}');
  }
};

const updateKey = (index: number, newKey: string) => {
  if (editableItems.value[index]) {
    editableItems.value[index].key = newKey;
  }
};

const handleKeyBlur = (index: number, finalKey: string) => {
  if (editableItems.value[index]) {
    editableItems.value[index].key = finalKey.trim();
    emitUpdate();
  }
};

const handleValueBlur = (index: number, finalValueString: string) => {
  if (editableItems.value[index]) {
    editableItems.value[index].value = parseInputValue(finalValueString);
    emitUpdate();
  }
};

const addItem = () => {
  let newKeyBase = 'newKey';
  let newKeySuffix = 1;
  let potentialKey = `${newKeyBase}${newKeySuffix}`;
  const existingKeys = new Set(editableItems.value.map(item => item.key));
  while (existingKeys.has(potentialKey)) {
    newKeySuffix++;
    potentialKey = `${newKeyBase}${newKeySuffix}`;
  }
  editableItems.value.push({
    id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    key: potentialKey,
    value: '',
  });
  emitUpdate();
};

const removeItem = (index: number) => {
  editableItems.value.splice(index, 1);
  emitUpdate();
};

</script>

<style scoped>
.key-value-editor-pro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 1px solid hsl(var(--ct-border-base-hsl) / 1);
  border-radius: 4px;
  background-color: hsl(var(--ct-background-surface-hsl) / 1);
  font-size: 0.9em;
}

.kv-list-scroll-container {
  flex-grow: 1;
  max-height: 160px;
  overflow-y: auto;
  padding-right: 5px;
  margin-right: -5px;
  display: flex;
  flex-direction: column;
  gap: 8px; /* 保持 kv-pair 之间的间距 */
}

.kv-list-scroll-container .kv-pair:last-child {
   /* margin-bottom: 0; */ /* 如果gap已足够，则不需要 */
}

.kv-pair {
  display: flex;
  align-items: center;
  gap: 6px;
}

.key-input,
.value-input {
  flex-grow: 1;
  padding: 4px 6px;
  border: 1px solid hsl(var(--ct-border-base-hsl) / 1);
  border-radius: 3px;
  background-color: hsl(var(--ct-background-base-hsl) / 1);
  color: hsl(var(--ct-text-base-hsl) / 1);
  font-size: 0.95em;
  line-height: 1.4;
  min-width: 0;
  height: 28px;
}

.key-input {
  flex-basis: 35%;
}

.value-input {
  flex-basis: 55%;
}

.key-input:focus,
.value-input:focus {
  outline: none;
  border-color: hsl(var(--ct-accent-hsl) / 1);
  box-shadow: 0 0 0 1px hsl(var(--ct-accent-hsl) / 1);
}

.separator {
  color: hsl(var(--ct-text-muted-hsl) / 1);
  font-weight: 500;
}

.remove-button {
  flex-shrink: 0;
  padding: 2px 6px;
  background-color: transparent;
  border: none;
  color: hsl(var(--ct-error-hsl) / 1);
  cursor: pointer;
  font-size: 1.2em;
  line-height: 1;
  border-radius: 3px;
}
.remove-button:hover {
  background-color: hsl(var(--ct-error-hsl) / 0.15);
}

.add-button {
  padding: 0px 8px;
  width: 100%;
  height: 22px;
  background-color: hsl(var(--ct-border-base-hsl) / 1); /* 使用基础边框的颜色作为浅色背景 (类似 gray-200) */
  border: 1px solid hsl(var(--ct-border-base-hsl) / 1); /* 边框与背景一致或略深，这里用一致 */
  color: hsl(var(--ct-text-secondary-hsl) / 1);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
  margin-top: 4px;
  flex-shrink: 0;
  text-align: center;
}
.add-button:hover {
  background-color: hsl(var(--ct-secondary-hsl) / 0.3); /* 使用次要颜色配合透明度作为 hover 背景 */
}

.empty-state {
  color: hsl(var(--ct-text-muted-hsl) / 1);
  font-style: italic;
  text-align: center;
  padding: 8px 0;
}
</style>