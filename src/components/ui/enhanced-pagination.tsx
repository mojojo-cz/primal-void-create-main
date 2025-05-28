import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getAvailablePageSizes } from "@/utils/userPreferences";

interface EnhancedPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  showPageSizeSelector?: boolean;
  showItemsInfo?: boolean;
  maxVisiblePages?: number;
  className?: string;
}

export const EnhancedPagination: React.FC<EnhancedPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  showPageSizeSelector = true,
  showItemsInfo = true,
  maxVisiblePages = 5,
  className = ""
}) => {
  // 如果只有一页且不显示页面大小选择器，则不显示分页
  if (totalPages <= 1 && !showPageSizeSelector) {
    return null;
  }

  const availablePageSizes = getAvailablePageSizes();
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // 计算可见页码
  const getVisiblePages = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return { pages, startPage, endPage };
  };

  const { pages, startPage, endPage } = getVisiblePages();

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* 主分页控件 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* 左侧：每页显示数量选择器 */}
        {showPageSizeSelector && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>每页显示</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value))}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availablePageSizes.map(size => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>项</span>
          </div>
        )}

        {/* 中间：页码导航 */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* 第一页 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
              title="第一页"
            >
              <ChevronsLeft className="h-3 w-3" />
            </Button>

            {/* 上一页 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 px-3"
            >
              <ChevronLeft className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">上一页</span>
            </Button>

            {/* 页码数字 */}
            <div className="flex items-center gap-1">
              {/* 前面的省略号 */}
              {startPage > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(1)}
                    className="h-8 w-8 p-0"
                  >
                    1
                  </Button>
                  {startPage > 2 && (
                    <span className="px-1 text-muted-foreground text-sm">...</span>
                  )}
                </>
              )}

              {/* 可见页码 */}
              {pages.map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className="h-8 w-8 p-0"
                >
                  {page}
                </Button>
              ))}

              {/* 后面的省略号 */}
              {endPage < totalPages && (
                <>
                  {endPage < totalPages - 1 && (
                    <span className="px-1 text-muted-foreground text-sm">...</span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(totalPages)}
                    className="h-8 w-8 p-0"
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>

            {/* 下一页 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 px-3"
            >
              <span className="hidden sm:inline">下一页</span>
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>

            {/* 最后一页 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
              title="最后一页"
            >
              <ChevronsRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* 右侧：项目信息 */}
        {showItemsInfo && (
          <div className="text-sm text-muted-foreground">
            显示第 {totalItems > 0 ? startIndex + 1 : 0}-{endIndex} 项，共 {totalItems} 项
            {totalPages > 1 && (
              <span className="ml-2">
                第 {currentPage} / {totalPages} 页
              </span>
            )}
          </div>
        )}
      </div>

      {/* 移动端简化信息 */}
      <div className="sm:hidden text-center text-xs text-muted-foreground">
        第 {currentPage} / {totalPages} 页 • 共 {totalItems} 项
      </div>
    </div>
  );
};

export default EnhancedPagination; 