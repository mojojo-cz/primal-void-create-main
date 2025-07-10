import { useEffect, useState, useRef } from 'react';

interface UseStickyHeaderProps {
  rootMargin?: string;
  threshold?: number;
}

export function useStickyHeader({ rootMargin = '0px', threshold = 0 }: UseStickyHeaderProps = {}) {
  const [isSticky, setIsSticky] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 当sentinel不可见时，表示需要激活粘性效果
        setIsSticky(!entry.isIntersecting);
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return {
    isSticky,
    sentinelRef,
    stickyRef
  };
}

interface UseStickyTableHeaderProps {
  tableContainerSelector?: string;
}

export function useStickyTableHeader({ 
  tableContainerSelector = '.table-container' 
}: UseStickyTableHeaderProps = {}) {
  const [stickyHeaders, setStickyHeaders] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const tableContainer = document.querySelector(tableContainerSelector);
    if (!tableContainer) return;

    const handleScroll = () => {
      const planHeaders = tableContainer.querySelectorAll('[data-plan-header]');
      const newStickyHeaders = new Set<string>();
      
      planHeaders.forEach((header) => {
        const rect = header.getBoundingClientRect();
        const containerRect = tableContainer.getBoundingClientRect();
        
        // 如果表头的顶部已经超出容器顶部，则需要粘性显示
        if (rect.top <= containerRect.top + 60) { // 60px 为预留空间
          const planId = header.getAttribute('data-plan-id');
          if (planId) {
            newStickyHeaders.add(planId);
          }
        }
      });
      
      setStickyHeaders(newStickyHeaders);
    };

    tableContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 初始检查
    handleScroll();

    return () => {
      tableContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [tableContainerSelector]);

  return {
    stickyHeaders,
    isStickyHeader: (planId: string) => stickyHeaders.has(planId)
  };
} 