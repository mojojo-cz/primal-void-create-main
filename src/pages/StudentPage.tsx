import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap } from "lucide-react";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";

const StudentPage = () => {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-8">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">学习中心</h1>
              <p className="text-muted-foreground">欢迎回来，{profile?.full_name || profile?.username}！</p>
            </div>
          </div>
          <UserAvatarDropdown variant="default" />
        </div>

        {/* 主要内容 */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                我的课程
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无课程</h3>
                <p className="text-muted-foreground">
                  您还没有报名任何课程，请联系管理员为您分配课程。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 学生信息 */}
          <Card>
            <CardHeader>
              <CardTitle>个人信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">学号</h4>
                  <p className="text-lg">{profile?.username}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">姓名</h4>
                  <p className="text-lg">{profile?.full_name || '未设置'}</p>
                </div>
                {profile?.school && (
                  <>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">学校</h4>
                      <p className="text-lg">{profile.school}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">专业</h4>
                      <p className="text-lg">{profile.major || '未设置'}</p>
                    </div>
                  </>
                )}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">账户状态</h4>
                  <p className="text-lg">正常</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">有效期至</h4>
                  <p className="text-lg">{new Date(profile?.access_expires_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentPage; 