# ComfyTavern Custom Node Development Guide

## 1. Introduction

Welcome to the ComfyTavern Custom Node Development Guide! Custom nodes are the core way to extend ComfyTavern's functionality and implement specific business logic. By creating custom nodes, you can encapsulate complex operations into reusable modules and flexibly arrange them in the visual workflow editor.

This guide will detail the complete process of developing a custom node, including:

*   **Backend Definition**: How to define node properties, inputs, outputs, and configuration using TypeScript.
*   **Execution Logic**: How to implement the backend processing logic for nodes, and how to integrate frontend client scripts for richer interaction.
*   **Frontend Rendering**: How node definitions affect their visual representation and user interaction in the frontend editor (primarily through the generic [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue) component).

Understanding and following the specifications in this guide will help you create custom nodes that are powerful, easy to maintain, and well-integrated with the ComfyTavern system.

## 2. Preparation

### 2.1 Development Environment Configuration

Ensure your development environment is configured with the following tools:

*   **Bun**: The ComfyTavern project uses Bun as the JavaScript runtime and package manager.
*   **TypeScript**: Node definitions and backend logic are primarily written in TypeScript to ensure type safety and code quality.

### 2.2 Node-Related Directories in the Project Structure

The main code for custom nodes is typically located in the following directories:

*   **Backend Node Definitions and Logic**: `apps/backend/src/nodes/`
    *   You can create subdirectories based on node categories, e.g., `apps/backend/src/nodes/MyCustomNodes/`.
    *   Each node usually corresponds to a `.ts` file, e.g., `MyCustomNode.ts`.
*   **Client Scripts (if needed)**: Typically placed in a `client-scripts/` subdirectory within the node definition file's directory, e.g., `apps/backend/src/nodes/MyCustomNodes/client-scripts/MyCustomNode.js`.
*   **Frontend Base Node Component**: The frontend rendering and basic interaction logic for all nodes are handled uniformly by the component located at `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`. In most cases, you do not need to modify this file, but understanding how it works will help you better design the node's `config` object to control the frontend UI.
*   **Node Type Definitions**: Core node-related type interfaces (such as `NodeDefinition`, `InputDefinition`, `OutputDefinition`) are located in the shared package `packages/types/src/node.ts`.
*   **Node Export Index**: In your created node directory (e.g., `apps/backend/src/nodes/MyCustomNodes/`), there will typically be an `index.ts` file used to collect and export the definitions of all nodes in that directory, so they can be discovered by the node loader.

## 3. Node Definition (`NodeDefinition`)

The core of each custom node is a TypeScript object that conforms to the `NodeDefinition` interface (defined in [`packages/types/src/node.ts`](packages/types/src/node.ts:88)). This object describes the node's metadata, input/output ports, configuration items, and behavior in detail.

```typescript
// Example: MyCustomNode.ts
import type { NodeDefinition, InputDefinition, OutputDefinition, NodeExecutionContext } from '@comfytavern/types';
import { DataFlowType, BuiltInSocketMatchCategory } from '@comfytavern/types'; // Import necessary enums

export const definition: NodeDefinition = {
  // ... Core properties ...
  // ... Input definitions ...
  // ... Output definitions ...
  // ... Node-level configuration ...
  // ... Execution logic, etc. ...
};
```

### 3.1 Core Properties

*   `type: string`: **Required.** A unique type identifier for the node. Must be unique across the entire system. Example: `'MyCustomNode'`.
*   `namespace?: string`: Optional. The node's namespace. This is usually automatically inferred by the node loader based on the file path (e.g., nodes under `apps/backend/src/nodes/core/` might have the `'core'` namespace). If specified uniformly in the node directory's `index.ts`, this can be omitted here.
*   `category: string`: **Required.** The category the node belongs to in the frontend UI node panel. Example: `'Data Processing'`, `'Logic Operations'`.
*   `displayName: string`: **Required.** The name displayed for the node in the UI. Should be concise and clear. Example: `'✨ My Custom Node'`.
*   `description: string`: **Required.** A detailed description of the node, typically displayed in the frontend UI's Tooltip. Can include Markdown line breaks `\n`. Example: `'This is a custom node that performs a specific function.\nSupports multiple configuration options.'`.
*   `width?: number`: Optional. The preferred width (in pixels) when the node is rendered on the canvas. Users can still adjust it manually.
*   `filePath?: string`: Optional. This field is usually automatically populated by the node loader during loading, pointing to the absolute path of the node definition file.

### 3.2 Inputs (`inputs: Record<string, InputDefinition>`)

The `inputs` object defines all input ports for the node. The keys of the object are the unique identifiers for the input ports (unique within the node), and the values are objects conforming to the `InputDefinition` interface.

Reference: [`InputDefinition` Interface Definition](packages/types/src/node.ts:65)

```typescript
// InputDefinition Structure Example
interface InputDefinition extends SlotDefinitionBase {
  description?: string;
  required?: boolean | ((configValues: Record<string, any>) => boolean);
  config?: Record<string, any>; // Key: UI control configuration
  multi?: boolean; // Whether to support multiple connections
}

interface SlotDefinitionBase {
  displayName?: string;
  dataFlowType: DataFlowTypeName; // e.g., DataFlowType.STRING
  matchCategories?: string[];    // e.g., [BuiltInSocketMatchCategory.CODE]
  allowDynamicType?: boolean;
}
```

*   `dataFlowType: DataFlowTypeName`: **Required.** The core data type of the input port. Examples: `DataFlowType.STRING`, `DataFlowType.INTEGER`, `DataFlowType.OBJECT`. For detailed types, please refer to the `docs/node-types` document.
*   `matchCategories?: string[]`: Optional. An array of tags used to more precisely describe the port's semantics or behavior. Examples: `[BuiltInSocketMatchCategory.CODE]`, `['MyCustomDataFormat']`. These tags affect connection compatibility judgment and certain behaviors in the frontend UI, including the display of default action buttons (e.g., `CanPreview` indicates previewable, `NoDefaultEdit` prohibits default editing). For details, please refer to the `docs/node-types` document.
*   `displayName?: string`: Optional. The name displayed for the input port in the UI. If not provided, the frontend may use the port's key name or `description`.
*   `description?: string`: Optional. A detailed description of the input port, used for Tooltip.
*   `required?: boolean | ((configValues: Record<string, any>) => boolean)`: Optional. Indicates whether this input is required. Can be a boolean value, or a function that receives the node's current configuration values and returns a boolean, to implement conditional requirements. Defaults to `false`.
*   `multi?: boolean`: Optional. If `true`, this input port can accept multiple connections. The corresponding input value in the backend `execute` method will be an array. Defaults to `false`. See [`apps/backend/src/nodes/Utilities/MergeNode.ts`](apps/backend/src/nodes/Utilities/MergeNode.Node.ts:1) for an example of `text_inputs`.
*   `config?: Record<string, any>`: **Core configuration object**. Properties in this object directly affect the type and behavior of the UI control corresponding to this input port when it is not connected. These properties should be compatible with the various input option Zod Schemas defined in [`packages/types/src/node.ts`](packages/types/src/node.ts:1) (such as [`zNumericInputOptions`](packages/types/src/node.ts:13), [`zStringInputOptions`](packages/types/src/node.ts:22), etc.).
*   `actions?: NodeInputAction[]`: Optional. Defines a set of action buttons displayed next to the input slot. Each button is defined by a `NodeInputAction` object, including properties like `id`, `icon`, `label`, `tooltip`, `handlerType` (e.g., `'builtin_preview'`, `'builtin_editor'`), `handlerArgs`, and `showConditionKey`. These buttons are rendered and managed by the frontend's `NodeInputActionsBar.vue` component, allowing for interactions like previewing, editing, and custom events. For detailed definition, please refer to the `docs/node-types` document regarding the `NodeInputAction` section.

    *   **Common `config` properties (refer to [`TestWidgetsNode.ts`](apps/backend/src/nodes/Utilities/TestWidgetsNode.ts:1) and the rendering logic of [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1)):**
        *   `default: any`: The default value for the input control.
        *   `multiline?: boolean`: (For `STRING` type) If `true`, renders as a multi-line text area (TextAreaInput), otherwise a single line (StringInput).
        *   `placeholder?: string`: Placeholder text for the input box.
        *   `min?: number`, `max?: number`, `step?: number`: (For `INTEGER`, `FLOAT` types) Numerical range and step.
        *   `suggestions?: any[]`: (For `STRING`, `INTEGER`, `FLOAT` types) Provides a list of suggested values, typically rendered as a dropdown selection box (SelectInput/Combo) in the frontend.
        *   `languageHint?: string`: (For `STRING` type, especially when `matchCategories` includes `CODE` or `MARKDOWN`) Specifies the language for the code editor (e.g., `'javascript'`, `'json'`, `'markdown'`), or assists with Markdown preview.
        *   `label?: string`: (Primarily for `WILDCARD` type when `matchCategories` includes `TRIGGER`) Text displayed on the button (ButtonInput).
        *   `display_only?: boolean`: (For `STRING` and other types) If `true`, only displays text content even when not connected, not editable (TextDisplay).
        *   `bottomEditorMode?: string`: (For types requiring complex editing like code, JSON, Markdown) Configures the mode of the bottom docked editor, optional `'lightweightSingle'` (lightweight single page) or `'fullMultiTab'` (full-featured multi-tab, default). Triggered when the user clicks the edit button next to the input control.

**Input Definition Example (excerpt from [`TestWidgetsNode.ts`](apps/backend/src/nodes/Utilities/TestWidgetsNode.ts:1)):**
```typescript
inputs: {
  string_input: {
    dataFlowType: DataFlowType.STRING,
    displayName: 'Single Line Text',
    config: { default: 'Default Value', multiline: false, placeholder: 'Please enter...' }
  },
  markdown_input: {
    dataFlowType: DataFlowType.STRING,
    displayName: 'Markdown Text',
    matchCategories: [BuiltInSocketMatchCategory.MARKDOWN],
    config: { default: '# Title', multiline: true, languageHint: 'markdown' }
  },
  int_input: {
    dataFlowType: DataFlowType.INTEGER,
    displayName: 'Integer',
    config: { default: 10, min: 0, max: 100, step: 1 }
  },
  combo_select: {
    dataFlowType: DataFlowType.STRING,
    displayName: 'Dropdown Select',
    matchCategories: [BuiltInSocketMatchCategory.COMBO_OPTION],
    config: { default: 'Option A', suggestions: ['Option A', 'Option B'] }
  },
  button_trigger: {
    dataFlowType: DataFlowType.WILDCARD, // Buttons usually don't transmit specific data types
    displayName: 'Trigger Button',
    matchCategories: [BuiltInSocketMatchCategory.TRIGGER],
    config: { label: 'Click to Execute' }
  }
}
```

### 3.3 Outputs (`outputs: Record<string, OutputDefinition>`)

The `outputs` object defines all output ports for the node. The structure is similar to `inputs`, but `OutputDefinition` is simpler.

Reference: [`OutputDefinition` Interface Definition](packages/types/src/node.ts:73)

```typescript
// OutputDefinition Structure Example
interface OutputDefinition extends SlotDefinitionBase {
  description?: string;
}
```
*   `dataFlowType: DataFlowTypeName`: **Required.** The core data type of the output port.
*   `matchCategories?: string[]`: Optional. Semantic or behavior tags.
*   `displayName?: string`: Optional. The name displayed for the output port in the UI.
*   `description?: string`: Optional. A detailed description of the output port.

**Output Definition Example:**
```typescript
outputs: {
  result_text: {
    dataFlowType: DataFlowType.STRING,
    displayName: 'Result Text',
    description: 'The processed text result'
  },
  processed_data: {
    dataFlowType: DataFlowType.OBJECT,
    displayName: 'Processed Data',
    matchCategories: ['MyCustomDataFormat']
  }
}
```

### 3.4 Node-Level Configuration (`configSchema` and `configValues`)

In addition to receiving data through input ports, nodes can also have their own configuration items. These configuration items are independent of the input/output streams and are typically used to control the node's internal behavior or settings.

*   `configSchema?: Record<string, InputDefinition>`: Optional. Used to define the node's own configuration items. Its structure is exactly the same as the `inputs` object. Each key-value pair represents a configuration item, using `InputDefinition` to describe its type, UI display (e.g., rendering the corresponding input control in a special area of the node body), and default value.
*   `configValues?: Record<string, any>`: Optional. Used to store the actual values of the configuration items defined in `configSchema`. These values are typically persisted when the workflow is saved.

**Node-Level Configuration Example:**
```typescript
// In NodeDefinition
configSchema: {
  processingMode: {
    dataFlowType: DataFlowType.STRING,
    displayName: 'Processing Mode',
    config: {
      default: 'fast',
      suggestions: ['fast', 'accurate']
    }
  },
  retryAttempts: {
    dataFlowType: DataFlowType.INTEGER,
    displayName: 'Retry Attempts',
    config: {
      default: 3,
      min: 0,
      max: 5
    }
  }
},
// configValues will store the user's selected values in the workflow, e.g.:
// { processingMode: 'accurate', retryAttempts: 2 }
```
In the frontend [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1), these configuration items will be rendered in a dedicated area of the node using logic similar to input ports.

### 3.5 Bypass Behavior (`bypassBehavior`)

*   `bypassBehavior?: "mute" | BypassBehavior`: Optional. Defines the behavior when the node is set to "Bypass" or "Mute" state in the workflow.
    *   `"mute"`: The node does not execute and does not produce any output.
    *   `BypassBehavior` object: `{ passThrough?: Record<string, string>, defaults?: Record<string, any> }`
        *   `passThrough`: Defines how output ports directly get values from input ports (e.g., `{'output_A': 'input_X'}` means the value of output_A is taken directly from input_X).
        *   `defaults`: Provides fixed default values for certain output ports to be used when bypassed.

## 4. Node Execution Logic

The node's execution logic defines how it should process input data, perform calculations, and produce output when the workflow runs to this node. The execution logic can be fully implemented in the backend, or partially or fully rely on frontend client scripts.

### 4.1 Backend Execution (`execute` Method)

If the node needs to process data on the server side, you need to provide an asynchronous `execute` method in the `NodeDefinition`.

```typescript
// In NodeDefinition
async execute(
  inputs: Record<string, any>, // An object where keys are input port IDs and values are parsed input data
  context?: NodeExecutionContext // Optional execution context object
): Promise<Record<string, any>> { // Returns an object where keys are output port IDs and values are corresponding output data
  // ... Your logic ...
  const inputValue = inputs['myInputKey'];
  const nodeConfigValue = context?.configValues?.['myConfigKey']; // Assuming config values are passed via context

  // Handle multi-input (example from MergeNode.ts)
  const textInputsArray = Array.isArray(inputs.text_inputs) ? inputs.text_inputs : [inputs.text_inputs];

  // ... Perform calculations ...
  const result = processData(inputValue, nodeConfigValue);

  return {
    myOutputKey: result
  };
}
```

*   **Parameters**:
    *   `inputs: Record<string, any>`: An object containing all connected and parsed input values. Keys are the input port IDs you defined in `NodeDefinition.inputs`. If an input port is `multi: true` 则对应的值会是一个数组.
    *   `context?: NodeExecutionContext`: An optional execution context object ([`NodeExecutionContext`](packages/types/src/node.ts:193)). It may contain `nodeId` and a way to access the node's own `configValues` (the specific implementation may depend on how the execution engine passes context; please refer to relevant documentation or the implementation of `ExecutionEngine.ts`).
*   **Return Value**: A `Promise` that resolves to an object where keys are the output port IDs you defined in `NodeDefinition.outputs`, and values are the corresponding output data.
*   **Error Handling**: If an error occurs during execution, you can throw an exception. The execution engine will catch this exception and update the node status accordingly.
*   **Backend Role for Frontend-Driven Nodes**: For nodes where the main logic is executed on the frontend via client scripts (like [`RandomNumberNode.ts`](apps/backend/src/nodes/Utilities/RandomNumberNode.ts:1)), the backend `execute` method might be very simple, e.g., only serving as a data passthrough, or handling some simple validation or preparation that cannot be done on the frontend.

### 4.2 Frontend Execution (Client Scripts)

For nodes that require complex frontend interaction (such as responding to button clicks, utilizing browser APIs) or want to reduce server load, you can use client scripts.

*   `clientScriptUrl?: string`: Set this property in `NodeDefinition` to point to the URL of a JavaScript file. This URL is usually relative to the node definition file itself, e.g., `'client-scripts/MyCustomNode.js'`.
    *   The backend will serve these script files at specific API endpoints (e.g., `/client-scripts/:namespace/:nodeType.js`).
*   **Use Cases**:
    *   Responding to click events on internal UI elements of the node (like buttons).
    *   Performing data preprocessing or validation on the frontend.
    *   Directly manipulating the DOM or using browser-specific APIs.
    *   Implementing instant feedback without backend involvement.
*   **Writing Client Scripts**:
    *   Client scripts are loaded and executed in the frontend [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) component via the `useNodeClientScript` composable.
    *   Scripts typically export an object or function containing specific hooks or methods for `BaseNode.vue` to call. For example, a function to handle button clicks.
    *   **Interacting with the Node Instance**: Client scripts can access certain states or methods of their associated node instance, such as:
        *   Getting input values.
        *   Updating the node's input values via `updateInputValue` (passed to the script context by `BaseNode.vue`) (this is typically used to simulate changes in the node's internal state).
        *   Triggering messages to be sent to the backend (e.g., constructing and sending a [`ButtonClickPayload`](packages/types/src/node.ts:261) type WebSocket message via `handleButtonClick`).
    *   **Example**: Refer to [`apps/backend/src/nodes/Utilities/RandomNumberNode.ts`](apps/backend/src/nodes/Utilities/RandomNumberNode.ts:1) and its corresponding `apps/backend/src/nodes/Utilities/client-scripts/RandomNumberNode.js`.
        *   `RandomNumberNode.js` might export an object containing methods like `onRerollButtonClick`. When the user clicks the "Reroll" button, `BaseNode.vue` will call this method. The method might internally generate a random number and update the node's `value` input via `updateInputValue`, and potentially trigger an update of the `number` output (the specific mechanism requires checking the implementation details of `useNodeClientScript` and `BaseNode.vue`).

## 5. Frontend Rendering and Interaction (`BaseNode.vue`)

All custom nodes (unless there is a special mechanism) are rendered uniformly by the frontend component [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1). Therefore, understanding how your node definition affects the behavior of `BaseNode.vue` is very important.

*   **Unified Renderer**: `BaseNode.vue` receives the node's `props` (including most of the node definition obtained from the backend) and is responsible for rendering the node's header (title, category, ID), body, input/output ports (Handles), and UI controls corresponding to unconnected inputs.
*   **Dynamic Selection of Input Controls**:
    *   `BaseNode.vue` has internal logic (roughly implemented through the `getInputComponent` function) that determines which specific Vue component (e.g., `StringInput.vue`, `NumberInput.vue`, `ButtonInput.vue`, `JsonInlineViewer.vue`, etc.) to render for a given port based on its `dataFlowType`, `matchCategories`, and `config` object.
    *   Therefore, correctly configuring these properties in `InputDefinition` is crucial for the correct display of the frontend UI.
*   **Handle (Connection Point) Styles**: The color and style of Handles change dynamically based on their `dataFlowType` to provide visual cues.
*   **Multi-Input Rendering**: Input ports with `multi: true` will have a special "runway" rendering effect on the frontend, allowing multiple connections.
*   **Linkage between Action Buttons and Complex Inputs**:
    *   Action buttons next to input slots (such as preview, edit, custom buttons) are now dynamically generated and managed by the [`apps/frontend-vueflow/src/components/graph/nodes/NodeInputActionsBar.vue`](apps/frontend-vueflow/src/components/graph/nodes/NodeInputActionsBar.vue:1) component based on the `actions` array and `matchCategories` (like `CanPreview`) in the `InputDefinition`.
    *   For example, an input marked with `CanPreview` or with a `'builtin_preview'` action defined in `actions` will display a preview button. Clicking this button triggers the built-in Tooltip preview logic.
    *   Similarly, editable inputs (not marked with `NoDefaultEdit`, or with a `'builtin_editor'` action defined in `actions`) will display an edit button. Upon clicking, `BaseNode.vue` (triggered by an event from `NodeInputActionsBar.vue`) will call the `interactionCoordinator.openDockedEditorForNodeInput` method, opening an editor for the corresponding content in the bottom docked editor. Parameters like the editor type can be specified in `handlerArgs`.
    *   `WILDCARD` type inputs with `matchCategories` including `TRIGGER` will still be rendered as buttons (ButtonInput). Their click events are typically handled by client scripts, or more specific behavior can be defined through `actions`.
*   **Tooltip and Execution Status**: `BaseNode.vue` is responsible for displaying the `description` of nodes and ports as Tooltips, and adding visual feedback like highlighting to nodes based on the execution status (`RUNNING`, `COMPLETED`, `ERROR`, etc.) obtained from the `executionStore`.

## 6. Node Registration and Loading

To ensure that the ComfyTavern system can recognize and use your custom nodes, you need to make sure they are correctly organized and exported.

*   **Backend Node Organization and Export Pattern**: (Refer to [`apps/backend/src/nodes/Utilities/index.ts`](apps/backend/src/nodes/Utilities/index.ts:1))
    1.  **Single Node File**: Each custom node is typically defined in a separate `.ts` file (e.g., `MyCustomNode.ts`).
    2.  **Export `definition`**: In this file, you need to export a constant named `definition`, whose value is an object conforming to the `NodeDefinition` interface.
        ```typescript
        // MyCustomNode.ts
        import type { NodeDefinition } from '@comfytavern/types';
        // ...
        export const definition: NodeDefinition = { /* ... */ };
        ```
    3.  **Directory `index.ts`**: In a directory containing multiple node definition files (e.g., `apps/backend/src/nodes/MyCustomNodes/`), create an `index.ts` file.
    4.  **Aggregate and Export `definitions`**: In this `index.ts` file, import the `definition` objects from all node files in that directory and collect them into an array named `definitions` to be exported. When aggregating, you will typically uniformly specify or override the `namespace` property for these nodes.
        ```typescript
        // apps/backend/src/nodes/MyCustomNodes/index.ts
        import type { NodeDefinition } from '@comfytavern/types';
        import { definition as MyCustomNodeOneDefinition } from './MyCustomNodeOne';
        import { definition as MyCustomNodeTwoDefinition } from './MyCustomNodeTwo';

        export const definitions: NodeDefinition[] = [
          { ...MyCustomNodeOneDefinition, namespace: 'myCustomNamespace' }, // Specify namespace
          // ... Other node definitions
        ];
        ```
*   **Node Loader (`NodeLoader.ts`)**: The project's backend includes a node loader (roughly located at `apps/backend/src/nodes/NodeLoader.ts`) that scans specified node directories (e.g., subdirectories under `apps/backend/src/nodes/`), looks for `index.ts` files that export a `definitions` array, and thus loads all custom nodes. `NodeManager.ts` is responsible for managing these loaded node definitions.

## 7. A Complete Example

Let's conceive a simple "String Reverse" node as an example.

**`apps/backend/src/nodes/MyCustomNodes/StringReverseNode.ts`**:
```typescript
import type { NodeDefinition, InputDefinition, OutputDefinition, NodeExecutionContext } from '@comfytavern/types';
import { DataFlowType } from '@comfytavern/types';

class StringReverseNodeImpl {
  static async execute(inputs: Record<string, any>, context?: NodeExecutionContext): Promise<Record<string, any>> {
    const inputText = inputs.text_to_reverse as string || '';
    const reversedText = inputText.split('').reverse().join('');
    return {
      reversed_text: reversedText,
    };
  }
}

export const definition: NodeDefinition = {
  type: 'StringReverse',
  category: 'Text Processing',
  displayName: '🔄 String Reverse',
  description: 'Reverses the input string.',
  inputs: {
    text_to_reverse: {
      dataFlowType: DataFlowType.STRING,
      displayName: 'Input Text',
      description: 'The string to be reversed.',
      required: true,
      config: {
        default: 'Hello World',
        multiline: false,
        placeholder: 'Enter text to reverse',
      },
    } as InputDefinition, // Type assertion to ensure compliance with interface
  },
  outputs: {
    reversed_text: {
      dataFlowType: DataFlowType.STRING,
      displayName: 'Reversed Text',
      description: 'The string after reversal.',
    } as OutputDefinition, // Type assertion
  },
  execute: StringReverseNodeImpl.execute,
};
```

**`apps/backend/src/nodes/MyCustomNodes/index.ts`**:
```typescript
import type { NodeDefinition } from '@comfytavern/types';
import { definition as StringReverseNodeDefinition } from './StringReverseNode';
// If there are other nodes, import them here as well

export const definitions: NodeDefinition[] = [
  { ...StringReverseNodeDefinition, namespace: 'myCustomNodes' }, // Specify namespace
  // ... Other node definitions
];
```
Add the `MyCustomNodes` directory to the scan path of `NodeLoader.ts` (if needed). After restarting the system, this "String Reverse" node should appear under the "Text Processing" category in the frontend node panel.

## 8. Best Practices

*   **Naming Conventions**:
    *   Node `type`: Use PascalCase, e.g., `MyImageProcessor`.
    *   File Name: Usually consistent with the node `type`, e.g., `MyImageProcessor.ts`.
    *   Input/Output Port IDs (keys): Use snake_case, e.g., `input_image`, `processed_output`.
    *   `displayName`: Use user-friendly natural language, can include Emoji.
*   **Comments and Documentation**:
    *   Provide clear, detailed descriptions for the `description` property of `NodeDefinition` and the `description` property of input/output ports. These will be displayed directly to the user.
    *   Use JSDoc or TSDoc comments in the code for key logic.
*   **Performance Considerations**:
    *   Avoid executing very time-consuming or blocking operations in the `execute` method. If long processing is needed, consider designing it asynchronously and think about how to provide progress feedback to the frontend (if the project supports it).
*   **Type Safety**:
    *   Fully utilize TypeScript's type system, providing explicit types for all variables, parameters, and return values.
    *   Use types imported from the `@comfytavern/types` package.
*   **Single Responsibility**:
    *   Try to keep each node focused on a single, clear function. If a node's logic is too complex, consider splitting it into multiple smaller, composable nodes.
*   **Consider Frontend Interaction**:
    *   When designing the node's `inputs` and `configSchema`, think about how they will be rendered in the frontend [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) and how users will interact with them. Choose appropriate `dataFlowType`, `matchCategories`, and `config` properties to optimize the user experience.

## 9. Debugging Tips

*   **Backend Logs**: Add `console.log` or use a more professional logging library in your `execute` method or node loading related logic for debugging. The output from the Bun runtime will appear in the terminal where the backend was started.
*   **Frontend Browser Console**:
    *   Open the browser's developer tools (usually F12).
    *   Check the `Console` tab for errors or debugging information that [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) or other frontend components might output.
    *   For client scripts, you can directly use `console.log` in the script, and the output will appear in the browser console. You can also use the browser's `Debugger` tool to set breakpoints for debugging.
*   **Using [`TestWidgetsNode.ts`](apps/backend/src/nodes/Utilities/TestWidgetsNode.ts:1)**: This node contains examples of various input types. If you encounter issues when implementing the UI or behavior of a specific input type, you can refer to how this node is defined and how it behaves on the frontend to help troubleshoot.
*   **Check Network Requests**: Use the developer tools' `Network` tab to inspect API requests (e.g., loading node definitions) and WebSocket messages between the frontend and backend, ensuring data is transmitted as expected.
*   **Check Code**: `bun tsc -p apps/frontend-vueflow/tsconfig.json --noEmit`, `bun tsc -p apps/backend/tsconfig.json --noEmit`
*   **Node Group Node**: Node group nodes dynamically obtain internal IO slots from referenced workflow groups and display them in their own input and output panels. These slots are not saved to the workflow file but only save the configuration reference information, which is then dynamically obtained upon loading.
*   **Common Type Import**: `@comfytavern/types` is the import path for common types. All common type definitions are uniformly registered through `index.ts`.

## 10. Appendix (Optional)

*   **Common `DataFlowType` and `SocketMatchCategory` List**: Please refer to the project's [`docs/node-types/node-types.zh.md`](docs/node-types/node-types.zh.md) (Chinese) or [`docs/node-types/node-types.en.md`](docs/node-types/node-types.en.md) (English) documents for the most detailed and up-to-date list and explanations.
*   **Introduction to Zod Schema**: Zod is a TypeScript-first schema declaration and validation library. In ComfyTavern, it is primarily used for:
    *   Defining and validating the payload structure of WebSocket messages.
    *   Defining and validating the request and response bodies of backend APIs.
    *   In [`packages/types/src/node.ts`](packages/types/src/node.ts:1), various input configuration options (such as [`zNumericInputOptions`](packages/types/src/node.ts:13)) are defined using Zod Schema. This helps ensure the correctness of the `config` object in node definitions and allows TypeScript types to be inferred from them. When writing custom nodes, you need to ensure that your `config` object properties are compatible with these Zod Schemas.

Hope this guide helps you successfully develop powerful custom nodes!