### **阶段 0：后端核心服务实施方案**

#### **总览**

本方案旨在为 `unified-panel-agent-plan` 的阶段 0 提供具体的技术实现细节。我们将创建 `WorldStateService` 用于场景状态管理，并扩展现有的 `WebSocketManager` 以支持按场景隔离的事件总线（EventBus）。

**重要前提**：本方案中设计的所有服务，都将被一个更高层次的 **`SessionManager` (或 `SceneManager`)** 所调用和协调。`SessionManager` 负责加载 `scene.json` 定义，创建并管理 `SceneInstance` 的生命周期，并在合适的时机（如场景实例化、用户加入场景等）调用本方案中提供的服务接口。

---

#### **任务 1: 实现 `WorldStateService`**

**目标**: 创建一个提供原子性读写能力的场景范围共享状态存储服务。

1.  **创建新文件**: `apps/backend/src/services/WorldStateService.ts`

    *   此服务将独立于 `ConcurrencyScheduler`，因为它需要的是轻量级的数据级锁，而非重量级的工作流执行调度。
    *   我们将利用 `Promise` 链实现一个非阻塞的异步锁，来确保对同一场景状态更新的原子性。

    ```typescript
    // apps/backend/src/services/WorldStateService.ts

    import { NanoId } from '@comfytavern/types';

    // 内部锁，用于确保对同一场景状态的更新是串行化的
    type StateLock = {
      promise: Promise<void>;
    };
    
    // 存储的状态，包含数据本身和其对应的锁
    interface SceneState {
      data: Record<string, any>;
      lock: StateLock;
    }

    /**
     * WorldStateService 提供一个场景范围内的、可进行原子性读写的共享状态存储。
     * 这是 Agent 感知环境的基础。
     * 它通过一个轻量级的异步锁机制来确保更新操作的原子性。
     */
    export class WorldStateService {
      private states: Map<NanoId, SceneState> = new Map();

      /**
       * 当一个新场景实例被创建时，调用此方法来初始化其世界状态。
       * 此方法应由 SessionManager 调用。
       * @param sceneInstanceId 新场景实例的唯一 ID
       * @param initialState 来自 `scene.json` 的 `initial_world_state`
       */
      public createSceneState(sceneInstanceId: NanoId, initialState: Record<string, any> = {}): void {
        if (this.states.has(sceneInstanceId)) {
          console.warn(`[WorldStateService] Scene state for ${sceneInstanceId} already exists. Ignoring creation request.`);
          return;
        }
        this.states.set(sceneInstanceId, {
          data: { ...initialState }, // 使用提供的初始状态
          lock: { promise: Promise.resolve() },
        });
        console.log(`[WorldStateService] Initialized world state for scene ${sceneInstanceId}.`);
      }

      private getSceneState(sceneInstanceId: NanoId): SceneState | undefined {
        return this.states.get(sceneInstanceId);
      }
      
      /**
       * 获取指定场景的当前状态。
       * @param sceneInstanceId 场景实例 ID
       * @returns 状态对象的只读副本，如果场景不存在则返回 null
       */
      public async getState(sceneInstanceId: NanoId): Promise<Readonly<Record<string, any>> | null> {
        const sceneState = this.getSceneState(sceneInstanceId);
        if (!sceneState) {
            console.warn(`[WorldStateService] Attempted to get state for non-existent scene ${sceneInstanceId}.`);
            return null;
        }
        // 等待所有正在进行的写操作完成
        await sceneState.lock.promise;
        return Object.freeze({ ...sceneState.data }); // 返回一个不可变的副本
      }

      /**
       * 原子性地更新指定场景的状态。
       * @param sceneInstanceId 场景实例 ID
       * @param updater 一个函数，接收当前状态并返回新状态
       * @returns 如果成功更新则返回 true，否则返回 false
       */
      public async updateState(
        sceneInstanceId: NanoId,
        updater: (currentState: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>
      ): Promise<boolean> {
        const sceneState = this.getSceneState(sceneInstanceId);
        if (!sceneState) {
          console.error(`[WorldStateService] Cannot update state for non-existent scene ${sceneInstanceId}.`);
          return false;
        }

        // 关键：原子性地将我们的更新操作链接到现有的 Promise 链上。
        // 这可以防止竞争条件，即两个更新同时读取旧的锁并并行执行。
        const updatePromise = sceneState.lock.promise.then(async () => {
          // then() 确保了我们在上一个操作完成后才开始。
          const currentState = sceneState.data;
          const newState = await Promise.resolve(updater(currentState));
          sceneState.data = newState;
        }).catch(error => {
          // 捕获更新函数自身或其 Promise 可能抛出的错误。
          console.error(`[WorldStateService] Error updating state for scene ${sceneInstanceId}:`, error);
          // 我们在这里不重新抛出错误，以确保即使此更新失败，
          // promise 链也不会中断，后续的更新仍然可以排队执行。
        });

        // 立即用包含了我们当前操作的新 promise 来更新锁。
        // 任何后续的 updateState 调用都将在此操作完成后排队。
        sceneState.lock.promise = updatePromise;

        // 等待我们自己的更新完成。
        await updatePromise;
        // 注意：即使更新内部出错，updatePromise 也会成功解析（因为我们 catch 了错误），
        // 以允许服务继续。返回 true 表示更新已被调度和执行。
        return true;
      }

      /**
       * 当场景实例结束时，调用此方法来清理其状态。
       * 此方法应由 SessionManager 调用。
       * @param sceneInstanceId 场景实例 ID
       */
      public async deleteState(sceneInstanceId: NanoId): Promise<void> {
        const sceneState = this.getSceneState(sceneInstanceId);
        if (sceneState) {
          // 等待任何正在进行的操作完成，以确保状态一致性
          await sceneState.lock.promise; 
          this.states.delete(sceneInstanceId);
          console.log(`[WorldStateService] Cleaned up world state for scene ${sceneInstanceId}.`);
        }
      }
    }
    ```

2.  **集成**: `SessionManager` 在创建 `SceneInstance` 时，会：
    1.  从 `scene.json` 读取 `initial_world_state`。
    2.  调用 `worldStateService.createSceneState(sceneInstanceId, initialState)`。
    3.  在 `SceneInstance` 销毁时，调用 `worldStateService.deleteState(sceneInstanceId)`。

---

#### **任务 2: 扩展 `WebSocketManager` 以支持场景隔离的 `EventBus`**

**目标**: 改造 `WebSocketManager`，使其能管理多个逻辑事件通道，并按场景 ID 隔离消息。

1.  **修改文件**: `apps/backend/src/websocket/WebSocketManager.ts`

    *   我们将添加新的数据结构来追踪每个客户端订阅的场景，以及每个场景有哪些客户端订阅者。

    ```typescript
    // 在 apps/backend/src/websocket/WebSocketManager.ts 中进行修改

    // ... imports ...

    // ... ClientInfo interface ...

    export class WebSocketManager {
      private clients: Map<NanoId, ClientInfo> = new Map();
      private wsToClientId: WeakMap<WsContext, NanoId> = new WeakMap();
      
      // --- 新增数据结构 ---
      // 场景实例 ID -> 订阅该场景的客户端 ID 集合
      private sceneChannels: Map<NanoId, Set<NanoId>> = new Map();
      // 客户端 ID -> 该客户端订阅的场景实例 ID
      private clientSubscriptions: Map<NanoId, NanoId> = new Map();
      // (可选增强) 场景实例 ID -> 命名空间前缀
      private sceneNamespaces: Map<NanoId, string> = new Map();


      // ... constructor ...

      // ... addClient ...

      public removeClient(ws: WsContext): void {
        const clientId = this.wsToClientId.get(ws);
        if (clientId) {
          // --- 新增逻辑：清理订阅信息 ---
          this.unsubscribeFromScene(clientId, 'disconnect');

          this.clients.delete(clientId);
          this.wsToClientId.delete(ws);
          console.log(`[WS Manager] Client disconnected: ${clientId}`);
        }
      }

      // --- 新增方法：处理由 SessionManager 发起的订阅 ---
      /**
       * 将客户端订阅到指定的场景频道。此方法应由 SessionManager 调用。
       * @param clientId 客户端 ID
       * @param sceneInstanceId 场景实例 ID
       * @param sceneConfig 可选的场景配置，如 `event_bus_config`
       */
      public subscribeToScene(clientId: NanoId, sceneInstanceId: NanoId, sceneConfig?: { eventBusConfig?: { namespacePrefix?: string } }): void {
        // 如果客户端已订阅其他场景，先取消订阅
        this.unsubscribeFromScene(clientId, 'resubscribe');

        if (!this.sceneChannels.has(sceneInstanceId)) {
          this.sceneChannels.set(sceneInstanceId, new Set());
        }
        this.sceneChannels.get(sceneInstanceId)!.add(clientId);
        this.clientSubscriptions.set(clientId, sceneInstanceId);
        
        // (可选增强) 存储命名空间
        if (sceneConfig?.eventBusConfig?.namespacePrefix) {
            this.sceneNamespaces.set(sceneInstanceId, sceneConfig.eventBusConfig.namespacePrefix);
        }
        
        console.log(`[WS Manager] Client ${clientId} was subscribed to scene ${sceneInstanceId} by SessionManager.`);
      }

      // --- 新增方法：处理取消订阅 ---
      /**
       * 取消客户端对场景的订阅。此方法可由 SessionManager 调用，或在客户端断开连接时内部调用。
       * @param clientId 客户端 ID
       * @param reason 取消订阅的原因，用于日志记录
       */
      public unsubscribeFromScene(clientId: NanoId, reason: 'disconnect' | 'resubscribe' | 'session_end'): void {
        const currentSceneId = this.clientSubscriptions.get(clientId);
        if (currentSceneId) {
          const subscribers = this.sceneChannels.get(currentSceneId);
          if (subscribers) {
            subscribers.delete(clientId);
            if (subscribers.size === 0) {
              // 如果没有订阅者了，可以清理场景频道和命名空间
              this.sceneChannels.delete(currentSceneId);
              this.sceneNamespaces.delete(currentSceneId);
              console.log(`[WS Manager] Scene channel ${currentSceneId} is now empty and has been removed.`);
            }
          }
          this.clientSubscriptions.delete(clientId);
          console.log(`[WS Manager] Client ${clientId} unsubscribed from scene ${currentSceneId}. Reason: ${reason}.`);
        }
      }

      // ... handleMessage, handleError, getClientId, sendMessageToClient ...

      // --- 新增方法：向特定场景发布事件 ---
      /**
       * 向特定场景的所有订阅者发布事件。
       * 这是 Agent 与环境交互的主要方式。
       * @param sceneInstanceId 目标场景 ID
       * @param type 事件类型
       * @param payload 事件载荷
       */
      public publishToScene(sceneInstanceId: NanoId, type: string, payload: any): void {
        const subscribers = this.sceneChannels.get(sceneInstanceId);
        if (subscribers && subscribers.size > 0) {
          const namespace = this.sceneNamespaces.get(sceneInstanceId);
          const finalType = namespace ? `[${namespace}]${type}` : type;

          const messageString = JSON.stringify({ type: finalType, payload });
          console.log(`[WS Manager] Publishing to scene ${sceneInstanceId} (${subscribers.size} subscribers). Event: ${finalType}`);
          
          subscribers.forEach(clientId => {
            // 复用现有的 sendMessageToClient 逻辑来发送, 注意这里我们发送包装后的 finalType
            this.sendMessageToClient(clientId, finalType, payload);
          });
        } else {
            console.log(`[WS Manager] No subscribers found for scene ${sceneInstanceId} when publishing event ${type}.`);
        }
      }

      /**
       * [保持不变] 向所有连接的客户端广播消息。
       * 这个方法现在主要用于系统级的、非场景隔离的通知。
       * @param type 消息类型
       * @param payload 消息载荷
       */
      public broadcast(type: string, payload: any): void {
        // ... 此方法实现保持不变 ...
      }

      // ... getAllClientIds ...
    }
    ```

2.  **集成**:

    *   移除 `index.ts` 中对 `SUBSCRIBE_SCENE` 消息的直接处理。客户端订阅将由 `SessionManager` 统一管理。
    *   `SessionManager` 在将一个用户会话（`clientId`）与一个 `SceneInstance`（`sceneInstanceId`）关联时，会：
        1.  从 `scene.json` 读取 `event_bus_config`。
        2.  调用 `wsManager.subscribeToScene(clientId, sceneInstanceId, { eventBusConfig })`。
    *   当用户会话结束或切换场景时，`SessionManager` 会调用 `wsManager.unsubscribeFromScene(clientId, 'session_end')`。

---

此方案为后续 `AgentRuntime` 和 `SceneManager` 的实现奠定了坚实的基础。下一步，我们将能够基于这里创建的服务来构建更高层次的 Agent 逻辑。