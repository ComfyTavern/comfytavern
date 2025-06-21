import type { InjectionKey, Ref } from 'vue';

/**
 * 用于在设置页面布局中提供和注入一个布尔值的 Ref，该值指示是否应采用紧凑模式。
 *
 * @example
 * // 在父组件中
 * import { provide, ref } from 'vue';
 * import { IsSettingsCompactKey } from './injectionKeys';
 * const isCompact = ref(false);
 * provide(IsSettingsCompactKey, isCompact);
 *
 * // 在子组件中
 * import { inject, ref } from 'vue';
 * import { IsSettingsCompactKey } from './injectionKeys';
 * const isCompact = inject(IsSettingsCompactKey, ref(false)); // 第二个参数是默认值
 */
export const IsSettingsCompactKey: InjectionKey<Ref<boolean>> = Symbol('IsSettingsCompact');