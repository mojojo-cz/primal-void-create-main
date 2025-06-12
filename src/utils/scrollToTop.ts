/**
 * 滚动到页面顶部的工具函数
 * 特别针对移动端进行了优化
 */

// 检测是否为移动设备
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768;
};

/**
 * 强制滚动到页面顶部
 * @param options 滚动选项
 */
export const forceScrollToTop = (options?: {
  behavior?: 'auto' | 'smooth';
  retries?: number;
  delay?: number;
}) => {
  const {
    behavior = 'auto', // 移动端默认使用 'auto' 行为，更可靠
    retries = 3,
    delay = 100
  } = options || {};

  let attempt = 0;

  const scrollToTop = () => {
    attempt++;
    
    try {
      // 方法1: 使用 window.scrollTo
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: isMobile() ? 'auto' : behavior
      });

      // 方法2: 直接设置 scrollTop (备用方案)
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
      }

      // 方法3: 针对移动端的额外处理
      if (isMobile()) {
        // 在移动端，有时需要触发 viewport 的重新计算
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 50);
      }

      console.log(`[SCROLL] 滚动到顶部 - 尝试 ${attempt}/${retries}`);

      // 验证滚动是否成功
      setTimeout(() => {
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        
        if (currentScrollY > 10 && attempt < retries) {
          console.log(`[SCROLL] 滚动验证失败，当前位置: ${currentScrollY}，重试...`);
          setTimeout(scrollToTop, delay);
        } else {
          console.log(`[SCROLL] 滚动完成，当前位置: ${currentScrollY}`);
        }
      }, behavior === 'smooth' ? 500 : 100);

    } catch (error) {
      console.error('[SCROLL] 滚动到顶部失败:', error);
      
      // 如果出错且还有重试次数，则重试
      if (attempt < retries) {
        setTimeout(scrollToTop, delay);
      }
    }
  };

  // 立即执行第一次滚动
  scrollToTop();
};

/**
 * 页面加载完成后滚动到顶部
 * 等待页面完全渲染后再执行滚动
 */
export const scrollToTopAfterLoad = (options?: {
  behavior?: 'auto' | 'smooth';
  timeout?: number;
}) => {
  const { timeout = 1000, ...scrollOptions } = options || {};

  // 如果页面已经完全加载，立即滚动
  if (document.readyState === 'complete') {
    setTimeout(() => forceScrollToTop(scrollOptions), 100);
    return;
  }

  // 等待页面加载完成
  const handleLoad = () => {
    setTimeout(() => forceScrollToTop(scrollOptions), 150);
    window.removeEventListener('load', handleLoad);
  };

  window.addEventListener('load', handleLoad);

  // 设置超时，防止无限等待
  setTimeout(() => {
    window.removeEventListener('load', handleLoad);
    forceScrollToTop(scrollOptions);
  }, timeout);
};

/**
 * 路由变化后滚动到顶部
 * 专门用于路由跳转后的滚动处理
 */
export const scrollToTopOnRouteChange = () => {
  // 使用 requestAnimationFrame 确保在下一次重绘之前执行
  requestAnimationFrame(() => {
    setTimeout(() => {
      forceScrollToTop({
        behavior: isMobile() ? 'auto' : 'smooth',
        retries: 5,
        delay: 150
      });
    }, 200); // 给路由更多时间完成渲染
  });
};

export default {
  forceScrollToTop,
  scrollToTopAfterLoad,
  scrollToTopOnRouteChange
}; 