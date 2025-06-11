# ComfyTavern 客户端脚本指南

本指南将帮助你理解和创建 ComfyTavern 中的客户端脚本。客户端脚本允许节点在用户浏览器中执行逻辑，主要用于**操控前端界面元素、实现复杂的 UI 交互，以及在工作流正式提交执行前运行预处理逻辑**。

## 1. 什么是客户端脚本？

*   **定义**：在前端（浏览器）环境中运行的 JavaScript 代码片段，与特定节点关联，用于增强节点的交互性和在特定时机执行前端逻辑。
*   **核心目的**：
    *   **前端界面操控与交互**：
        *   实现节点 UI 元素的动态行为（例如，根据输入改变显示、响应自定义按钮点击）。
        *   创建更丰富、更具响应性的用户界面交互，而无需与后端通信。
    *   **工作流预执行逻辑**：
        *   在用户点击“运行”工作流按钮后，但在工作流数据实际发送到后端执行之前，执行一些前端的预处理步骤。
        *   例如：基于当前前端状态动态修改节点输入、进行前端验证、准备执行上下文等。
        *   这通常通过客户端脚本暴露的特定钩子（如 `onWorkflowExecute`）实现，并由前端的工作流执行管理器 ([`apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts)) 在适当的时机调用。
*   **与后端执行的关系**：客户端脚本主要处理前端的交互和预处理逻辑。节点的最终核心计算和数据处理通常仍在后端 `execute` 方法中完成，但客户端脚本可以在此之前影响节点的输入或状态。

## 2. 客户端脚本如何工作？

*   **核心流程图 (Mermaid)**：
    ```mermaid
    graph TD
        A[后端节点定义<br>(NodeDefinition)] -- 包含 clientScriptUrl --> B{前端加载器<br>(useNodeClientScript)};
        B -- 1. 读取 namespace, type, clientScriptUrl --> B;
        B -- 2. 构建请求 URL<br>(e.g., /api/nodes/core/MyNode/client-script/script.js) --> C[后端 API 路由<br>([`apps/backend/src/routes/nodeRoutes.ts`](apps/backend/src/routes/nodeRoutes.ts))];
        C -- 3. 提供脚本文件内容 --> B;
        B -- 4. 动态 import() 执行脚本 --> D[客户端脚本模块<br>(e.g., MyNodeScript.js)];
        D -- 5. 调用 setupClientNode() --> E{脚本 API 实例<br>(clientScriptApi)};
        
        subgraph 工作流执行前 (前端)
            F[用户点击“运行”工作流] --> G([`useWorkflowExecution.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts)::executeWorkflow);
            G -- 遍历所有节点 --> H{有 onWorkflowExecute 钩子?};
            H -- 是 --> I[调用 clientScriptApi.onWorkflowExecute()<br>传入 workflowContext (nodes, edges)];
            I -- context.updateInputValue() --> J[更新 VueFlow Store 中的节点数据];
            G -- 所有钩子执行完毕后<br>从 Store 获取最新节点数据 --> K[扁平化工作流];
            K --> L[发送到后端执行];
        end

        subgraph 节点 UI 交互
            M[节点组件 UI<br>(BaseNode.vue)] -- 用户交互 (如按钮点击) --> B;
            B -- 调用 clientScriptApi.onButtonClick() --> E;
            B -- 或调用 executeClientHook() --> E;
            E -- context.updateInputValue() --> J;
        end
    ```
*   **后端配置与服务**：
    *   在节点定义 (`NodeDefinition`) 中使用 `clientScriptUrl` 字段指定脚本路径。
        *   路径是相对于节点定义文件本身的。
        *   示例：`clientScriptUrl: "client-scripts/MyNodeScript.js"`
    *   后端通过特定 API 路由 (定义在 [`apps/backend/src/routes/nodeRoutes.ts`](apps/backend/src/routes/nodeRoutes.ts)) 提供这些脚本文件。
        *   路由通常格式为：`GET /api/nodes/:namespace/:type/client-script/:scriptFileName`
*   **前端加载**：
    *   [`apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts`](apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts) composable 负责处理。
    *   它会从当前节点的定义中读取 `namespace`, `type`, 和 `clientScriptUrl`。
    *   然后根据这些信息构建一个指向后端 API 的完整 URL 来请求脚本文件。
    *   通过 `import(/* @vite-ignore */ fullScriptUrl)` 异步加载并执行返回的 JavaScript 代码。
*   **脚本初始化**：
    *   客户端脚本必须导出一个名为 `setupClientNode` 的函数。
    *   此函数在脚本加载并成功执行后被调用。

## 3. 编写客户端脚本

*   **`setupClientNode` 函数**：
    *   **签名**：`function setupClientNode(vueFlow, node, context)`
    *   **参数详解**：
        *   `vueFlow`: (当前为 `null`) VueFlow 实例或相关 API，未来可能用于更高级的画布交互。
        *   `node`: 当前节点的 props 对象，包含节点的 ID, 类型, 数据 (data), 位置 (position) 等。
            *   `node.id`: 节点的唯一 ID。
            *   `node.data`: 节点的持久化数据，包括输入值。
            *   `node.type`: 节点的类型。
            *   `node.namespace`: 节点的命名空间。
        *   `context`: 一个包含与前端交互方法的对象：
            *   `updateInputValue(inputKey: string, value: any): void`: 更新当前节点指定输入字段的值。这会触发 VueFlow 的响应式更新，并将更改反映在 Store 中。
            *   `getNodeInputValue(inputKey: string): any`: 获取当前节点指定输入字段的当前值（从 Store 中读取）。
            *   `setNodeOutputValue(outputKey: string, value: any): void`: (目前主要用于日志) 理论上用于设置节点的输出值。
            *   `ref`: Vue 的 `ref` 函数，用于创建响应式变量。
            *   `watch`: Vue 的 `watch` 函数，用于监听响应式数据的变化。
    *   **返回值**：可以返回一个对象，该对象的方法可以被节点组件或其他前端部分调用。这些方法构成了该客户端脚本的 API。

*   **常用 API 和钩子**：
    *   `onButtonClick(buttonName: string): void`:
        *   当节点上的按钮输入被点击时，如果客户端脚本 API 中定义了此方法，则会被调用。
        *   `buttonName` 参数是该按钮输入字段的 `key`。
        *   主要用于处理纯前端的按钮交互逻辑。
    *   `onWorkflowExecute(context: { nodeId: string, workflowContext: { nodes: VueFlowNode[], edges: VueFlowEdge[] } }): void | Promise<void>`:
        *   **关键钩子**，由前端工作流执行管理器 ([`apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts)) 在**工作流启动执行前（前端阶段）**为每个节点调用。
        *   在所有节点的 `onWorkflowExecute` 钩子执行完毕后，才会从 Store 中获取最终的节点数据进行扁平化并发送到后端。
        *   **参数 `context.workflowContext`**：包含执行开始时工作流中所有节点 (`nodes`) 和边 (`edges`) 的**克隆副本**。这意味着脚本可以安全地读取整个工作流的初始状态，而不用担心意外修改原始对象。
        *   **主要用途**：
            *   **预处理输入**：根据 `workflowContext` 中的其他节点状态或全局设置，动态调整此节点的输入值（通过 `context.updateInputValue()`）。
            *   **前端验证**：执行一些在提交到后端前的最终前端验证逻辑。
            *   **动态状态准备**：准备或记录特定的前端状态，这些状态可能会通过修改节点输入间接影响后端执行。
        *   **重要**：通过 `context.updateInputValue()` 所做的任何更改都会更新 VueFlow Store。这些更改将在所有客户端脚本的 `onWorkflowExecute` 钩子执行完毕后被收集，并用于构建发送到后端的最终工作流数据。
        *   **异步处理**：此钩子可以是 `async` 函数。如果返回 `Promise`，工作流执行管理器会 `await` 它完成后再继续处理下一个节点或后续步骤。
    *   **自定义钩子**: 你可以在返回的 API 对象中定义任何其他方法，并通过 `executeClientHook(hookName: string, ...args: any[])` 从节点组件或其他地方调用。

*   **状态管理**：
    *   使用 `context.ref()` 创建响应式变量来管理脚本内部状态。
    *   使用 `context.watch()` 监听节点输入值 (`getNodeInputValue`) 或其他响应式状态的变化。

*   **与节点输入输出交互**：
    *   **读取输入**：使用 `context.getNodeInputValue('yourInputKey')`。
    *   **更新输入（并影响最终提交到后端的数据）**：使用 `context.updateInputValue('yourInputKey', newValue)`。

*   **示例：一个简单的计数器节点脚本**

    ```javascript
    // client-scripts/CounterNodeScript.js
    export function setupClientNode(vueFlow, node, context) {
      const { updateInputValue, getNodeInputValue, ref, watch } = context;
      const count = ref(getNodeInputValue('count') ?? 0);

      watch(() => getNodeInputValue('count'), (newVal) => {
        if (newVal !== undefined && typeof newVal === 'number' && newVal !== count.value) {
          count.value = newVal;
        }
      });

      function updateNodeCount(newCount) {
        count.value = newCount;
        updateInputValue('count', newCount);
      }

      return {
        onButtonClick: (buttonName) => {
          if (buttonName === 'increment') {
            updateNodeCount(count.value + 1);
          } else if (buttonName === 'decrement') {
            updateNodeCount(count.value - 1);
          }
        },
        // 示例：在工作流执行前，如果计数值小于5，则自动增加到5
        async onWorkflowExecute(execContext) {
          console.log(`[Client ${node.id}] Workflow executing. Current count: ${count.value}. Workflow nodes: ${execContext.workflowContext.nodes.length}`);
          if (count.value < 5) {
            console.log(`[Client ${node.id}] Count is less than 5, auto-incrementing to 5 before backend execution.`);
            // 模拟一个异步操作，例如从某个地方获取一个值
            await new Promise(resolve => setTimeout(resolve, 100)); // 模拟异步延迟
            updateNodeCount(5); // 这个更新会反映在发送到后端的数据中
          }
        }
      };
    }
    ```

    **对应的节点定义 (部分)**：
    ```typescript
    // ...
    inputs: {
      count: { dataFlowType: "INTEGER", displayName: "计数值", config: { default: 0 }},
      increment: { dataFlowType: "WILDCARD", displayName: "增加", matchCategories: ["Trigger"], config: { label: "+1" }},
      decrement: { dataFlowType: "WILDCARD", displayName: "减少", matchCategories: ["Trigger"], config: { label: "-1" }},
    },
    outputs: {
      current_count: { dataFlowType: "INTEGER", displayName: "当前计数值" } // 后端可能只透传 count
    },
    clientScriptUrl: "client-scripts/CounterNodeScript.js",
    // ...
    ```

## 4. 调试客户端脚本

*   使用浏览器的开发者工具 (Console, Debugger)。
*   `console.log` 在客户端脚本中会输出到浏览器控制台。
*   可以在 `setupClientNode` 或其返回的 API 方法中设置断点。

## 5. 注意事项与最佳实践

*   **保持脚本轻量**：避免在客户端脚本中执行非常耗时的操作，以免阻塞 UI，特别是同步操作。异步操作是允许的。
*   **错误处理**：在脚本中使用 `try...catch` 处理潜在错误。[`apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts`](apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts) 也会捕获加载和执行错误。
*   **安全性**：客户端脚本由用户浏览器执行，注意不要包含敏感操作或直接处理敏感数据。
*   **依赖管理**：客户端脚本目前不能直接 `import` npm 包。所有依赖需要通过 `context` 参数或全局变量提供。
*   **与后端同步**：如果客户端脚本修改了应持久化的状态，确保通过 `updateInputValue` 更新节点数据，这些数据最终会通过工作流保存与后端同步。
*   **命名空间和类型**：确保后端节点定义中的 `namespace` 和 `type` 正确无误，前端依赖这些信息来定位和加载脚本。
*   **清理逻辑**：如果脚本设置了事件监听器或创建了需要手动清理的资源（例如定时器），可以在 `setupClientNode` 返回的 API 中提供一个 `cleanup` 方法，并在适当的时候（如节点卸载或脚本重载时）调用它。
*   **理解执行时机**：清楚客户端脚本中的不同函数（如 `onButtonClick` vs `onWorkflowExecute`）在何时被调用，以及它们在整个用户交互和工作流生命周期中的位置。`onWorkflowExecute` 是在前端预处理阶段，其修改会影响发送到后端的数据。
*   **`vueFlow` 参数展望**：虽然 `setupClientNode` 的第一个参数 `vueFlow` 当前传递为 `null`，但未来它可能被用于提供对 VueFlow 实例或特定画布操作 API 的直接访问，从而允许客户端脚本进行更复杂的画布级交互（例如，动态添加/删除节点、修改连接、控制视口等）。在设计脚本时，可以考虑到这种可能性，但目前不应依赖此参数。