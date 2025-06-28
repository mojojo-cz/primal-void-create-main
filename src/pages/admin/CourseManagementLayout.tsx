import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const CourseManagementLayout = () => {
  const location = useLocation();

  const subNavItems = [
    {
      to: "/admin/courses/offline",
      label: "线下课程",
      icon: <BookOpen className="h-4 w-4" />,
      tooltip: "管理排课所需的教学科目和学科分类"
    },
    {
      to: "/admin/courses/online",
      label: "自制网课",
      icon: <Video className="h-4 w-4" />,
      tooltip: "管理包含视频章节的线上自学课程"
    }
  ];

  return (
    <TooltipProvider>
      <div className="w-full p-4 md:p-6 lg:p-8">
        {/* Tab式二级导航 */}
        <div className="mb-6">
          <div className="border-b border-border">
            <nav className="flex space-x-6 -mb-px" aria-label="课程管理子导航">
              {subNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.to) ||
                               (item.to === "/admin/courses/offline" && location.pathname === "/admin/courses");
                
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.to}
                        className={cn(
                          "flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 whitespace-nowrap",
                          "transition-all duration-200",
                          "hover:text-primary hover:border-primary/50",
                          isActive 
                            ? "text-primary border-primary" 
                            : "text-muted-foreground border-transparent"
                        )}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-60">
                      <p>{item.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </div>
        </div>

        {/* 子页面内容 */}
        <div className="space-y-6">
          <Outlet />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default CourseManagementLayout;
