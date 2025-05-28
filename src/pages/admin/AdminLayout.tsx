import React, { useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Video, 
  Users,
  AlertCircle,
  Shield,
  Settings,
  Menu,
  X
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";
import { getGlobalSettings } from "@/utils/systemSettings";

const AdminLayout = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  const isTeacher = profile?.user_type === "teacher";
  const systemSettings = getGlobalSettings();

  // 教师尝试访问限制页面时的处理函数
  const handleRestrictedAccess = (e) => {
    if (isTeacher) {
      e.preventDefault();
      toast({
        title: "访问受限",
        description: "教师账号无法访问此功能",
        variant: "destructive"
      });
    }
  };

  // 获取当前页面信息和面包屑导航
  const getCurrentPageInfo = () => {
    const path = location.pathname;
    if (path.includes('/courses')) {
      return { 
        title: '课程管理', 
        breadcrumb: '课程管理',
        showDashboardLink: false,
        breadcrumbPath: `${isTeacher ? '教师控制台' : '管理控制台'} / 课程管理`
      };
    } else if (path.includes('/videos')) {
      return { 
        title: '视频管理', 
        breadcrumb: '视频管理',
        showDashboardLink: false,
        breadcrumbPath: `${isTeacher ? '教师控制台' : '管理控制台'} / 视频管理`
      };
    } else if (path.includes('/accounts')) {
      return { 
        title: '账号管理', 
        breadcrumb: '账号管理',
        showDashboardLink: false,
        breadcrumbPath: `${isTeacher ? '教师控制台' : '管理控制台'} / 账号管理`
      };
    } else if (path.includes('/settings')) {
      return { 
        title: '系统设置', 
        breadcrumb: '设置',
        showDashboardLink: false,
        breadcrumbPath: `${isTeacher ? '教师控制台' : '管理控制台'} / 系统设置`
      };
    }
    return { 
      title: '管理控制台', 
      breadcrumb: '控制台',
      showDashboardLink: false,
      breadcrumbPath: `${isTeacher ? '教师控制台' : '管理控制台'}`
    };
  };

  const currentPage = getCurrentPageInfo();

  const navItems = [
    { 
      to: "/admin/courses", 
      label: "课程管理", 
      icon: <BookOpen className="h-5 w-5" />,
      restricted: isTeacher
    },
    { 
      to: "/admin/videos", 
      label: "视频管理", 
      icon: <Video className="h-5 w-5" />,
      restricted: isTeacher
    },
    { 
      to: "/admin/accounts", 
      label: "账号管理", 
      icon: <Users className="h-5 w-5" />,
      restricted: false
    },
  ];

  const personalItems = [
    {
      to: "/admin/settings",
      label: "设置",
      icon: <Settings className="h-5 w-5" />,
      restricted: false,
      disabled: false
    }
  ];
  
  return (
    <div className="min-h-screen">
      {/* 移动端遮罩层 */}
      <div 
        className={`mobile-sidebar-overlay ${isMobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      ></div>
      
      {/* 左侧边栏 */}
      <aside className={`w-64 admin-sidebar flex-col flex ${isMobileSidebarOpen ? 'mobile-open' : ''}`}>
        {/* 侧边栏头部 */}
        <div className="sidebar-header p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="sidebar-logo w-8 h-8 rounded-lg flex items-center justify-center">
                {systemSettings.system_logo ? (
                  <img 
                    src={systemSettings.system_logo} 
                    alt="系统Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // 如果自定义Logo加载失败，显示默认图标
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.setAttribute('style', 'display: block');
                    }}
                  />
                ) : null}
                <Shield className={`h-5 w-5 text-white ${systemSettings.system_logo ? 'hidden' : ''}`} />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">
                  {isTeacher ? "教师控制台" : "管理员控制台"}
                </h1>
              </div>
            </div>
            
            {/* 移动端关闭按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden p-2 h-8 w-8"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm">
            {systemSettings.site_name || (isTeacher ? "教师管理系统" : "系统管理控制台")}
          </p>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-6">
          {/* 管理功能分组 */}
          <div>
            <h3 className="nav-group-title text-xs uppercase tracking-wider mb-3">
              管理功能
            </h3>
            <div className="space-y-1">
            {navItems.map((item) => {
              if (item.restricted) {
                return (
                  <TooltipProvider key={item.to}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="sidebar-restricted-item flex items-center gap-3 px-4 py-3 rounded-lg cursor-not-allowed"
                          onClick={(e) => {
                            handleRestrictedAccess(e);
                            setIsMobileSidebarOpen(false);
                          }}
                        >
                          {item.icon}
                          <span className="font-medium">{item.label}</span>
                          <AlertCircle className="h-4 w-4 ml-auto text-amber-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1 text-amber-500" />
                          <span>教师账号无法访问此功能</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => 
                    `sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-lg hover:no-underline ${
                      isActive ? 'active' : ''
                    }`
                  }
                  onClick={() => setIsMobileSidebarOpen(false)}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="sidebar-divider"></div>

          {/* 系统设置分组 */}
          <div>
            <h3 className="nav-group-title text-xs uppercase tracking-wider mb-3">
              系统设置
            </h3>
            <div className="space-y-1">
            {personalItems.map((item) => {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => 
                    `sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-lg hover:no-underline ${
                      isActive ? 'active' : ''
                    }`
                  }
                  onClick={() => setIsMobileSidebarOpen(false)}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
            </div>
          </div>
        </nav>

        {/* 侧边栏底部 */}
        <div className="sidebar-user-area p-4">
          <UserAvatarDropdown variant="admin" className="w-full" />
        </div>
      </aside>

      {/* 主内容区域 */}
      <div className="flex flex-col admin-main-content">
        {/* 页面顶部面包屑 */}
        <div className="bg-background">
          <div className="px-4 md:px-6 py-2 md:py-3">
            <div className="admin-nav-breadcrumb">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                  {/* 移动端菜单按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden p-2 h-8 w-8"
                    onClick={() => setIsMobileSidebarOpen(true)}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-medium text-primary truncate">
                      <span className="hidden sm:inline">
                        {currentPage.breadcrumbPath}
                      </span>
                      <span className="sm:hidden">
                        {currentPage.breadcrumb}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 主内容区域 */}
        <main className="bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout; 