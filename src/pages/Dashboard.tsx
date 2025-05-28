import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, User } from "lucide-react";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(true);

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
      <div className="container mx-auto p-4 md:p-8">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">用户中心</h1>
              <p className="text-muted-foreground">欢迎，{profile?.full_name || profile?.username}！</p>
            </div>
          </div>
          <UserAvatarDropdown variant="default" />
        </div>

        {/* 主要内容 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                学习资源
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                访问学习材料和课程内容
              </p>
              <Button 
                onClick={() => navigate('/student')} 
                className="w-full"
                variant="outline"
              >
                进入学习
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                个人信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">姓名：</span>{profile?.full_name}</p>
                <p><span className="font-medium">用户名：</span>{profile?.username}</p>
                <p><span className="font-medium">手机号：</span>{profile?.phone_number}</p>
                {profile?.school && <p><span className="font-medium">学校：</span>{profile.school}</p>}
                {profile?.major && <p><span className="font-medium">专业：</span>{profile.major}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>账户状态</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                您的账户类型：注册用户
              </p>
              <p className="text-sm text-muted-foreground">
                如需更多权限，请联系管理员
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
