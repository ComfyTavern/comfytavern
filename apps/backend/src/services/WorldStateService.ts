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