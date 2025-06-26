import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users, BookOpen, User, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Shield, Menu, X, LogOut } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";
import { getGlobalSettings } from "@/utils/systemSettings";
import { scrollToTopAfterLoad } from "@/utils/scrollToTop";

interface Schedule {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  lesson_title: string;
  lesson_description?: string;
  location?: string;
  online_meeting_url?: string;
  course_hours?: number;
  status: string;
  created_at: string;
  updated_at: string;
  // 关联数据
  class_name: string;
  subject_name: string;
}

const TeacherPage = () => {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [currentWeek, setCurrentWeek] = useState(0); // 0 = 本周, 1 = 下周, -1 = 上周
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const systemSettings = getGlobalSettings();

  // 权限检查
  if (!profile || profile.user_type !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">权限不足</h2>
          <p className="text-muted-foreground">只有任课老师可以访问此页面</p>
        </div>
      </div>
    );
  }

  // 获取当前周的日期范围
  const getCurrentWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = 周日, 1 = 周一, ...
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday + (currentWeek * 7));
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return { monday, sunday };
  };

  // 获取我的课表
  const fetchMySchedules = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const { monday, sunday } = getCurrentWeekRange();
      
      // 查询当前老师的排课
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          classes!inner(name),
          subjects!inner(name)
        `)
        .eq('teacher_id', profile.id)
        .gte('schedule_date', monday.toISOString().split('T')[0])
        .lte('schedule_date', sunday.toISOString().split('T')[0])
        .order('schedule_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        throw error;
      }

      // 转换数据格式
      const formattedSchedules = data?.map(schedule => ({
        ...schedule,
        class_name: schedule.classes.name,
        subject_name: schedule.subjects.name
      })) || [];

      setSchedules(formattedSchedules);
    } catch (error: any) {
      console.error('获取课表失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载课表数据"
      });
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间
  const formatTime = (time: string) => {
    return time.substring(0, 5); // HH:MM
  };

  // 格式化日期
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default">已安排</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">进行中</Badge>;
      case 'completed':
        return <Badge variant="outline">已完成</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">已取消</Badge>;
      case 'postponed':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">已延期</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 获取周显示文本
  const getWeekText = () => {
    if (currentWeek === 0) return "本周";
    if (currentWeek === 1) return "下周";
    if (currentWeek === -1) return "上周";
    return currentWeek > 0 ? `${currentWeek}周后` : `${Math.abs(currentWeek)}周前`;
  };

  // 获取日期范围文本
  const getDateRangeText = () => {
    const { monday, sunday } = getCurrentWeekRange();
    return `${monday.toLocaleDateString('zh-CN')} - ${sunday.toLocaleDateString('zh-CN')}`;
  };

  // 刷新课表
  const handleRefresh = () => {
    fetchMySchedules();
  };

  // 切换到上一周
  const handlePreviousWeek = () => {
    setCurrentWeek(prev => prev - 1);
  };

  // 切换到下一周
  const handleNextWeek = () => {
    setCurrentWeek(prev => prev + 1);
  };

  // 回到本周
  const handleCurrentWeek = () => {
    setCurrentWeek(0);
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

  useEffect(() => {
    fetchMySchedules();
  }, [profile?.id, currentWeek]);

  useEffect(() => {
    scrollToTopAfterLoad();
  }, []);

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
                <Shield className={`h-5 w-5 text-white ${systemSettings.system_logo ? 'hidden' : ''}`} />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">
                  教师控制台
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
            {systemSettings.site_name || "显然考研·教师平台"}
          </p>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-6">
          {/* 教学功能分组 */}
          <div>
            <h3 className="nav-group-title text-xs uppercase tracking-wider mb-3">
              教学功能
            </h3>
            <div className="space-y-1">
              <div className="sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-lg active">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">我的课表</span>
              </div>
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
              {/* 退出登录按钮 */}
              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileSidebarOpen(false);
                }}
                className="sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">退出登录</span>
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
                        教师控制台 / 我的课表
                      </span>
                      <span className="sm:hidden">
                        我的课表
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
          <div className="admin-page-container">
            {/* 欢迎信息 */}
            <div className="mb-6 md:mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <User className="h-5 w-5 md:h-6 md:w-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">
                    欢迎，{profile?.full_name || profile?.username} 老师！
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground">
                    您的专属教学管理平台
                  </p>
                </div>
              </div>
            </div>

        {/* 我的课表模块 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                我的课表
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
            
            {/* 周切换控件 */}
            <div className="flex items-center justify-between mt-4">
              <div>
                <h3 className="text-lg font-semibold">{getWeekText()}课表</h3>
                <p className="text-sm text-muted-foreground">{getDateRangeText()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousWeek}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一周
                </Button>
                {currentWeek !== 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCurrentWeek}
                  >
                    本周
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextWeek}
                >
                  下一周
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">加载课表中...</p>
                </div>
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无课程安排</h3>
                <p className="text-muted-foreground">
                  {getWeekText()}没有安排课程
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {schedules.map((schedule) => (
                  <Card key={schedule.id} className="border-l-4 border-l-indigo-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{schedule.lesson_title}</h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" />
                              {schedule.subject_name}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {schedule.class_name}
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(schedule.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDate(schedule.schedule_date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {schedule.location || schedule.online_meeting_url ? (
                              schedule.location ? schedule.location : "在线课程"
                            ) : (
                              "待安排"
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {schedule.lesson_description && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground">
                            {schedule.lesson_description}
                          </p>
                        </div>
                      )}
                      
                      {schedule.course_hours && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            {schedule.course_hours} 课时
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TeacherPage; 