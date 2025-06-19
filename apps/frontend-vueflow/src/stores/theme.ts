import { defineStore } from 'pinia';
import { ref, computed, readonly, watch } from 'vue';
import type { FAMItem, ThemePreset } from '@comfytavern/types'; // 导入新定义的类型
import * as fileManagerApi from '@/api/fileManagerApi';
import { useAuthStore } from '@/stores/authStore';

// 定义显示模式的类型
export type DisplayMode = 'light' | 'dark' | 'system';

// 定义 DaisyUI 桥接主题的名称，后续可以考虑从主题配置中读取或更动态化
const DAISYUI_LIGHT_THEME_NAME = 'mytheme_light';
const DAISYUI_DARK_THEME_NAME = 'mytheme_dark';

// 默认主题 ID，如果 localStorage 中没有，则使用此值
// 假设我们有一个名为 'default' 的系统主题，或者第一个加载的主题
const DEFAULT_THEME_ID = 'default'; // 已根据 public/themes/default.json 的 id 调整

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
      // console.log(`[ThemeStore] Applying theme "${presetToApply.id}", mode "${modeToApply}". Variables:`, JSON.parse(JSON.stringify(variant.variables)));
      // 正常应用选中的变体
      Object.entries(variant.variables).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
      // 将应用的主题变量和模式缓存到 localStorage
      try {
        localStorage.setItem('comfyTavern_cachedThemeVariables', JSON.stringify(variant.variables));
        localStorage.setItem('comfyTavern_cachedThemeMode', modeToApply);
        // console.log('[ThemeStore] Saved theme variables and mode to localStorage. Mode:', modeToApply, 'Variables:', JSON.parse(JSON.stringify(variant.variables)));
      } catch (e) {
        console.error('[ThemeStore] Error saving theme variables to localStorage:', e);
      }
    } else {
      // 如果目标变体无效或没有可应用的变量，则不应用任何特定变量。
      // CSS 变量将回退到 theme-variables.css 中定义的 :root 或 html.dark 的值。
      console.warn(`[ThemeStore] Variant "${modeToApply}" for theme "${presetToApply.id}" is invalid or has no variables. CSS defaults will apply. Variant data:`, variant);
      // 当 variant 或其 variables 无效时，不做任何 setProperty 操作。
      // 这将让 theme-variables.css 中定义的默认值生效。
      // 清除 localStorage 中的缓存变量，但保留模式
      try {
        localStorage.removeItem('comfyTavern_cachedThemeVariables');
        localStorage.setItem('comfyTavern_cachedThemeMode', modeToApply); // 仍然记录当前尝试应用的模式
        // console.log('[ThemeStore] Cleared cached theme variables from localStorage, saved mode:', modeToApply);
      } catch (e) {
        console.error('[ThemeStore] Error clearing/saving theme variables/mode from localStorage:', e);
      }
    }


    // 2. 根据 currentAppliedMode 添加/移除 <html> 上的 'dark' 类 (用于 Tailwind CSS)
    if (modeToApply === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 3. 设置 document.documentElement.dataset.theme 为对应的 DaisyUI 桥接主题名
    document.documentElement.dataset.theme = modeToApply === 'dark' ? DAISYUI_DARK_THEME_NAME : DAISYUI_LIGHT_THEME_NAME;

  }

  /**
   * 从预定义位置加载可用的主题预设。
   * 系统主题从 system://public/themes/ 加载。
   * 用户主题从 user://library/themes/ 加载。
   */
  async function loadAvailableThemes() {
    const authStore = useAuthStore();
    const loadedSystemThemes: ThemePreset[] = [];
    userCustomThemes.value = []; // 清空之前的用户主题

        // 1. 加载系统预设主题 (通过 import.meta.glob)
        try {
          // 使用 import.meta.glob 导入 src/assets/themes 目录下的所有 .json 文件
          // eager: true 会同步加载模块，返回的是模块本身而不是加载函数
          // 对于 JSON 文件，模块的 default 导出就是解析后的对象
          const themeModules = import.meta.glob('@/assets/themes/*.json', { eager: true }) as Record<string, { default: ThemePreset }>;
    
          for (const path in themeModules) {
            // 确保 themeModules[path] 存在并且有 default 属性
            if (themeModules[path] && themeModules[path].default) {
              const themeData = themeModules[path].default;
              // 对 themeData 进行基本验证，确保它看起来像一个有效的主题预设
              if (themeData && typeof themeData === 'object' && themeData.id && themeData.name && themeData.variants) {
                // 系统主题来源已明确，直接将其标记为 isSystemTheme: true
                loadedSystemThemes.push({ ...themeData, isSystemTheme: true });
              } else {
                console.warn(`[ThemeStore] Theme file ${path} did not export a valid ThemePreset object or is missing required fields (id, name, variants). Data:`, themeData);
              }
            } else {
              console.warn(`[ThemeStore] Module for theme file ${path} is invalid or missing default export.`);
            }
          }
    
          if (loadedSystemThemes.length === 0) {
            console.warn('[ThemeStore] No system themes were loaded via import.meta.glob. Check src/assets/themes/ directory for .json files and the glob pattern.');
          }
        } catch (error) {
          // 这个 catch 块主要用于捕获 import.meta.glob (eager: true) 在加载或解析模块时可能发生的同步错误，
          // 或者遍历 themeModules 过程中的其他意外错误。
          console.error('[ThemeStore] Failed to load or parse system themes from src/assets/themes using import.meta.glob (eager):', error);
        }
    // 2. 加载用户自定义主题 (逻辑保持不变)
    if (authStore.isAuthenticated && authStore.currentUser) { // 移除了 .id 检查，因为 fileManagerApi 调用不直接使用 userId
      try {
        const userThemeItems: FAMItem[] = await fileManagerApi.listDir('user://library/themes/');
        for (const item of userThemeItems) {
          if (item.itemType === 'file' && item.name.endsWith('.json')) {
            try {
              // 注意：如果 getDownloadFileLink 返回的链接对于用户私有文件没有正确的认证机制，
              // fetch 可能会失败。这种情况下，后端需要提供一个专门的 readFile API 端点，
              // 前端 fileManagerApi 也需要添加对应的方法来调用。
              const downloadUrl = await fileManagerApi.getDownloadFileLink(item.logicalPath);
              const response = await fetch(downloadUrl);
              if (!response.ok) {
                console.error(`[ThemeStore] Failed to load user theme file: ${item.name}, status: ${response.status}`);
                continue;
              }
              const themeData = await response.json();
              // TODO: 在此可以添加 Zod 校验 themeData 是否符合 ThemePreset 结构
              // 用户主题来源已明确，直接将其标记为 isSystemTheme: false
              userCustomThemes.value.push({ ...themeData, isSystemTheme: false } as ThemePreset);
            } catch (error) {
              console.error(`[ThemeStore] Error loading or parsing user theme file ${item.name}:`, error);
            }
          }
        }
      } catch (error: any) { // 明确 error 类型为 any 以访问 response 属性
        const userThemesPath = 'user://library/themes/';
        // 检查错误是否为 404 Not Found，这通常意味着目录不存在
        // 假设 fileManagerApi.listDir 抛出的错误对象在失败时有 response.status
        if (error.response && error.response.status === 404) {
          console.warn(`[ThemeStore] User themes directory ${userThemesPath} not found. Attempting to create it.`);
          try {
            // 从 userThemesPath 解析 parentLogicalPath 和 dirName
            // 'user://library/themes/' -> parent: 'user://library/', name: 'themes'
            await fileManagerApi.createDir('user://library/', 'themes');
            console.log(`[ThemeStore] User themes directory ${userThemesPath} created successfully. No custom themes loaded as it's new.`);
            // userCustomThemes.value 保持为空，因为目录是新创建的，里面没有文件
          } catch (createError: any) {
            console.error(`[ThemeStore] Failed to create user themes directory ${userThemesPath} after it was not found:`, createError);
            // 即使创建失败，也继续执行，只是用户主题将为空。原始的 console.error 已在下面处理。
            // 记录原始的列出目录失败的错误
            console.error('[ThemeStore] Original error when listing user themes (before attempting create):', error);
          }
        } else {
          // 对于其他类型的错误，或者如果 404 不是因为目录不存在（虽然不太可能），则正常记录
          console.error('[ThemeStore] Failed to list user themes:', error);
        }
        // 无论如何，如果列出或创建失败，userCustomThemes.value 此时应为空或未被填充
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
    console.warn('[ThemeStore] saveUserTheme (not implemented)', theme);
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
    console.warn('[ThemeStore] deleteUserTheme (not implemented)', themeId);
  }

  /**
   * (阶段二) 更新用户自定义主题。
   * @param themeId 要更新的主题的 ID。
   * @param updatedVariables 更新的变量。
   */
  async function updateUserTheme(themeId: string, updatedVariables: Partial<ThemePreset['variants']['light']['variables']>) {
    // TODO: 实现更新逻辑
    console.warn('[ThemeStore] updateUserTheme (not implemented)', themeId, updatedVariables);
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