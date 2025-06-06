<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">对话框和通知演示</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 对话框部分 -->
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">对话框</h2>
        
        <div class="space-y-4">
          <div>
            <button 
              @click="showMessageDialog"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示消息对话框
            </button>
          </div>
          
          <div>
            <button 
              @click="showConfirmDialog"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示确认对话框
            </button>
          </div>
          
          <div>
            <button 
              @click="showDangerConfirmDialog"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示危险操作确认对话框
            </button>
          </div>
          
          <div>
            <button 
              @click="showAutoCloseDialog"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示自动关闭对话框
            </button>
          </div>
        </div>
      </div>
      
      <!-- 通知部分 -->
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">通知</h2>
        
        <div class="space-y-4">
          <div>
            <button 
              @click="showInfoToast"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示信息通知
            </button>
          </div>
          
          <div>
            <button 
              @click="showSuccessToast"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示成功通知
            </button>
          </div>
          
          <div>
            <button 
              @click="showWarningToast"
              class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示警告通知
            </button>
          </div>
          
          <div>
            <button 
              @click="showErrorToast"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示错误通知
            </button>
          </div>
          
          <div>
            <button 
              @click="showCustomToast"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示自定义通知
            </button>
          </div>
          
          <div>
            <button 
              @click="showMultipleToasts"
              class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              显示多个通知
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 结果显示区域 -->
    <div class="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">操作结果</h2>
      <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
        <pre class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ result }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDialogService } from '../../services/DialogService';

// 获取对话服务实例
const dialogService = useDialogService();

// 结果显示
const result = ref('');

// 显示消息对话框
const showMessageDialog = async () => {
  try {
    await dialogService.showMessage({
      title: '消息提示',
      message: '这是一个简单的消息对话框，只有一个确定按钮。',
    });
    result.value = '用户点击了确定按钮';
  } catch (error) {
    result.value = `发生错误: ${error}`;
  }
};

// 显示确认对话框
const showConfirmDialog = async () => {
  try {
    const confirmed = await dialogService.showConfirm({
      title: '确认操作',
      message: '您确定要执行此操作吗？',
      confirmText: '确定',
      cancelText: '取消',
    });
    result.value = confirmed ? '用户确认了操作' : '用户取消了操作';
  } catch (error) {
    result.value = `发生错误: ${error}`;
  }
};

// 显示危险操作确认对话框
const showDangerConfirmDialog = async () => {
  try {
    const confirmed = await dialogService.showConfirm({
      title: '危险操作',
      message: '此操作不可逆，确定要继续吗？',
      confirmText: '删除',
      cancelText: '取消',
      dangerConfirm: true,
    });
    result.value = confirmed ? '用户确认了危险操作' : '用户取消了危险操作';
  } catch (error) {
    result.value = `发生错误: ${error}`;
  }
};

// 显示自动关闭对话框
const showAutoCloseDialog = async () => {
  try {
    await dialogService.showMessage({
      title: '自动关闭',
      message: '此对话框将在3秒后自动关闭',
      autoClose: 3000,
    });
    result.value = '对话框已自动关闭';
  } catch (error) {
    result.value = `发生错误: ${error}`;
  }
};

// 显示信息通知
const showInfoToast = () => {
  dialogService.showInfo('这是一条信息通知', '信息');
  result.value = '显示了信息通知';
};

// 显示成功通知
const showSuccessToast = () => {
  dialogService.showSuccess('操作已成功完成', '成功');
  result.value = '显示了成功通知';
};

// 显示警告通知
const showWarningToast = () => {
  dialogService.showWarning('请注意此操作的风险', '警告');
  result.value = '显示了警告通知';
};

// 显示错误通知
const showErrorToast = () => {
  dialogService.showError('操作失败，请重试', '错误');
  result.value = '显示了错误通知';
};

// 显示自定义通知
const showCustomToast = () => {
  dialogService.showToast({
    title: '自定义通知',
    message: '这是一个位于底部中央的通知',
    type: 'info',
    duration: 5000,
    position: 'bottom-center',
  });
  result.value = '显示了自定义通知';
};

// 显示多个通知
const showMultipleToasts = () => {
  dialogService.showInfo('第一条通知', '信息');
  dialogService.showSuccess('第二条通知', '成功');
  dialogService.showWarning('第三条通知', '警告');
  dialogService.showError('第四条通知', '错误');
  dialogService.showInfo('第五条通知', '信息');
  dialogService.showSuccess('第六条通知', '成功'); // 这条可能会替换最早的通知
  
  result.value = '显示了多个通知';
};
</script>