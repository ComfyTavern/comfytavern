<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { ApiAdapter, CreateApiAdapterPayload } from '@comfytavern/types';
import { useProjectStore } from '@/stores/projectStore';
import { klona } from 'klona';
import { fileManagerApiClient } from '@/api/fileManagerApi'; // 导入文件管理器API

// 定义简化的工作流信息类型
interface WorkflowInfo {
  id: string;
  name: string;
}

interface Props {
  modelValue: boolean; // 控制模态框显示
  adapter?: ApiAdapter | null; // 正在编辑的适配器，如果为null则为创建模式
}

const props = withDefaults(defineProps<Props>(), {
  adapter: null,
});

const emit = defineEmits(['update:modelValue', 'save']);

const projectStore = useProjectStore();

const workflows = ref<WorkflowInfo[]>([]); // 更改类型为 WorkflowInfo[]
const form = ref<CreateApiAdapterPayload | ApiAdapter>(createEmptyForm());

const isCreateMode = computed(() => !props.adapter);
const title = computed(() => isCreateMode.value ? '创建新适配器' : '编辑适配器');

// 创建一个空的表单对象
function createEmptyForm(): CreateApiAdapterPayload {
  return {
    name: '',
    description: '',
    adapterType: 'openai:chat_v1',
    targetWorkflowId: '',
    requestMapping: {
      // 默认提供一个示例映射
      prompt: { sourcePath: 'messages' }
    },
  };
}

// 动态添加一个新的映射规则
function addMappingRule() {
  form.value.requestMapping['new_key'] = { sourcePath: '' };
}

// 删除一个映射规则
function removeMappingRule(key: string) {
  delete form.value.requestMapping[key];
}

// 当模态框打开时，根据模式初始化表单
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    // 加载项目下的所有工作流，用于选择目标工作流
    if (projectStore.currentProjectId) {
      const workflowDir = `user://projects/${projectStore.currentProjectId}/workflows/`;
      try {
        const items = await fileManagerApiClient.listDir(workflowDir, { ensureExists: true });
        const workflowFiles = items.filter(item => item.itemType === 'file' && item.name.endsWith('.json'));

        workflows.value = await Promise.all(
          workflowFiles.map(async (file) => {
            const content = await fileManagerApiClient.readFile(file.logicalPath);
            const workflowData = typeof content === 'string' ? JSON.parse(content) : content;
            // 假设工作流文件内容中包含 name 字段
            return {
              id: file.name.replace('.json', ''), // 文件名作为ID
              name: workflowData.name || file.name.replace('.json', ''), // 使用工作流内部名称或文件名
            };
          })
        );
      } catch (error) {
        console.error('加载工作流列表失败:', error);
        workflows.value = [];
      }
    } else {
      workflows.value = [];
    }
    
    if (isCreateMode.value) {
      form.value = createEmptyForm();
    } else {
      // 使用 klona 进行深拷贝，避免直接修改 prop
      form.value = klona(props.adapter!);
    }
  }
});

function handleClose() {
  emit('update:modelValue', false);
}

function handleSave() {
  // TODO: 添加更完整的表单验证
  emit('save', form.value);
  handleClose();
}
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="w-full max-w-2xl p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800 max-h-[90vh] flex flex-col">
      <h2 class="text-xl font-bold mb-4">{{ title }}</h2>
      
      <div class="flex-grow overflow-y-auto pr-2 space-y-4">
        <!-- 基础信息 -->
        <div>
          <label class="block mb-1 font-semibold">名称</label>
          <input v-model="form.name" type="text" placeholder="例如：我的聊天机器人API" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
        </div>
        <div>
          <label class="block mb-1 font-semibold">描述 (可选)</label>
          <textarea v-model="form.description" rows="2" placeholder="适配器功能描述" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"></textarea>
        </div>
        <div>
          <label class="block mb-1 font-semibold">适配器类型</label>
          <input v-model="form.adapterType" type="text" placeholder="例如：openai:chat_v1" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
        </div>
        <div>
          <label class="block mb-1 font-semibold">目标工作流</label>
          <select v-model="form.targetWorkflowId" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
            <option disabled value="">请选择一个工作流</option>
            <option v-for="wf in workflows" :key="wf.id" :value="wf.id">{{ wf.name }} ({{ wf.id }})</option>
          </select>
        </div>

        <!-- 请求映射规则 -->
        <div class="pt-4">
          <h3 class="text-lg font-bold mb-2">请求映射规则</h3>
          <div class="space-y-2">
            <div v-for="(rule, key) in form.requestMapping" :key="key" class="flex items-center gap-2 p-2 bg-gray-100 rounded dark:bg-gray-700">
              <input :value="key" @change="e => { form.requestMapping[(e.target as HTMLInputElement).value] = rule; delete form.requestMapping[key] }" placeholder="目标槽位ID" class="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 w-1/3">
              <span class="text-gray-500">←</span>
              <input v-model="rule.sourcePath" placeholder="来源路径 (例如: messages)" class="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 flex-grow">
              <button @click="removeMappingRule(key)" class="p-1 text-red-500 hover:text-red-700">&times;</button>
            </div>
          </div>
          <button @click="addMappingRule" class="mt-2 text-sm text-blue-600 hover:underline">
            + 添加映射规则
          </button>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end pt-4 mt-4 border-t dark:border-gray-700">
        <button @click="handleClose" class="px-4 py-2 mr-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500">
          取消
        </button>
        <button @click="handleSave" class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
          保存
        </button>
      </div>
    </div>
  </div>
</template>