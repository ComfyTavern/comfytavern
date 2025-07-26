# ComfyTavern Client Script Guide

This guide will help you understand and create client scripts in ComfyTavern. Client scripts allow nodes to execute logic in the user's browser, primarily for **manipulating frontend UI elements, implementing complex UI interactions, and running preprocessing logic before workflows are formally submitted for execution**.

## 1. What are Client Scripts?

*   **Definition**: JavaScript code snippets that run in the frontend (browser) environment, associated with specific nodes, used to enhance node interactivity and execute frontend logic at specific times.
*   **Core Purposes**:
    *   **Frontend UI Manipulation and Interaction**:
        *   Implement dynamic behavior of node UI elements (e.g., changing display based on input, responding to custom button clicks).
        *   Create richer, more responsive user interface interactions without needing to communicate with the backend.
    *   **Workflow Pre-execution Logic**:
        *   Execute some frontend preprocessing steps after the user clicks the "Run" workflow button, but before the workflow data is actually sent to the backend for execution.
        *   For example: dynamically modifying node inputs based on current frontend state, performing frontend validation, preparing execution context, etc.
        *   This is typically achieved through specific hooks exposed by client scripts (e.g., `onWorkflowExecute`), and called by the frontend's workflow execution manager ([`apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts)) at appropriate times.
*   **Relationship with Backend Execution**: Client scripts primarily handle frontend interaction and preprocessing logic. The node's final core computation and data processing are usually still completed in the backend `execute` method, but client scripts can influence the node's inputs or state before this.

## 2. How Do Client Scripts Work?

*   **Core Flowchart (Mermaid)**:
    ```mermaid
    graph TD
        A[Backend Node Definition<br>(NodeDefinition)] -- Contains clientScriptUrl --> B{Frontend Loader<br>(useNodeClientScript)};
        B -- 1. Read namespace, type, clientScriptUrl --> B;
        B -- 2. Construct Request URL<br>(e.g., /api/nodes/core/MyNode/client-script/script.js) --> C[Backend API Route<br>([`apps/backend/src/routes/nodeRoutes.ts`](apps/backend/src/routes/nodeRoutes.ts))];
        C -- 3. Provide Script File Content --> B;
        B -- 4. Dynamic import() Execute Script --> D[Client Script Module<br>(e.g., MyNodeScript.js)];
        D -- 5. Call setupClientNode() --> E{Script API Instance<br>(clientScriptApi)};
        
        subgraph Before Workflow Execution (Frontend)
            F[User clicks "Run" workflow] --> G([`useWorkflowExecution.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts)::executeWorkflow);
            G -- Traverse all nodes --> H{Has onWorkflowExecute hook?};
            H -- Yes --> I[Call clientScriptApi.onWorkflowExecute()<br>Pass workflowContext (nodes, edges)];
            I -- context.updateInputValue() --> J[Update VueFlow Store node data];
            G -- After all hooks executed<br>Get latest node data from Store --> K[Flatten workflow];
            K --> L[Send to backend for execution];
        end

        subgraph Node UI Interaction
            M[Node Component UI<br>(BaseNode.vue)] -- User Interaction (e.g., button click) --> B;
            B -- Call clientScriptApi.onButtonClick() --> E;
            B -- Or call executeClientHook() --> E;
            E -- context.updateInputValue() --> J;
        end
    ```
*   **Backend Configuration and Service**:
    *   Use the `clientScriptUrl` field in the node definition (`NodeDefinition`) to specify the script path.
        *   The path is relative to the node definition file itself.
        *   Example: `clientScriptUrl: "client-scripts/MyNodeScript.js"`
    *   The backend provides these script files through specific API routes (defined in [`apps/backend/src/routes/nodeRoutes.ts`](apps/backend/src/routes/nodeRoutes.ts)).
        *   The route format is typically: `GET /api/nodes/:namespace/:type/client-script/:scriptFileName`
*   **Frontend Loading**:
    *   The [`apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts`](apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts) composable is responsible for handling this.
    *   It reads `namespace`, `type`, and `clientScriptUrl` from the current node's definition.
    *   Then, it constructs a full URL pointing to the backend API based on this information to request the script file.
    *   Asynchronously loads and executes the returned JavaScript code via `import(/* @vite-ignore */ fullScriptUrl)`.
*   **Script Initialization**:
    *   Client scripts must export a function named `setupClientNode`.
    *   This function is called after the script is loaded and successfully executed.

## 3. Writing Client Scripts

*   **`setupClientNode` Function**:
    *   **Signature**: `function setupClientNode(vueFlow, node, context)`
    *   **Parameter Details**:
        *   `vueFlow`: (Currently `null`) VueFlow instance or related API, potentially for more advanced canvas interactions in the future.
        *   `node`: The props object of the current node, containing the node's ID, type, data, position, etc.
            *   `node.id`: Unique ID of the node.
            *   `node.data`: Persistent data of the node, including input values.
            *   `node.type`: Type of the node.
            *   `node.namespace`: Namespace of the node.
        *   `context`: An object containing methods for interacting with the frontend:
            *   `updateInputValue(inputKey: string, value: any): void`: Updates the value of the specified input field of the current node. This triggers VueFlow's reactive update and reflects the changes in the Store.
            *   `getNodeInputValue(inputKey: string): any`: Gets the current value of the specified input field of the current node (read from the Store).
            *   `setNodeOutputValue(outputKey: string, value: any): void`: (Currently mainly for logging) Theoretically used to set the node's output value.
            *   `ref`: Vue's `ref` function, used to create reactive variables.
            *   `watch`: Vue's `watch` function, used to listen for changes in reactive data.
    *   **Return Value**: Can return an object whose methods can be called by node components or other frontend parts. These methods constitute the API of this client script.

*   **Common APIs and Hooks**:
    *   `onButtonClick(buttonName: string): void`:
        *   When a button input on the node is clicked, if this method is defined in the client script API, it will be called.
        *   The `buttonName` parameter is the `key` of that button input field.
        *   Mainly used to handle purely frontend button interaction logic.
    *   `onWorkflowExecute(context: { nodeId: string, workflowContext: { nodes: VueFlowNode[], edges: VueFlowEdge[] } }): void | Promise<void>`:
        *   **Crucial Hook**, called by the frontend workflow execution manager ([`apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts)) for each node **before workflow execution starts (frontend phase)**.
        *   Only after all nodes' `onWorkflowExecute` hooks have finished executing, the final node data is retrieved from the Store for flattening and sending to the backend.
        *   **Parameter `context.workflowContext`**: Contains **cloned copies** of all nodes (`nodes`) and edges (`edges`) in the workflow at the start of execution. This means scripts can safely read the initial state of the entire workflow without worrying about accidentally modifying original objects.
        *   **Main Uses**:
            *   **Pre-process Inputs**: Dynamically adjust this node's input values (via `context.updateInputValue()`) based on other node states in `workflowContext` or global settings.
            *   **Frontend Validation**: Perform some final frontend validation logic before submission to the backend.
            *   **Dynamic State Preparation**: Prepare or record specific frontend states that might indirectly affect backend execution by modifying node inputs.
        *   **Important**: Any changes made via `context.updateInputValue()` update the VueFlow Store. These changes will be collected after all client scripts' `onWorkflowExecute` hooks have finished executing, and will be used to construct the final workflow data sent to the backend.
        *   **Asynchronous Handling**: This hook can be an `async` function. If it returns a `Promise`, the workflow execution manager will `await` its completion before proceeding to the next node or subsequent steps.
    *   **Custom Hooks**: You can define any other methods in the returned API object and call them from node components or elsewhere via `executeClientHook(hookName: string, ...args: any[])`.

*   **State Management**:
    *   Use `context.ref()` to create reactive variables to manage internal script state.
    *   Use `context.watch()` to listen for changes in node input values (`getNodeInputValue`) or other reactive states.

*   **Interacting with Node Inputs and Outputs**:
    *   **Reading Inputs**: Use `context.getNodeInputValue('yourInputKey')`.
    *   **Updating Inputs (and affecting data ultimately submitted to backend)**: Use `context.updateInputValue('yourInputKey', newValue)`.

*   **Example: A Simple Counter Node Script**

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
        // Example: If count is less than 5 before workflow execution, auto-increment to 5
        async onWorkflowExecute(execContext) {
          console.log(`[Client ${node.id}] Workflow executing. Current count: ${count.value}. Workflow nodes: ${execContext.workflowContext.nodes.length}`);
          if (count.value < 5) {
            console.log(`[Client ${node.id}] Count is less than 5, auto-incrementing to 5 before backend execution.`);
            // Simulate an asynchronous operation, e.g., fetching a value from somewhere
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async delay
            updateNodeCount(5); // This update will be reflected in the data sent to the backend
          }
        }
      };
    }
    ```

    **Corresponding Node Definition (partial)**:
    ```typescript
    // ...
    inputs: {
      count: { dataFlowType: "INTEGER", displayName: "Count Value", config: { default: 0 }},
      increment: { dataFlowType: "WILDCARD", displayName: "Increment", matchCategories: ["Trigger"], config: { label: "+1" }},
      decrement: { dataFlowType: "WILDCARD", displayName: "Decrement", matchCategories: ["Trigger"], config: { label: "-1" }},
    },
    outputs: {
      current_count: { dataFlowType: "INTEGER", displayName: "Current Count" } // Backend might just pass through count
    },
    clientScriptUrl: "client-scripts/CounterNodeScript.js",
    // ...
    ```

## 4. Debugging Client Scripts

*   Use browser's developer tools (Console, Debugger).
*   `console.log` in client scripts will output to the browser console.
*   Breakpoints can be set in `setupClientNode` or its returned API methods.

## 5. Considerations and Best Practices

*   **Keep Scripts Lightweight**: Avoid executing very time-consuming operations in client scripts to prevent blocking the UI, especially synchronous operations. Asynchronous operations are allowed.
*   **Error Handling**: Use `try...catch` in scripts to handle potential errors. [`apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts`](apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts) will also catch loading and execution errors.
*   **Security**: Client scripts are executed by the user's browser; be careful not to include sensitive operations or directly process sensitive data.
*   **Dependency Management**: Client scripts currently cannot directly `import` npm packages. All dependencies need to be provided via the `context` parameter or global variables.
*   **Synchronization with Backend**: If client scripts modify persistent state, ensure that node data is updated via `updateInputValue`. This data will eventually be synchronized with the backend through workflow saving.
*   **Namespace and Type**: Ensure that `namespace` and `type` in backend node definitions are correct, as the frontend relies on this information to locate and load scripts.
*   **Cleanup Logic**: If scripts set up event listeners or create resources that need manual cleanup (e.g., timers), a `cleanup` method can be provided in the API returned by `setupClientNode` and called at appropriate times (e.g., when the node is unmounted or the script is reloaded).
*   **Understand Execution Timing**: Clearly understand when different functions in client scripts (e.g., `onButtonClick` vs `onWorkflowExecute`) are called, and their position in the overall user interaction and workflow lifecycle. `onWorkflowExecute` is in the frontend preprocessing phase, and its modifications will affect the data sent to the backend.
*   **`vueFlow` Parameter Outlook**: While the first parameter `vueFlow` of `setupClientNode` is currently passed as `null`, in the future it may be used to provide direct access to the VueFlow instance or specific canvas operation APIs, allowing client scripts to perform more complex canvas-level interactions (e.g., dynamically adding/removing nodes, modifying connections, controlling viewport, etc.). When designing scripts, this possibility can be considered, but currently, this parameter should not be relied upon.