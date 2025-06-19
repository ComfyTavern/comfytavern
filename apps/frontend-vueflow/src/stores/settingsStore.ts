import { defineStore } from 'pinia';
import { ref, watch, onMounted, reactive } from 'vue';
import type { SettingItemConfig } from '@/types/settings'; // 确保路径正确
import { defaultLocale } from '@/locales';

// 简易防抖函数
// eslint-disable-next-line @typescript-eslint/ban-types
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: Parameters<F>) => ReturnType<F>;
}

export interface I18nSettings {
  currentLanguage: string;
  fallbackLanguage: string;
  autoDetect: boolean;
}

export const useSettingsStore = defineStore('settings', () => {
  // 存储所有设置项的值, key 就是 SettingItemConfig.key
  const settings = ref<Record<string, any>>({});

  const i18nSettings = reactive<I18nSettings>({
    currentLanguage: defaultLocale,
    fallbackLanguage: defaultLocale,
    autoDetect: true,
  });

  // 加载持久化数据 (e.g., from localStorage)
  function loadSettings() {
    console.log("咕: 从存储加载设置...");
    try {
      const saved = localStorage.getItem('app_settings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        // 可以在这里进行一些数据校验或迁移逻辑
        settings.value = parsedSettings;

        // 加载 i18n 设置
        if (parsedSettings.i18n) {
          Object.assign(i18nSettings, parsedSettings.i18n);
        }
      } else {
        // 如果没有保存的设置，可以考虑初始化一些默认值
        // (或者让 SettingControl 在 getSetting 时处理默认值)
        console.log("咕: 未找到已保存的设置，将使用默认值。");
      }
    } catch (error) {
      console.error("咕: 加载设置失败!", error);
      // 加载失败，清空或使用默认
      settings.value = {};
    }
  }

  // 保存数据 (需要做 debounce 防抖处理，避免频繁写入)
  const saveSettings = debounce(() => {
    console.log("咕: 保存设置到存储...");
    try {
      const allSettings = {
        ...settings.value,
        i18n: i18nSettings,
      };
      localStorage.setItem('app_settings', JSON.stringify(allSettings));
    } catch (error) {
      console.error("咕: 保存设置失败!", error);
    }
  }, 500); // 500ms 防抖

  // 更新单个设置项
  function updateSetting(key: string, value: any) {
    settings.value[key] = value;
    // watch 会自动触发 saveSettings
  }

  // 获取单个设置项，提供默认值
  // SettingItemConfig 中的 defaultValue 将在这里被使用
  function getSetting(key: string, defaultValueFromConfig: any): any {
    // 检查 settings.value 中是否存在该 key
    // eslint-disable-next-line no-prototype-builtins
    if (settings.value.hasOwnProperty(key) && settings.value[key] !== undefined) {
      return settings.value[key];
    }
    return defaultValueFromConfig;
  }

  function setLanguage(langCode: string) {
    i18nSettings.currentLanguage = langCode;
  }

  // 初始化时加载设置
  onMounted(() => {
    loadSettings();
  });

  // 监听 settings 对象的深度变化以自动保存
  watch(
    [settings, i18nSettings],
    () => {
      saveSettings();
    },
    { deep: true }
  );

  // 提供一个方法来批量初始化/应用默认设置 (如果需要)
  function initializeDefaultSettings(configs: SettingItemConfig[]) {
    let changed = false;
    configs.forEach(config => {
      // eslint-disable-next-line no-prototype-builtins
      if (!settings.value.hasOwnProperty(config.key)) {
        settings.value[config.key] = config.defaultValue;
        changed = true;
      }
    });
    if (changed) {
      console.log("咕: 部分设置已初始化为默认值。");
      // saveSettings(); // 立即保存或让 watch 处理
    }
  }


  return {
    settings,
    getSetting,
    updateSetting,
    loadSettings, // 暴露以便手动重新加载（如果需要）
    initializeDefaultSettings,
    i18nSettings,
    setLanguage,
  };
});

// 示例: 独立的 LLM Store (用于嵌入模块) - 暂时注释掉，按用户要求先做主体
/*
export const useLlmStore = defineStore('llm', () => {
    // 复杂的LLM配置结构
    const apiConfigs = ref([]); // 假设是数组
    const activeConfigId = ref('');
    // ... 增删改查 API Config 的 actions
    function addConfig() { console.log('Adding LLM config'); }
    return { apiConfigs, activeConfigId, addConfig };
})
*/