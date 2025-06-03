# Node Type System Documentation (English Version)

This document outlines the new slot type system for node inputs and outputs in the ComfyTavern project, including `DataFlowType`, `SocketMatchCategory`, configuration options, and their connection compatibility rules.

## 1. Core Concepts

The new type system aims to clearly distinguish the actual data format of the data flow from the matching logic during connection, enhancing flexibility and extensibility.

### 1.1. `DataFlowType`

`DataFlowType` defines the basic data structure for actual transmission and processing by slots. They are relatively stable and universal.

| `DataFlowType` Name | Description                                                                                                                                           | Corresponding TypeScript Type (Example) |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- |
| `STRING`            | General text string                                                                                                                                   | `string`                                |
| `INTEGER`           | Integer number                                                                                                                                        | `number`                                |
| `FLOAT`             | Floating-point number                                                                                                                                 | `number`                                |
| `BOOLEAN`           | Boolean value                                                                                                                                         | `boolean`                               |
| `OBJECT`            | General JavaScript object                                                                                                                             | `object`                                |
| `ARRAY`             | General JavaScript array                                                                                                                              | `any[]`                                 |
| `BINARY`            | Binary data                                                                                                                                           | `ArrayBuffer`, `Uint8Array`             |
| `WILDCARD`          | Special type: Wildcard, does not specify data format, can connect to any type, no forced conversion upon connection.                                  | `any`                                   |
| `CONVERTIBLE_ANY`   | Special type: Dynamically converts upon connection, changing its own `dataFlowType` and `matchCategories` to exactly match the connected counterpart. | `any` (initially)                       |

### 1.2. `SocketMatchCategory` (Socket Matching Category/Tag)

`SocketMatchCategory` is a set of **optional string tags** used to describe the semantics, purpose, content characteristics, or special matching behavior of a slot. It is primarily used for compatibility judgment during connection and, if provided, serves as a priority matching condition. Developers can freely define and use custom tags.

#### 1.2.1. Built-in, Recommended `SocketMatchCategory` Tags

Here are some built-in recommended tags:

**Semantic/Content Feature Tags:**

*   `Code`: Code snippets
*   `Json`: JSON formatted data
*   `Markdown`: Markdown formatted text
*   `Url`: URL string
*   `FilePath`: File path string
*   `Prompt`: Prompt text
*   `ChatMessage`: Single chat message object
*   `ChatHistory`: Chat history array
*   `LlmConfig`: LLM configuration object
*   `LlmOutput`: LLM output result
*   `VectorEmbedding`: Vector embedding data
*   `CharacterProfile`: Character profile/object
*   `ImageData`: Actual image data (usually with `OBJECT` or `BINARY` DataFlowType)
*   `AudioData`: Actual audio data (usually with `OBJECT` or `BINARY` DataFlowType)
*   `VideoData`: Actual video data (usually with `OBJECT` or `BINARY` DataFlowType)
*   `ResourceId`: Resource identifier
*   `Trigger`: Trigger signal (often used for button-like interactions)
*   `StreamChunk`: Data stream chunk
*   `ComboOption`: Used to mark values originating from or applicable to COMBO (dropdown suggestion) selections
*   `UI_BLOCK`: (UI Rendering Hint) Marks this input component to be rendered as a "block" or "block-level" element, rather than an inline compact widget.
*   `CanPreview`: (Action Hint) Marks this input to support the standard inline preview action button.
*   `NoDefaultEdit`: (Action Hint) Marks this input to not display its type's default edit action button (if its type normally has one).

**Behavioral Tags:**

*   `BehaviorWildcard`: Behavioral tag: Wildcard, overrides other rules, can connect to any other slot.
*   `BehaviorConvertible`: Behavioral tag: Convertible, upon connection, it changes its own `dataFlowType` and `matchCategories` to exactly match the connected counterpart.

#### 1.2.2. Custom Tags

Developers can create new tags based on application scenarios, such as `"MySpecificDataFormat"`, `"GameEntityReference"`, etc. It is recommended to establish naming conventions and length limits for custom tags.

## 2. Node Slot Definition

In a node's `InputDefinition` and `OutputDefinition`:

*   The old `type: string` field is replaced by `dataFlowType: DataFlowTypeName`.
*   A new **optional** `matchCategories: string[]` field is added to define semantic or behavioral tags.
*   The `config` object contains specific configuration items to guide frontend UI rendering and interaction behavior.

### 2.1. Common `config` Object Configuration Items

The following are commonly used configuration items within an `InputDefinition`'s `config` object, guiding frontend UI rendering and behavior:

| Config Item                | Type      | Description & Purpose                                                                                                                                                                                                                       | Applicable `DataFlowType` (Example) |
| :------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------- |
| `default`                  | `any`     | The default value for the slot.                                                                                                                                                                                                             | All                                 |
| `multiline`                | `boolean` | Whether it's a multi-line input. `true` usually renders as a text area, `false` as a single-line input field.                                                                                                                               | `STRING`                            |
| `placeholder`              | `string`  | Placeholder text for the input field.                                                                                                                                                                                                       | `STRING`, `INTEGER`, `FLOAT`        |
| `languageHint`             | `string`  | Specifies the language for a code editor (e.g., `'javascript'`, `'python'`, `'json'`, `'markdown'`). When `dataFlowType` is `STRING`, this configuration is used to specify the code editor and its language highlighting for the frontend. | `STRING`                            |
| `suggestions`              | `any[]`   | Provides a list of suggested values. The frontend can render this as a combo-box/select.                                                                                                                                                    | `STRING`, `INTEGER`, `FLOAT`        |
| `min`, `max`, `step`       | `number`  | Minimum, maximum, and step values for numeric types. Can be used for rendering sliders, etc.                                                                                                                                                | `INTEGER`, `FLOAT`                  |
| `label`                    | `string`  | Primarily used for the display text of buttons (`Trigger` type).                                                                                                                                                                            | `WILDCARD` (with `Trigger`)         |
| `readOnly` / `displayOnly` | `boolean` | Indicates the input is read-only; the frontend should render it as non-editable text.                                                                                                                                                       | `STRING`, etc.                      |
| `displayAs`                | `string`  | (Optional new) More explicitly specifies non-default UI representation, e.g., `'slider'`, `'color-picker'`.                                                                                                                                 | Specific types                      |
| `bottomEditorMode`         | `string`  | (Optional) Configures the mode of the bottom docked editor: `'lightweightSingle'` (lightweight single-page editing) or `'fullMultiTab'` (full-featured multi-tab editing, default). Used for editing complex content (like code, JSON).     | `STRING`, `OBJECT`, `ARRAY`         |
| `showPreview`              | `boolean` | (Specific to images, etc.) Whether to display a preview.                                                                                                                                                                                    | `OBJECT`, `BINARY`, `STRING` (URL)  |
| `maxWidth`, `maxHeight`    | `number`  | (Specific to images, etc.) Maximum width/height for the image preview.                                                                                                                                                                      | `OBJECT`, `BINARY`, `STRING` (URL)  |

**Other Top-Level Properties**:

*   `displayName: string`: Name displayed in the UI.
*   `description: string`: Detailed description of the slot, often used in Tooltips.
*   `required: boolean | ((inputs: Record<string, any>, configValues: Record<string, any>) => boolean)`: (Input only) Defines if this input is mandatory.
*   `multi: boolean`: (Input only) If `true`, this input slot can accept multiple connections.
    *   `acceptTypes: string[]`: (Only when `multi: true`) Defines a list of `DataFlowType` or `SocketMatchCategory` tags that this multi-input slot accepts. Exact matching is performed during connection.
*   `hideHandle: boolean`: (Optional) If `true`, the connection point (Handle) for this slot will be hidden in the frontend UI.
*   `actions: NodeInputAction[]`: (Optional) Defines an array of action buttons displayed next to the input slot, used for providing quick actions like preview, edit, etc. See the "Input Action Buttons (`actions`)" section below for details.

### 2.2. Tooltip Information

A slot's Tooltip will typically display its `displayName`, `description`, and may additionally show its `dataFlowType` and all `matchCategories` (both built-in and custom) to help users understand the slot's nature.

### 2.3. UI Component Selection Logic

The choice and rendering method of frontend UI components will primarily depend on `DataFlowType`, `SocketMatchCategory` (optional, for semantic understanding), and specific configuration items within the `InputDefinition.config` object.

For example:

*   `dataFlowType: 'STRING'`, `config: { multiline: true }` -> Multi-line text input.
*   `dataFlowType: 'STRING'`, `matchCategories: ['Code']`, `config: { languageHint: 'javascript' }` -> JavaScript code editor (in the bottom docked editor).
*   `dataFlowType: 'INTEGER'`, `config: { suggestions: [1, 2, 3], default: 1 }` -> Integer input with suggestions or a dropdown.
*   `dataFlowType: 'WILDCARD'`, `matchCategories: ['Trigger']`, `config: { label: 'Execute' }` -> A button displaying "Execute".

### 2.4. Input Action Buttons (`actions`)

The `actions` property in `InputDefinition` allows defining a set of custom action buttons for an input slot. Each action button is defined by a `NodeInputAction` object with the following structure:

| Property Name      | Type                                                                                             | Description                                                                                                                                                                                                |
| :----------------- | :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `string`                                                                                         | Unique ID to identify the action. Also used to override standard actions; e.g., if this ID is `'builtin_preview'`, this definition will override the default preview button.                               |
| `icon`             | `string` (optional)                                                                              | Icon name (Heroicons v2 outline style names in camelCase are recommended, e.g., `'eye'`, `'pencilSquare'`). If not provided, the `NodeInputActionsBar.vue` component will try to provide a default icon based on `handlerType` or `id`. |
| `label`            | `string` (optional)                                                                              | Text label displayed on the button, can be used with or instead of an `icon`.                                                                                                                            |
| `tooltip`          | `string` (optional)                                                                              | Tooltip text for the button.                                                                                                                                                                             |
| `handlerType`      | `'builtin_preview'`, `'builtin_editor'`, `'emit_event'`, `'client_script_hook'`, `'open_panel'` | How the action is handled:<br> - `'builtin_preview'`: Uses built-in Tooltip preview logic.<br> - `'builtin_editor'`: Uses a built-in method to open an editor.<br> - `'emit_event'`: Emits a custom event.<br> - `'client_script_hook'`: Calls a defined hook function in the node's client script.<br> - `'open_panel'`: Triggers opening a specified sidebar panel or modal. |
| `handlerArgs`      | `Record<string, any>` (optional)                                                                 | Arguments passed to the handler, structure depends on `handlerType`. Examples:<br> - for `'builtin_editor'`: `{ editorType?: string, languageHint?: string, preferFloatingEditor?: boolean }`<br> - for `'open_panel'`: `{ panelId: string, panelTitle?: string, ... }`<br> - for `'emit_event'`: `{ eventName: string, eventPayload?: any }`<br> - for `'client_script_hook'`: `{ hookName: string, hookPayload?: any }` |
| `showConditionKey` | `string` (optional, defaults to `'always'`)                                                      | Predefined key to control button visibility (e.g., `'always'`, `'ifNotConnected'`, `'ifHasValue'`, `'never'`). The frontend component will implement the logic for these conditions.                   |

These action buttons are rendered and managed by the frontend component `NodeInputActionsBar.vue`. Semantic tags `CanPreview` and `NoDefaultEdit` can influence the display of default preview and edit buttons, while the `actions` array provides finer-grained control.

### 2.5. Example Slot Definition (referencing `TestWidgetsNode.ts`)

```typescript
// Example: Markdown input slot
inputs: {
  markdown_input: {
    dataFlowType: 'STRING',
    displayName: 'Markdown Text',
    description: 'Test input for Markdown content',
    required: false,
    matchCategories: ['Markdown'], // Clearly Markdown
    config: {
      default: '# Title...',
      multiline: true,
      languageHint: 'markdown' // Assists frontend editor
    }
  }
}

// Example: JSON object input
inputs: {
  json_input: {
    dataFlowType: 'OBJECT', // Or 'STRING' if stringified JSON is expected
    displayName: 'JSON Object',
    matchCategories: ['Json'], // Semantic tag
    config: {
      default: { "key": "value" },
      languageHint: 'json' // Useful if dataFlowType is STRING
    }
  }
}

// Example: Dropdown selection (Combo)
inputs: {
  combo_select: {
    dataFlowType: 'STRING', // Assuming option values are strings
    displayName: 'Dropdown Select',
    matchCategories: ['ComboOption'], // Marks as COMBO option source
    config: {
      default: 'OptionA',
      suggestions: ['OptionA', 'OptionB', 'OptionC']
    }
  }
}
```

## 3. Connection Compatibility Rules

The validity of a connection is determined by the following order and logic:

### 3.1. Impact of Special Behavioral Tags (`SocketMatchCategory`) (Highest Priority)

*   **`BEHAVIOR_WILDCARD`**: If a slot has this tag (typically with `dataFlowType` as `WILDCARD`), it overrides other rules and can connect to any other slot. After connection, the node's internal logic can perceive the `dataFlowType` and `matchCategories` of the counterpart.
*   **`BEHAVIOR_CONVERTIBLE`**: If a slot has this tag (typically with `dataFlowType` as `CONVERTIBLE_ANY`), upon connection, it changes its own `dataFlowType` and all other `matchCategories` (except `BEHAVIOR_CONVERTIBLE` itself) to exactly match the connected counterpart. This change is persistent and takes precedence over other matching logic.

### 3.2. Priority Matching Based on `SocketMatchCategory` (Semantic/Behavioral Tags)

*   This matching occurs only if **both the source and target slots have defined `matchCategories` (and the `matchCategories` arrays are not empty)**.
*   Let the source slot's `matchCategories` be `SourceTags`, and the target slot's be `TargetTags`.
*   **Direct Match**: If `SourceTags` and `TargetTags` share at least one common tag, they are considered compatible.
*   **Built-in Compatibility Rules**: (If defined in the future) If a direct match fails, a predefined rule set is queried, which specifies unidirectional or bidirectional compatibility between certain `SocketMatchCategory` tags.
*   If compatibility is found through these means, the connection is considered valid.

### 3.3. Fallback Matching Based on `DataFlowType`

*   This matching occurs if:
    *   `SocketMatchCategory` matching did not occur (e.g., at least one slot did not define `matchCategories`, or the defined array was empty).
    *   Or, `SocketMatchCategory` matching occurred but failed to establish compatibility.
*   Compatibility is based on predefined `DataFlowType` conversion rules:
    *   `INTEGER` can connect to `FLOAT` (implicit conversion).
    *   `INTEGER`, `FLOAT`, `BOOLEAN` can connect to `STRING` (implicitly converted to string).
    *   `WILDCARD` can connect to any `DataFlowType`. Any `DataFlowType` can also connect to `WILDCARD`.
    *   `CONVERTIBLE_ANY` changes its own `dataFlowType` to exactly match the counterpart upon connection.
*   If compatibility is found through `DataFlowType` rules, the connection is considered valid.

**Summary of Connection Logic Priority:**

1.  Special behavioral tags (`BEHAVIOR_WILDCARD`, `BEHAVIOR_CONVERTIBLE`) have the highest priority.
2.  If both slots provide valid `SocketMatchCategory` lists, matching based on these tags is attempted first.
3.  If `SocketMatchCategory` is not provided or matching fails, fallback to `DataFlowType`-based matching.

**Additional Rules for Multi-Input Slots (`multi: true`):**

*   If an input slot defines `multi: true`, it can accept multiple connections.
*   **Type Checking**:
    *   If `acceptTypes` (an array of strings, which can be `DataFlowType` names or `SocketMatchCategory` tags) is defined, the output type of each connection must **exactly match** *at least one* entry in `acceptTypes`.
    *   If `acceptTypes` is not defined, each connection must be compatible with the input slot's own type definition (its `dataFlowType` and `matchCategories`), following the connection logic described above.

**Important Note:** These rules are primarily enforced by the frontend to provide immediate feedback. The backend may perform additional validation or conversion during execution.

## 4. Node-Level Configuration

A `NodeDefinition` can include configurations independent of its slots:

*   **`configSchema`**: Defines node-level configuration items (similar in structure to `inputs`), displayed in a separate area on the node body.
*   **`configValues`**: Stores the actual values for configuration items defined by `configSchema`.
*   **`clientScriptUrl`**: (Optional) URL pointing to a node-specific frontend JS file for handling custom client-side logic (e.g., button interactions in `RandomNumberNode.ts`).
*   **`width`**: (Optional) Preferred rendering width for the node (in pixels), adjustable by the user.
*   **Group-related properties**: `isGroupInternal`, `groupId`, `groupConfig`, `dynamicSlots`.
*   **`data.groupInfo`**: (Frontend) If the node is a `NodeGroup`, its `data` may contain `groupInfo`.

## 5. Execution Status

The status of a node during workflow execution is defined by the `ExecutionStatus` enum:

*   `IDLE`: Idle/Not executed
*   `PENDING`: Waiting for execution (dependencies not ready)
*   `RUNNING`: Currently executing
*   `COMPLETED`: Executed successfully
*   `ERROR`: Error during execution
*   `SKIPPED`: Skipped (node disabled or condition not met)

The frontend changes the visual style of nodes based on backend status updates.

## 6. WebSocket Communication

The node system relies on WebSockets for frontend-backend communication. Message types are defined in `WebSocketMessageType` within `packages/types/src/node.ts`. This includes workflow operations, node definition retrieval, execution control, status updates, etc.
