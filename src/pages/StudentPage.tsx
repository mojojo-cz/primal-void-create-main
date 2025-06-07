import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, User, PlayCircle, Clock, CheckCircle, X, Menu } from "lucide-react";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";
import { getGlobalSettings } from "@/utils/systemSettings";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type ActiveTab = "learning" | "courses" | "profile";

interface Course {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
}

interface Chapter {
  id: string;
  title: string;
  video_url: string;
  course_id: string;
  order_index: number;
  duration: number;
}

interface Progress {
  chapter_id: string;
  progress: number;
  completed: boolean;
  last_watched_at: string;
}

const StudentPage = () => {
  const { profile } = useAuth();
  const systemSettings = getGlobalSettings();
  const [activeTab, setActiveTab] = useState<ActiveTab>("learning");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningData, setLearningData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 获取课程数据
  useEffect(() => {
    fetchCourses();
    fetchLearningProgress();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('获取课程失败:', error);
    }
  };

  const fetchLearningProgress = async () => {
    try {
      // 这里可以查询学习进度数据
      // 暂时使用模拟数据
      const mockLearningData = [
        {
          id: '1',
          course_title: '高等数学基础',
          chapter_title: '第3章 导数与微分',
          progress: 65,
          status: 'learning',
          last_watched: '2024-01-15 14:30:00'
        },
        {
          id: '2',
          course_title: '英语语法精讲',
          chapter_title: '第1章 时态语态',
          progress: 100,
          status: 'completed',
          last_watched: '2024-01-14 16:20:00'
        },
        {
          id: '3',
          course_title: '政治理论',
          chapter_title: '第2章 马克思主义基本原理',
          progress: 0,
          status: 'not_started',
          last_watched: null
        }
      ];
      setLearningData(mockLearningData);
    } catch (error) {
      console.error('获取学习进度失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string, progress: number) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>;
      case 'learning':
        return <Badge className="bg-blue-100 text-blue-800">学习中</Badge>;
      case 'not_started':
        return <Badge className="bg-gray-100 text-gray-800">未学习</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">未知</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'learning':
        return <PlayCircle className="h-4 w-4 text-blue-600" />;
      case 'not_started':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const navItems = [
    { id: "learning", label: "学习中", icon: <PlayCircle className="h-5 w-5" /> },
    { id: "courses", label: "我的课程", icon: <BookOpen className="h-5 w-5" /> },
    { id: "profile", label: "个人信息", icon: <User className="h-5 w-5" /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "learning":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">学习中</h2>
              <p className="text-muted-foreground">继续上次未完成的课程学习</p>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : learningData.length > 0 ? (
              <div className="grid gap-4">
                {learningData.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                            {getStatusIcon(item.status)}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{item.course_title}</h3>
                            <p className="text-muted-foreground mb-2">{item.chapter_title}</p>
                            <div className="flex items-center gap-4">
                              {getStatusBadge(item.status, item.progress)}
                              {item.status !== 'not_started' && (
                                <div className="flex items-center gap-2">
                                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary transition-all" 
                                      style={{ width: `${item.progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-muted-foreground">{item.progress}%</span>
                                </div>
                              )}
                            </div>
                            {item.last_watched && (
                              <p className="text-xs text-muted-foreground mt-2">
                                上次学习：{new Date(item.last_watched).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button 
                          className="ml-4"
                          disabled={item.status === 'completed'}
                        >
                          {item.status === 'completed' ? '已完成' : '继续学习'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <PlayCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">暂无学习记录</h3>
                  <p className="text-muted-foreground">开始学习课程后，这里会显示您的学习进度</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "courses":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">我的课程</h2>
              <p className="text-muted-foreground">浏览所有可学习的课程内容</p>
            </div>
            
            {courses.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <Card key={course.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        {course.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4 line-clamp-3">
                        {course.description || '暂无课程描述'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          创建时间：{new Date(course.created_at).toLocaleDateString()}
                        </span>
                        <Button size="sm">开始学习</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">暂无课程</h3>
                  <p className="text-muted-foreground">目前还没有可学习的课程</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">个人信息</h2>
              <p className="text-muted-foreground">查看和管理您的个人资料</p>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">学号</h4>
                    <p className="text-lg">{profile?.username}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">姓名</h4>
                    <p className="text-lg">{profile?.full_name || '未设置'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">手机号</h4>
                    <p className="text-lg">{profile?.phone_number || '未设置'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">账户类型</h4>
                    <p className="text-lg">学员</p>
                  </div>
                  {profile?.school && (
                    <>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">学校</h4>
                        <p className="text-lg">{profile.school}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">专业</h4>
                        <p className="text-lg">{profile.major || '未设置'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">学院</h4>
                        <p className="text-lg">{profile.department || '未设置'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">年级</h4>
                        <p className="text-lg">{profile.grade || '未设置'}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">账户状态</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-lg text-green-600">正常</span>
                    </div>
                  </div>
                  {profile?.access_expires_at && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">有效期至</h4>
                      <p className="text-lg">{new Date(profile.access_expires_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
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
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.setAttribute('style', 'display: block');
                    }}
                  />
                ) : null}
                <GraduationCap className={`h-5 w-5 text-white ${systemSettings.system_logo ? 'hidden' : ''}`} />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">学习中心</h1>
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
            {systemSettings.site_name || "显然考研·学员平台"}
          </p>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-6">
          <div>
            <h3 className="nav-group-title text-xs uppercase tracking-wider mb-3">
              学习功能
            </h3>
            <div className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as ActiveTab);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left ${
                    activeTab === item.id ? 'active' : ''
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
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
                    <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-medium text-primary truncate">
                      <span className="hidden sm:inline">
                        学习中心 / {navItems.find(item => item.id === activeTab)?.label}
                      </span>
                      <span className="sm:hidden">
                        {navItems.find(item => item.id === activeTab)?.label}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 主内容区域 */}
        <main className="bg-background p-4 md:p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default StudentPage; 