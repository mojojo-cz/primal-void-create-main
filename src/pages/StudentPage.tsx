import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, User, PlayCircle, Clock, CheckCircle, X, Menu, RotateCcw, Trash2, LogOut, ChevronRight, Shield, ArrowUp, Calendar, MapPin, FileText, ChevronDown, Download } from "lucide-react";
import UserAvatarDropdown from "@/components/UserAvatarDropdown";
import { getGlobalSettings } from "@/utils/systemSettings";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
import { StudentPageSkeleton } from "@/components/ui/student-page-skeleton";
import KeyActivation from "@/components/KeyActivation";
import UpgradePage from "@/pages/UpgradePage";
import { formatDateForDisplay, toSafeISOString } from '@/utils/timezone';
import * as XLSX from 'xlsx';

type ActiveTab = "learning" | "courses" | "schedule" | "profile" | "upgrade";

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

// 学员课表数据结构
interface StudentSchedule {
  schedule_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  period: string;
  subject_name: string;
  lesson_title: string;
  lesson_description: string;
  teacher_name: string;
  teacher_full_name: string;
  venue_name: string;
  venue_type: string;
  class_name: string;
  plan_name: string;
  participation_source: 'class' | 'plan' | 'schedule';
  participation_type: string;
  status: string;
  notes: string;
}

const StudentPage = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const systemSettings = getGlobalSettings();
  
  // 从URL参数读取初始activeTab值，默认为"learning"
  const getInitialTab = (): ActiveTab => {
    const tabFromUrl = searchParams.get('tab') as ActiveTab;
    const validTabs: ActiveTab[] = ["learning", "courses", "schedule", "profile", "upgrade"];
    return validTabs.includes(tabFromUrl) ? tabFromUrl : "learning";
  };
  
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab());
  
  // 处理标签页切换，同时更新URL参数
  const handleTabChange = (newTab: ActiveTab) => {
    setActiveTab(newTab);
    // 更新URL参数，保持其他参数不变
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', newTab);
    setSearchParams(newParams, { replace: true });
  };
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningCourses, setLearningCourses] = useState<LearningCourse[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [updatingCourseId, setUpdatingCourseId] = useState<string | null>(null);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);
  
  // 课表相关状态
  const [schedules, setSchedules] = useState<StudentSchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<StudentSchedule | null>(null);
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false);
  const [scheduleTab, setScheduleTab] = useState<'pending' | 'all'>('pending'); // 默认显示待上课程
  const [selectedSchedulePlan, setSelectedSchedulePlan] = useState<string>('all'); // 默认显示全部课表
  const [availableSchedulePlans, setAvailableSchedulePlans] = useState<Array<{value: string, label: string}>>([]);
  const [courseFieldWidth, setCourseFieldWidth] = useState<number>(320); // 课程字段动态宽度，默认320px
  const [venueFieldWidth, setVenueFieldWidth] = useState<number>(120); // 教室字段动态宽度，默认120px
  const [planFieldWidth, setPlanFieldWidth] = useState<number>(200); // 所属课表字段动态宽度，默认200px

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
      // 使用优化的数据库函数一次性获取所有数据
      const { data: studentData, error } = await PerformanceMonitor.measure(
        'student-data-fetch-optimized',
        () => supabase.rpc('get_student_page_data', {
          p_user_id: user.id
        })
      );

      if (error) {
        console.error('获取学生页面数据失败:', error);
        throw error;
      }

      if (!studentData) {
        throw new Error('学生页面数据不存在');
      }

      const studentDataObj = studentData as any;
      const coursesData = studentDataObj.courses || [];
      const learningCoursesData = studentDataObj.learning_courses || [];
      const enrolledCourseIdsArray = studentDataObj.enrolled_course_ids || [];

      const enrolledIds = new Set<string>(enrolledCourseIdsArray);

      // 更新缓存
      dataCache.current = {
        courses: coursesData,
        learningCourses: learningCoursesData,
        lastFetch: Date.now(),
        isInitialLoad: false,
        backgroundRefreshing: false
      };

      // 更新状态
      setCourses(coursesData);
      setLearningCourses(learningCoursesData);
      setEnrolledCourseIds(enrolledIds);

    } catch (error) {
      console.error('智能数据获取失败:', error);
      dataCache.current.backgroundRefreshing = false;
      toast({
        variant: "destructive",
        title: "数据加载失败",
        description: "无法加载页面数据，请稍后重试"
      });
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

  // 监听URL参数变化，同步activeTab状态
  useEffect(() => {
    const newTab = getInitialTab();
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchParams]);

  // 当切换到课表页面时获取课表数据
  useEffect(() => {
    if (activeTab === 'schedule' && user?.id) {
      fetchStudentSchedule();
    }
  }, [activeTab, user?.id]);

  // 计算过滤后的课表数据
  const filteredSchedules = useMemo(() => {
    let filtered = schedules;
    
    // 根据选中的课表过滤
    if (selectedSchedulePlan !== 'all') {
      filtered = schedules.filter(schedule => {
        const schedulePlan = schedule.plan_name || schedule.class_name;
        return schedulePlan === selectedSchedulePlan;
      });
    }
    
    // 根据待上/全部课程过滤
    if (scheduleTab === 'pending') {
      filtered = filtered.filter(schedule => {
        const now = new Date();
        const scheduleEndTime = new Date(`${schedule.schedule_date}T${schedule.end_time}`);
        return scheduleEndTime > now;
      });
    }
    
    return filtered;
  }, [schedules, selectedSchedulePlan, scheduleTab]);

  // 当课表tab切换或课表选择切换时重新计算字段宽度
  useEffect(() => {
    if (filteredSchedules.length > 0) {
      calculateFieldWidths(filteredSchedules);
    }
  }, [filteredSchedules]);

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

  // 获取学员课表
  const fetchStudentSchedule = async () => {
    if (!user?.id) return;
    
    try {
      setScheduleLoading(true);
      
      const { data, error } = await supabase.rpc('get_student_schedule', {
        p_student_id: null // 传null表示查看自己的课表
      });

      if (error) throw error;

      const scheduleData: StudentSchedule[] = (data || []).map((item: any) => ({
        schedule_id: item.schedule_id,
        schedule_date: item.schedule_date,
        start_time: item.start_time,
        end_time: item.end_time,
        duration_minutes: item.duration_minutes,
        period: item.period,
        subject_name: item.subject_name || '未知课程',
        lesson_title: item.lesson_title || '无主题',
        lesson_description: item.lesson_description || '',
        teacher_name: item.teacher_name || '',
        teacher_full_name: item.teacher_full_name || item.teacher_name || '未分配老师',
        venue_name: item.venue_name || '在线课程',
        venue_type: item.venue_type || 'online',
        class_name: item.class_name || '',
        plan_name: item.plan_name || '',
        participation_source: item.participation_source,
        participation_type: item.participation_type,
        status: item.status,
        notes: item.notes || ''
      }));

      setSchedules(scheduleData);
      
      // 提取所有可用的课表选项
      const planOptions = new Set<string>();
      scheduleData.forEach(schedule => {
        if (schedule.plan_name && schedule.plan_name.trim()) {
          planOptions.add(schedule.plan_name);
        } else if (schedule.class_name && schedule.class_name.trim()) {
          planOptions.add(schedule.class_name);
        }
      });
      
      const availablePlans = [
        { value: 'all', label: '全部课表' },
        ...Array.from(planOptions).map(plan => ({ value: plan, label: plan }))
      ];
      
      setAvailableSchedulePlans(availablePlans);
      
      // 计算各字段宽度
      calculateFieldWidths(scheduleData);
    } catch (error: any) {
      console.error('获取课表失败:', error);
      toast({
        variant: "destructive",
        title: "获取课表失败",
        description: error.message || "无法加载课表信息，请稍后重试"
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  // 计算各字段动态宽度
  const calculateFieldWidths = (schedules: StudentSchedule[]) => {
    if (schedules.length === 0) {
      setCourseFieldWidth(320); // 默认宽度
      setVenueFieldWidth(120);
      setPlanFieldWidth(200);
      return;
    }

    // 计算字符宽度的工具函数
    const calculateTextWidth = (text: string, hasIcon: boolean = true) => {
      const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      const englishCharCount = text.length - chineseCharCount;
      const textWidth = chineseCharCount * 14 + englishCharCount * 7;
      const iconWidth = hasIcon ? 24 : 0; // 图标宽度
      const spacing = hasIcon ? 8 : 0; // 间距
      return textWidth + iconWidth + spacing;
    };

    // 获取最长的课程名称
    const maxCourseText = schedules.reduce((max, schedule) => {
      const courseText = schedule.lesson_title && schedule.lesson_title.trim() && schedule.lesson_title !== '无主题'
        ? `${schedule.subject_name} - ${schedule.lesson_title}`
        : schedule.subject_name;
      return courseText.length > max.length ? courseText : max;
    }, '');

    // 获取最长的教室名称
    const maxVenueText = schedules.reduce((max, schedule) => {
      const venueText = schedule.venue_name || '在线课程';
      return venueText.length > max.length ? venueText : max;
    }, '');

    // 获取最长的所属课表名称
    const maxPlanText = schedules.reduce((max, schedule) => {
      const planText = schedule.plan_name || schedule.class_name || '未分配';
      return planText.length > max.length ? planText : max;
    }, '');

    // 计算课程字段宽度
    const courseWidth = calculateTextWidth(maxCourseText);
    const finalCourseWidth = Math.min(Math.max(courseWidth, 160), 600);

    // 计算教室字段宽度
    const venueWidth = calculateTextWidth(maxVenueText);
    const finalVenueWidth = Math.min(Math.max(venueWidth, 80), 300);

    // 计算所属课表字段宽度
    const planWidth = calculateTextWidth(maxPlanText);
    const finalPlanWidth = Math.min(Math.max(planWidth, 120), 400);

    setCourseFieldWidth(finalCourseWidth);
    setVenueFieldWidth(finalVenueWidth);
    setPlanFieldWidth(finalPlanWidth);
  };

  // 课表详情处理
  const handleScheduleClick = (schedule: StudentSchedule) => {
    setSelectedSchedule(schedule);
    setScheduleDetailOpen(true);
  };

  // 导出课表为Excel
  const exportScheduleToExcel = () => {
    // 检查是否有数据
    if (filteredSchedules.length === 0) {
      toast({
        variant: "destructive",
        title: "导出失败",
        description: "当前筛选条件下没有课表数据可导出",
      });
      return;
    }

    // 按日期+时间排序
    const sortedSchedules = [...filteredSchedules].sort((a, b) => {
      const dateTimeA = new Date(`${a.schedule_date}T${a.start_time}`);
      const dateTimeB = new Date(`${b.schedule_date}T${b.start_time}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });

    // 准备Excel数据
    const excelData = sortedSchedules.map(schedule => ({
      '日期': formatDateForDisplay(schedule.schedule_date, true),
      '星期': new Date(schedule.schedule_date).toLocaleDateString('zh-CN', { weekday: 'long' }),
      '时段': schedule.period,
      '时间': `${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`,
      '课程': schedule.lesson_title && schedule.lesson_title.trim() && schedule.lesson_title !== '无主题'
        ? `${schedule.subject_name} - ${schedule.lesson_title}`
        : schedule.subject_name,
      '任课老师': schedule.teacher_full_name || '未安排',
      '教室': schedule.venue_name || '在线课程',
      '所属课表': schedule.plan_name || schedule.class_name || '未分配',
      '时长(分钟)': schedule.duration_minutes
    }));

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 设置列宽
    const colWidths = [
      { wch: 12 }, // 日期
      { wch: 8 },  // 星期
      { wch: 8 },  // 时段
      { wch: 15 }, // 时间
      { wch: 30 }, // 课程
      { wch: 12 }, // 任课老师
      { wch: 15 }, // 教室
      { wch: 20 }, // 所属课表
      { wch: 10 }  // 时长
    ];
    ws['!cols'] = colWidths;

    // 添加工作表
    XLSX.utils.book_append_sheet(wb, ws, '课表');

    // 生成文件名
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const planName = selectedSchedulePlan === 'all' ? '全部课表' : selectedSchedulePlan;
    const tabName = scheduleTab === 'pending' ? '待上课程' : '全部课程';
    const fileName = `${planName}_${tabName}_${dateStr}.xlsx`;

    // 下载文件
    XLSX.writeFile(wb, fileName);

    // 显示成功提示
    toast({
      title: "导出成功",
      description: `课表已导出为 ${fileName}`,
    });
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
      handleTabChange("learning");
      return;
    }

    try {
      setEnrollingCourseId(courseId);

      const enrollmentData = {
        user_id: user.id,
        course_id: courseId,
        status: 'not_started' as const, // 改为未开始状态
        progress: 0,
        enrolled_at: toSafeISOString(new Date()),
        last_accessed_at: toSafeISOString(new Date())
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
      handleTabChange("learning");
      
    } catch (error: any) {
      console.error('添加课程到学习中失败:', error);
      
      // 检查是否是重复插入错误
      if (error.code === '23505') {
        toast({
          title: "课程已添加",
          description: "该课程已在您的学习列表中，正在跳转到学习中页面"
        });
        // 即使课程已存在，也跳转到学习中页面
        handleTabChange("learning");
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
        last_accessed_at: toSafeISOString(new Date())
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
          last_accessed_at: toSafeISOString(new Date())
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
    { id: "schedule", label: "我的课表", icon: <Calendar className="h-5 w-5" /> },
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
      return <StudentPageSkeleton />;
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
                  <CardContent className="p-0">
                    <div className="flex gap-4">
                      {/* Left: Cover Image */}
                      <div className="w-24 h-full flex-shrink-0 sm:w-28">
                        <img 
                          src={course.cover_image || `https://placehold.co/400x400/e2e8f0/e2e8f0/png?text=Cover`} 
                          alt={course.title}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      
                      {/* Right: Course Info */}
                      <div className="flex-1 py-3 pr-3 flex flex-col justify-between min-w-0">
                        <div>
                          {/* Course Title */}
                          <h3 className="font-semibold text-base leading-snug truncate mb-1.5">
                            {course.title}
                          </h3>
                          
                          {/* Course Description */}
                          <div className="text-sm text-gray-500 min-h-[20px] mb-2">
                            <p className="truncate">{course.description}</p>
                          </div>
                        </div>
                        
                        {/* Action Button */}
                        <div className="flex items-center justify-between">
                          <div className="text-xs">
                            <span className={isEnrolled ? "text-blue-600 font-medium" : "text-gray-500"}>
                              {isEnrolled ? "已加入学习" : "未加入学习"}
                          </span>
                          </div>
                          
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

    // 我的课表页面
    if (activeTab === 'schedule') {
      if (scheduleLoading) {
        return (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">正在加载课表...</p>
          </div>
        );
      }

      if (schedules.length > 0) {
        return (
          <div className="space-y-4">
            {/* 我的课表 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  我的课表
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      {availableSchedulePlans.length > 0 ? availableSchedulePlans.length - 1 : 0}
                    </div>
                    <div className="text-sm text-purple-600">总课表数</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {schedules.length}
                    </div>
                    <div className="text-sm text-blue-600">总课节数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {(() => {
                        const now = new Date();
                        const today = now.toISOString().split('T')[0];
                        const currentTime = now.toTimeString().slice(0, 5);
                        
                        return schedules.filter(schedule => {
                          const scheduleDate = schedule.schedule_date;
                          const scheduleTime = schedule.end_time.slice(0, 5);
                          
                          // 如果是今天，比较时间；如果是过去的日期，算作已上课
                          if (scheduleDate === today) {
                            return scheduleTime <= currentTime;
                          } else {
                            return scheduleDate < today;
                          }
                        }).length;
                      })()}
                    </div>
                    <div className="text-sm text-green-600">已上课节</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      {(() => {
                        const now = new Date();
                        const today = now.toISOString().split('T')[0];
                        const currentTime = now.toTimeString().slice(0, 5);
                        
                        return schedules.filter(schedule => {
                          const scheduleDate = schedule.schedule_date;
                          const scheduleTime = schedule.end_time.slice(0, 5);
                          
                          // 如果是今天，比较时间；如果是未来的日期，算作未上课
                          if (scheduleDate === today) {
                            return scheduleTime > currentTime;
                          } else {
                            return scheduleDate > today;
                          }
                        }).length;
                      })()}
                    </div>
                    <div className="text-sm text-orange-600">未上课节</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 课表列表 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <Select value={selectedSchedulePlan} onValueChange={setSelectedSchedulePlan}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="选择课表" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSchedulePlans.map((plan) => (
                            <SelectItem key={plan.value} value={plan.value}>
                              {plan.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={exportScheduleToExcel}
                        className="gap-2"
                        disabled={filteredSchedules.length === 0}
                      >
                        <Download className="h-4 w-4" />
                        导出课表
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setScheduleTab('pending')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                          scheduleTab === 'pending'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        待上课程
                      </button>
                      <button
                        onClick={() => setScheduleTab('all')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                          scheduleTab === 'all'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        全部课程
                      </button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg bg-white">
                  {(() => {
                    // 按日期分组课程的工具函数
                    const groupSchedulesByDate = (schedules: StudentSchedule[]) => {
                      const groups: { [key: string]: StudentSchedule[] } = {};
                      
                      schedules.forEach(schedule => {
                        const date = schedule.schedule_date;
                        if (!groups[date]) {
                          groups[date] = [];
                        }
                        groups[date].push(schedule);
                      });
                      
                      // 按日期排序，每个日期内按时间排序
                      return Object.keys(groups)
                        .sort()
                        .map(date => ({
                          date,
                          schedules: groups[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
                        }));
                    };

                    // 按日期+时间排序（使用已计算的过滤数据）
                    const sortedSchedules = [...filteredSchedules].sort((a, b) => {
                      const dateTimeA = new Date(`${a.schedule_date}T${a.start_time}`);
                      const dateTimeB = new Date(`${b.schedule_date}T${b.start_time}`);
                      return dateTimeA.getTime() - dateTimeB.getTime();
                    });

                    // 按日期分组
                    const dateGroups = groupSchedulesByDate(sortedSchedules);
                    
                    // 处理过滤后课程列表为空的情况
                    if (sortedSchedules.length === 0) {
                      const getEmptyStateMessage = () => {
                        if (selectedSchedulePlan !== 'all' && scheduleTab === 'pending') {
                          return {
                            title: '暂无待上课程',
                            description: `在 ${availableSchedulePlans.find(p => p.value === selectedSchedulePlan)?.label} 中没有待上课程`
                          };
                        } else if (selectedSchedulePlan !== 'all') {
                          return {
                            title: '暂无课表',
                            description: `在 ${availableSchedulePlans.find(p => p.value === selectedSchedulePlan)?.label} 中没有课程`
                          };
                        } else if (scheduleTab === 'pending') {
                          return {
                            title: '暂无待上课程',
                            description: '您的待上课程已全部完成'
                          };
                        } else {
                          return {
                            title: '暂无课表',
                            description: '您还没有安排的课程'
                          };
                        }
                      };
                      
                      const emptyState = getEmptyStateMessage();
                      
                      return (
                        <div className="text-center py-16">
                          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium">{emptyState.title}</h3>
                          <p className="text-gray-500 mt-1">{emptyState.description}</p>
                        </div>
                      );
                    }
                    
                    return dateGroups.map((dateGroup, groupIndex) => {
                      const isEvenDate = groupIndex % 2 === 0;
                      const isFirstGroup = groupIndex === 0;
                      const isLastGroup = groupIndex === dateGroups.length - 1;
                      
                      return (
                        <div key={dateGroup.date} className={`border-b border-gray-100 last:border-b-0 ${
                          isFirstGroup ? 'rounded-t-lg overflow-hidden' : ''
                        } ${
                          isLastGroup ? 'rounded-b-lg overflow-hidden' : ''
                        }`}>
                          {/* 日期分组 - 合并单元格效果 */}
                          <div className="relative">
                            {/* 左侧日期单元格 */}
                            <div className={`absolute left-0 top-0 bottom-0 w-16 sm:w-20 md:w-24 border-r border-gray-200 flex items-center justify-center ${
                              isEvenDate ? 'bg-white' : 'bg-gray-50'
                            } ${
                              isFirstGroup ? 'rounded-tl-lg' : ''
                            } ${
                              isLastGroup ? 'rounded-bl-lg' : ''
                            }`}>
                              <div className="text-center px-2">
                                <div className="text-xs sm:text-sm font-semibold text-gray-800 mb-1">
                                  {(() => {
                                    const date = new Date(dateGroup.date);
                                    const month = date.getMonth() + 1;
                                    const day = date.getDate();
                                    return `${month}/${day}`;
                                  })()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(dateGroup.date).toLocaleDateString('zh-CN', { weekday: 'short' })}
                                </div>
                              </div>
                            </div>
                            
                            {/* 右侧课程列表 */}
                            <div className="ml-16 sm:ml-20 md:ml-24">
                              {dateGroup.schedules.map((schedule, index) => {
                                const isFirstInGroup = index === 0;
                                const isLastInGroup = index === dateGroup.schedules.length - 1;
                                const isFirstOverall = isFirstGroup && isFirstInGroup;
                                const isLastOverall = isLastGroup && isLastInGroup;
                                
                                return (
                                  <div
                                    key={schedule.schedule_id}
                                    className={`border-b border-gray-100 last:border-b-0 p-3 hover:shadow-sm cursor-pointer transition-all duration-200 hover:border-primary/20 ${
                                      isEvenDate 
                                        ? 'bg-white hover:bg-gray-50/50' 
                                        : 'bg-gray-50 hover:bg-gray-100/50'
                                    } ${
                                      isFirstOverall ? 'rounded-tr-lg' : ''
                                    } ${
                                      isLastOverall ? 'rounded-br-lg' : ''
                                    }`}
                                    onClick={() => handleScheduleClick(schedule)}
                                  >
                                  <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
                                    {/* 时段 */}
                                    <div className="flex-shrink-0">
                                      <span 
                                        className={`inline-block px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 rounded-md border text-xs font-medium ${
                                          schedule.period === '上午' 
                                            ? 'text-orange-600 bg-orange-50 border-orange-200' 
                                            : schedule.period === '下午' 
                                            ? 'text-blue-600 bg-blue-50 border-blue-200' 
                                            : 'text-purple-600 bg-purple-50 border-purple-200'
                                        }`}
                                      >
                                        {schedule.period}
                                      </span>
                                    </div>

                                    {/* 具体时间 */}
                                    <div className="flex-shrink-0 w-16 sm:w-20 md:w-24">
                                      <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                                        {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                      </div>
                                    </div>

                                    {/* 课程 */}
                                    <div className="flex-shrink-0" style={{ width: `${courseFieldWidth}px` }}>
                                      <div className="flex items-center gap-1">
                                        <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                                        <span className="text-xs sm:text-sm font-medium truncate">
                                          {schedule.lesson_title && schedule.lesson_title.trim() && schedule.lesson_title !== '无主题'
                                            ? `${schedule.subject_name} - ${schedule.lesson_title}`
                                            : schedule.subject_name
                                          }
                                        </span>
                                      </div>
                                    </div>

                                    {/* 任课老师 */}
                                    <div className="flex-shrink-0 w-16 sm:w-20 md:w-24">
                                      <div className="flex items-center gap-1">
                                        <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                                        <span className="text-xs sm:text-sm text-gray-600 truncate" title={schedule.teacher_full_name}>
                                          {schedule.teacher_full_name || '未安排'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* 教室 */}
                                    <div className="flex-shrink-0" style={{ width: `${venueFieldWidth}px` }}>
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                                        <span className="text-xs sm:text-sm text-gray-600 truncate" title={schedule.venue_name}>
                                          {schedule.venue_name || '在线课程'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* 所属课表 */}
                                    <div className="flex-shrink-0" style={{ width: `${planFieldWidth}px` }}>
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                                        <span className="text-xs sm:text-sm text-gray-600 truncate" title={schedule.plan_name || schedule.class_name}>
                                          {schedule.plan_name || schedule.class_name || '未分配'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      } else {
        return (
          <div className="text-center py-16">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium">暂无课表</h3>
            <p className="text-gray-500 mt-1">您还没有安排的课程</p>
          </div>
        );
      }
    }
    
    // 升级学员页面
    if (activeTab === 'upgrade') {
      return <UpgradePage onActivationSuccess={() => handleTabChange('profile')} />;
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
                        {profile?.created_at ? formatDateForDisplay(profile.created_at) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-muted-foreground">权限过期时间</span>
                      <span className="text-sm font-medium">
                        {profile?.access_expires_at ? formatDateForDisplay(profile.access_expires_at) : '-'}
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
                        {profile?.updated_at ? formatDateForDisplay(profile.updated_at) : '-'}
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
                              {formatDateForDisplay(course.last_accessed_at)} • 
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
      {/* 课表详情对话框 */}
      <AlertDialog open={scheduleDetailOpen} onOpenChange={setScheduleDetailOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              课程详情
            </AlertDialogTitle>
          </AlertDialogHeader>
          {selectedSchedule && (
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">课程名称</span>
                    <span className="text-sm font-medium">{selectedSchedule.subject_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">本节主题</span>
                    <span className="text-sm font-medium">{selectedSchedule.lesson_title || '无主题'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">日期</span>
                    <span className="text-sm font-medium">{formatDateForDisplay(selectedSchedule.schedule_date, true)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">时间</span>
                    <span className="text-sm font-medium">
                      {selectedSchedule.start_time.slice(0, 5)} - {selectedSchedule.end_time.slice(0, 5)} 
                      <span className="text-gray-500 ml-1">({selectedSchedule.duration_minutes}分钟)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">任课老师</span>
                    <span className="text-sm font-medium">{selectedSchedule.teacher_full_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">上课地点</span>
                    <span className="text-sm font-medium">{selectedSchedule.venue_name}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setScheduleDetailOpen(false)}>
              关闭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    handleTabChange(item.id as ActiveTab);
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
                    handleTabChange('upgrade');
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