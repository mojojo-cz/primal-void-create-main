// 系统设置工具函数
export interface SystemSettings {
  system_logo: string;
  favicon_url: string;
  system_title: string;
  site_name: string;
}

// 默认设置
export const defaultSettings: SystemSettings = {
  system_logo: "",
  favicon_url: "/favicon.png",
  system_title: "primal-void-create",
  site_name: "考研教育系统"
};

// 加载系统设置
export const loadSystemSettings = (): SystemSettings => {
  try {
    const savedSettings = localStorage.getItem('system_settings');
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      return {
        ...defaultSettings,
        ...parsedSettings
      };
    }
  } catch (error) {
    console.error('加载系统设置失败:', error);
  }
  return defaultSettings;
};

// 保存系统设置
export const saveSystemSettings = (settings: SystemSettings): void => {
  try {
    localStorage.setItem('system_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('保存系统设置失败:', error);
  }
};

// 应用系统设置到页面
export const applySystemSettings = (settings?: SystemSettings): void => {
  const currentSettings = settings || loadSystemSettings();
  
  // 更新页面标题
  document.title = currentSettings.system_title;
  
  // 更新favicon
  const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  if (favicon && currentSettings.favicon_url) {
    favicon.href = currentSettings.favicon_url;
  }
};

// 页面加载时自动应用设置
export const initSystemSettings = (): void => {
  applySystemSettings();
}; 