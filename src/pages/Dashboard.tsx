import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Shield, AlertCircle, Phone, Mail, MessageCircle } from "lucide-react";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";
import { getGlobalSettings } from "@/utils/systemSettings";

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(true);
  const systemSettings = getGlobalSettings();

  useEffect(() => {
    // 根据用户类型自动重定向到相应的管理控制台
    if (profile) {
      switch (profile.user_type) {
        case 'admin':
          navigate('/admin/courses', { replace: true });
          break;
        case 'teacher':
          navigate('/admin/accounts', { replace: true });
          break;
        case 'student':
          navigate('/student', { replace: true });
          break;
        case 'registered':
        default:
          // 注册用户显示欢迎页面
          setIsRedirecting(false);
          break;
      }
    }
  }, [profile, navigate]);

  // 如果正在重定向，显示加载状态
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在跳转到管理控制台...</p>
        </div>
      </div>
    );
  }

  // 注册用户的欢迎页面
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <div className="bg-background border-b border-border/40">
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="sidebar-logo w-8 h-8 rounded-lg flex items-center justify-center">
                {systemSettings.system_logo ? (
                  <img 
                    src={systemSettings.system_logo} 
                    alt="系统Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.setAttribute('style', 'display: block');
                    }}
                  />
                ) : null}
                <Shield className={`h-5 w-5 text-white ${systemSettings.system_logo ? 'hidden' : ''}`} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold leading-tight">
                  学员控制台
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {systemSettings.site_name || "显然考研·学员平台"}
                </p>
              </div>
            </div>
            <UserAvatarDropdown variant="default" />
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <main className="container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl">
        {/* 欢迎信息 */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold">
                欢迎，{profile?.full_name || profile?.username}！
              </h2>
              <p className="text-sm md:text-base text-muted-foreground">
                您已成功注册为注册用户
              </p>
            </div>
          </div>
        </div>

        {/* 权限开通提示区域 */}
        <div className="grid gap-4 md:gap-6">
          {/* 主要提示卡片 */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                权限开通提示
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/60 rounded-lg p-4">
                <h3 className="font-semibold text-amber-900 mb-2">
                  学员请联系班主任或管理员开通权限
                </h3>
                <p className="text-sm text-amber-800 leading-relaxed">
                  您的账户已成功注册，但需要班主任或管理员将账户授权为学员账户后，才能访问课程内容和学习资料。请联系相关人员开通权限
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 账户状态卡片 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  账户状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-sm text-muted-foreground">账户类型</span>
                    <span className="text-sm font-medium">注册学员</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-sm text-muted-foreground">用户名</span>
                    <span className="text-sm font-medium">{profile?.username}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">注册状态</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-600">已完成</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  学习权限
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-sm text-muted-foreground">课程访问</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span className="text-sm font-medium text-amber-600">待开通</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-sm text-muted-foreground">资料下载</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span className="text-sm font-medium text-amber-600">待开通</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">在线学习</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span className="text-sm font-medium text-amber-600">待开通</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 帮助说明 */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <h3 className="font-medium text-muted-foreground">需要帮助？</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  如果您在权限开通过程中遇到任何问题，或者需要了解更多信息，请随时联系我们的工作人员。
                  我们会尽快为您处理权限开通事宜。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
