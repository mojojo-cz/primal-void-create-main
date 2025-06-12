import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToTopOnRouteChange } from '@/utils/scrollToTop';

/**
 * 路由变化时自动滚动到顶部的组件
 * 需要放在 Router 内部，在 App 根组件中使用
 */
const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    // 在路由变化时滚动到顶部
    scrollToTopOnRouteChange();
  }, [location.pathname]);

  // 这个组件不渲染任何内容
  return null;
};

export default ScrollToTop; 