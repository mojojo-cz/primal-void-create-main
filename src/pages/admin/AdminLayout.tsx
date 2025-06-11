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
  X,
  Database,
  LogOut
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
  
  const isHeadTeacher = profile?.user_type === "head_teacher";
  const isBusinessTeacher = profile?.user_type === "business_teacher";
  const isTeacherRole = isHeadTeacher || isBusinessTeacher; // 班主任或业务老师
  const systemSettings = getGlobalSettings();

  // 班主任尝试访问限制页面时的处理函数
  const handleRestrictedAccess = (e) => {
    if (isHeadTeacher) {
      e.preventDefault();
      toast({
        title: "访问受限",
        description: "班主任账号无法访问此功能",
        variant: "destructive"
      });
    }
  };

  // 退出登录处理函数
  const handleLogout = async () => {
    try {
      await signOut();
      // 清理 Supabase 本地缓存
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      // 显示成功提示
      toast({
        title: "退出成功",
        description: "您已安全退出系统",
      });
      // 强制刷新页面并跳转到登录页，彻底重置所有状态
      window.location.replace("/auth/login");
    } catch (error) {
      toast({
        title: "退出失败",
        description: "退出登录时发生错误，请重试",
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
        breadcrumbPath: `${isTeacherRole ? '教师控制台' : '管理控制台'} / 课程管理`
      };
    } else if (path.includes('/videos')) {
      return { 
        title: '视频管理', 
        breadcrumb: '视频管理',
        showDashboardLink: false,
        breadcrumbPath: `${isTeacherRole ? '教师控制台' : '管理控制台'} / 视频管理`
      };
    } else if (path.includes('/accounts')) {
      return { 
        title: '账号管理', 
        breadcrumb: '账号管理',
        showDashboardLink: false,
        breadcrumbPath: `${isTeacherRole ? '教师控制台' : '管理控制台'} / 账号管理`
      };
    } else if (path.includes('/settings')) {
      return { 
        title: '系统设置', 
        breadcrumb: '设置',
        showDashboardLink: false,
        breadcrumbPath: `${isTeacherRole ? '教师控制台' : '管理控制台'} / 系统设置`
      };
    }
    return { 
      title: '管理控制台', 
      breadcrumb: '控制台',
      showDashboardLink: false,
      breadcrumbPath: `${isTeacherRole ? '教师控制台' : '管理控制台'}`
    };
  };

  const currentPage = getCurrentPageInfo();

  const navItems = [
    { 
      to: "/admin/courses", 
      label: "课程管理", 
      icon: <BookOpen className="h-5 w-5" />,
      allowedForTeachers: false // 班主任和业务老师不可访问
    },
    { 
      to: "/admin/videos", 
      label: "视频管理", 
      icon: <Video className="h-5 w-5" />,
      allowedForTeachers: false // 班主任和业务老师不可访问
    },
    { 
      to: "/admin/accounts", 
      label: "账号管理", 
      icon: <Users className="h-5 w-5" />,
      allowedForTeachers: true // 班主任和业务老师可以访问
    },
  ].filter(item => {
    // 如果是班主任或业务老师，只显示允许访问的功能
    if (isTeacherRole) {
      return item.allowedForTeachers;
    }
    // 管理员显示所有功能
    return true;
  });

  const personalItems = [
    {
      to: "/admin/settings",
      label: "系统设置",
      icon: <Settings className="h-5 w-5" />,
      allowedForTeachers: false // 班主任和业务老师不可访问
    }
  ].filter(item => {
    // 如果是班主任或业务老师，只显示允许访问的功能
    if (isTeacherRole) {
      return item.allowedForTeachers;
    }
    // 管理员显示所有功能
    return true;
  });

  // 退出登录按钮配置（单独处理，不在personalItems中）
  const logoutItem = {
    label: "退出登录",
    icon: <LogOut className="h-5 w-5" />,
    onClick: handleLogout
  };
  
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
                  {isTeacherRole ? "教师控制台" : "管理员控制台"}
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
            {systemSettings.site_name || (isTeacherRole ? "教师管理系统" : "系统管理控制台")}
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
            {navItems.map((item) => (
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
            ))}
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
            {personalItems.map((item) => (
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
            ))}
            
            {/* 退出登录按钮 */}
            <button
              onClick={() => {
                logoutItem.onClick();
                setIsMobileSidebarOpen(false);
              }}
              className="sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              {logoutItem.icon}
              <span className="font-medium">{logoutItem.label}</span>
            </button>
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