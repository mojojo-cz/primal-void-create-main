import { useEffect } from 'react';
import { forceScrollToTop, scrollToTopAfterLoad } from '@/utils/scrollToTop';

/**
 * 自定义Hook：页面加载时自动滚动到顶部
 * @param dependencies - 依赖数组，当这些值变化时会滚动到顶部
 * @param smooth - 是否使用平滑滚动，默认为true
 * @param delay - 延迟时间（毫秒），默认为200ms（增加了延迟确保页面渲染完成）
 */
export const useScrollToTop = (
  dependencies: any[] = [], 
  smooth: boolean = true, 
  delay: number = 200
) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      forceScrollToTop({
        behavior: smooth ? 'smooth' : 'auto',
        retries: 5,
        delay: 150
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
  forceScrollToTop({
    behavior: smooth ? 'smooth' : 'auto',
    retries: 3,
    delay: 100
  });
}; 