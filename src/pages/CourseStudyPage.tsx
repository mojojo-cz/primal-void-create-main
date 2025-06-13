import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Clock, CheckCircle, Lock, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import VideoPlayer from "@/components/VideoPlayer";
import { getGlobalSettings } from "@/utils/systemSettings";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { 
  CACHE_CONFIG, 
  globalVisibilityDetector, 
  PerformanceMonitor,
  debounce,
  OPTIMIZATION_CONFIG
} from '@/utils/performance';

interface CourseSection {
  id: string;
  title: string;
  description: string | null;
  order: number;
  course_id: string;
  chapter_id?: string; // 新增：关联的章节ID
  video_id: string | null;
  video?: {
    id: string;
    title: string;
    video_url: string;
    minio_object_name: string;
    play_url?: string | null;
    play_url_expires_at?: string | null;
  } | null;
  progress?: VideoProgress | null;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  status: string;
}

interface CourseEnrollment {
  id: string;
  status: 'not_started' | 'learning' | 'completed' | 'paused';
  progress: number;
  enrolled_at: string;
  last_accessed_at: string;
}

interface VideoProgress {
  id: string;
  current_position: number;
  duration: number;
  progress_percentage: number;
  is_completed: boolean;
  section_id: string;
  video_id: string;
  last_played_at?: string;
  completed_at?: string;
}

const CourseStudyPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const systemSettings = getGlobalSettings();

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [videoDialog, setVideoDialog] = useState<{ 
    open: boolean; 
    url: string; 
    title: string; 
    sectionId: string;
    videoId: string;
    startTime?: number;
  }>({ 
    open: false, 
    url: '', 
    title: '',
    sectionId: '',
    videoId: '',
    startTime: 0
  });
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [progressSaveInterval, setProgressSaveInterval] = useState<NodeJS.Timeout | null>(null);
  const [nextVideoDialog, setNextVideoDialog] = useState<{ 
    open: boolean; 
    currentSectionId: string;
    nextSection: CourseSection | null;
    countdown: number;
  }>({ 
    open: false, 
    currentSectionId: '',
    nextSection: null,
    countdown: 10
  });
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null);

  // 数据缓存和加载状态管理
  const dataCache = useRef<{
    course: Course | null;
    sections: CourseSection[] | null;
    enrollment: CourseEnrollment | null;
    lastFetch: number;
    isInitialLoad: boolean;
    backgroundRefreshing: boolean; // 新增：后台刷新状态
  }>({
    course: null,
    sections: null,
    enrollment: null,
    lastFetch: 0,
    isInitialLoad: true,
    backgroundRefreshing: false
  });

  // 使用统一的缓存配置
  const CACHE_DURATION = CACHE_CONFIG.COURSE_STUDY;

  // 检查缓存是否有效
  const isCacheValid = () => {
    const now = Date.now();
    return (now - dataCache.current.lastFetch) < CACHE_DURATION;
  };

  // 更新课程最后访问时间
  const updateLastAccessedTime = async () => {
    if (!user?.id || !courseId || !enrollment) return;

    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', enrollment.id);

      if (error) throw error;

      // 更新本地状态
      setEnrollment(prev => prev ? {
        ...prev,
        last_accessed_at: new Date().toISOString()
      } : null);

    } catch (error: any) {
      console.error('更新最后访问时间失败:', error);
    }
  };

  // 智能数据获取 - 只在必要时获取数据
  const smartFetchCourseData = async (forceRefresh = false, isBackgroundRefresh = false) => {
    if (!courseId || !user?.id) return;

    // 如果有有效缓存且不强制刷新，使用缓存数据
    if (!forceRefresh && isCacheValid() && dataCache.current.course && dataCache.current.sections && dataCache.current.enrollment) {
      setCourse(dataCache.current.course);
      setSections(dataCache.current.sections);
      setEnrollment(dataCache.current.enrollment);
      
      // 即使使用缓存数据，也要更新最后访问时间（后台进行）
      setTimeout(() => {
        updateLastAccessedTime();
      }, 100);
      
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
      // 获取课程信息
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .eq('status', 'published')
        .single();

      if (courseError) throw courseError;

      // 获取章节信息
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', courseId)
        .order('"order"', { ascending: true });

      if (chaptersError) throw chaptersError;

      // 获取考点和视频信息
      const { data: keyPointsData, error: keyPointsError } = await supabase
        .from('key_points')
        .select(`
          id,
          title,
          description,
          order,
          chapter_id,
          video_id,
          minio_videos(
            id,
            title,
            video_url,
            minio_object_name,
            play_url,
            play_url_expires_at
          )
        `)
        .order('"order"', { ascending: true });

      if (keyPointsError) throw keyPointsError;

      // 获取视频播放进度（包含最后播放时间）
      const { data: progressData, error: progressError } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (progressError) {
        console.error('获取播放进度失败:', progressError);
      }

      // 将进度数据映射到考点
      const progressMap = new Map<string, VideoProgress>();
      if (progressData) {
        progressData.forEach(progress => {
          if (progress.section_id) {
            progressMap.set(progress.section_id, {
              id: progress.id,
              current_position: progress.current_position || 0,
              duration: progress.duration || 0,
              progress_percentage: progress.progress_percentage || 0,
              is_completed: progress.is_completed || false,
              section_id: progress.section_id,
              video_id: progress.video_id || '',
              last_played_at: progress.last_played_at,
              completed_at: progress.completed_at
            });
          }
        });
      }
      
      // 创建章节映射用于查找课程ID
      const chapterMap = new Map<string, any>();
      chaptersData?.forEach(chapter => {
        chapterMap.set(chapter.id, chapter);
      });

      // 将考点数据转换为sections格式（扁平化显示）
      const formattedSections: CourseSection[] = keyPointsData?.map(keyPoint => {
        const chapter = chapterMap.get(keyPoint.chapter_id!);
        return {
          id: keyPoint.id,
          title: keyPoint.title,
          description: keyPoint.description,
          order: keyPoint.order,
          course_id: chapter?.course_id || courseId, // 从章节获取course_id
          chapter_id: keyPoint.chapter_id,
          video_id: keyPoint.video_id,
          video: keyPoint.minio_videos ? {
            id: (keyPoint.minio_videos as any).id,
            title: (keyPoint.minio_videos as any).title,
            video_url: (keyPoint.minio_videos as any).video_url,
            minio_object_name: (keyPoint.minio_videos as any).minio_object_name,
            play_url: (keyPoint.minio_videos as any).play_url,
            play_url_expires_at: (keyPoint.minio_videos as any).play_url_expires_at,
          } : null,
          progress: progressMap.get(keyPoint.id) || null
        };
      }) || [];

      // 按章节order和考点order排序
      formattedSections.sort((a, b) => {
        const chapterA = chapterMap.get(a.chapter_id!);
        const chapterB = chapterMap.get(b.chapter_id!);
        
        // 首先按章节顺序排序
        if (chapterA && chapterB && chapterA.order !== chapterB.order) {
          return chapterA.order - chapterB.order;
        }
        
        // 如果在同一章节内，按考点顺序排序
        return a.order - b.order;
      });

      // 获取学习进度
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single();

      if (enrollmentError && enrollmentError.code !== 'PGRST116') {
        throw enrollmentError;
      }

      // 更新缓存
      dataCache.current = {
        course: courseData,
        sections: formattedSections,
        enrollment: enrollmentData as CourseEnrollment,
        lastFetch: Date.now(),
        isInitialLoad: false,
        backgroundRefreshing: false
      };

      // 更新状态
      setCourse(courseData);
      setSections(formattedSections);
      setEnrollment(enrollmentData as CourseEnrollment);

      // 数据加载完成后，更新最后访问时间
      if (enrollmentData) {
        setTimeout(() => {
          updateLastAccessedTime();
        }, 100);
      }

    } catch (error: any) {
      console.error('获取课程数据失败:', error);
      dataCache.current.backgroundRefreshing = false;
      toast({
        variant: "destructive",
        title: "获取课程失败",
        description: error.message || "无法加载课程信息，请稍后重试"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 窗口焦点检测 - 使用全局优化工具
  useEffect(() => {
    if (!courseId || !user?.id) return;

    const debouncedRefresh = debounce((isVisible: boolean) => {
      if (isVisible && !isCacheValid() && !dataCache.current.backgroundRefreshing) {
        PerformanceMonitor.measure('course-background-refresh', () => {
          return smartFetchCourseData(false, true); // 后台刷新，不显示loading
        });
      }
    }, OPTIMIZATION_CONFIG.DEBOUNCE_DELAY);

    const removeListener = globalVisibilityDetector.addListener(debouncedRefresh);
    
    return removeListener;
  }, [courseId, user]);

  // 确保页面加载时滚动到顶部
  useScrollToTop([courseId, user?.id]);

  // 初始数据获取
  useEffect(() => {
    if (courseId && user) {
      smartFetchCourseData();
    }
  }, [courseId, user]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
      }
    };
  }, [progressSaveInterval]);

  // 保留原有的fetchCourseData函数供其他地方调用
  const fetchCourseData = async () => {
    await smartFetchCourseData(true); // 强制刷新
  };

  // 精准刷新视频进度（避免整个页面刷新）
  const refreshVideoProgress = async () => {
    if (!courseId || !user?.id) return;

    try {
      // 只获取视频播放进度数据
      const { data: progressData, error: progressError } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (progressError) {
        console.error('刷新播放进度失败:', progressError);
        return;
      }

      // 更新本地章节的进度信息
      if (progressData) {
        const progressMap = new Map<string, VideoProgress>();
        progressData.forEach(progress => {
          if (progress.section_id) {
            progressMap.set(progress.section_id, {
              id: progress.id,
              current_position: progress.current_position || 0,
              duration: progress.duration || 0,
              progress_percentage: progress.progress_percentage || 0,
              is_completed: progress.is_completed || false,
              section_id: progress.section_id,
              video_id: progress.video_id || '',
              last_played_at: progress.last_played_at,
              completed_at: progress.completed_at
            });
          }
        });

        // 只更新进度信息，保持其他数据不变
        setSections(prevSections => {
          const updatedSections = prevSections.map(section => ({
            ...section,
            progress: progressMap.get(section.id) || null
          }));
          
          // 在状态更新后立即计算课程进度
          setTimeout(() => {
            calculateCourseProgressWithSections(updatedSections);
          }, 0);
          
          return updatedSections;
        });
      }

    } catch (error: any) {
      console.error('刷新视频进度失败:', error);
    }
  };

  // 计算课程整体进度（使用提供的章节数据）
  const calculateCourseProgressWithSections = async (sectionsData: CourseSection[]) => {
    if (!user?.id || !courseId) return;

    try {
      // 获取所有章节的完成情况
      const { data: progressData, error } = await supabase
        .from('video_progress')
        .select('section_id, is_completed')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('is_completed', true);

      if (error) throw error;

      const completedCount = progressData?.length || 0;
      const totalSections = sectionsData.length;
      
      if (totalSections > 0) {
        // 检查是否最后一章已完成（获取order最大的章节）
        const lastSection = [...sectionsData].sort((a, b) => b.order - a.order)[0];
        const isLastSectionCompleted = progressData?.some(progress => 
          progress.section_id === lastSection?.id
        ) || false;

        let courseProgress: number;
        
        // 如果最后一章已完成，直接设置为100%
        if (isLastSectionCompleted && completedCount > 0) {
          courseProgress = 100;
        } else {
          // 否则按正常比例计算
          courseProgress = Math.round((completedCount / totalSections) * 100);
        }

        await updateCourseProgress(courseProgress);
      }

    } catch (error: any) {
      console.error('计算课程进度失败:', error);
    }
  };

  // 计算课程整体进度（原函数，使用全局sections状态）
  const calculateCourseProgress = async () => {
    await calculateCourseProgressWithSections(sections);
  };

  // 播放视频（使用智能缓存）
  const handlePlayVideo = async (section: CourseSection) => {
    if (!section.video) {
      toast({
        variant: "destructive",
        title: "播放失败",
        description: "该章节暂无视频"
      });
      return;
    }

    try {
      setPlayingVideoId(section.video.id);
      
      // 如果是第一章且状态为未开始，更新进度为1%
      if (section.order === 1 && enrollment?.status === 'not_started') {
        await updateCourseProgress(1);
      }

      let playUrl = section.video.play_url;
      
      // 检查是否有存储的播放URL且未过期
      if (section.video.play_url && section.video.play_url_expires_at) {
        const expiresAt = new Date(section.video.play_url_expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        
        // 如果URL将在10小时内过期，则重新生成（适应长视频播放）
        if (timeUntilExpiry > 10 * 60 * 60 * 1000) {
          // URL仍然有效，直接使用
          setVideoDialog({ 
            open: true, 
            url: section.video.play_url, 
            title: `${course?.title} - ${section.title}`,
            sectionId: section.id,
            videoId: section.video.id,
            startTime: section.progress?.current_position || 0
          });
          return;
        }
      }
      
      // 如果没有播放URL或将在10小时内过期，调用Edge Function生成新的播放URL
      const { data, error } = await supabase.functions.invoke('minio-presigned-upload', {
        body: { 
          action: 'generatePlayUrl',
          objectName: section.video.minio_object_name 
        }
      });
      
      if (error) throw error;

      if (data?.playUrl) {
        // 更新本地缓存URL
        setSections(prevSections => 
          prevSections.map(s => 
            s.id === section.id && s.video ? {
              ...s,
              video: {
                ...s.video,
                play_url: data.playUrl,
                play_url_expires_at: data.expiresAt
              }
            } : s
          )
        );
        
        setVideoDialog({ 
          open: true, 
          url: data.playUrl, 
          title: `${course?.title} - ${section.title}`,
          sectionId: section.id,
          videoId: section.video.id,
          startTime: section.progress?.current_position || 0
        });
      } else {
        throw new Error('未能获取视频播放URL');
      }
    } catch (error: any) {
      console.error('播放失败:', error);
      toast({
        variant: "destructive",
        title: "播放失败",
        description: error.message || "无法播放视频"
      });
    } finally {
      setPlayingVideoId(null);
    }
  };

  // 重置并播放视频（用于已完成的视频重新播放）
  const handleResetAndPlayVideo = async (section: CourseSection) => {
    if (!section.video || !user?.id || !courseId) {
      toast({
        variant: "destructive",
        title: "重新播放失败",
        description: "该章节暂无视频或用户信息缺失"
      });
      return;
    }

    try {
      setPlayingVideoId(section.video.id);

      // 首先重置该章节的播放进度
      const { error: resetError } = await supabase
        .from('video_progress')
        .upsert({
          user_id: user.id,
          course_id: courseId,
          section_id: section.id,
          video_id: section.video.id,
          current_position: 0,
          duration: section.progress?.duration || 0,
          progress_percentage: 0,
          is_completed: false,
          last_played_at: new Date().toISOString(),
          completed_at: null // 清除完成时间
        }, {
          onConflict: 'user_id,section_id'
        });

      if (resetError) {
        console.error('重置播放进度失败:', resetError);
        throw new Error('重置播放进度失败');
      }

      // 更新本地状态，重置进度
      setSections(prevSections => 
        prevSections.map(s => 
          s.id === section.id ? {
            ...s,
            progress: section.progress ? {
              ...section.progress,
              current_position: 0,
              progress_percentage: 0,
              is_completed: false,
              last_played_at: new Date().toISOString(),
              completed_at: null
            } : null
          } : s
        )
      );

      // 获取播放URL并开始播放（从头开始）
      let playUrl = section.video.play_url;
      
      // 检查是否有存储的播放URL且未过期
      if (section.video.play_url && section.video.play_url_expires_at) {
        const expiresAt = new Date(section.video.play_url_expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        
        // 如果URL将在10小时内过期，则重新生成（适应长视频播放）
        if (timeUntilExpiry > 10 * 60 * 60 * 1000) {
          // URL仍然有效，直接使用，从头开始播放
          setVideoDialog({ 
            open: true, 
            url: section.video.play_url, 
            title: `${course?.title} - ${section.title}`,
            sectionId: section.id,
            videoId: section.video.id,
            startTime: 0 // 从头开始播放
          });
          
          toast({
            title: "开始重新播放",
            description: `正在从头播放：${section.title}`,
            duration: 3000
          });
          return;
        }
      }
      
      // 如果没有播放URL或将在10小时内过期，调用Edge Function生成新的播放URL
      const { data, error } = await supabase.functions.invoke('minio-presigned-upload', {
        body: { 
          action: 'generatePlayUrl',
          objectName: section.video.minio_object_name 
        }
      });
      
      if (error) throw error;

      if (data?.playUrl) {
        // 更新本地缓存URL
        setSections(prevSections => 
          prevSections.map(s => 
            s.id === section.id && s.video ? {
              ...s,
              video: {
                ...s.video,
                play_url: data.playUrl,
                play_url_expires_at: data.expiresAt
              }
            } : s
          )
        );
        
        setVideoDialog({ 
          open: true, 
          url: data.playUrl, 
          title: `${course?.title} - ${section.title}`,
          sectionId: section.id,
          videoId: section.video.id,
          startTime: 0 // 从头开始播放
        });
        
        toast({
          title: "开始重新播放",
          description: `正在从头播放：${section.title}`,
          duration: 3000
        });
      } else {
        throw new Error('未能获取视频播放URL');
      }
    } catch (error: any) {
      console.error('重新播放失败:', error);
      toast({
        variant: "destructive",
        title: "重新播放失败",
        description: error.message || "无法重新播放视频"
      });
    } finally {
      setPlayingVideoId(null);
    }
  };

  // 更新课程整体进度
  const updateCourseProgress = async (newProgress: number) => {
    if (!enrollment || !user?.id) return;

    const newStatus = newProgress >= 100 ? 'completed' : 'learning';
    
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({
          progress: newProgress,
          status: newStatus,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', enrollment.id);

      if (error) throw error;

      // 更新本地状态
      setEnrollment(prev => prev ? {
        ...prev,
        progress: newProgress,
        status: newStatus as 'not_started' | 'learning' | 'completed' | 'paused',
        last_accessed_at: new Date().toISOString()
      } : null);

      if (newStatus === 'completed') {
        toast({
          title: "恭喜完成课程！",
          description: "您已完成所有章节的学习"
        });
      }

    } catch (error: any) {
      console.error('更新课程进度失败:', error);
    }
  };

  // 保存视频播放进度
  const saveVideoProgress = async (
    sectionId: string, 
    videoId: string, 
    currentTime: number, 
    duration: number
  ) => {
    if (!user?.id || !courseId) return;

    const progressPercentage = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
    const isCompleted = progressPercentage >= 90; // 播放90%以上算完成

    try {
      // 使用upsert操作插入或更新播放进度
      const { data, error } = await supabase
        .from('video_progress')
        .upsert({
          user_id: user.id,
          course_id: courseId,
          section_id: sectionId,
          video_id: videoId,
          current_position: Math.floor(currentTime),
          duration: Math.floor(duration),
          progress_percentage: progressPercentage,
          is_completed: isCompleted,
          last_played_at: new Date().toISOString(),
          ...(isCompleted && { completed_at: new Date().toISOString() })
        }, {
          onConflict: 'user_id,section_id'
        })
        .select()
        .single();

      if (error) throw error;

      // 更新课程的最后访问时间（学习活动）
      if (enrollment) {
        await supabase
          .from('course_enrollments')
          .update({
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', enrollment.id);

        // 更新本地状态
        setEnrollment(prev => prev ? {
          ...prev,
          last_accessed_at: new Date().toISOString()
        } : null);
      }

      // 如果章节完成，计算课程整体进度
      if (isCompleted) {
        await calculateCourseProgress();
      }

      // 更新本地章节进度
      setSections(prevSections => 
        prevSections.map(section => 
          section.id === sectionId ? {
            ...section,
            progress: {
              id: data.id,
              current_position: Math.floor(currentTime),
              duration: Math.floor(duration),
              progress_percentage: progressPercentage,
              is_completed: isCompleted,
              section_id: sectionId,
              video_id: videoId,
              last_played_at: new Date().toISOString(),
              completed_at: isCompleted ? new Date().toISOString() : section.progress?.completed_at
            }
          } : section
        )
      );

    } catch (error: any) {
      console.error('保存播放进度失败:', error);
    }
  };

  // 获取考点状态（四种状态：未学习、学习中、已完成、上次学习）
  const getSectionStatus = (section: CourseSection, allSections: CourseSection[]) => {
    // 已完成状态 - 但需要检查是否重新播放
    if (section.progress?.is_completed) {
      // 如果已完成但有更新的播放记录，说明重新播放了
      const hasRecentPlay = section.progress.last_played_at && 
        section.progress.completed_at && 
        new Date(section.progress.last_played_at) > new Date(section.progress.completed_at);
      
      if (!hasRecentPlay) {
        return 'completed';
      }
    }
    
    // 找出所有有进度且未完成的章节，或已完成但重新播放的章节
    const learningProgresses = allSections
      .filter(s => {
        if (!s.progress || !s.progress.current_position || s.progress.current_position <= 0) {
          return false;
        }
        
        // 未完成的章节
        if (!s.progress.is_completed) {
          return true;
        }
        
        // 已完成但重新播放的章节
        const hasRecentPlay = s.progress.last_played_at && 
          s.progress.completed_at && 
          new Date(s.progress.last_played_at) > new Date(s.progress.completed_at);
        
        return hasRecentPlay;
      })
      .map(s => ({
        sectionId: s.id,
        lastPlayedAt: s.progress!.last_played_at
      }))
      .filter(p => p.lastPlayedAt) // 只保留有播放时间的
      .sort((a, b) => new Date(b.lastPlayedAt!).getTime() - new Date(a.lastPlayedAt!).getTime()); // 按时间倒序排列
    
    // 如果当前章节是最后播放的且未完成（或已完成但重新播放），则为"上次学习"状态
    if (learningProgresses.length > 0 && learningProgresses[0].sectionId === section.id) {
      return 'last_learning';
    }
    
    // 如果有播放进度但不是最后播放的，则为"学习中"状态
    if (section.progress && section.progress.current_position > 0) {
      // 未完成的章节
      if (!section.progress.is_completed) {
        return 'learning';
      }
      
      // 已完成但重新播放的章节
      const hasRecentPlay = section.progress.last_played_at && 
        section.progress.completed_at && 
        new Date(section.progress.last_played_at) > new Date(section.progress.completed_at);
      
      if (hasRecentPlay) {
        return 'learning';
      }
    }
    
    // 没有播放进度，为"未学习"状态
    return 'available';
  };

  // 获取状态配置（统一状态设计）
  const getStatusConfig = (status: string) => {
    const configs = {
      completed: { 
        icon: CheckCircle, 
        color: 'text-gray-500', 
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
        cardBg: 'bg-gray-50/30',
        cardBorder: 'border-gray-200',
        titleColor: 'text-gray-500'  // 已完成考点标题颜色
      },
      last_learning: { 
        icon: PlayCircle, 
        color: 'text-blue-600', 
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        cardBg: 'bg-blue-50/30',
        cardBorder: 'border-blue-200',
        titleColor: 'text-gray-900'  // 正常黑色标题
      },
      learning: { 
        icon: PlayCircle, 
        color: 'text-orange-600', 
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        cardBg: 'bg-orange-50/30',
        cardBorder: 'border-orange-200',
        titleColor: 'text-gray-900'  // 正常黑色标题
      },
      available: { 
        icon: PlayCircle, 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        cardBg: 'bg-white',
        cardBorder: 'border-gray-200',
        titleColor: 'text-gray-900'  // 正常黑色标题
      }
    };
    return configs[status as keyof typeof configs] || configs.available;
  };

  // 获取状态图标（使用统一配置）
  const getStatusIcon = (status: string) => {
    const config = getStatusConfig(status);
    const IconComponent = config.icon;
    return <IconComponent className={`h-5 w-5 ${config.color}`} />;
  };

  // 获取状态徽章（使用统一配置）
  const getStatusBadge = (status: string, progress?: VideoProgress | null) => {
    const config = getStatusConfig(status);
    let text = '';
    
    switch (status) {
      case 'completed':
        text = '已完成';
        break;
      case 'last_learning':
        text = '上次学习';
        break;
      case 'learning':
        text = '学习中';
        break;
      case 'available':
        text = '未学习';
        break;
      default:
        text = '未知';
    }
    
    return (
      <Badge className={`${config.bgColor} ${config.textColor} border-0`}>
        {text}
      </Badge>
    );
  };

  // 获取播放按钮配置
  const getPlayButtonConfig = (section: CourseSection, status: string) => {
    const isLoading = playingVideoId === section.video?.id;
    
    if (isLoading) {
      return {
        text: '加载中...',
        variant: 'default' as const,
        disabled: true
      };
    }
    
    if (status === 'last_learning') {
      return {
        text: '继续播放',
        variant: 'default' as const,
        disabled: false
      };
    }
    
    if (status === 'learning') {
      return {
        text: '继续播放',
        variant: 'secondary' as const,
        disabled: false
      };
    }
    
    if (status === 'completed') {
      return {
        text: '重新播放',
        variant: 'outline' as const,
        disabled: false
      };
    }
    
    return {
      text: '播放',
      variant: 'default' as const,
      disabled: false
    };
  };

  // 获取当前视频的播放信息并保存进度
  const getCurrentVideoProgressAndSave = () => {
    const video = document.querySelector('video');
    if (video && videoDialog.sectionId && videoDialog.videoId && video.duration > 0) {
      saveVideoProgress(
        videoDialog.sectionId,
        videoDialog.videoId,
        video.currentTime,
        video.duration
      );
    }
  };

  // 处理视频对话框关闭
  const handleVideoDialogClose = async (open: boolean) => {
    if (!open) {
      // 清理倒计时器
      if (countdownTimer) {
        clearInterval(countdownTimer);
        setCountdownTimer(null);
      }
      
      // 关闭选择对话框
      setNextVideoDialog({ open: false, currentSectionId: '', nextSection: null, countdown: 10 });
      
      // 关闭对话框前保存当前播放进度
      getCurrentVideoProgressAndSave();
      
      // 清除定期保存的定时器
      if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
        setProgressSaveInterval(null);
      }

      // 精准刷新视频进度状态（避免整个页面刷新）
      setTimeout(() => {
        refreshVideoProgress();
      }, 500); // 稍微延迟以确保进度保存完成
    }
    
    setVideoDialog(prev => ({ ...prev, open }));
  };

  // 开始定期保存进度
  const startProgressAutoSave = () => {
    // 清除之前的定时器
    if (progressSaveInterval) {
      clearInterval(progressSaveInterval);
    }
    
    // 每5秒自动保存一次进度
    const interval = setInterval(() => {
      getCurrentVideoProgressAndSave();
    }, 5000);
    
    setProgressSaveInterval(interval);
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取下一个可播放的考点
  const getNextPlayableSection = (currentSectionId: string) => {
    const currentIndex = sections.findIndex(section => section.id === currentSectionId);
    if (currentIndex === -1 || currentIndex >= sections.length - 1) {
      return null; // 没有下一个考点
    }
    
    // 查找下一个有视频的考点
    for (let i = currentIndex + 1; i < sections.length; i++) {
      const nextSection = sections[i];
      if (nextSection.video) {
        return nextSection;
      }
    }
    
    return null; // 没有找到下一个有视频的考点
  };

  // 显示下一个视频选择对话框
  const showNextVideoChoice = async (currentSectionId: string) => {
    const nextSection = getNextPlayableSection(currentSectionId);
    
    if (nextSection) {
      // 显示选择对话框
      setNextVideoDialog({
        open: true,
        currentSectionId,
        nextSection,
        countdown: 10
      });
      
      // 启动倒计时
      let timeLeft = 10;
      const timer = setInterval(async () => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(timer);
          setCountdownTimer(null);
          // 自动播放下一个视频 - 先关闭对话框，再播放视频
          setNextVideoDialog({ open: false, currentSectionId: '', nextSection: null, countdown: 10 });
          setTimeout(async () => {
            await handlePlayVideo(nextSection);
            toast({
              title: "自动播放",
              description: `正在播放下一章节：${nextSection.title}`,
              duration: 3000
            });
          }, 100);
        } else {
          setNextVideoDialog(prev => ({ ...prev, countdown: timeLeft }));
        }
      }, 1000);
      
      setCountdownTimer(timer);
    } else {
      // 已经是最后一个章节，显示课程完成提示
      toast({
        title: "🎉 恭喜完成课程！",
        description: "您已经观看完所有视频章节",
        duration: 5000
      });
      
      // 刷新进度状态
      setTimeout(() => {
        refreshVideoProgress();
      }, 1000);
    }
  };

  // 播放下一个视频
  const playNextVideo = async () => {
    console.log('playNextVideo 被调用');
    console.log('nextVideoDialog:', nextVideoDialog);
    
    const { nextSection } = nextVideoDialog;
    console.log('nextSection:', nextSection);
    
    if (nextSection) {
      console.log('准备播放下一个视频:', nextSection.title);
      
      // 清除倒计时
      if (countdownTimer) {
        console.log('清除倒计时');
        clearInterval(countdownTimer);
        setCountdownTimer(null);
      }
      
      // 先关闭选择对话框
      console.log('关闭选择对话框');
      setNextVideoDialog({ open: false, currentSectionId: '', nextSection: null, countdown: 10 });
      
      // 稍微延迟后播放视频，确保状态更新完成
      setTimeout(async () => {
        try {
          console.log('开始调用 handlePlayVideo');
          await handlePlayVideo(nextSection);
          console.log('handlePlayVideo 调用成功');
          
          toast({
            title: "继续播放",
            description: `正在播放下一章节：${nextSection.title}`,
            duration: 3000
          });
        } catch (error) {
          console.error('播放下一个视频失败:', error);
          toast({
            title: "播放失败",
            description: "播放下一章节时出现错误，请重试",
            duration: 3000
          });
        }
      }, 100);
    } else {
      console.log('nextSection 为空，无法播放');
    }
  };

  // 退出播放，关闭视频对话框
  const exitVideoPlayback = () => {
    // 清除倒计时
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }
    
    setNextVideoDialog({ open: false, currentSectionId: '', nextSection: null, countdown: 10 });
    setVideoDialog(prev => ({ ...prev, open: false }));
  };

  // 获取"上次学习"的章节
  const getLastLearningSection = () => {
    return sections.find(section => getSectionStatus(section, sections) === 'last_learning');
  };

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (nextVideoDialog.open) {
        switch (event.key) {
          case ' ':
          case 'Enter':
            event.preventDefault();
            console.log('键盘事件触发 - 空格/回车');
            if (nextVideoDialog.nextSection) {
              console.log('键盘事件调用 playNextVideo');
              playNextVideo();
            } else {
              console.log('键盘事件 - nextSection 为空');
            }
            break;
          case 'Escape':
            event.preventDefault();
            exitVideoPlayback();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [nextVideoDialog.open, nextVideoDialog.nextSection]);

  // 清理倒计时器
  useEffect(() => {
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, [countdownTimer]);

  if (isLoading && dataCache.current.isInitialLoad) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* 头部导航骨架屏 */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-3 py-2 md:px-4 md:py-4">
            <div className="grid grid-cols-3 items-center">
              <div className="flex justify-start">
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="flex justify-center">
                <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
              </div>
              <div className="flex justify-end">
                <div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 主要内容骨架屏 */}
        <div className="max-w-6xl mx-auto px-3 py-4 md:px-4 md:py-6 space-y-6">
          {/* 快速继续学习卡片骨架屏 */}
          <div className="border border-gray-200 rounded-xl p-4 bg-white animate-pulse">
            <div className="space-y-3">
              <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          </div>

          {/* 章节列表骨架屏 */}
          <div className="border-0 shadow-sm bg-white rounded-xl">
            <div className="p-6 pb-4">
              <div className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
            </div>
            <div className="px-3 md:px-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 md:p-4 animate-pulse">
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-gray-200 rounded flex-shrink-0 mt-1"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-gray-200 rounded w-4/5"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/5"></div>
                      <div className="flex items-center justify-between">
                        <div className="h-6 bg-gray-200 rounded w-16"></div>
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!course || !enrollment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">课程不存在</h2>
          <p className="text-muted-foreground mb-4">该课程不存在或您没有访问权限</p>
          <Button onClick={() => navigate('/student')}>
            返回学习中心
          </Button>
        </div>
      </div>
    );
  }

  // 获取"上次学习"的章节
  const lastLearningSection = getLastLearningSection();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部导航 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 py-2 md:px-4 md:py-4">
          <div className="grid grid-cols-3 items-center">
            {/* 左侧返回按钮 */}
            <div className="flex justify-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/student')}
                className="flex items-center h-8 w-8 p-0 md:h-auto md:w-auto md:p-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* 中间课程标题 */}
            <div className="flex justify-center">
              <h1 className="text-base font-bold text-center truncate px-2 md:text-xl">{course.title}</h1>
            </div>

            {/* 右侧课程进度 */}
            <div className="flex justify-end">
              <span className="text-xs font-medium md:text-sm">{enrollment.progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-4 md:py-6 space-y-6">
        {/* 后台刷新指示器 */}
        {dataCache.current.backgroundRefreshing && (
          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm">
              <div className="w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              正在更新数据...
            </div>
          </div>
        )}

        {/* 快速继续学习卡片 */}
        {lastLearningSection && (
          <Card className="border border-blue-200 shadow-lg bg-gradient-to-r from-blue-50 to-blue-100/50">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* 章节标题 */}
                <h3 className="font-medium text-blue-900 text-sm leading-snug md:text-base">
                  {lastLearningSection.title}
                </h3>
                
                {/* 状态标签和进度信息同一行 */}
                <div className="flex items-center justify-between">
                  <Badge className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 border-0">
                    上次学习
                  </Badge>
                  <span className="text-xs text-blue-600 font-medium">
                    已学习 {lastLearningSection.progress?.progress_percentage || 0}%
                  </span>
                </div>
                
                {/* 继续播放按钮 */}
                {lastLearningSection.video ? (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 text-sm font-medium"
                    onClick={() => {
                      const status = getSectionStatus(lastLearningSection, sections);
                      // 如果是已完成状态，使用重置播放函数
                      if (status === 'completed') {
                        handleResetAndPlayVideo(lastLearningSection);
                      } else {
                        handlePlayVideo(lastLearningSection);
                      }
                    }}
                    disabled={playingVideoId === lastLearningSection.video?.id}
                  >
                    {playingVideoId === lastLearningSection.video?.id ? '加载中' : '继续播放'}
                  </Button>
                ) : (
                  <Button 
                    className="w-full h-10 text-sm"
                    variant="ghost" 
                    disabled
                  >
                    暂无视频
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 章节列表 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
                            <CardTitle className="text-lg">课程考点</CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="space-y-3">
              {sections.map((section, index) => {
                const status = getSectionStatus(section, sections);
                const config = getStatusConfig(status);
                
                return (
                  <div
                    key={section.id}
                    className={`
                      border rounded-xl p-3 transition-all duration-200 cursor-pointer
                      ${config.cardBg} ${config.cardBorder}
                      active:scale-[0.98] hover:shadow-md
                      md:p-4
                      ${!section.video ? 'cursor-not-allowed opacity-60' : ''}
                    `}
                    onClick={() => {
                      if (section.video) {
                        if (status === 'completed') {
                          handleResetAndPlayVideo(section);
                        } else {
                          handlePlayVideo(section);
                        }
                      }
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 pt-1">
                        {getStatusIcon(status)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className={`font-medium ${config.titleColor} text-sm leading-snug md:text-base`}>
                          {section.title}
                        </h3>
                        {section.description && (
                          <p className="text-xs text-gray-600 md:text-sm">
                            {section.description}
                          </p>
                        )}
                        
                        {/* 状态标签和进度信息同一行 */}
                        <div className="flex items-center justify-between">
                          {getStatusBadge(status, section.progress)}
                          {section.progress && section.progress.progress_percentage > 0 && (
                            <span className="text-xs text-gray-500">
                              已学习 {section.progress.progress_percentage}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {sections.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2 text-gray-900">暂无考点</h3>
                  <p className="text-gray-600">该课程还没有添加考点内容</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 视频播放对话框 */}
      <Dialog open={videoDialog.open} onOpenChange={handleVideoDialogClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 bg-black border-0 overflow-hidden [&>button:has(svg[data-lucide=x])]:hidden">
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4">
            <DialogTitle className="text-white text-lg font-medium">{videoDialog.title}</DialogTitle>
          </DialogHeader>
          
          <div className="aspect-video bg-black">
            <VideoPlayer
              src={videoDialog.url}
              title={videoDialog.title}
              autoPlay={true}
              autoFullscreen={false}
              className="w-full h-full"
              startTime={videoDialog.startTime}
              onPlay={() => {
                // 视频开始播放时启动自动保存进度
                startProgressAutoSave();
              }}
              onPause={() => {
                // 视频暂停时保存进度
                getCurrentVideoProgressAndSave();
              }}
              onEnded={() => {
                // 视频播放结束时保存进度
                const video = document.querySelector('video');
                if (video && videoDialog.sectionId && videoDialog.videoId) {
                  saveVideoProgress(
                    videoDialog.sectionId,
                    videoDialog.videoId,
                    video.duration, // 播放结束，设置为总时长
                    video.duration
                  );
                }
                
                // 清除定期保存的定时器
                if (progressSaveInterval) {
                  clearInterval(progressSaveInterval);
                  setProgressSaveInterval(null);
                }

                // 显示下一个视频选择对话框
                showNextVideoChoice(videoDialog.sectionId);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 下一个视频选择界面 - 独立的全屏覆盖层 */}
      {nextVideoDialog.open && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4"
          style={{ zIndex: 99999 }}
          onClick={(e) => {
            console.log('背景被点击');
            e.stopPropagation();
          }}
        >
          <div 
            className="bg-white rounded-lg p-3 sm:p-4 md:p-6 w-full max-w-xs sm:max-w-sm md:max-w-md text-center shadow-2xl max-h-[90vh] overflow-y-auto relative"
            style={{ zIndex: 100000 }}
            onClick={(e) => {
              console.log('对话框内部被点击');
              e.stopPropagation();
            }}
          >
            <div className="mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-green-600" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-1 sm:mb-2">视频播放完成</h3>
            </div>
            
            {nextVideoDialog.nextSection ? (
              <>
                <p className="text-gray-600 mb-1 sm:mb-2 text-xs sm:text-sm md:text-base">下一章节：</p>
                <p className="font-medium text-gray-900 mb-3 sm:mb-4 md:mb-6 text-xs sm:text-sm md:text-base leading-relaxed">{nextVideoDialog.nextSection.title}</p>
                
                <div className="bg-blue-50 rounded-lg p-2 sm:p-3 md:p-4 mb-3 sm:mb-4 md:mb-6">
                  <p className="text-xs sm:text-xs md:text-sm text-blue-700 mb-2">
                    {nextVideoDialog.countdown}秒后自动播放下一章节
                  </p>
                  <div className="w-full bg-blue-200 rounded-full h-1.5 sm:h-2">
                    <div 
                      className="bg-blue-600 h-1.5 sm:h-2 rounded-full transition-all duration-1000" 
                      style={{ width: `${((10 - nextVideoDialog.countdown) / 10) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 sm:gap-2 md:flex-row md:gap-3 md:justify-center relative">
                  <Button 
                    onClick={(e) => {
                      console.log('立即播放按钮被点击 - 原生事件');
                      e.preventDefault();
                      e.stopPropagation();
                      playNextVideo();
                    }}
                    onMouseDown={(e) => {
                      console.log('立即播放按钮 mousedown');
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      console.log('立即播放按钮 touchstart');
                      e.stopPropagation();
                    }}
                    className="w-full md:w-auto px-3 sm:px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10 relative z-10 cursor-pointer"
                    style={{ 
                      zIndex: 100001,
                      pointerEvents: 'auto',
                      touchAction: 'manipulation'
                    }}
                  >
                    立即播放
                    <span className="hidden md:inline ml-2 text-xs opacity-75">(空格)</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={(e) => {
                      console.log('退出播放按钮被点击');
                      e.preventDefault();
                      e.stopPropagation();
                      exitVideoPlayback();
                    }}
                    className="w-full md:w-auto px-3 sm:px-4 md:px-6 py-2 text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10 relative z-10 cursor-pointer"
                    style={{ 
                      zIndex: 100001,
                      pointerEvents: 'auto',
                      touchAction: 'manipulation'
                    }}
                  >
                    退出播放
                    <span className="hidden md:inline ml-2 text-xs opacity-75">(ESC)</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-4 sm:mb-6 text-xs sm:text-sm md:text-base">已完成所有视频</p>
                <Button 
                  onClick={(e) => {
                    console.log('关闭按钮被点击');
                    e.preventDefault();
                    e.stopPropagation();
                    exitVideoPlayback();
                  }}
                  className="w-full md:w-auto px-3 sm:px-4 md:px-6 py-2 text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10 relative z-10 cursor-pointer"
                  style={{ 
                    zIndex: 100001,
                    pointerEvents: 'auto',
                    touchAction: 'manipulation'
                  }}
                >
                  关闭
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseStudyPage; 