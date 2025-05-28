// 用户偏好设置工具函数
export interface UserPreferences {
  pagination: {
    itemsPerPage: number;
    defaultPageSize: number;
    availablePageSizes: number[];
  };
  display: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
  admin: {
    defaultVideoView: 'list' | 'grid';
    showAdvancedFilters: boolean;
  };
}

// 默认用户偏好
export const defaultPreferences: UserPreferences = {
  pagination: {
    itemsPerPage: 20, // 默认每页20个项目
    defaultPageSize: 20,
    availablePageSizes: [10, 20, 30, 50, 100] // 可选的每页显示数量
  },
  display: {
    theme: 'auto',
    language: 'zh-CN'
  },
  admin: {
    defaultVideoView: 'list',
    showAdvancedFilters: false
  }
};

// 本地存储键
const PREFERENCES_STORAGE_KEY = 'user_preferences';

// 加载用户偏好设置
export const loadUserPreferences = (): UserPreferences => {
  try {
    const savedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (savedPreferences) {
      const parsedPreferences = JSON.parse(savedPreferences);
      // 合并默认设置和已保存设置，确保新增字段有默认值
      return {
        pagination: {
          ...defaultPreferences.pagination,
          ...parsedPreferences.pagination
        },
        display: {
          ...defaultPreferences.display,
          ...parsedPreferences.display
        },
        admin: {
          ...defaultPreferences.admin,
          ...parsedPreferences.admin
        }
      };
    }
  } catch (error) {
    console.error('加载用户偏好设置失败:', error);
  }
  return defaultPreferences;
};

// 保存用户偏好设置
export const saveUserPreferences = (preferences: UserPreferences): void => {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('保存用户偏好设置失败:', error);
  }
};

// 更新分页设置
export const updatePaginationPreferences = (paginationSettings: Partial<UserPreferences['pagination']>): UserPreferences => {
  const currentPreferences = loadUserPreferences();
  const updatedPreferences = {
    ...currentPreferences,
    pagination: {
      ...currentPreferences.pagination,
      ...paginationSettings
    }
  };
  saveUserPreferences(updatedPreferences);
  return updatedPreferences;
};

// 获取当前每页显示数量
export const getCurrentPageSize = (): number => {
  const preferences = loadUserPreferences();
  return preferences.pagination.itemsPerPage;
};

// 设置每页显示数量
export const setPageSize = (pageSize: number): void => {
  updatePaginationPreferences({ itemsPerPage: pageSize });
};

// 获取可选的页面大小选项
export const getAvailablePageSizes = (): number[] => {
  const preferences = loadUserPreferences();
  return preferences.pagination.availablePageSizes;
};

// 全局偏好设置存储器
let globalPreferences: UserPreferences | null = null;

// 设置全局偏好
export const setGlobalPreferences = (preferences: UserPreferences): void => {
  globalPreferences = preferences;
  saveUserPreferences(preferences);
};

// 获取全局偏好
export const getGlobalPreferences = (): UserPreferences => {
  if (globalPreferences) {
    return globalPreferences;
  }
  return loadUserPreferences();
};

// 重置为默认偏好
export const resetToDefaultPreferences = (): UserPreferences => {
  saveUserPreferences(defaultPreferences);
  globalPreferences = defaultPreferences;
  return defaultPreferences;
}; 