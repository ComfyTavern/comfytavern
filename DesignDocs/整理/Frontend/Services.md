# ComfyTavern 前端服务概述

## 1. 引言

ComfyTavern 前端应用中的服务层（位于 [`apps/frontend-vueflow/src/services/`](apps/frontend-vueflow/src/services/) 目录）扮演着至关重要的角色。它们封装了与特定功能相关的业务逻辑、状态管理或与外部资源（如后端 API）的交互。服务的设计旨在提高代码的模块化程度、可复用性和可测试性，使得应用结构更清晰，功能更易于维护和扩展。通过将复杂的逻辑抽象到服务中，Vue 组件可以保持相对简洁，专注于视图渲染和用户交互。

## 2. 核心服务介绍

以下是 ComfyTavern 前端应用中的一些核心服务：

### 2.1 DialogService

*   **文件路径**: [`apps/frontend-vueflow/src/services/DialogService.ts`](apps/frontend-vueflow/src/services/DialogService.ts:1)
*   **主要职责**: `DialogService` 提供了一个全局的、统一的方式来显示模态对话框（如消息提示、确认框、输入框）和非模态通知（Toasts）。它简化了在应用各处触发这些 UI 元素的逻辑，并管理它们的队列和状态。
*   **核心API/方法**:
    *   **对话框 (Dialogs)**:
        *   `showMessage(options: UniversalDialogOptions): Promise<void>`: 显示一个简单的消息对话框。
            *   `options`: 包含 `title`, `message`, `confirmText`, `showCloseIcon`, `closeOnBackdrop`, `autoClose` 等。
            *   返回一个在对话框关闭时 resolve 的 Promise。
        *   `showConfirm(options: UniversalDialogOptions): Promise<boolean>`: 显示一个确认对话框，通常有“确定”和“取消”按钮。
            *   `options`: 包含 `title`, `message`, `confirmText`, `cancelText`, `dangerConfirm` 等。
            *   用户点击“确定”时 Promise resolve `true`，否则 resolve `false`。
        *   `showInput(options: UniversalDialogOptions): Promise<string | null>`: 显示一个带输入框的对话框。
            *   `options`: 包含 `title`, `message`, `initialValue`, `inputPlaceholder`, `inputType`, `inputRows` 等。
            *   用户点击“确定”时 Promise resolve 输入的字符串，否则 resolve `null`。
    *   **通知 (Toasts)**:
        *   `showToast(options: ToastOptions): string`: 显示一个通用的通知。
            *   `options`: 包含 `title`, `message`, `type` ('info', 'success', 'warning', 'error'), `duration`, `position`。
            *   返回通知的唯一 ID。
        *   便捷方法:
            *   `showSuccess(message: string, title?: string, duration?: number): string`
            *   `showError(message: string, title?: string, duration?: number): string`
            *   `showWarning(message: string, title?: string, duration?: number): string`
            *   `showInfo(message: string, title?: string, duration?: number): string`
*   **状态管理**:
    *   该服务通过 Pinia store `useDialogService` 进行状态管理。
    *   Store 内部管理 `activeDialog` (当前活动的对话框实例)、`dialogQueue` (等待显示的对话框队列) 和 `toasts` (当前显示的通知列表)。
*   **相关组件**:
    *   对话框 UI 由 [`apps/frontend-vueflow/src/components/common/Dialog.vue`](apps/frontend-vueflow/src/components/common/Dialog.vue:1) 组件渲染（由服务动态导入）。
    *   通知 UI 由 [`apps/frontend-vueflow/src/components/common/ToastNotification.vue`](apps/frontend-vueflow/src/components/common/ToastNotification.vue:1) 渲染。
    *   通知的容器和管理由 [`apps/frontend-vueflow/src/components/common/DialogContainer.vue`](apps/frontend-vueflow/src/components/common/DialogContainer.vue:1) 负责，它通常放置在应用顶层。
*   **使用示例**:
    ```typescript
    import { useDialogService } from '@/services/DialogService'; // 路径根据实际项目结构调整

    const dialogService = useDialogService();

    async function handleDelete() {
      const confirmed = await dialogService.showConfirm({
        title: '确认删除',
        message: '您确定要删除这个项目吗？此操作不可撤销。',
        dangerConfirm: true,
      });

      if (confirmed) {
        // 执行删除逻辑
        dialogService.showSuccess('项目已成功删除！');
      } else {
        dialogService.showInfo('删除操作已取消。');
      }
    }

    async function askForName() {
      const name = await dialogService.showInput({
        title: '请输入名称',
        inputPlaceholder: '例如：我的新工作流'
      });
      if (name !== null) {
        console.log('用户输入的名称:', name);
      }
    }
    ```

### 2.2 SillyTavernService

*   **文件路径**: [`apps/frontend-vueflow/src/services/SillyTavernService.ts`](apps/frontend-vueflow/src/services/SillyTavernService.ts:1)
*   **主要职责**: `SillyTavernService` 负责处理与 SillyTavern 角色卡相关的功能，主要是从后端加载角色卡数据，并将其转换为前端 UI 显示所需的格式。它也提供了获取默认角色卡的备用方案。
*   **核心API/方法**:
    *   `getInstance(): SillyTavernService`: 获取服务的单例实例。
    *   `async loadCharacterCards(): Promise<CharacterCardUI[]>`: 异步从后端 API (`/api/characters`) 加载角色卡数据。它内部使用 `useApi` 工具进行网络请求，并处理响应和错误。
    *   `mapBackendCharToUI(backendChar: ApiCharacterEntry): CharacterCardUI`: 一个私有方法，用于将从后端获取的 `ApiCharacterEntry` 对象映射为前端 `CharacterCardUI` 接口兼容的格式，包括处理图片 URL 的构建。
    *   `getDefaultCharacters(): CharacterCardUI[]`: 返回一组预定义的默认角色卡数据，主要用于在后端数据加载失败或无数据时提供备选内容。
    *   `async getCharacterCards(): Promise<CharacterCardUI[]>`: 公开方法，尝试加载角色卡，如果加载失败或返回空，则调用 `getDefaultCharacters()` 返回默认角色。
*   **状态管理**:
    *   `SillyTavernService` 本身不直接管理 Pinia store，它是一个单例类，其状态（如果有的话）是类实例内部的。它主要负责数据的获取和转换。
*   **相关组件**:
    *   此服务获取的数据主要用于渲染角色卡列表和详情的组件，例如 [`apps/frontend-vueflow/src/views/CharacterCardView.vue`](apps/frontend-vueflow/src/views/CharacterCardView.vue:1) 或其他展示角色卡信息的组件。
*   **使用示例**:
    ```typescript
    import { sillyTavernService } from '@/services/SillyTavernService';
    import type { CharacterCardUI } from '@comfytavern/types';
    import { ref, onMounted } from 'vue';

    const characterCards = ref<CharacterCardUI[]>([]);
    const isLoading = ref(true);

    onMounted(async () => {
      try {
        characterCards.value = await sillyTavernService.getCharacterCards();
      } catch (error) {
        console.error('加载角色卡失败:', error);
        // 可以选择显示错误信息给用户
      } finally {
        isLoading.value = false;
      }
    });
    ```

## 3. 服务的设计原则与使用模式

ComfyTavern 前端服务的设计遵循一些通用的软件设计原则，以确保代码的质量和可维护性：

*   **单一职责原则 (SRP)**: 每个服务都专注于一个特定的功能领域。例如，`DialogService` 只处理对话框和通知，而 `SillyTavernService` 只处理角色卡相关逻辑。这使得服务更易于理解、测试和修改。
*   **封装**: 服务封装了其内部的实现细节，只通过定义良好的 API 对外暴露功能。这降低了服务消费者与服务实现之间的耦合度。
*   **依赖注入 (通过 Pinia)**: 对于像 `DialogService` 这样需要管理全局状态或与 UI 紧密相关的服务，通常会结合 Pinia store 使用。Vue 组件或其他的 Composable 函数可以通过 `useDialogService()` 这样的钩子函数来“注入”并使用服务实例及其状态。
*   **异步操作处理**: 许多服务操作（如 API 请求）本质上是异步的。服务通常使用 `Promise` 来处理这些异步操作，允许调用者使用 `async/await` 或 `.then().catch()` 来处理结果和错误。
*   **单例模式**: 对于某些全局性的服务，如 `SillyTavernService`，可能会采用单例模式，确保在整个应用中只有一个服务实例，便于管理和共享资源。

**推荐的使用模式**:

1.  **在 Composable 函数或 Vue 组件的 `setup` 中引入**:
    ```typescript
    // 在 Vue 组件的 <script setup lang="ts">
    import { useDialogService } from '@/services/DialogService';
    const dialogService = useDialogService();

    // 或对于单例类服务
    import { sillyTavernService } from '@/services/SillyTavernService';
    ```
2.  **调用服务方法执行业务逻辑**:
    ```typescript
    async function performAction() {
      const result = await sillyTavernService.getCharacterCards();
      if (result.length > 0) {
        dialogService.showSuccess('角色卡已加载！');
      } else {
        dialogService.showError('未能加载角色卡。');
      }
    }
    ```
3.  **避免在服务中直接操作 DOM**: 服务应专注于业务逻辑和数据处理。如果需要 UI 交互，应通过 Pinia store 更新状态，让相关的 Vue 组件响应这些状态变化来更新视图，或者像 `DialogService` 那样，管理动态加载的 UI 组件。

## 4. 未来展望或待办事项 (可选)

根据现有代码中的注释和项目需求，前端服务层未来可能包括以下扩展：

*   **`SillyTavernService` 增强**:
    *   实现 `loadPresets()`: 加载预设功能。
    *   实现 `loadWorldInfo()`: 加载世界信息。
    *   实现 `saveCharacterCard()`: 保存角色卡到后端。
    *   实现 `deleteCharacterCard()`: 从后端删除角色卡。
    *   实现 `exportCharacterCard()`: 导出角色卡（可能涉及前端文件处理或后端辅助）。
    *   实现 `importCharacterCard()`: 导入角色卡（可能涉及前端文件处理或后端辅助）。
*   **新的服务**:
    *   **`ProjectManagementService`**: 封装与项目（工作流文件）相关的 CRUD 操作，如创建、加载、保存、删除项目等到后端。
    *   **`ExecutionService`**: 管理工作流的执行请求，与后端 WebSocket 通信，处理执行状态和结果。
    *   **`SettingsService`**: 管理用户偏好设置的加载和保存。

这些服务的引入将进一步解耦前端逻辑，使得应用更加健壮和易于扩展。