import { useEffect } from 'react';

/**
 * 自定义Hook：页面加载时自动滚动到顶部
 * @param dependencies - 依赖数组，当这些值变化时会滚动到顶部
 * @param smooth - 是否使用平滑滚动，默认为true
 * @param delay - 延迟时间（毫秒），默认为100ms
 */
export const useScrollToTop = (
  dependencies: any[] = [], 
  smooth: boolean = true, 
  delay: number = 100
) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ 
        top: 0, 
        behavior: smooth ? 'smooth' : 'auto' 
      });
    }, delay);

    return () => clearTimeout(timer);
  }, dependencies);
};

/**
 * 立即滚动到顶部的工具函数
 * @param smooth - 是否使用平滑滚动，默认为true
 */
export const scrollToTop = (smooth: boolean = true) => {
  window.scrollTo({ 
    top: 0, 
    behavior: smooth ? 'smooth' : 'auto' 
  });
}; 