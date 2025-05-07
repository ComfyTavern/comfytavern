# Node Type System Documentation (English Version)

This document outlines the data types used for node inputs and outputs, configuration options, and connection rules between them within the ComfyTavern project.

## Core Data Types

The following types define the kind of data processed by a node's input or output slots. Configuration options are typically defined within the `config` object of the corresponding slot in the `NodeDefinition`. Common UI options (`tooltip`, `hidden`, `showReceivedValue`) are also defined within the `config` object. The `required` property is a top-level property of the `InputDefinition`.

| Type                    | Description                                     | UI Component (Example)                                                                                                           | Transferred Data Type  | Configuration Options (`config` object, unless noted) & Notes                                                                                                                                                                                                                             |
| :---------------------- | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INT`                   | Integer (whole number)                          | `NumberInput` (inline)                                                                                                           | `number`               | `config`: `default`, `min`, `max`, `step`, `suggestions` (array of numbers), `tooltip`, `hidden`, `showReceivedValue`. Top-level: `required` (bool or function), `defaultValue`, `min`, `max` (Note: Top-level props might overlap with config; priority depends on node implementation). |
| `FLOAT`                 | Floating-point number (decimal)                 | `NumberInput` (inline)                                                                                                           | `number`               | `config`: `default`, `min`, `max`, `step`, `suggestions` (array of numbers), `tooltip`, `hidden`, `showReceivedValue`. Top-level: `required` (bool or function), `defaultValue`, `min`, `max` (Note: Top-level props might overlap with config; priority depends on node implementation). |
| `STRING`                | Text string                                     | `StringInput` (inline, `multiline:false`), `TextAreaInput` (block, `multiline:true`), `TextDisplay` (block, `display_only:true`) | `string`               | `config`: `default`, `multiline` (boolean), `placeholder`, `display_only` (boolean), `suggestions` (array of strings), `tooltip`, `hidden`, `showReceivedValue`. Top-level: `required` (bool or function), `defaultValue`.                                                                |
| `BOOLEAN`               | Boolean value (true or false)                   | `BooleanToggle` (inline)                                                                                                         | `boolean`              | `config`: `default`, `tooltip`, `hidden`, `showReceivedValue`. Top-level: `required` (bool or function), `defaultValue`.                                                                                                                                                                  |
| `COMBO`                 | Selection from a predefined list                | `SelectInput` (inline)                                                                                                           | `string` or `number`   | `config`: `options` (array of strings/numbers), `default`, `tooltip`, `hidden`, `showReceivedValue`. Transmits the _value_ of the option. Top-level: `required` (bool or function), `defaultValue`.                                                                                       |
| `CODE`                  | Code snippet (e.g., JavaScript, JSON)           | `CodeInput` (block-level)                                                                                                        | `string`               | `config`: `default`, `language` (string, e.g., 'javascript'), `placeholder`, `tooltip`, `hidden`, `showReceivedValue`. UI includes syntax highlighting. Top-level: `required` (bool or function), `defaultValue`.                                                                         |
| `BUTTON`                | Action trigger                                  | `ButtonInput` (block-level)                                                                                                      | Event                  | `config`: `label` (button text), `tooltip`, `hidden`. Does not transfer persistent data; clicking triggers a backend action (via `button_click` WebSocket event) or client-side script (`clientScriptUrl`). Top-level: `required` is usually false.                                       |
| `WILDCARD` (`*`, `ANY`) | Any data type (compatibility wildcard)          | (Depends on connection)                                                                                                          | `any`                  | `config`: `tooltip`, `hidden`, `showReceivedValue`. Used for flexibility, only indicates compatibility, does not change type on connection. See Type Compatibility Rules.                                                                                                                 |
| `CONVERTIBLE_ANY`       | Dynamically Convertible Type                    | (Depends on connection; behaves like the concrete type after connection)                                                         | `any` (initially)      | `config`: `tooltip`, `hidden`, `showReceivedValue`. Actually changes its own type to match the other end upon connection; change is persisted and may sync group interface. See Type Compatibility Rules.                                                                                 |
| `HISTORY`               | (Specific use) Typically for chat history, etc. | `TextAreaInput` (block-level)                                                                                                    | `any` / `object[]`     | `config`: `tooltip`, `hidden`, `showReceivedValue`. Top-level: `required` (bool or function), `defaultValue`.                                                                                                                                                                             |
| `RESOURCE_SELECTOR`     | Resource selector (e.g., workflow, image)       | `ResourceSelectorInput` (block-level)                                                                                            | `string` (resource ID) | `config`: `acceptedTypes` (array, defines selectable resource types, e.g., `[{ value: 'workflow', label: 'Workflow' }]`), `editable` (boolean), `placeholder`, `tooltip`, `hidden`, `showReceivedValue`. Top-level: `required` (bool or function), `defaultValue`.                        |

**Notes:**

- **UI Components**: The UI components listed above are examples implemented in the frontend (`apps/frontend-vueflow/src/components/graph/inputs/index.ts`). The actual rendered component is determined by the `getInputComponent` function based on the type and `config` (like `multiline`, `display_only`). Inline components (e.g., `NumberInput`, `StringInput`, `BooleanToggle`, `SelectInput`) are typically displayed next to the slot when the input is unconnected. Block-level components (e.g., `TextAreaInput`, `CodeInput`, `ButtonInput`, `TextDisplay`, `ResourceSelectorInput`) are typically displayed within the main node body area.
- **Configuration Options**: The `config` object within a node's `InputDefinition` can contain type-specific options (e.g., `StringInputOptions`, `NumericInputOptions`) as well as common UI options (`tooltip`, `hidden`, `showReceivedValue`). These customize UI behavior and validation. `required` is a top-level property of the `InputDefinition` and can be a boolean or a function returning a boolean for conditional requirements. The `InputDefinition` interface itself also defines top-level `defaultValue`, `min`, `max` properties, which might overlap with similarly named fields in `config`; the specific behavior depends on the node implementation.
- **`suggestions`**: For `INT`, `FLOAT`, and `STRING` types, `suggestions` provides a list of recommended values, but the user can still input other valid values of that type.
- **`showReceivedValue`**: If an input is connected and this option is `true`, the block-level input component may remain visible even with a connection to display the received value (specific behavior depends on frontend implementation).
- **`display_only`**: For the `STRING` type, if this option is `true`, the frontend will use the read-only `TextDisplay` component (block-level) to show the text content.
- **Slot Name Display**: The frontend (`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`) displays slot names with the following priority: **Tooltip Content** -> Prefers `description` (formats `\\n` to newline), then `displayName` or `key`. **Direct Display** -> Prefers `displayName`, then `description` (formatted), finally `key`.

## Type Compatibility Rules

Connections between output slots and input slots are based on the following rules, primarily enforced by the frontend (`apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts`) when creating connections:

1.  **Exact Match:** Any type can connect to the same type (e.g., `STRING` -> `STRING`, `INT` -> `INT`).

2.  **Wildcard and Dynamic Types:**

    - **`WILDCARD` (or `*`, `ANY`)**:
      - This is purely a compatibility wildcard.
      - Any type can connect to a `WILDCARD` input (`*` -> `WILDCARD`).
      - A `WILDCARD` output can connect to any type (`WILDCARD` -> `*`).
      - When a connection is made, the type of the `WILDCARD` slot **does not** change. It merely indicates "accepts any type" or "can be any type."
    - **`CONVERTIBLE_ANY` (Dynamically Convertible Type)**:
      - This is a special dynamic type whose slot **actually changes its own type** upon connection to match the other end.
      - When a `CONVERTIBLE_ANY` **output** connects to a specific type **input** (e.g., `STRING`), the `CONVERTIBLE_ANY` output slot's type **actually becomes** `STRING`.
      - When a specific type **output** (e.g., `FLOAT`) connects to a `CONVERTIBLE_ANY` **input**, the `CONVERTIBLE_ANY` input slot's type **actually becomes** `FLOAT`.
      - This type change is **persisted** and updates the node data. If it involves `GroupInput` or `GroupOutput` nodes, it also triggers synchronization of the central workflow interface.
      - `CONVERTIBLE_ANY` **cannot** directly connect to `WILDCARD` or another `CONVERTIBLE_ANY`.
      - UI: Typically no specific component; depends on the concrete type after connection.
      - Config: Shares common UI config (`tooltip`, `hidden`, `showReceivedValue`) defined within the `config` object. Top-level properties `required` (bool or function) and `defaultValue` also apply.

3.  **Numeric Conversion:**

    - `INT` can connect to `FLOAT` (`INT` -> `FLOAT`). (Implicit conversion)

4.  **Conversion to String:**

    - `INT` can connect to `STRING` (`INT` -> `STRING`).
    - `FLOAT` can connect to `STRING` (`FLOAT` -> `STRING`).
    - `BOOLEAN` can connect to `STRING` (`BOOLEAN` -> `STRING`).

5.  **Special Text Compatibility:**

    - `STRING` can connect to `CODE` (`STRING` -> `CODE`). (Treats plain text as code)
    - `STRING` can connect to `COMBO` (`STRING` -> `COMBO`). (The string value **must** exactly match one of the values in the target `COMBO` input's `config.options` array).
    - **Note:** Direct connection from `INT`/`FLOAT` to `COMBO` is no longer supported.

6.  **Multi-Input Slots (`multi: true`):**
    - If an input slot definition includes `multi: true` (as a top-level property), it can accept multiple incoming connections _simultaneously_.
    - **Type Checking**:
      - If the input slot also defines `acceptTypes` (an array of type strings, top-level property), then the output type of each incoming connection must **exactly match** _at least one_ of the type strings in the `acceptTypes` array (no other conversion rules apply).
      - If `acceptTypes` is not defined, then each incoming connection must be compatible with the input slot's own `type` (following rules 1-5 above, noting the behavior of `WILDCARD` and `CONVERTIBLE_ANY`).
    - The node's `execute` function typically receives an array of values for these inputs.

**Important Note:** These rules are primarily enforced by the frontend to provide immediate user feedback. The backend might perform additional validation or type conversions during workflow execution.

## Node-Level Configuration

A `NodeDefinition` can contain configurations related to the node itself, rather than its input/output slots:

- **`configSchema`**: Defines node-level configuration options, structured similarly to `inputs`, using `InputDefinition` to describe each config item's type, name, UI, etc. These options are typically displayed in a separate area within the node body (in `.node-configs` within `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`).
- **`configValues`**: Stores the actual values for these node-level configuration items.
- **`clientScriptUrl`**: (Optional) A URL pointing to a frontend JavaScript file specific to this node. The script can handle custom logic, such as responding to `BUTTON` click events.
- **`width`**: (Optional) The preferred width (in pixels) for the node when rendered on the canvas. Users can still resize it manually.
- **Group-Related Properties**:
  - `isGroupInternal`: (Boolean) If `true`, this node type can only be used inside a Node Group.
  - `groupId`: (String) The ID of the group this node belongs to (if it's an instance within a group).
  - `groupConfig`: (Object) Contains group-specific configurations, e.g., `allowExternalUse` (boolean, whether it can be used outside the group).
  - `dynamicSlots`: (Boolean) Marks if the node supports dynamic addition/removal of slots (e.g., `GroupInput` / `GroupOutput` nodes).
- **`data.groupInfo`**: (Frontend) If the node is a `NodeGroup`, its `data` object may contain `groupInfo` used to display statistics (number of nodes, inputs, outputs) in the frontend.

This allows nodes to have configurable parameters independent of their input/output data (e.g., setting specific parameters for a model or selecting a referenced workflow).

## Execution Status

Nodes can be in different states during workflow execution, defined by the `ExecutionStatus` enum (`packages/types/src/node.ts`):

- `IDLE`: Idle/Not executed
- `PENDING`: Waiting for execution (e.g., dependent inputs not ready)
- `RUNNING`: Currently executing
- `COMPLETED`: Execution finished successfully
- `ERROR`: Execution failed
- `SKIPPED`: Skipped (e.g., node disabled or bypassed conditionally)

The frontend (`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`) changes the node's visual style based on status updates received from the backend (via the `NODE_STATUS_UPDATE` WebSocket message):

- **Border Color**: Running (`RUNNING`) - Yellow, Completed (`COMPLETED`) - Green, Error (`ERROR`) - Red, Selected (`selected`) - Blue.
- **Opacity**: Skipped (`SKIPPED`) - Reduced opacity, border becomes dashed.
- **Error Indication**: In the Error state, the node title turns red, and the error message is shown in a tooltip. (Note: The code does not display a specific icon for execution errors but uses a red title and tooltip).

## WebSocket Communication

The node system relies on WebSockets (`WebSocketMessageType` enum in `packages/types/src/node.ts`) for frontend-backend communication for actions like:

- Loading/Saving/Listing Workflows (`LOAD_WORKFLOW`, `SAVE_WORKFLOW`, `LIST_WORKFLOWS`)
- Getting Node Definitions (`GET_NODE_DEFINITIONS`)
- Executing Workflows (`EXECUTE_WORKFLOW`)
- Triggering Button Actions (`BUTTON_CLICK`)
- Updating Node and Workflow Status (`NODE_STATUS_UPDATE`, `WORKFLOW_STATUS_UPDATE`)
- Sending Execution Results and Error Messages (`EXECUTION_RESULT`, `ERROR`)
- Reloading the Backend (`RELOAD_BACKEND`)
- Confirming Operations (`WORKFLOW_LOADED`, `WORKFLOW_SAVED`, `WORKFLOW_LIST`, `NODE_DEFINITIONS`, `BACKEND_RELOADED`)
