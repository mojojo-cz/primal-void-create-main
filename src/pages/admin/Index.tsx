import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const AdminIndex = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">管理员仪表盘</h1>
        <Button onClick={signOut} variant="outline">退出登录</Button>
      </div>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>欢迎回来，{profile?.username || '管理员'}！</CardTitle>
        </CardHeader>
        <CardContent>
          <p>这里是管理员控制面板，您可以管理系统功能和用户。</p>
          <div className="mt-4 flex gap-4">
            <Link to="/admin/courses">
              <Button>课程管理</Button>
            </Link>
            <Link to="/admin/videos">
              <Button variant="secondary">视频管理</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIndex; 