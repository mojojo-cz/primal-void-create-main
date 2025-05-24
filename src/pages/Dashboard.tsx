
import React, { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

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
          // 学生用户可以保持在Dashboard，或重定向到学习页面
          navigate('/student', { replace: true });
          break;
        default:
          // 其他用户类型暂时保持在当前页面
          break;
      }
    }
  }, [profile, navigate]);

  // 显示加载中或重定向提示
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">正在跳转到管理控制台...</p>
      </div>
    </div>
  );
};

export default Dashboard;
