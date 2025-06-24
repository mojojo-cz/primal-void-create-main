import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const CourseStudySkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      {/* 课程标题骨架 */}
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-2/3 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
      </div>

      {/* 进度条骨架 */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between mt-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </CardContent>
      </Card>

      {/* 视频列表骨架 */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((index) => (
          <Card key={index} className="transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  {/* 状态图标 */}
                  <Skeleton className="h-6 w-6 rounded-full" />
                  
                  {/* 标题和描述 */}
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                
                {/* 播放按钮 */}
                <Skeleton className="h-10 w-24 rounded-md" />
              </div>
              
              {/* 进度条 */}
              <div className="mt-4 space-y-2">
                <Skeleton className="h-1 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 底部操作按钮骨架 */}
      <div className="flex justify-center space-x-4 pt-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}; 