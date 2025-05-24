import { supabase } from '@/integrations/supabase/client';
import { SystemSettings, defaultSettings } from '@/utils/systemSettings';

// 设置键名常量
export const SETTING_KEYS = {
  SYSTEM_LOGO: 'system_logo',
  FAVICON_URL: 'favicon_url', 
  SYSTEM_TITLE: 'system_title',
  SITE_NAME: 'site_name'
} as const;

/**
 * 从数据库加载系统设置
 */
export const loadSystemSettingsFromDB = async (): Promise<SystemSettings> => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value');

    if (error) {
      console.error('从数据库加载系统设置失败:', error);
      return defaultSettings;
    }

    // 将数据库结果转换为SystemSettings格式
    const settings: SystemSettings = { ...defaultSettings };
    
    if (data) {
      data.forEach((row) => {
        switch (row.setting_key) {
          case SETTING_KEYS.SYSTEM_LOGO:
            settings.system_logo = row.setting_value || '';
            break;
          case SETTING_KEYS.FAVICON_URL:
            settings.favicon_url = row.setting_value || defaultSettings.favicon_url;
            break;
          case SETTING_KEYS.SYSTEM_TITLE:
            settings.system_title = row.setting_value || defaultSettings.system_title;
            break;
          case SETTING_KEYS.SITE_NAME:
            settings.site_name = row.setting_value || defaultSettings.site_name;
            break;
        }
      });
    }

    return settings;
  } catch (error) {
    console.error('加载系统设置异常:', error);
    return defaultSettings;
  }
};

/**
 * 保存系统设置到数据库
 */
export const saveSystemSettingsToDB = async (settings: SystemSettings): Promise<boolean> => {
  try {
    // 准备要更新的设置项
    const settingsToSave = [
      { key: SETTING_KEYS.SYSTEM_LOGO, value: settings.system_logo },
      { key: SETTING_KEYS.FAVICON_URL, value: settings.favicon_url },
      { key: SETTING_KEYS.SYSTEM_TITLE, value: settings.system_title },
      { key: SETTING_KEYS.SITE_NAME, value: settings.site_name }
    ];

    // 使用事务确保数据一致性
    for (const setting of settingsToSave) {
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            setting_key: setting.key,
            setting_value: setting.value,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'setting_key'
          }
        );

      if (error) {
        console.error(`保存设置 ${setting.key} 失败:`, error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('保存系统设置到数据库异常:', error);
    return false;
  }
};

/**
 * 检查是否可以访问数据库
 */
export const checkDatabaseAccess = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1);

    return !error;
  } catch (error) {
    console.error('数据库访问检查失败:', error);
    return false;
  }
}; 