import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, User, PlayCircle, Clock, CheckCircle, X, Menu, RotateCcw, Trash2 } from "lucide-react";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";
import { getGlobalSettings } from "@/utils/systemSettings";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ActiveTab = "learning" | "courses" | "profile";

interface Course {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
  cover_image?: string;
}

// 学习中的课程数据结构
interface LearningCourse {
  id: string;
  course_id: string;
  course_title: string;
  course_description: string;
  status: 'not_started' | 'learning' | 'completed' | 'paused';
  progress: number;
  enrolled_at: string;
  last_accessed_at: string;
  sections_count: number;
  completed_sections: number;
}

const StudentPage = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const systemSettings = getGlobalSettings();
  const [activeTab, setActiveTab] = useState<ActiveTab>("learning");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningCourses, setLearningCourses] = useState<LearningCourse[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [updatingCourseId, setUpdatingCourseId] = useState<string | null>(null);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);

  // 获取课程数据
  useEffect(() => {
    if (user) {
      fetchCourses();
      fetchLearningCourses();
    }
  }, [user]);

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
      toast({
        variant: "destructive",
        title: "获取课程失败",
        description: "无法加载课程信息，请稍后重试"
      });
    }
  };

  // 获取学习中的课程
  const fetchLearningCourses = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      // 获取用户注册的课程及其详细信息
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          course_id,
          status,
          progress,
          enrolled_at,
          last_accessed_at,
          courses!inner(
            id,
            title,
            description,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .order('last_accessed_at', { ascending: false });

      if (enrollmentsError) throw enrollmentsError;

      // 获取每个课程的章节统计
      const coursesWithProgress: LearningCourse[] = [];
      const enrolledIds = new Set<string>();

      if (enrollmentsData) {
        for (const enrollment of enrollmentsData) {
          enrolledIds.add(enrollment.course_id);
          
          // 获取课程章节数
          const { data: sectionsData, error: sectionsError } = await supabase
            .from('course_sections')
            .select('id')
            .eq('course_id', enrollment.course_id);

          if (sectionsError) {
            console.error('获取章节数失败:', sectionsError);
            continue;
          }

          const sectionsCount = sectionsData?.length || 0;
          const completedSections = Math.floor((enrollment.progress || 0) / 100 * sectionsCount);

          coursesWithProgress.push({
            id: enrollment.id,
            course_id: enrollment.course_id,
            course_title: (enrollment.courses as any).title,
            course_description: (enrollment.courses as any).description || '',
            status: enrollment.status as 'not_started' | 'learning' | 'completed' | 'paused',
            progress: enrollment.progress || 0,
            enrolled_at: enrollment.enrolled_at || '',
            last_accessed_at: enrollment.last_accessed_at || enrollment.enrolled_at || '',
            sections_count: sectionsCount,
            completed_sections: completedSections
          });
        }
      }

      setLearningCourses(coursesWithProgress);
      setEnrolledCourseIds(enrolledIds);
    } catch (error) {
      console.error('获取学习课程失败:', error);
      toast({
        variant: "destructive",
        title: "获取学习进度失败",
        description: "无法加载学习记录，请稍后重试"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 开始学习课程（添加到学习中，状态为未开始）
  const handleStartLearning = async (courseId: string) => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "未登录",
        description: "请先登录后再开始学习"
      });
      return;
    }

    if (enrolledCourseIds.has(courseId)) {
      toast({
        title: "课程已添加",
        description: "该课程已在您的学习列表中"
      });
      return;
    }

    try {
      setEnrollingCourseId(courseId);

      const enrollmentData: TablesInsert<'course_enrollments'> = {
        user_id: user.id,
        course_id: courseId,
        status: 'not_started', // 改为未开始状态
        progress: 0,
        enrolled_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('course_enrollments')
        .insert([enrollmentData]);

      if (error) throw error;

      toast({
        title: "课程已添加",
        description: "课程已添加到学习列表中，请开始学习"
      });

      // 刷新数据
      await fetchLearningCourses();
      
    } catch (error: any) {
      console.error('添加课程到学习中失败:', error);
      
      // 检查是否是重复插入错误
      if (error.code === '23505') {
        toast({
          title: "课程已添加",
          description: "该课程已在您的学习列表中"
        });
      } else {
        toast({
          variant: "destructive",
          title: "添加失败",
          description: error.message || "无法添加课程到学习列表，请稍后重试"
        });
      }
    } finally {
      setEnrollingCourseId(null);
    }
  };

  // 更新学习状态
  const handleUpdateLearningStatus = async (enrollmentId: string, newStatus: 'learning' | 'completed', currentStatus: string) => {
    if (!user?.id) return;

    try {
      setUpdatingCourseId(enrollmentId);

      const updateData: any = {
        status: newStatus,
        last_accessed_at: new Date().toISOString()
      };

      // 如果是从未开始变为学习中，进度设为1%
      if (currentStatus === 'not_started' && newStatus === 'learning') {
        updateData.progress = 1;
      }
      // 如果是重新学习，重置进度
      else if (currentStatus === 'completed' && newStatus === 'learning') {
        updateData.progress = 0;
      }

      const { error } = await supabase
        .from('course_enrollments')
        .update(updateData)
        .eq('id', enrollmentId)
        .eq('user_id', user.id);

      if (error) throw error;

      let toastMessage = "";
      switch (newStatus) {
        case 'learning':
          toastMessage = currentStatus === 'completed' ? "开始重新学习课程" : "开始学习课程";
          break;
        case 'completed':
          toastMessage = "恭喜完成课程学习！";
          break;
      }

      toast({
        title: "状态更新成功",
        description: toastMessage
      });

      // 刷新数据
      await fetchLearningCourses();
      
    } catch (error: any) {
      console.error('更新学习状态失败:', error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新学习状态，请稍后重试"
      });
    } finally {
      setUpdatingCourseId(null);
    }
  };

  // 重置课程进度和播放记录
  const resetCourseProgress = async (course: LearningCourse) => {
    if (!user?.id) return;

    try {
      setUpdatingCourseId(course.id);
      
      console.log('🔄 开始重置课程进度:', { courseId: course.course_id, enrollmentId: course.id });

      // 第一步：删除所有视频播放进度记录
      const { error: progressDeleteError } = await supabase
        .from('video_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', course.course_id);

      if (progressDeleteError) {
        console.error('删除视频进度失败:', progressDeleteError);
        throw new Error(`删除视频播放记录失败: ${progressDeleteError.message}`);
      }

      console.log('✅ 视频播放记录已清空');

      // 第二步：重置课程注册记录
      const { error: enrollmentUpdateError } = await supabase
        .from('course_enrollments')
        .update({
          status: 'not_started',
          progress: 0,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', course.id)
        .eq('user_id', user.id);

      if (enrollmentUpdateError) {
        console.error('重置课程进度失败:', enrollmentUpdateError);
        throw new Error(`重置课程进度失败: ${enrollmentUpdateError.message}`);
      }

      console.log('✅ 课程进度已重置');

      toast({
        title: "重置成功",
        description: `课程《${course.course_title}》已重置为初始状态，可以重新开始学习`
      });

      // 刷新数据
      await fetchLearningCourses();
      
    } catch (error: any) {
      console.error('重置课程进度失败:', error);
      toast({
        variant: "destructive",
        title: "重置失败",
        description: error.message || "无法重置课程进度，请稍后重试"
      });
    } finally {
      setUpdatingCourseId(null);
    }
  };

  // 移除课程功能
  const handleRemoveCourse = async (courseId: string, courseTitle: string) => {
    if (!user?.id) return;

    try {
      setRemovingCourseId(courseId);
      
      console.log('🗑️ 开始移除课程:', { courseId, courseTitle });

      // 第一步：删除视频播放进度记录
      const { error: progressDeleteError } = await supabase
        .from('video_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (progressDeleteError) {
        console.error('删除视频进度失败:', progressDeleteError);
        throw new Error(`删除视频播放记录失败: ${progressDeleteError.message}`);
      }

      console.log('✅ 视频播放记录已清空');

      // 第二步：删除课程注册记录
      const { error: enrollmentDeleteError } = await supabase
        .from('course_enrollments')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (enrollmentDeleteError) {
        console.error('删除课程注册记录失败:', enrollmentDeleteError);
        throw new Error(`移除课程失败: ${enrollmentDeleteError.message}`);
      }

      console.log('✅ 课程注册记录已删除');

      toast({
        title: "移除成功",
        description: `课程《${courseTitle}》已从学习列表中移除`
      });

      // 刷新数据
      await fetchLearningCourses();
      
    } catch (error: any) {
      console.error('移除课程失败:', error);
      toast({
        variant: "destructive",
        title: "移除失败",
        description: error.message || "无法移除课程，请稍后重试"
      });
    } finally {
      setRemovingCourseId(null);
    }
  };

  const getStatusBadge = (status: string, progress: number) => {
    switch (status) {
      case 'not_started':
        return <Badge className="bg-gray-100 text-gray-800">未开始</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>;
      case 'learning':
        return <Badge className="bg-blue-100 text-blue-800">学习中</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800">已暂停</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">未知</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Clock className="h-4 w-4 text-gray-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'learning':
        return <PlayCircle className="h-4 w-4 text-blue-600" />;
      case 'paused':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  // 获取学习按钮文本和操作
  const getLearningButton = (course: LearningCourse) => {
    switch (course.status) {
      case 'not_started':
        return {
          text: "开始学习",
          disabled: false,
          variant: "default" as const, // 默认蓝色
          action: () => {
            // 直接跳转到课程学习页面
            navigate(`/student/course/${course.course_id}`);
          }
        };
      case 'learning':
        return {
          text: "继续学习",
          disabled: false,
          variant: "secondary" as const, // 灰色
          action: () => {
            // 跳转到课程学习页面
            navigate(`/student/course/${course.course_id}`);
          }
        };
      case 'completed':
        return {
          text: "查看课程",
          disabled: false,
          variant: "outline" as const, // 边框样式
          action: () => {
            // 跳转到课程学习页面查看
            navigate(`/student/course/${course.course_id}`);
          }
        };
      case 'paused':
        return {
          text: "继续学习",
          disabled: false,
          variant: "secondary" as const, // 灰色
          action: () => {
            // 直接跳转到课程学习页面
            navigate(`/student/course/${course.course_id}`);
          }
        };
      default:
        return {
          text: "继续学习",
          disabled: true,
          variant: "secondary" as const,
          action: () => {}
        };
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
          <div className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-2">学习中</h2>
              <p className="text-sm md:text-base text-muted-foreground">继续学习您已添加的课程</p>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : learningCourses.length > 0 ? (
              <div className="grid gap-3 md:gap-4">
                {learningCourses.map((course) => (
                  <Card key={course.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 md:p-6">
                      {/* 移动端垂直布局，桌面端水平布局 */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start md:items-center gap-3 md:gap-4 flex-1">
                          <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-lg flex-shrink-0">
                            {getStatusIcon(course.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base md:text-lg mb-1 line-clamp-2">{course.course_title}</h3>
                            <p className="text-sm md:text-base text-muted-foreground mb-2 line-clamp-2">{course.course_description || '暂无课程描述'}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              {getStatusBadge(course.status, course.progress)}
                              {course.status !== 'not_started' && (
                                <div className="flex items-center gap-2">
                                  <div className="w-24 sm:w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary transition-all" 
                                      style={{ width: `${course.progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-muted-foreground">{course.progress}%</span>
                                </div>
                              )}
                              {course.sections_count > 0 && (
                                <span className="text-sm text-muted-foreground">
                                  {course.status === 'not_started' ? 
                                    `共${course.sections_count}章节` : 
                                    `${course.completed_sections}/${course.sections_count} 章节`
                                  }
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              开始学习：{new Date(course.enrolled_at).toLocaleDateString()}
                              {course.last_accessed_at && course.last_accessed_at !== course.enrolled_at && (
                                <span> • 上次学习：{new Date(course.last_accessed_at).toLocaleDateString()}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {course.status === 'completed' ? (
                          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:ml-4">
                            {/* 重新学习按钮 - 调换到左侧 */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  className="flex-1 sm:flex-none"
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingCourseId === course.id}
                                >
                                  {updatingCourseId === course.id ? (
                                    <>
                                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                                      重置中...
                                    </>
                                  ) : (
                                    <>
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      重新学习
                                    </>
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认重新学习</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    您确定要重新学习课程《{course.course_title}》吗？
                                    <br /><br />
                                    <strong>注意：</strong>此操作将会：
                                    <br />• 清除所有视频播放记录
                                    <br />• 重置课程进度为0%
                                    <br />• 将状态改为"未开始"
                                    <br /><br />
                                    重置后您可以从头开始学习这门课程。
                                    <br /><br />
                                    <strong>提示：</strong>如果只是想回顾课程内容，可以选择"继续学习"。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => resetCourseProgress(course)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    确认重置
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            
                            {/* 继续学习按钮 - 调换到右侧，样式改为secondary */}
                            <Button 
                              className="flex-1 sm:flex-none"
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate(`/student/course/${course.course_id}`)}
                              disabled={updatingCourseId === course.id}
                            >
                              继续学习
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            className="w-full md:w-auto md:ml-4"
                            size="sm"
                            variant={getLearningButton(course).variant}
                            disabled={getLearningButton(course).disabled || updatingCourseId === course.id}
                            onClick={getLearningButton(course).action}
                          >
                            {updatingCourseId === course.id ? "处理中..." : getLearningButton(course).text}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8 md:py-12">
                  <PlayCircle className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-base md:text-lg font-medium mb-2">暂无学习记录</h3>
                  <p className="text-sm md:text-base text-muted-foreground mb-4">从"我的课程"中选择课程开始学习</p>
                  <Button 
                    onClick={() => setActiveTab("courses")}
                    variant="outline"
                    size="sm"
                  >
                    浏览课程
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "courses":
        return (
          <div className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-2">我的课程</h2>
              <p className="text-sm md:text-base text-muted-foreground">浏览所有可学习的课程内容</p>
        </div>

            {courses.length > 0 ? (
              <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <Card key={course.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3 md:pb-6">
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                        <span className="line-clamp-2">{course.title}</span>
              </CardTitle>
            </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm md:text-base text-muted-foreground mb-4 line-clamp-3">
                        {course.description || '暂无课程描述'}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          创建时间：{new Date(course.created_at).toLocaleDateString()}
                        </span>
                        {enrolledCourseIds.has(course.id) ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className="w-full sm:w-auto"
                                disabled={removingCourseId === course.id}
                              >
                                {removingCourseId === course.id ? (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-2 animate-pulse" />
                                    移除中...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    移除课程
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认移除课程</AlertDialogTitle>
                                <AlertDialogDescription>
                                  您确定要从学习列表中移除课程《{course.title}》吗？
                                  <br /><br />
                                  <strong>注意：</strong>此操作将会：
                                  <br />• 删除该课程的学习记录
                                  <br />• 清除所有视频播放进度
                                  <br />• 移除该课程的注册信息
                                  <br /><br />
                                  移除后，如需重新学习此课程，需要再次添加到学习列表。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleRemoveCourse(course.id, course.title)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  确认移除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button 
                            size="sm" 
                            className="w-full sm:w-auto"
                            onClick={() => handleStartLearning(course.id)}
                            disabled={enrollingCourseId === course.id}
                          >
                            {enrollingCourseId === course.id ? "添加中..." : "开始学习"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8 md:py-12">
                  <BookOpen className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-base md:text-lg font-medium mb-2">暂无课程</h3>
                  <p className="text-sm md:text-base text-muted-foreground">目前还没有可学习的课程</p>
            </CardContent>
          </Card>
            )}
          </div>
        );

      case "profile":
        return (
          <div className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-2">个人信息</h2>
              <p className="text-sm md:text-base text-muted-foreground">查看和管理您的个人资料</p>
            </div>
            
          <Card>
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="text-base md:text-lg">基本信息</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">学号</h4>
                    <p className="text-base md:text-lg">{profile?.username}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">姓名</h4>
                    <p className="text-base md:text-lg">{profile?.full_name || '未设置'}</p>
                  </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">手机号</h4>
                    <p className="text-base md:text-lg">{profile?.phone_number || '未设置'}</p>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">账户类型</h4>
                    <p className="text-base md:text-lg">学员</p>
                </div>
                {profile?.school && (
                  <>
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">学校</h4>
                        <p className="text-base md:text-lg">{profile.school}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">专业</h4>
                        <p className="text-base md:text-lg">{profile.major || '未设置'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">学院</h4>
                        <p className="text-base md:text-lg">{profile.department || '未设置'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">年级</h4>
                        <p className="text-base md:text-lg">{profile.grade || '未设置'}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">账户状态</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-base md:text-lg text-green-600">正常</span>
                    </div>
                  </div>
                  {profile?.access_expires_at && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">有效期至</h4>
                      <p className="text-base md:text-lg">{new Date(profile.access_expires_at).toLocaleDateString()}</p>
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