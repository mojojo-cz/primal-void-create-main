/**
 * 时区处理工具函数
 * 用于在整个应用中提供统一的时区处理标准
 */

// 应用默认时区 - 中国标准时间
export const DEFAULT_TIMEZONE = 'Asia/Shanghai';

// 常用的日期时间格式
export const DATE_FORMATS = {
  DATE_ONLY: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm',
  DATETIME: 'YYYY-MM-DD HH:mm',
  DATETIME_FULL: 'YYYY-MM-DD HH:mm:ss',
  DISPLAY_DATE: 'YYYY年MM月DD日',
  DISPLAY_DATETIME: 'YYYY年MM月DD日 HH:mm',
  DISPLAY_WEEKDAY: 'MM月DD日 (ddd)',
} as const;

/**
 * 获取当前时区的当前时间
 */
export const getCurrentTime = (): Date => {
  return new Date();
};

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
export const getTodayString = (): string => {
  const today = new Date();
  return formatDateToString(today);
};

/**
 * 格式化日期为字符串 (YYYY-MM-DD)
 * @param date - 要格式化的日期
 * @returns 格式化后的日期字符串
 */
export const formatDateToString = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  // 使用本地时区格式化，避免时区偏移
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * 格式化时间为字符串 (HH:mm)
 * @param time - 要格式化的时间（可以是Date对象或时间字符串）
 * @returns 格式化后的时间字符串
 */
export const formatTimeToString = (time: Date | string): string => {
  let timeObj: Date;
  
  if (typeof time === 'string') {
    // 如果是时间字符串 (HH:mm)，创建今天的日期对象
    if (time.includes(':') && !time.includes('T')) {
      const [hours, minutes] = time.split(':');
      timeObj = new Date();
      timeObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    } else {
      timeObj = new Date(time);
    }
  } else {
    timeObj = time;
  }
  
  if (isNaN(timeObj.getTime())) {
    return '';
  }
  
  const hours = String(timeObj.getHours()).padStart(2, '0');
  const minutes = String(timeObj.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
};

/**
 * 格式化日期时间为字符串 (YYYY-MM-DD HH:mm)
 * @param datetime - 要格式化的日期时间
 * @returns 格式化后的日期时间字符串
 */
export const formatDateTimeToString = (datetime: Date | string): string => {
  const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  const dateStr = formatDateToString(dateObj);
  const timeStr = formatTimeToString(dateObj);
  
  return `${dateStr} ${timeStr}`;
};

/**
 * 格式化日期为中文显示格式
 * @param date - 要格式化的日期
 * @param includeWeekday - 是否包含星期几
 * @returns 格式化后的中文日期字符串
 */
export const formatDateForDisplay = (date: Date | string, includeWeekday = false): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '-';
  }
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(includeWeekday && { weekday: 'short' })
  };
  
  return dateObj.toLocaleDateString('zh-CN', options);
};

/**
 * 格式化日期为自定义中文显示格式
 * @param date - 要格式化的日期
 * @param options - 自定义格式选项
 * @returns 格式化后的日期字符串
 */
export const formatDateForCustomDisplay = (date: Date | string, options: Intl.DateTimeFormatOptions): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '-';
  }
  
  const finalOptions: Intl.DateTimeFormatOptions = {
    timeZone: DEFAULT_TIMEZONE,
    ...options
  };
  
  return dateObj.toLocaleDateString('zh-CN', finalOptions);
};

/**
 * 格式化日期时间为中文显示格式
 * @param datetime - 要格式化的日期时间
 * @returns 格式化后的中文日期时间字符串
 */
export const formatDateTimeForDisplay = (datetime: Date | string): string => {
  const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;
  
  if (isNaN(dateObj.getTime())) {
    return '-';
  }
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  
  return dateObj.toLocaleString('zh-CN', options);
};

/**
 * 格式化时间为中文显示格式
 * @param time - 要格式化的时间
 * @returns 格式化后的中文时间字符串
 */
export const formatTimeForDisplay = (time: Date | string): string => {
  const timeStr = formatTimeToString(time);
  return timeStr || '-';
};

/**
 * 将日期时间转换为HTML datetime-local输入格式
 * @param datetime - 要转换的日期时间
 * @returns HTML datetime-local输入格式的字符串 (YYYY-MM-DDTHH:mm)
 */
export const formatForDateTimeInput = (datetime: Date | string | null | undefined): string => {
  if (!datetime) return '';
  
  const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  // 使用本地时区，避免时区偏移问题
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * 将日期转换为HTML date输入格式
 * @param date - 要转换的日期
 * @returns HTML date输入格式的字符串 (YYYY-MM-DD)
 */
export const formatForDateInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  return formatDateToString(dateObj);
};

/**
 * 解析日期字符串为Date对象
 * @param dateString - 日期字符串
 * @returns Date对象，如果解析失败返回null
 */
export const parseDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * 检查日期是否有效
 * @param date - 要检查的日期
 * @returns 是否有效
 */
export const isValidDate = (date: any): date is Date => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * 获取本周的开始和结束日期
 * @returns 本周的周一和周日
 */
export const getCurrentWeekRange = (): { monday: Date; sunday: Date } => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  
  // 调整到周一 (如果今天是周日，dayOfWeek为0，需要往前推6天)
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(today.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { monday, sunday };
};

/**
 * 计算两个日期之间的差异（天数）
 * @param date1 - 第一个日期
 * @param date2 - 第二个日期
 * @returns 天数差异
 */
export const getDateDifference = (date1: Date | string, date2: Date | string): number => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  if (!isValidDate(d1) || !isValidDate(d2)) {
    return 0;
  }
  
  const timeDiff = d1.getTime() - d2.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

/**
 * 检查日期是否是今天
 * @param date - 要检查的日期
 * @returns 是否是今天
 */
export const isToday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  return formatDateToString(dateObj) === formatDateToString(today);
};

/**
 * 检查日期是否是过去的日期
 * @param date - 要检查的日期
 * @returns 是否是过去的日期
 */
export const isPastDate = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateObj);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate < today;
};

/**
 * 检查日期是否是未来的日期
 * @param date - 要检查的日期
 * @returns 是否是未来的日期
 */
export const isFutureDate = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateObj);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate > today;
};

/**
 * 创建安全的ISO字符串（避免时区问题）
 * @param date - 要转换的日期
 * @returns ISO字符串
 */
export const toSafeISOString = (date: Date): string => {
  // 使用本地时区的时间创建ISO字符串
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
}; 