import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Play, Clock, CheckCircle, Lock } from "lucide-react";
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
}

const CourseStudyPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const systemSettings = getGlobalSettings();

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    if (courseId && user) {
      fetchCourseData();
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

  const fetchCourseData = async () => {
    if (!courseId || !user?.id) return;

    try {
      setIsLoading(true);

      // 获取课程信息
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .eq('status', 'published')
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

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

      // 获取视频播放进度
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
              video_id: progress.video_id || ''
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

      setSections(formattedSections);

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
              video_id: videoId
            }
          } : section
        )
      );

    } catch (error: any) {
      console.error('保存播放进度失败:', error);
    }
  };

  // 计算课程整体进度
  const calculateCourseProgress = async () => {
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
      const totalSections = sections.length;
      
      if (totalSections > 0) {
        // 🐛 修复：使用slice()创建副本，避免直接修改原始sections数组
        // 检查是否最后一章已完成（获取order最大的章节）
        const lastSection = [...sections].sort((a, b) => b.order - a.order)[0];
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

  // 获取章节状态（所有章节都可播放）
  const getSectionStatus = (section: CourseSection) => {
    if (section.progress?.is_completed) {
      return 'completed';
    }
    return 'available';
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'available':
        return <Play className="h-5 w-5 text-blue-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  // 获取状态徽章
  const getStatusBadge = (status: string, progress?: VideoProgress | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>;
      case 'available':
        if (progress && progress.current_position > 0) {
          return <Badge className="bg-yellow-100 text-yellow-800">进行中</Badge>;
        }
        return <Badge className="bg-blue-100 text-blue-800">可播放</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">未知</Badge>;
    }
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
  const handleVideoDialogClose = (open: boolean) => {
    if (!open) {
      // 关闭对话框前保存当前播放进度
      getCurrentVideoProgressAndSave();
      
      // 清除定期保存的定时器
      if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
        setProgressSaveInterval(null);
      }
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/student')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                返回学习中心
              </Button>
              
              <div>
                <h1 className="text-xl font-bold">{course.title}</h1>
              </div>
            </div>

            {/* 课程进度 */}
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all" 
                  style={{ width: `${enrollment.progress}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium">{enrollment.progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 章节列表 */}
        <Card>
          <CardHeader>
            <CardTitle>课程章节</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sections.map((section, index) => {
                const status = getSectionStatus(section);
                return (
                  <div
                    key={section.id}
                    className={`border rounded-lg p-4 transition-all ${
                      status === 'completed' ? 'border-green-200 bg-green-50' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0">
                          {getStatusIcon(status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium">
                            第{section.order}章 - {section.title}
                          </h3>
                          {section.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {section.description}
                            </p>
                          )}
                          {/* 播放进度信息 */}
                          {section.progress && section.progress.current_position > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              上次播放到: {formatTime(section.progress.current_position)}
                              {section.progress.duration > 0 && (
                                <span> / {formatTime(section.progress.duration)}</span>
                              )}
                              <span className="ml-2">({section.progress.progress_percentage}%)</span>
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {getStatusBadge(status, section.progress)}
                        {section.video && (
                          <Button
                            size="sm"
                            variant={status === 'completed' ? 'outline' : 'default'}
                            onClick={() => handlePlayVideo(section)}
                            disabled={playingVideoId === section.video?.id}
                            className="flex items-center gap-2"
                          >
                            <Play className="h-4 w-4" />
                            {playingVideoId === section.video?.id ? '加载中...' : 
                             section.progress?.current_position > 0 ? '继续播放' : '播放'}
                          </Button>
                        )}
                        {!section.video && (
                          <Button size="sm" variant="ghost" disabled>
                            暂无视频
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {sections.length === 0 && (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">暂无章节</h3>
                  <p className="text-muted-foreground">该课程还没有添加章节内容</p>
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