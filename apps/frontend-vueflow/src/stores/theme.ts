import { defineStore } from 'pinia';
import { ref, computed, readonly, watch } from 'vue';
import type { ThemePreset } from '@comfytavern/types'; // 导入新定义的类型

// 定义显示模式的类型
export type DisplayMode = 'light' | 'dark' | 'system';

// 定义 DaisyUI 桥接主题的名称，后续可以考虑从主题配置中读取或更动态化
const DAISYUI_LIGHT_THEME_NAME = 'mytheme_light';
const DAISYUI_DARK_THEME_NAME = 'mytheme_dark';

// 默认主题 ID，如果 localStorage 中没有，则使用此值
// 假设我们有一个名为 'default' 的系统主题，或者第一个加载的主题
const DEFAULT_THEME_ID = 'default-light'; // TODO: 需要根据实际预设主题调整

export const useThemeStore = defineStore('theme', () => {
  // --- 状态 (State) ---

  /** 所有可用的主题预设 */
  const availableThemes = ref<ThemePreset[]>([]);
  /** 当前选中的主题预设 ID */
  const selectedThemeId = ref<string>(localStorage.getItem('selectedThemeId') || DEFAULT_THEME_ID);
  /** 用户选择的显示模式 ('light', 'dark', 'system') */
  const displayMode = ref<DisplayMode>((localStorage.getItem('displayMode') as DisplayMode | null) || 'system');
  /** (阶段二) 用户自定义并保存的主题 */
  const userCustomThemes = ref<ThemePreset[]>([]); // 初始为空

  // --- 计算属性 (Computed) ---

  /** 根据 displayMode 和系统偏好计算出的当前实际应用的模式 ('light' 或 'dark') */
  const currentAppliedMode = computed<'light' | 'dark'>(() => {
    if (displayMode.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return displayMode.value;
  });

  /** 当前选中的主题预设对象 */
  const currentThemePreset = computed<ThemePreset | undefined>(() => {
    return availableThemes.value.find(t => t.id === selectedThemeId.value) || availableThemes.value[0];
  });

  // --- 核心方法 (Actions) ---

  /**
   * 应用当前选定的主题和模式到文档。
   * 这是主题切换的核心逻辑。
   */
  function applyCurrentTheme() {
    if (!currentThemePreset.value) {
      console.warn('[ThemeStore] No theme preset selected or available.');
      // 可以考虑应用一个非常基础的回退样式
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
      // 清除可能已应用的 CSS 变量
      // (更复杂的清除逻辑可能需要遍历已知的变量名)
      document.documentElement.style.cssText = '';
      return;
    }

    const presetToApply = currentThemePreset.value;
    const modeToApply = currentAppliedMode.value;

    // 1. 获取对应变体的 CSS 变量
    const variant = presetToApply.variants[modeToApply];
    
    // 确保 variant 和 variant.variables 都有效，并且 variables 对象不是空的
    if (variant && variant.variables && Object.keys(variant.variables).length > 0) {
      // 正常应用选中的变体
      console.log(`[ThemeStore] Applying variables from ${presetToApply.id}.${modeToApply}:`, variant.variables);
      Object.entries(variant.variables).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    } else {
      // 如果目标变体无效或没有可应用的变量，则不应用任何特定变量。
      // CSS 变量将回退到 theme-variables.css 中定义的 :root 或 html.dark 的值。
      console.warn(`[ThemeStore] Variant "${modeToApply}" for theme "${presetToApply.id}" is invalid or has no variables. CSS defaults will apply. Variant data:`, variant);
      // 当 variant 或其 variables 无效时，不做任何 setProperty 操作。
      // 这将让 theme-variables.css 中定义的默认值生效。
    }
    

    // 2. 根据 currentAppliedMode 添加/移除 <html> 上的 'dark' 类 (用于 Tailwind CSS)
    if (modeToApply === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 3. 设置 document.documentElement.dataset.theme 为对应的 DaisyUI 桥接主题名
    document.documentElement.dataset.theme = modeToApply === 'dark' ? DAISYUI_DARK_THEME_NAME : DAISYUI_LIGHT_THEME_NAME;

    console.log(`[ThemeStore] Applied theme: ${presetToApply.id}, Mode: ${modeToApply}`);
  }

  /**
   * 从预定义位置加载可用的主题预设。
   * 初期从 public/themes/ 加载 JSON 文件。
   */
  async function loadAvailableThemes() {
    // TODO: 实现从 FAMService 加载用户自定义主题的逻辑 (user://library/themes/)
    // userCustomThemes.value = await famService.loadUserThemes();

    // 示例：加载系统预设主题 (这里需要实际的主题文件名列表)
    const systemThemeFiles = ['default-light.json', 'default-dark.json', 'ocean-blue.json']; // 示例文件名
    const loadedSystemThemes: ThemePreset[] = [];

    for (const fileName of systemThemeFiles) {
      try {
        const response = await fetch(`/themes/${fileName}`); // 假设主题文件在 public/themes/ 目录下
        if (!response.ok) {
          console.error(`[ThemeStore] Failed to load theme file: ${fileName}, status: ${response.status}`);
          continue;
        }
        const themeData = await response.json();
        // TODO: 在此可以添加 Zod 校验 themeData 是否符合 ThemePreset 结构
        loadedSystemThemes.push(themeData as ThemePreset);
      } catch (error) {
        console.error(`[ThemeStore] Error loading or parsing theme file ${fileName}:`, error);
      }
    }
    availableThemes.value = [...loadedSystemThemes, ...userCustomThemes.value];

    // 修正 selectedThemeId 的逻辑：
    // 确保 selectedThemeId 总是指向一个有效的主题，或者在没有主题时为空。
    const currentSelectedThemeIsValid = availableThemes.value.some(t => t.id === selectedThemeId.value);

    if (!currentSelectedThemeIsValid) {
      // 如果当前选中的主题 ID 无效 (例如，主题列表已更改，或初始默认 ID 不存在)
      const firstThemeCandidate = availableThemes.value[0]; // 获取第一个可用主题作为候选
      if (firstThemeCandidate) {
        // 如果确实有可用的主题
        selectedThemeId.value = firstThemeCandidate.id;
        localStorage.setItem('selectedThemeId', selectedThemeId.value);
      } else {
        // 如果没有任何可用的主题
        selectedThemeId.value = '';
        localStorage.removeItem('selectedThemeId'); // 清除无效的或不存在的 themeId
        console.warn('[ThemeStore] No themes available. Selected theme ID cleared.');
      }
    }
    // 如果 currentSelectedThemeIsValid 为 true，则 selectedThemeId 保持不变。

    // 主题加载并选定完毕后，应用一次当前主题
    applyCurrentTheme();
  }

  /**
   * 选择一个主题预设。
   * @param themeId 要选择的主题的 ID。
   */
  function selectThemePreset(themeId: string) {
    if (availableThemes.value.find(t => t.id === themeId)) {
      selectedThemeId.value = themeId;
      localStorage.setItem('selectedThemeId', themeId);
      applyCurrentTheme();
    } else {
      console.warn(`[ThemeStore] Attempted to select non-existent theme ID: ${themeId}`);
    }
  }

  /**
   * 设置显示模式。
   * @param mode 要设置的显示模式 ('light', 'dark', 'system')。
   */
  function setDisplayMode(mode: DisplayMode) {
    displayMode.value = mode;
    localStorage.setItem('displayMode', mode);
    // displayMode 变化会通过 currentAppliedMode 的 watch 自动触发 applyCurrentTheme
    // 但为了确保立即响应，这里也直接调用
    applyCurrentTheme();
  }

  // --- 初始化与监听 ---

  /**
   * 初始化主题系统。
   * 在应用启动时调用。
   */
  async function initTheme() {
    await loadAvailableThemes(); // 加载主题是异步的
    // applyCurrentTheme(); // loadAvailableThemes 成功后会调用
    
    // 监听系统颜色方案变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (displayMode.value === 'system') {
        // currentAppliedMode 会自动更新，其 watch 会调用 applyCurrentTheme
        // 为确保万无一失，也可以直接调用
         applyCurrentTheme();
      }
    });
  }
  
  // 监听 currentAppliedMode 的变化，确保主题正确应用
  // (displayMode 或系统主题变化时，此计算属性会变)
  watch(currentAppliedMode, () => {
    applyCurrentTheme();
  }, { immediate: false }); // immediate: false 因为 initTheme 会处理首次应用

  // --- 阶段二及以后功能 (占位) ---

  /**
   * (阶段二) 保存用户自定义主题。
   * @param theme 要保存的主题对象。
   */
  async function saveUserTheme(theme: ThemePreset) {
    // TODO: 通过 FAMService 将其保存到用户的个人主题库中。
    // await famService.saveUserTheme(theme);
    // userCustomThemes.value.push(theme); // 或重新加载
    // availableThemes.value = [...systemThemes, ...userCustomThemes.value];
    console.log('[ThemeStore] saveUserTheme (not implemented)', theme);
  }

  /**
   * (阶段二) 删除用户自定义主题。
   * @param themeId 要删除的主题的 ID。
   */
  async function deleteUserTheme(themeId: string) {
    // TODO: 通过 FAMService 删除对应的文件。
    // await famService.deleteUserTheme(themeId);
    // userCustomThemes.value = userCustomThemes.value.filter(t => t.id !== themeId);
    // availableThemes.value = availableThemes.value.filter(t => t.id !== themeId);
    console.log('[ThemeStore] deleteUserTheme (not implemented)', themeId);
  }
  
  /**
   * (阶段二) 更新用户自定义主题。
   * @param themeId 要更新的主题的 ID。
   * @param updatedVariables 更新的变量。
   */
  async function updateUserTheme(themeId: string, updatedVariables: Partial<ThemePreset['variants']['light']['variables']>) {
    // TODO: 实现更新逻辑
    console.log('[ThemeStore] updateUserTheme (not implemented)', themeId, updatedVariables);
  }


  // --- 暴露状态和方法 ---
  return {
    // State
    availableThemes: readonly(availableThemes),
    selectedThemeId: readonly(selectedThemeId),
    displayMode: readonly(displayMode),
    currentAppliedMode, // computed 已经是 readonly ref
    currentThemePreset, // computed 已经是 readonly ref
    userCustomThemes: readonly(userCustomThemes),

    // Actions
    initTheme,
    loadAvailableThemes, // 可能主要用于开发或特殊场景，initTheme 会自动调用
    selectThemePreset,
    setDisplayMode,
    applyCurrentTheme, // 暴露出来以便调试或特殊场景

    // Stage 2+ (placeholder)
    saveUserTheme,
    deleteUserTheme,
    updateUserTheme,
  };
});