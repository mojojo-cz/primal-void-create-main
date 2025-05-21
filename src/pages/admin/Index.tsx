import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { BookOpen, Video, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminIndex = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    coursesCount: 0,
    videosCount: 0,
    loading: true
  });

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 获取课程数量
        const { count: coursesCount, error: coursesError } = await supabase
          .from('courses')
          .select('id', { count: 'exact', head: true });
        
        // 获取视频数量
        const { count: videosCount, error: videosError } = await supabase
          .from('videos')
          .select('id', { count: 'exact', head: true });
        
        if (!coursesError && !videosError) {
          setStats({
            coursesCount: coursesCount || 0,
            videosCount: videosCount || 0,
            loading: false
          });
        }
      } catch (error) {
        console.error("获取统计数据失败", error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  // 功能卡片数据
  const featureCards = [
    {
      title: "课程管理",
      description: "创建、编辑和删除课程，管理章节和视频",
      icon: <BookOpen className="h-6 w-6" />,
      link: "/admin/courses",
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
    },
    {
      title: "视频管理",
      description: "上传和管理视频资源库",
      icon: <Video className="h-6 w-6" />,
      link: "/admin/videos",
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
    }
  ];

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">欢迎回来，{profile?.username || '管理员'}！</h1>
        <p className="text-muted-foreground mt-1">这里是考研在线课程系统管理员仪表盘。</p>
      </div>
      
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-muted-foreground text-sm">总课程数</p>
              <h3 className="text-3xl font-bold">
                {stats.loading ? "..." : stats.coursesCount}
              </h3>
            </div>
            <div className="p-3 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-muted-foreground text-sm">总视频数</p>
              <h3 className="text-3xl font-bold">
                {stats.loading ? "..." : stats.videosCount}
              </h3>
            </div>
            <div className="p-3 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              <Video className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 功能卡片 */}
      <h2 className="text-xl font-semibold mb-4">快速访问</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {featureCards.map((card, index) => (
          <Link key={index} to={card.link} className="no-underline">
            <Card className="h-full transition-all hover:shadow-md">
              <CardHeader>
                <div className={`p-3 w-fit rounded-full ${card.color} mb-2`}>
                  {card.icon}
                </div>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminIndex; 