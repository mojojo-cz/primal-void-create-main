import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const StudentPageSkeleton = () => {
  return (
    <div className="space-y-4">
      {/* 后台刷新指示器骨架 */}
      <div className="flex items-center justify-center py-2">
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      
      {/* 课程卡片骨架 */}
      {[1, 2, 3, 4].map((index) => (
        <Card key={index} className="overflow-hidden transition-all duration-200 border">
          <CardContent className="p-0">
            <div className="flex gap-4">
              {/* 左侧：封面图片骨架 */}
              <div className="w-24 h-20 flex-shrink-0 sm:w-28 sm:h-24">
                <Skeleton className="w-full h-full" />
              </div>
              
              {/* 右侧：课程信息骨架 */}
              <div className="flex-1 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    {/* 课程标题 */}
                    <Skeleton className="h-5 w-3/4" />
                    
                    {/* 课程描述 */}
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  
                  {/* 状态标签 */}
                  <Skeleton className="h-6 w-16 rounded-full ml-4" />
                </div>
                
                {/* 进度信息和按钮 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-20 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* 空状态骨架 */}
      <div className="text-center py-8">
        <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
        <Skeleton className="h-6 w-48 mx-auto mb-2" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
    </div>
  );
}; 