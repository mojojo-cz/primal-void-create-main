import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, User, PlayCircle, Clock, CheckCircle, X, Menu, RotateCcw, Trash2, LogOut, ChevronRight, Shield, ArrowUp } from "lucide-react";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";
import { getGlobalSettings } from "@/utils/systemSettings";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useScrollToTop } from "@/hooks/useScrollToTop";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  BarChart3,
  PauseCircle,
  Trophy
} from "lucide-react";
import { 
  CACHE_CONFIG, 
  globalVisibilityDetector, 
  PerformanceMonitor,
  debounce,
  OPTIMIZATION_CONFIG
} from '@/utils/performance';
import KeyActivation from "@/components/KeyActivation";
import UpgradePage from "@/pages/UpgradePage";

type ActiveTab = "learning" | "courses" | "profile" | "upgrade";

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
  cover_image: string | null;
  status: 'not_started' | 'learning' | 'completed' | 'paused';
  progress: number;
  enrolled_at: string;
  last_accessed_at: string;
  sections_count: number;
  completed_sections: number;
  last_learning_section_title?: string;
}

const StudentPage = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const systemSettings = getGlobalSettings();
  const [activeTab, setActiveTab] = useState<ActiveTab>("learning");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningCourses, setLearningCourses] = useState<LearningCourse[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [updatingCourseId, setUpdatingCourseId] = useState<string | null>(null);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);

  // 数据缓存和加载状态管理
  const dataCache = useRef<{
    courses: Course[] | null;
    learningCourses: LearningCourse[] | null;
    lastFetch: number;
    isInitialLoad: boolean;
    backgroundRefreshing: boolean; // 新增：后台刷新状态
  }>({
    courses: null,
    learningCourses: null,
    lastFetch: 0,
    isInitialLoad: true,
    backgroundRefreshing: false
  });

  // 使用统一的缓存配置
  const CACHE_DURATION = CACHE_CONFIG.STUDENT_PAGE;

  // 检查缓存是否有效
  const isCacheValid = () => {
    const now = Date.now();
    return (now - dataCache.current.lastFetch) < CACHE_DURATION;
  };

  // 智能数据获取 - 只在必要时获取数据
  const smartFetchData = async (forceRefresh = false, isBackgroundRefresh = false) => {
    if (!user?.id) return;

    // 如果有有效缓存且不强制刷新，使用缓存数据
    if (!forceRefresh && isCacheValid() && dataCache.current.courses && dataCache.current.learningCourses) {
      setCourses(dataCache.current.courses);
      setLearningCourses(dataCache.current.learningCourses);
      setEnrolledCourseIds(new Set(dataCache.current.learningCourses.map(c => c.course_id)));
      return;
    }

    // 如果是后台刷新，设置后台刷新状态
    if (isBackgroundRefresh) {
      dataCache.current.backgroundRefreshing = true;
    } else {
      // 只在初始加载时显示loading
      if (dataCache.current.isInitialLoad) {
        setIsLoading(true);
      }
    }

    try {
      // 使用性能监控测量数据获取时间
      const [coursesResult, learningResult] = await PerformanceMonitor.measure(
        'student-data-fetch',
        () => Promise.all([
          fetchCoursesData(),
          fetchLearningCoursesData()
        ])
      );

      // 更新缓存
      dataCache.current = {
        courses: coursesResult,
        learningCourses: learningResult.courses,
        lastFetch: Date.now(),
        isInitialLoad: false,
        backgroundRefreshing: false
      };

      // 更新状态
      setCourses(coursesResult);
      setLearningCourses(learningResult.courses);
      setEnrolledCourseIds(learningResult.enrolledIds);

    } catch (error) {
      console.error('智能数据获取失败:', error);
      dataCache.current.backgroundRefreshing = false;
    } finally {
      setIsLoading(false);
    }
  };

  // 获取课程数据
  const fetchCoursesData = async (): Promise<Course[]> => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  // 获取学习中的课程数据（重构版，解决N+1问题）  
  const fetchLearningCoursesData = async (): Promise<{courses: LearningCourse[], enrolledIds: Set<string>}> => {
    if (!user?.id) return { courses: [], enrolledIds: new Set() };
    
    // 1. 获取用户所有注册的课程（包含课程详情）
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
          created_at,
          cover_image
        )
      `)
      .eq('user_id', user.id)
      .order('last_accessed_at', { ascending: false });

    if (enrollmentsError) throw enrollmentsError;
    if (!enrollmentsData || enrollmentsData.length === 0) return { courses: [], enrolledIds: new Set() };

    const enrolledIds = new Set(enrollmentsData.map(e => e.course_id));
    const courseIds = Array.from(enrolledIds);

    // 2. 一次性获取所有相关课程的考点信息
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('key_points')
      .select('id, title, chapter_id, chapters!inner(course_id)')
      .in('chapters.course_id', courseIds);

    if (sectionsError) throw sectionsError;

    // 3. 一次性获取所有相关课程的学习进度
    const { data: progressData, error: progressError } = await supabase
      .from('video_progress')
      .select('course_id, section_id, is_completed, last_played_at')
      .eq('user_id', user.id)
      .in('course_id', courseIds);

    if (progressError) throw progressError;

    // 4. 在客户端处理数据，构建映射表
    const sectionTitleMap = new Map<string, string>();
    const courseSectionsMap = new Map<string, string[]>();
    sectionsData?.forEach(section => {
      sectionTitleMap.set(section.id, section.title);
      const courseId = (section.chapters as any).course_id;
      if (!courseSectionsMap.has(courseId)) {
        courseSectionsMap.set(courseId, []);
      }
      courseSectionsMap.get(courseId)!.push(section.id);
    });

    const courseProgressMap = new Map<string, { section_id: string; last_played_at: string; is_completed: boolean }[]>();
    progressData?.forEach(progress => {
      if (!courseProgressMap.has(progress.course_id)) {
        courseProgressMap.set(progress.course_id, []);
      }
      courseProgressMap.get(progress.course_id)!.push(progress as any);
    });

    // 5. 组装最终数据
    const coursesWithProgress: LearningCourse[] = enrollmentsData.map(enrollment => {
      const courseId = enrollment.course_id;
      const sections = courseSectionsMap.get(courseId) || [];
      const progresses = courseProgressMap.get(courseId) || [];

      const sectionsCount = sections.length;
      const completedSections = progresses.filter(p => p.is_completed).length;

      // 找出上次学习的考点
      let lastLearningSectionTitle: string | undefined = undefined;
      const learningProgresses = progresses
        .filter(p => !p.is_completed && p.last_played_at)
        .sort((a, b) => new Date(b.last_played_at).getTime() - new Date(a.last_played_at).getTime());
      
      if (learningProgresses.length > 0) {
        lastLearningSectionTitle = sectionTitleMap.get(learningProgresses[0].section_id);
      }

      const courseDetails = enrollment.courses as any;

      return {
        id: enrollment.id,
        course_id: courseId,
        course_title: courseDetails.title,
        course_description: courseDetails.description || '',
        cover_image: courseDetails.cover_image,
        status: enrollment.status as 'not_started' | 'learning' | 'completed' | 'paused',
        progress: enrollment.progress || 0,
        enrolled_at: enrollment.enrolled_at || '',
        last_accessed_at: enrollment.last_accessed_at || enrollment.enrolled_at || '',
        sections_count: sectionsCount,
        completed_sections: completedSections,
        last_learning_section_title: lastLearningSectionTitle,
      };
    });

    return { courses: coursesWithProgress, enrolledIds };
  };

  // 窗口焦点检测 - 使用全局优化工具
  useEffect(() => {
    if (!user?.id) return;

    const debouncedRefresh = debounce((isVisible: boolean) => {
      if (isVisible && !isCacheValid() && !dataCache.current.backgroundRefreshing) {
        PerformanceMonitor.measure('background-refresh', () => {
          return smartFetchData(false, true); // 后台刷新，不显示loading
        });
      }
    }, OPTIMIZATION_CONFIG.DEBOUNCE_DELAY);

    const removeListener = globalVisibilityDetector.addListener(debouncedRefresh);
    
    return removeListener;
  }, [user]);

  // 确保页面加载时滚动到顶部
  useScrollToTop([user?.id]);

  // 初始数据获取
  useEffect(() => {
    if (user) {
      smartFetchData();
    }
  }, [user]);

  // 保留原有的函数但修改为使用新的数据获取逻辑
  const fetchCourses = async () => {
    try {
      const coursesData = await fetchCoursesData();
      setCourses(coursesData);
      // 更新缓存中的课程数据
      if (dataCache.current.courses !== null) {
        dataCache.current.courses = coursesData;
        dataCache.current.lastFetch = Date.now();
      }
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
      const result = await fetchLearningCoursesData();
      setLearningCourses(result.courses);
      setEnrolledCourseIds(result.enrolledIds);
      
      // 更新缓存
      if (dataCache.current.learningCourses !== null) {
        dataCache.current.learningCourses = result.courses;
        dataCache.current.lastFetch = Date.now();
      }
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
        description: "该课程已在您的学习列表中，正在跳转到学习中页面"
      });
      // 如果课程已在学习列表中，直接跳转到学习中页面
      setActiveTab("learning");
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
        description: "课程已添加到学习列表中，正在跳转到学习中页面"
      });

      // 刷新数据
      await smartFetchData(true); // 强制刷新数据
      
      // 自动跳转到"学习中"页面
      setActiveTab("learning");
      
    } catch (error: any) {
      console.error('添加课程到学习中失败:', error);
      
      // 检查是否是重复插入错误
      if (error.code === '23505') {
        toast({
          title: "课程已添加",
          description: "该课程已在您的学习列表中，正在跳转到学习中页面"
        });
        // 即使课程已存在，也跳转到学习中页面
        setActiveTab("learning");
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
      await smartFetchData(true); // 强制刷新数据
      
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
      await smartFetchData(true); // 强制刷新数据
      
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
      await smartFetchData(true); // 强制刷新数据
      
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

  const navItems = [
    { id: "learning", label: "学习中", icon: <PlayCircle className="h-5 w-5" /> },
    { id: "courses", label: "我的课程", icon: <BookOpen className="h-5 w-5" /> },
    { id: "profile", label: "个人信息", icon: <User className="h-5 w-5" /> }
  ];

  // 用户类型映射
  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case 'student':
        return '正式学员';
      case 'trial_user':
        return '体验用户';
      case 'registered':
        return '注册用户';
      case 'admin':
        return '管理员';
      case 'head_teacher':
        return '班主任';
      case 'business_teacher':
        return '业务老师';
      default:
        return '未知类型';
    }
  };

  const getCourseStatusText = (status: LearningCourse['status'], progress: number) => {
    switch (status) {
      case 'not_started':
        return '未学习';
      case 'completed':
        return '已学完';
      case 'learning':
      case 'paused':
        return `已学 ${progress}%`;
      default:
        return '';
    }
  };

  const renderContent = () => {
    // 只在真正的初始加载时显示骨架屏
    if (isLoading && dataCache.current.isInitialLoad) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border animate-pulse">
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0"></div>
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // 学习中页面
    if (activeTab === 'learning') {
      if (learningCourses.length > 0) {
        return (
          <div className="space-y-4">
            {/* 后台刷新指示器 */}
            {dataCache.current.backgroundRefreshing && (
              <div className="flex items-center justify-center py-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm">
                  <div className="w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                  正在更新数据...
                </div>
              </div>
            )}
            
            {learningCourses.map((course) => {
              const buttonConfig = getLearningButton(course);
              
              return (
                <Card 
                  key={course.id} 
                  className="overflow-hidden transition-all duration-200 border hover:shadow-md cursor-pointer group"
                  onClick={() => {
                    // 如果不是正在处理中的课程，允许点击跳转
                    if (updatingCourseId !== course.id && removingCourseId !== course.id) {
                      navigate(`/student/course/${course.course_id}`);
                    }
                  }}
                >
                  <CardContent className="p-0">
                    <div className="flex gap-4">
                      {/* Left: Cover Image */}
                      <div className="w-24 h-full flex-shrink-0 sm:w-28">
                        <img 
                          src={course.cover_image || `https://placehold.co/400x400/e2e8f0/e2e8f0/png?text=Cover`} 
                          alt={course.course_title}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      
                      {/* Right: Course Info */}
                      <div className="flex-1 py-3 pr-3 flex flex-col justify-between min-w-0">
                        <div>
                          {/* Line 1: Title */}
                          <h3 className="font-semibold text-base leading-snug truncate mb-1.5">
                            {course.course_title}
                          </h3>
                          
                          {/* Line 2: Description or Continue Learning */}
                          <div className="text-sm text-gray-500 min-h-[20px] mb-2">
                            {course.status === 'learning' && course.last_learning_section_title && (
                              <p className="text-blue-600 truncate">
                                继续学习: {course.last_learning_section_title}
                              </p>
                            )}
                            {course.status === 'not_started' && (
                              <p className="truncate">{course.course_description}</p>
                            )}
                            {/* 'completed' state has this line empty */}
                          </div>
                        </div>
                        
                        {/* Line 3: Meta and Play Button */}
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            <span>共 {course.sections_count} 讲</span>
                            <span className="mx-1.5">|</span>
                            <span>{getCourseStatusText(course.status, course.progress)}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-500">
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      } else {
        return (
          <div className="text-center py-16">
            <PlayCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium">暂无学习中的课程</h3>
            <p className="text-gray-500 mt-1">请前往"我的课程"页面选择课程开始学习</p>
          </div>
        );
      }
    }
    
    // 我的课程页面 - 显示所有已发布的课程
    if (activeTab === 'courses') {
      if (courses.length > 0) {
        return (
          <div className="space-y-4">
            {courses.map((course) => {
              const isEnrolled = enrolledCourseIds.has(course.id);
              
              return (
                <Card 
                  key={course.id} 
                  className={`overflow-hidden transition-shadow border ${
                    removingCourseId === course.id 
                      ? 'cursor-not-allowed opacity-60' 
                      : isEnrolled 
                        ? 'hover:shadow-md cursor-pointer' 
                        : 'hover:shadow-md'
                  }`}
                  onClick={() => {
                    // 如果正在移除课程，不允许点击跳转
                    if (removingCourseId === course.id) {
                      return;
                    }
                    // 只有已注册且未在处理中的课程才允许点击跳转
                    if (isEnrolled) {
                      navigate(`/student/course/${course.id}`);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Left: Cover Image */}
                      <div className="w-24 h-24 flex-shrink-0">
                        <img 
                          src={course.cover_image || `https://placehold.co/400x400/e2e8f0/e2e8f0/png?text=Cover`} 
                          alt={course.title}
                          className="object-cover w-full h-full rounded-lg"
                        />
                      </div>
                      
                      {/* Right: Course Info */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          {/* Course Title */}
                          <h3 className="font-semibold text-base leading-snug truncate mb-2">
                            {course.title}
                          </h3>
                          
                          {/* Course Description */}
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                            {course.description}
                          </p>
                        </div>
                        
                        {/* Action Button */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            已发布课程
                          </span>
                          
                          {isEnrolled ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  disabled={removingCourseId === course.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  className="gap-1"
                                >
                                  {removingCourseId === course.id ? (
                                    <>
                                      <div className="animate-pulse">🗑️</div>
                                      <span>移除中...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4" />
                                      <span>移除课程</span>
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
                                    <strong>注意：此操作将会：</strong>
                                    <br />• 删除该课程的学习记录
                                    <br />• 清除所有视频播放进度
                                    <br />• 移除该课程的注册信息
                                    <br /><br />
                                    <span className="text-red-600">此操作不可撤销！</span>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveCourse(course.id, course.title);
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    确认移除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={enrollingCourseId === course.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartLearning(course.id);
                              }}
                              className="gap-1"
                            >
                              {enrollingCourseId === course.id ? (
                                <>
                                  <div className="animate-spin">⟳</div>
                                  <span>加入中...</span>
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="h-4 w-4" />
                                  <span>加入学习</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      } else {
        return (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium">暂无课程</h3>
            <p className="text-gray-500 mt-1">这里还没有任何已发布的课程</p>
          </div>
        );
      }
    }
    
    // 升级学员页面
    if (activeTab === 'upgrade') {
      return <UpgradePage />;
    }
    
    // 个人信息页面
    if (activeTab === 'profile') {
      return (
        <div className="w-full space-y-6">
          {/* 上半部分：基本信息和账户状态 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* 基本信息卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">用户名</span>
                      <span className="text-sm font-medium">{profile?.username || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">姓名</span>
                      <span className="text-sm font-medium">{profile?.full_name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">手机号</span>
                      <span className="text-sm font-medium">{profile?.phone_number || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">用户类型</span>
                      <span className="text-sm font-medium text-blue-600">
                        {getUserTypeLabel(profile?.user_type || '')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">学校</span>
                      <span className="text-sm font-medium">{profile?.school || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">院系</span>
                      <span className="text-sm font-medium">{profile?.department || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">专业</span>
                      <span className="text-sm font-medium">{profile?.major || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">年级</span>
                      <span className="text-sm font-medium">{profile?.grade || '-'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 账户状态卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  账户状态
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">注册时间</span>
                      <span className="text-sm font-medium">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('zh-CN') : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">权限过期时间</span>
                      <span className="text-sm font-medium">
                        {profile?.access_expires_at ? new Date(profile.access_expires_at).toLocaleDateString('zh-CN') : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">账户状态</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-600">正常</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">邮箱</span>
                      <span className="text-sm font-medium">{user?.email || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">最后更新</span>
                      <span className="text-sm font-medium">
                        {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString('zh-CN') : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">登录状态</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-blue-600">已登录</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 下半部分：学习统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                学习统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {learningCourses.length}
                  </div>
                  <div className="text-sm text-blue-600">学习中课程</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {learningCourses.filter(course => course.status === 'completed').length}
                  </div>
                  <div className="text-sm text-green-600">已完成课程</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {courses.length}
                  </div>
                  <div className="text-sm text-purple-600">可学习课程</div>
                </div>
              </div>
              
              {learningCourses.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">最近学习</h4>
                  <div className="space-y-2">
                    {learningCourses
                      .filter(course => course.last_accessed_at)
                      .sort((a, b) => new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime())
                      .slice(0, 3)
                      .map(course => (
                        <div key={course.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                          <img 
                            src={course.cover_image || `https://placehold.co/400x400/e2e8f0/e2e8f0/png?text=Cover`} 
                            alt={course.course_title}
                            className="w-8 h-8 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{course.course_title}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(course.last_accessed_at).toLocaleDateString('zh-CN')} • 
                              {getCourseStatusText(course.status, course.progress)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
    
    // 其他页面的fallback
    return (
      <div className="text-center py-16">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium">暂无内容</h3>
        <p className="text-gray-500 mt-1">选择左侧菜单查看相应内容</p>
      </div>
    );
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

          {/* 分隔线 */}
          <div className="sidebar-divider"></div>

          {/* 系统功能分组 */}
          <div>
            <h3 className="nav-group-title text-xs uppercase tracking-wider mb-3">
              系统功能
            </h3>
            <div className="space-y-1">
              {/* 升级学员按钮 - 只对体验用户显示 */}
              {profile?.user_type === 'trial_user' && (
                <button
                  onClick={() => {
                    setActiveTab('upgrade');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left ${
                    activeTab === 'upgrade' ? 'active' : ''
                  }`}
                >
                  <ArrowUp className="h-5 w-5" />
                  <span className="font-medium">升级学员</span>
                </button>
              )}
              
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