import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Play, Clock, CheckCircle, Lock, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import VideoPlayer from "@/components/VideoPlayer";
import { getGlobalSettings } from "@/utils/systemSettings";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

interface CourseSection {
  id: string;
  title: string;
  description: string | null;
  order: number;
  course_id: string;
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

  // 数据缓存和加载状态管理
  const dataCache = useRef<{
    course: Course | null;
    sections: CourseSection[] | null;
    enrollment: CourseEnrollment | null;
    lastFetch: number;
    isInitialLoad: boolean;
  }>({
    course: null,
    sections: null,
    enrollment: null,
    lastFetch: 0,
    isInitialLoad: true
  });

  // 缓存有效期 (3分钟，课程页面数据更新频率较高)
  const CACHE_DURATION = 3 * 60 * 1000;

  // 检查缓存是否有效
  const isCacheValid = () => {
    const now = Date.now();
    return (now - dataCache.current.lastFetch) < CACHE_DURATION;
  };

  // 智能数据获取 - 只在必要时获取数据
  const smartFetchCourseData = async (forceRefresh = false) => {
    if (!courseId || !user?.id) return;

    // 如果有有效缓存且不强制刷新，使用缓存数据
    if (!forceRefresh && isCacheValid() && dataCache.current.course && dataCache.current.sections && dataCache.current.enrollment) {
      setCourse(dataCache.current.course);
      setSections(dataCache.current.sections);
      setEnrollment(dataCache.current.enrollment);
      return;
    }

    // 只在初始加载时显示loading
    if (dataCache.current.isInitialLoad) {
      setIsLoading(true);
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

      // 获取课程章节和视频信息
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('course_sections')
        .select(`
          id,
          title,
          description,
          order,
          course_id,
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
        .eq('course_id', courseId)
        .order('"order"', { ascending: true });

      if (sectionsError) throw sectionsError;

      // 获取视频播放进度（包含最后播放时间）
      const { data: progressData, error: progressError } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (progressError) {
        console.error('获取播放进度失败:', progressError);
      }

      // 将进度数据映射到章节
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
      
      const formattedSections: CourseSection[] = sectionsData?.map(section => ({
        id: section.id,
        title: section.title,
        description: section.description,
        order: section.order,
        course_id: section.course_id,
        video_id: section.video_id,
        video: section.minio_videos ? {
          id: (section.minio_videos as any).id,
          title: (section.minio_videos as any).title,
          video_url: (section.minio_videos as any).video_url,
          minio_object_name: (section.minio_videos as any).minio_object_name,
          play_url: (section.minio_videos as any).play_url,
          play_url_expires_at: (section.minio_videos as any).play_url_expires_at,
        } : null,
        progress: progressMap.get(section.id) || null
      })) || [];

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
        isInitialLoad: false
      };

      // 更新状态
      setCourse(courseData);
      setSections(formattedSections);
      setEnrollment(enrollmentData as CourseEnrollment);

    } catch (error: any) {
      console.error('获取课程数据失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载课程信息"
      });
      navigate('/student');
    } finally {
      setIsLoading(false);
    }
  };

  // 窗口焦点检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      // 当页面变为可见且缓存过期时，刷新数据
      if (!document.hidden && !isCacheValid()) {
        smartFetchCourseData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [courseId, user]);

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

  // 获取章节状态（四种状态：未学习、学习中、已完成、上次学习）
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
        color: 'text-emerald-600', 
        bgColor: 'bg-emerald-100',
        textColor: 'text-emerald-800',
        cardBg: 'bg-emerald-50/30',
        cardBorder: 'border-emerald-200'
      },
      last_learning: { 
        icon: PlayCircle, 
        color: 'text-blue-600', 
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        cardBg: 'bg-blue-50/30',
        cardBorder: 'border-blue-200'
      },
      learning: { 
        icon: PlayCircle, 
        color: 'text-orange-600', 
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        cardBg: 'bg-orange-50/30',
        cardBorder: 'border-orange-200'
      },
      available: { 
        icon: Play, 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        cardBg: 'bg-white',
        cardBorder: 'border-gray-200'
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载课程中...</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部导航 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="grid grid-cols-3 items-center">
            {/* 左侧返回按钮 */}
            <div className="flex justify-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/student')}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* 中间课程标题 */}
            <div className="flex justify-center">
              <h1 className="text-xl font-bold text-center truncate px-2">{course.title}</h1>
            </div>

            {/* 右侧课程进度 */}
            <div className="flex justify-end">
              <span className="text-sm font-medium">{enrollment.progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-4 md:py-6">
        {/* 章节列表 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">课程章节</CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="space-y-3">
              {sections.map((section, index) => {
                const status = getSectionStatus(section, sections);
                const config = getStatusConfig(status);
                const buttonConfig = getPlayButtonConfig(section, status);
                
                return (
                  <div
                    key={section.id}
                    className={`
                      border rounded-xl p-4 transition-all duration-200
                      ${config.cardBg} ${config.cardBorder}
                      active:scale-[0.98] hover:shadow-sm
                      md:p-4
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getStatusIcon(status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate text-sm md:text-base">
                            {section.title}
                          </h3>
                          {section.description && (
                            <p className="text-xs text-gray-600 mt-1 truncate md:text-sm">
                              {section.description}
                            </p>
                          )}
                          {/* 简化的播放进度信息 */}
                          {section.progress && section.progress.progress_percentage > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              已学习 {section.progress.progress_percentage}%
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {getStatusBadge(status, section.progress)}
                        {section.video ? (
                          <Button
                            size="sm"
                            variant={buttonConfig.variant}
                            onClick={() => handlePlayVideo(section)}
                            disabled={buttonConfig.disabled}
                            className="min-w-[72px] h-9 text-xs md:min-w-[80px] md:text-sm"
                          >
                            {buttonConfig.text}
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            disabled
                            className="min-w-[72px] h-9 text-xs md:min-w-[80px] md:text-sm"
                          >
                            暂无视频
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {sections.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2 text-gray-900">暂无章节</h3>
                  <p className="text-gray-600">该课程还没有添加章节内容</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 视频播放对话框 */}
      <Dialog open={videoDialog.open} onOpenChange={handleVideoDialogClose}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{videoDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video">
            <VideoPlayer
              src={videoDialog.url}
              title={videoDialog.title}
              autoPlay={true}
              autoFullscreen={false}
              className="w-full h-full rounded-lg"
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
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseStudyPage; 