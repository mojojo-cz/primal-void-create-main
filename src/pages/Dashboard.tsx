
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">用户仪表盘</h1>
        <Button onClick={signOut} variant="outline">退出登录</Button>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>欢迎回来，{profile?.username || '用户'}！</CardTitle>
          <CardDescription>
            您的账户访问有效期至：{new Date(profile?.access_expires_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium">用户名</h4>
              <p className="text-lg">{profile?.username}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium">邮箱</h4>
              <p className="text-lg">{user?.email}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium">手机号码</h4>
              <p className="text-lg">{profile?.phone_number}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium">用户类型</h4>
              <p className="text-lg capitalize">{profile?.user_type}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {profile?.school && (
        <Card>
          <CardHeader>
            <CardTitle>学校信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium">学校</h4>
                <p className="text-lg">{profile.school}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">学院</h4>
                <p className="text-lg">{profile.department}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">专业</h4>
                <p className="text-lg">{profile.major}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">年级/届</h4>
                <p className="text-lg">{profile.grade}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
