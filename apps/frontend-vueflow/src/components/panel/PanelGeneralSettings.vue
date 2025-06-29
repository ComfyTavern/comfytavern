<template>
  <div class="p-6 overflow-y-auto h-full">
    <div class="flex flex-col h-full">
      <div>
        <h2 class="text-xl font-semibold text-text-base">面板通用设置</h2>
      </div>

      <div class="mt-6 border-t border-border-base/50">
        <!-- 咕咕：这里我们采用了和设置页类似的布局风格，左侧是说明，右侧是控件 -->
        <div v-if="props.panelDefinition" class="divide-y divide-border-base/50">
          <!-- 面板名称 -->
          <div class="py-5 flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
            <div class="md:w-1/3">
              <h4 class="font-medium text-text-base">面板名称</h4>
              <p class="text-sm text-text-secondary">在应用列表中显示的名称。</p>
            </div>
            <div class="flex-1">
              <input
                type="text"
                id="panel-display-name"
                v-model="props.panelDefinition.displayName"
                class="block w-full px-3 py-2 bg-background-input border border-border-base rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="例如：智能聊天助手"
              />
            </div>
          </div>

          <!-- 描述 -->
          <div class="py-5 flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
            <div class="md:w-1/3">
              <h4 class="font-medium text-text-base">描述</h4>
              <p class="text-sm text-text-secondary">向用户介绍这个面板的功能和用途。</p>
            </div>
            <div class="flex-1">
              <textarea
                id="panel-description"
                v-model="props.panelDefinition.description"
                rows="4"
                class="block w-full px-3 py-2 bg-background-input border border-border-base rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="一个简洁明了的介绍。"
              ></textarea>
            </div>
          </div>

          <!-- 版本 -->
          <div class="py-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
            <div class="md:w-1/3">
              <h4 class="font-medium text-text-base">版本</h4>
              <p class="text-sm text-text-secondary">
                面板的版本号，建议遵循
                <a
                  href="https://semver.org/lang/zh-CN/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                  >SemVer</a
                >
                规范。
              </p>
            </div>
            <div class="flex-1">
              <input
                type="text"
                id="panel-version"
                v-model="props.panelDefinition.version"
                class="block w-full px-3 py-2 bg-background-input border border-border-base rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="例如：1.0.0"
              />
            </div>
          </div>
          <!-- UI 入口文件 -->
          <div class="py-5 flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
            <div class="md:w-1/3">
              <h4 class="font-medium text-text-base">UI 入口文件</h4>
              <p class="text-sm text-text-secondary">
                指向面板 UI 的入口 HTML 文件，相对于面板所在目录。
              </p>
            </div>
            <div class="flex-1">
              <input
                type="text"
                id="panel-ui-entry-point"
                v-model="props.panelDefinition.uiEntryPoint"
                class="block w-full px-3 py-2 bg-background-input border border-border-base rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="例如：index.html"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PanelDefinition } from "@comfytavern/types";

const props = defineProps<{
  panelDefinition: PanelDefinition | null;
}>();

// 由于父组件期望直接修改 prop 对象的属性来触发 isDirty 计算，
// 这里我们直接在模板中使用 v-model="props.panelDefinition.fieldName"。
// 这是一种简化的实现方式，依赖于 JS 对象引用传递的特性。
// 正常情况下，更推荐的做法是在本地创建副本并通过 emit 更新。
</script>
