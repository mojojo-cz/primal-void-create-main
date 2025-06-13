/**
 * 性能优化工具
 * 用于改善"学习中"和"课程学习"页面的加载体验
 */

// 缓存配置
export const CACHE_CONFIG = {
  // 学生页面缓存时间 (8分钟)
  STUDENT_PAGE: 8 * 60 * 1000,
  // 课程学习页面缓存时间 (5分钟)
  COURSE_STUDY: 5 * 60 * 1000,
  // 视频进度缓存时间 (2分钟)
  VIDEO_PROGRESS: 2 * 60 * 1000,
  // 用户信息缓存时间 (10分钟)
  USER_PROFILE: 10 * 60 * 1000,
};

// 防抖函数工具
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

// 节流函数工具
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function(...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 页面可见性检测
export class VisibilityDetector {
  private listeners: Array<(isVisible: boolean) => void> = [];
  private isListening = false;

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  private handleVisibilityChange() {
    const isVisible = !document.hidden;
    this.listeners.forEach(listener => {
      try {
        listener(isVisible);
      } catch (error) {
        console.error('Visibility change listener error:', error);
      }
    });
  }

  addListener(callback: (isVisible: boolean) => void) {
    this.listeners.push(callback);
    
    if (!this.isListening) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this.isListening = true;
    }
    
    // 返回移除监听器的函数
    return () => {
      this.removeListener(callback);
    };
  }

  removeListener(callback: (isVisible: boolean) => void) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
    
    if (this.listeners.length === 0 && this.isListening) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.isListening = false;
    }
  }

  destroy() {
    this.listeners = [];
    if (this.isListening) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.isListening = false;
    }
  }
}

// 创建全局实例
export const globalVisibilityDetector = new VisibilityDetector();

// 数据缓存管理器
export class DataCacheManager<T = any> {
  private cache = new Map<string, {
    data: T;
    timestamp: number;
    ttl: number;
  }>();

  set(key: string, data: T, ttl: number = CACHE_CONFIG.STUDENT_PAGE) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // 获取缓存剩余时间
  getRemainingTTL(key: string): number {
    const item = this.cache.get(key);
    if (!item) return 0;

    const elapsed = Date.now() - item.timestamp;
    const remaining = item.ttl - elapsed;
    return Math.max(0, remaining);
  }

  // 检查缓存是否即将过期（剩余时间少于总时间的20%）
  isNearExpiry(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return true;

    const remaining = this.getRemainingTTL(key);
    return remaining < (item.ttl * 0.2);
  }
}

// 创建全局缓存管理器
export const globalDataCache = new DataCacheManager();

// 预加载工具
export class PreloadManager {
  private preloadQueue = new Set<string>();
  private preloadCallbacks = new Map<string, () => Promise<any>>();

  addPreloadTask(key: string, preloadFn: () => Promise<any>) {
    this.preloadCallbacks.set(key, preloadFn);
  }

  async preload(key: string): Promise<any> {
    if (this.preloadQueue.has(key)) {
      return; // 已在预加载队列中
    }

    const preloadFn = this.preloadCallbacks.get(key);
    if (!preloadFn) {
      console.warn(`No preload function registered for key: ${key}`);
      return;
    }

    this.preloadQueue.add(key);
    
    try {
      const result = await preloadFn();
      return result;
    } catch (error) {
      console.error(`Preload failed for ${key}:`, error);
    } finally {
      this.preloadQueue.delete(key);
    }
  }

  isPreloading(key: string): boolean {
    return this.preloadQueue.has(key);
  }

  clear() {
    this.preloadQueue.clear();
    this.preloadCallbacks.clear();
  }
}

// 创建全局预加载管理器
export const globalPreloadManager = new PreloadManager();

// 网络状态检测
export class NetworkDetector {
  private listeners: Array<(isOnline: boolean) => void> = [];
  private isListening = false;

  constructor() {
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
  }

  private handleOnline() {
    this.notifyListeners(true);
  }

  private handleOffline() {
    this.notifyListeners(false);
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        console.error('Network status listener error:', error);
      }
    });
  }

  addListener(callback: (isOnline: boolean) => void) {
    this.listeners.push(callback);
    
    if (!this.isListening) {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      this.isListening = true;
    }
    
    // 立即调用一次，提供当前状态
    callback(navigator.onLine);
    
    // 返回移除监听器的函数
    return () => {
      this.removeListener(callback);
    };
  }

  removeListener(callback: (isOnline: boolean) => void) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
    
    if (this.listeners.length === 0 && this.isListening) {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      this.isListening = false;
    }
  }

  get isOnline(): boolean {
    return navigator.onLine;
  }

  destroy() {
    this.listeners = [];
    if (this.isListening) {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      this.isListening = false;
    }
  }
}

// 创建全局网络检测器
export const globalNetworkDetector = new NetworkDetector();

// 智能重试工具
export class SmartRetry {
  static async execute<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      backoffFactor?: number;
      retryCondition?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2,
      retryCondition = () => true
    } = options;

    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          break;
        }
        
        // 检查是否应该重试
        if (!retryCondition(error)) {
          break;
        }
        
        // 计算延迟时间（指数退避）
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
        
        console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

// 性能监控工具
export class PerformanceMonitor {
  private static measurements = new Map<string, number>();

  static start(label: string) {
    this.measurements.set(label, performance.now());
  }

  static end(label: string): number {
    const startTime = this.measurements.get(label);
    if (!startTime) {
      console.warn(`No start time found for performance label: ${label}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.measurements.delete(label);
    
    console.log(`⏱️ Performance [${label}]: ${duration.toFixed(2)}ms`);
    return duration;
  }

  static measure<T>(label: string, operation: () => T): T;
  static measure<T>(label: string, operation: () => Promise<T>): Promise<T>;
  static measure<T>(label: string, operation: () => T | Promise<T>): T | Promise<T> {
    this.start(label);
    
    try {
      const result = operation();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          this.end(label);
        });
      } else {
        this.end(label);
        return result;
      }
    } catch (error) {
      this.end(label);
      throw error;
    }
  }
}

// 导出常用的优化配置
export const OPTIMIZATION_CONFIG = {
  // 防抖延迟
  DEBOUNCE_DELAY: 300,
  // 节流间隔
  THROTTLE_INTERVAL: 100,
  // 预加载阈值（滚动到底部多少像素时开始预加载）
  PRELOAD_THRESHOLD: 200,
  // 最大重试次数
  MAX_RETRIES: 3,
  // 缓存配置
  CACHE: CACHE_CONFIG,
} as const; 