# 修复：GroupInput/Output 插槽渲染与连接问题

## 问题描述

1.  **插槽渲染不一致**: 画布上的 `GroupInput` 节点显示的输出句柄（插槽）与侧边栏“工作流接口”中定义的输入接口不一致，特别是缺少动态添加的 `* CONVERTIBLE_ANY` 插槽。类似地，`GroupOutput` 节点的输入句柄也可能与侧边栏的输出接口不一致。
2.  **连接验证失败**: 尝试从 `GroupInput` 的输出句柄或连接到 `GroupOutput` 的输入句柄时，连接操作失败，控制台报错提示“无法找到源输出/目标输入的定义”。

## 根源分析

经过详细调试，发现问题并非单一原因，而是由多个层面的逻辑错误和类型定义问题叠加导致：

1.  **`useGroupIOSlots.ts` 逻辑错误 (计算插槽)**:
    *   在计算 `GroupInput` 节点的输出 (`finalOutputs`) 时，错误地从 `workflowStore` 的 `interfaceOutputs` 读取，而不是正确的 `interfaceInputs`。
    *   在判断节点类型时，错误地尝试从 `props.data.nodeType` 读取，而正确的节点类型信息位于顶层的 `props.type`。

2.  **`BaseNode.vue` Props 类型错误**:
    *   该组件使用自定义的 `UseNodeStateProps` 类型来定义其 props，该类型缺少 VueFlow 节点标准的顶层 `type` 属性。这导致传递给 `useGroupIOSlots` 的 `props` 对象缺少类型信息，使其无法正确判断节点类型。

3.  **`useCanvasConnections.ts` 逻辑错误 (连接验证)**:
    *   `isValidConnection`, `createEdge`, 和 `handleConnect` 函数在查找源/目标插槽定义时，没有正确处理 `GroupInput` 和 `GroupOutput` 类型。它们错误地假设这些节点的插槽定义存储在节点的 `data` 属性中，而实际上它们是由 `workflowStore` 中的 `interfaceInputs`/`interfaceOutputs` 动态决定的。

4.  **`packages/types/src/schemas.ts` 类型定义缺失**:
    *   为 Group IO 定义的 `GroupSlotInfo` 类型缺少 `acceptTypes` 和 `multi` 这两个属性。当 `useCanvasConnections.ts` 中的代码尝试访问这些属性（用于连接验证和多重连接逻辑）时，引发了 TypeScript 类型错误。

这些问题共同导致了 `GroupInput`/`GroupOutput` 节点的插槽渲染不正确，并且涉及这些节点的连接操作失败。

## 解决方案

针对上述问题，我们实施了一系列修复：

1.  **修改 `useGroupIOSlots.ts`**:
    *   修正了计算 `GroupInput` 节点 `finalOutputs` 的逻辑，使其从 `workflowStore.interfaceInputs` 读取。
    *   修正了获取节点类型的逻辑，使其从 `props.type` 读取。

2.  **修改 `BaseNode.vue`**:
    *   将 `defineProps` 使用的类型从 `UseNodeStateProps` 更改为 `@vue-flow/core` 提供的标准 `NodeProps`，确保 `props.type` 可用。

3.  **修改 `useCanvasConnections.ts`**:
    *   重构了 `isValidConnection`, `createEdge`, 和 `handleConnect` 函数内部查找插槽定义的逻辑。
    *   添加了对 `sourceNode.type === 'GroupInput'` 和 `targetNode.type === 'GroupOutput'` 的判断，当匹配时，从 `workflowStore` 的 `interfaceInputs` 或 `interfaceOutputs` 获取相应的插槽定义。

4.  **修改 `packages/types/src/schemas.ts`**:
    *   在 `GroupSlotInfoSchema` 中添加了可选的 `acceptTypes: z.array(z.string()).optional()` 和 `multi: z.boolean().optional()` 属性，以匹配普通节点输入定义的结构，解决 TypeScript 类型错误。

## 预期效果

*   `useGroupIOSlots` 能够正确识别 `GroupInput`/`GroupOutput` 节点类型，并根据 `workflowStore` 中正确的中央接口定义计算出应显示的插槽列表 (`finalInputs`/`finalOutputs`)。
*   `BaseNode.vue` 能够接收到正确的插槽列表并将其渲染为画布上的句柄。
*   `useCanvasConnections` 在进行连接验证和创建时，能够正确查找到 `GroupInput`/`GroupOutput` 节点的插槽定义。
*   解决了 `GroupInput`/`GroupOutput` 节点插槽渲染不一致以及连接失败的问题。