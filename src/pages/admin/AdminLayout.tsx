import React from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Video, 
  User, 
  LogOut,
  Menu,
  X,
  Users,
  AlertCircle
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const AdminLayout = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  
  const isTeacher = profile?.user_type === "teacher";
  
  const handleSignOut = async () => {
    try {
      await signOut();
      // 清理 Supabase 本地缓存
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      // 强制刷新页面，彻底重置所有状态
      window.location.replace("/auth/login");
    } catch (e) {
      // 可选：弹出错误提示
    }
  };

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
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">
              {isTeacher ? "教师控制台" : "管理员控制台"}
            </h1>
          </div>
          
          {/* 移动端菜单按钮 */}
          <button 
            className="md:hidden p-2" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
          
          {/* 桌面端导航 */}
          <nav className="hidden md:flex items-center gap-4">
            {navItems.map((item) => {
              const NavComponent = item.restricted ? 
                ({ children }) => (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`flex items-center gap-1 px-3 py-2 rounded cursor-not-allowed opacity-60`}
                          onClick={handleRestrictedAccess}
                        >
                          {children}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1 text-amber-500" />
                          <span>教师账号无法访问此功能</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : 
                NavLink;
                
              return (
                <NavComponent
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => 
                    `flex items-center gap-1 px-3 py-2 rounded transition-colors ${
                      isActive && !item.restricted
                        ? 'bg-primary-foreground/20 text-white' 
                        : 'hover:bg-primary-foreground/10'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavComponent>
              );
            })}
            <div className="h-6 w-px bg-primary-foreground/20 mx-1"></div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2">
                <User className="h-5 w-5" />
                <span>{profile?.username || (isTeacher ? '教师' : '管理员')}</span>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="font-bold"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-1" />
                退出
              </Button>
            </div>
          </nav>
        </div>
      </header>
      
      {/* 移动端菜单 */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-background border-b shadow-sm">
          <div className="container mx-auto py-2">
            <nav className="flex flex-col space-y-1">
              {navItems.map((item) => {
                if (item.restricted) {
                  return (
                    <div
                      key={item.to}
                      className="flex items-center gap-2 px-4 py-2 rounded opacity-60 cursor-not-allowed"
                      onClick={handleRestrictedAccess}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      <AlertCircle className="h-4 w-4 ml-auto text-amber-500" />
                    </div>
                  );
                }
                
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => 
                      `flex items-center gap-2 px-4 py-2 rounded ${
                        isActive ? 'bg-muted font-medium' : 'hover:bg-muted/50'
                      }`
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
              <div className="h-px bg-border my-1"></div>
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span>{profile?.username || (isTeacher ? '教师' : '管理员')}</span>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="font-bold"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  退出
                </Button>
              </div>
            </nav>
          </div>
        </div>
      )}
      
      {/* 主内容区域 */}
      <main className="flex-1 bg-background">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout; 