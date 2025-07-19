/**
 * @fileoverview 提供了插件与主应用交互的 API。
 * 这个服务在主应用初始化时被调用，将一个 API 实例附加到 window 对象上，
 * 以便外部插件脚本可以安全地与应用核心功能进行交互。
 */

// 这是一个简化的 API 实现，用于演示。
// 实际的实现会更加复杂，包含对 store 的操作、权限检查等。
class ExtensionApi {
  /**
   * 注册一个自定义的 Vue 组件来渲染特定类型的节点。
   * @param nodeType 节点的类型，例如 'core:Text'
   * @param _component 要用于渲染的 Vue 组件
   */
  registerNodeUI(nodeType: string, _component: any) {
    console.log(`[ExtensionApi] A plugin is trying to register a custom UI for node type: ${nodeType}`);
    // 实际逻辑：调用 nodeStore 的 action 来注册组件
    // import { useNodeStore } from '@/stores/nodeStore';
    // const nodeStore = useNodeStore();
    // nodeStore.registerCustomNodeUI(nodeType, component);
  }

  /**
   * 向指定的菜单添加一个项目。
   * @param targetMenu 目标菜单的标识符，例如 'main-menu' 或 'node-context-menu'
   * @param item 要添加的菜单项对象
   */
  addMenuItem(targetMenu: string, item: any) {
    console.log(`[ExtensionApi] A plugin is adding an item to menu: ${targetMenu}`, item);
    // 实际逻辑：调用 uiStore 或其他相关 store 的 action
  }

  /**
   * 监听应用内部的事件钩子。
   * @param event 钩子名称，例如 'workflow:before-execute'
   * @param _callback 事件触发时的回调函数
   */
  on(event: string, _callback: Function) {
    console.log(`[ExtensionApi] A plugin is subscribing to event: ${event}`);
    // 实际逻辑：使用 mitt 或自定义的事件总线服务
  }
}

/**
 * 初始化扩展 API，并将其附加到 window.ComfyTavern 对象上。
 */
export function initializeExtensionApi() {
  // 确保全局命名空间存在
  if (!(window as any).ComfyTavern) {
    (window as any).ComfyTavern = {};
  }
  
  (window as any).ComfyTavern.extensionApi = new ExtensionApi();
  console.log('[ExtensionApiService] Extension API initialized and attached to window.ComfyTavern.extensionApi');
}