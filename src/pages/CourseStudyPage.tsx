import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Clock, CheckCircle, Lock, PlayCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import VideoPlayer from "@/components/VideoPlayer";
import { getGlobalSettings } from "@/utils/systemSettings";

import { useScrollToTop } from "@/hooks/useScrollToTop";
import { CourseStudySkeleton } from "@/components/ui/course-study-skeleton";
import { toSafeISOString } from '@/utils/timezone';
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
  const [chapters, setChapters] = useState<any[]>([]); // 新增：存储章节信息
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
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null);
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



  // 新增：预加载相关状态
  const [preloadingVideos, setPreloadingVideos] = useState<Set<string>>(new Set());
  const preloadCache = useRef<Map<string, { url: string; expiresAt: string }>>(new Map());

  // 数据缓存和加载状态管理
  const dataCache = useRef<{
    course: Course | null;
    sections: CourseSection[] | null;
    chapters: any[] | null; // 新增：缓存章节信息
    enrollment: CourseEnrollment | null;
    lastFetch: number;
    isInitialLoad: boolean;
    backgroundRefreshing: boolean; // 新增：后台刷新状态
  }>({
    course: null,
    sections: null,
    chapters: null, // 新增：缓存章节信息
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
          last_accessed_at: toSafeISOString(new Date())
        })
        .eq('id', enrollment.id);

      if (error) throw error;

      // 更新本地状态
      setEnrollment(prev => prev ? {
        ...prev,
        last_accessed_at: toSafeISOString(new Date())
      } : null);

    } catch (error: any) {
      console.error('更新最后访问时间失败:', error);
    }
  };

  // 新增：生成视频播放URL的通用函数
  const generateVideoPlayURL = async (video: CourseSection['video'], forceRefresh = false): Promise<{ playUrl: string; expiresAt: string } | null> => {
    if (!video) return null;

    try {
      // 检查是否有存储的播放URL且未过期（除非强制刷新）
      if (!forceRefresh && video.play_url && video.play_url_expires_at) {
        const expiresAt = new Date(video.play_url_expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        
        // 如果URL将在10小时内过期，则重新生成
        if (timeUntilExpiry > 10 * 60 * 60 * 1000) {
          console.log(`✅ 使用有效的数据库URL (剩余时间: ${Math.round(timeUntilExpiry / (60 * 60 * 1000))}小时)`);
          return {
            playUrl: video.play_url,
            expiresAt: video.play_url_expires_at
          };
        } else {
          console.log(`⚠️ 数据库URL即将过期，重新生成 (剩余时间: ${Math.round(timeUntilExpiry / (60 * 60 * 1000))}小时)`);
        }
      }
      
      // 生成新的播放URL
      console.log('🔄 正在生成新的视频播放URL...');
      const { data, error } = await supabase.functions.invoke('minio-presigned-upload', {
        body: { 
          action: 'generatePlayUrl',
          objectName: video.minio_object_name 
        }
      });
      
      if (error) throw error;

      if (data?.playUrl) {
        // 🔧 新增：自动更新数据库中的URL和过期时间
        try {
          await supabase
            .from('minio_videos')
            .update({
              play_url: data.playUrl,
              play_url_expires_at: data.expiresAt
            })
            .eq('id', video.id);
          
          console.log(`📝 自动更新数据库URL成功`);
        } catch (dbError) {
          console.error('自动更新数据库URL失败:', dbError);
          // 即使数据库更新失败，也返回有效的URL
        }

        return {
          playUrl: data.playUrl,
          expiresAt: data.expiresAt
        };
      }
      
      return null;
    } catch (error: any) {
      console.error('生成视频播放URL失败:', error);
      return null;
    }
  };

  // 新增：渐进式预加载前3个"非已完成"状态的视频URL
  const preloadInitialVideos = async (sectionsData: CourseSection[]) => {
    if (!sectionsData.length) return;

    console.log('🎬 开始渐进式预加载前3个"非已完成"状态的视频...');
    
    // 获取前3个"非已完成"状态且有视频的考点
    const videosToPreload = sectionsData
      .filter(section => {
        // 必须有视频
        if (!section.video) return false;
        
        // 必须是"非已完成"状态（没有播放进度或未完成）
        const isNotCompleted = !section.progress || !section.progress.is_completed;
        
        return isNotCompleted;
      })
      .slice(0, 3);

    if (videosToPreload.length === 0) {
      console.log('✅ 前3个"非已完成"状态的视频不存在，无需预加载');
      return;
    }

    // 设置预加载状态
    const preloadingIds = new Set(videosToPreload.map(s => s.video!.id));
    setPreloadingVideos(preloadingIds);

    try {
      // 并行预加载视频URL
      const preloadPromises = videosToPreload.map(async (section) => {
        if (!section.video) return null;

        try {
          // 🔧 检查URL有效性：确保预加载的URL至少还有10小时有效期
          let needsRegenerate = true;
          if (section.video.play_url && section.video.play_url_expires_at) {
            const expiresAt = new Date(section.video.play_url_expires_at);
            const now = new Date();
            const timeUntilExpiry = expiresAt.getTime() - now.getTime();
            
            // 如果URL还有超过10小时有效期，则无需重新生成
            if (timeUntilExpiry >= 10 * 60 * 60 * 1000) {
              console.log(`✅ URL仍有效 ${section.title} (剩余: ${Math.round(timeUntilExpiry / (60 * 60 * 1000))}小时)`);
              needsRegenerate = false;
              
              // 缓存有效的URL
              preloadCache.current.set(section.video.id, { 
                url: section.video.play_url, 
                expiresAt: section.video.play_url_expires_at 
              });
              
              return { sectionId: section.id, success: true, skipped: true };
            } else {
              console.log(`🔄 URL即将过期，需要重新生成 ${section.title} (剩余: ${Math.round(timeUntilExpiry / (60 * 60 * 1000))}小时)`);
            }
          } else {
            console.log(`🆕 首次生成URL ${section.title}`);
          }

          if (needsRegenerate) {
            const result = await generateVideoPlayURL(section.video);
            if (result) {
              // 缓存预加载结果
              preloadCache.current.set(section.video.id, { url: result.playUrl, expiresAt: result.expiresAt });
              
              // 更新本地sections状态
              setSections(prevSections => 
                prevSections.map(s => 
                  s.id === section.id && s.video ? {
                    ...s,
                    video: {
                      ...s.video,
                      play_url: result.playUrl,
                      play_url_expires_at: result.expiresAt
                    }
                  } : s
                )
              );

              console.log(`✅ 预加载完成: ${section.title}`);
              return { sectionId: section.id, success: true };
            }
          }
          
          return { sectionId: section.id, success: false };
        } catch (error) {
          console.error(`❌ 预加载失败: ${section.title}`, error);
          return { sectionId: section.id, success: false };
        }
      });

      // 等待所有预加载完成
      const results = await Promise.allSettled(preloadPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const skippedCount = results.filter(r => r.status === 'fulfilled' && r.value?.skipped).length;
      const regeneratedCount = successCount - skippedCount;
      
      console.log(`🎯 渐进式预加载完成: ${successCount}/${videosToPreload.length} 个"非已完成"状态的视频 (${regeneratedCount}个重新生成, ${skippedCount}个已有效)`);
      
      // 预加载静默完成，无需用户提示

    } catch (error) {
      console.error('渐进式预加载失败:', error);
    } finally {
      // 清除预加载状态
      setPreloadingVideos(new Set());
    }
  };

  // 智能数据获取 - 只在必要时获取数据
  const smartFetchCourseData = async (forceRefresh = false, isBackgroundRefresh = false) => {
    if (!courseId || !user?.id) return;

    // 如果有有效缓存且不强制刷新，使用缓存数据
    if (!forceRefresh && isCacheValid() && dataCache.current.course && dataCache.current.sections && dataCache.current.enrollment) {
      setCourse(dataCache.current.course);
      setSections(dataCache.current.sections);
      setChapters(dataCache.current.chapters || []);
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
      // 使用优化的数据库函数一次性获取所有数据
      const { data: studyData, error } = await supabase.rpc(
        'get_course_study_data',
        {
          p_course_id: courseId,
          p_user_id: user.id
        }
      );

      if (error) {
        console.error('获取课程学习数据失败:', error);
        throw error;
      }

      if (!studyData) {
        throw new Error('课程数据不存在');
      }

      const studyDataObj = studyData as any;
      const courseData = studyDataObj.course;
      const enrollmentData = studyDataObj.enrollment;
      const chaptersData = studyDataObj.chapters;
      const progressData = studyDataObj.progress;

      // 将进度数据转换为Map格式
      const progressMap = new Map<string, VideoProgress>();
      if (progressData && typeof progressData === 'object') {
        Object.entries(progressData).forEach(([sectionId, progress]: [string, any]) => {
          progressMap.set(sectionId, {
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
        });
      }
      
      // 创建章节映射
      const chapterMap = new Map<string, any>();
      if (chaptersData && Array.isArray(chaptersData)) {
        chaptersData.forEach(chapter => {
          chapterMap.set(chapter.id, chapter);
        });
      }

      // 将章节和考点数据转换为sections格式（扁平化显示）
      const formattedSections: CourseSection[] = [];
      
      if (chaptersData && Array.isArray(chaptersData)) {
        chaptersData.forEach(chapter => {
          if (chapter.key_points && Array.isArray(chapter.key_points)) {
            chapter.key_points.forEach((keyPoint: any) => {
              formattedSections.push({
                id: keyPoint.id,
                title: keyPoint.title,
                description: keyPoint.description,
                order: keyPoint.order,
                course_id: courseId,
                chapter_id: keyPoint.chapter_id,
                video_id: keyPoint.video_id,
                video: keyPoint.video ? {
                  id: keyPoint.video.id,
                  title: keyPoint.video.title,
                  video_url: keyPoint.video.video_url,
                  minio_object_name: keyPoint.video.minio_object_name,
                  play_url: keyPoint.video.play_url,
                  play_url_expires_at: keyPoint.video.play_url_expires_at,
                } : null,
                progress: progressMap.get(keyPoint.id) || null
              });
            });
          }
        });
      }

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

      // 更新缓存
      dataCache.current = {
        course: courseData,
        sections: formattedSections,
        chapters: chaptersData || [],
        enrollment: enrollmentData as CourseEnrollment,
        lastFetch: Date.now(),
        isInitialLoad: false,
        backgroundRefreshing: false
      };

      // 更新状态
      setCourse(courseData);
      setSections(formattedSections);
      setChapters(chaptersData || []);
      setEnrollment(enrollmentData as CourseEnrollment);

      // 数据加载完成后，更新最后访问时间
      if (enrollmentData) {
        setTimeout(() => {
          updateLastAccessedTime();
        }, 100);
      }

             // 渐进式预加载前3个视频URL
       await preloadInitialVideos(formattedSections);

       // 用户行为预测预加载（在数据加载完成后执行）
       setTimeout(() => {
         predictivePreload();
       }, 2000); // 延迟2秒，让主要功能先加载完成

       // 延迟缓存全部章节（在课程页面加载5秒后执行）
       setTimeout(() => {
         delayedPreloadAllRemaining(formattedSections);
       }, 5000); // 延迟5秒，作为后台任务执行

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
      console.log('🔄 开始刷新视频进度...');
      const startTime = performance.now();
      
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

      console.log(`📊 获取到 ${progressData?.length || 0} 条进度记录`);

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

        // 🚀 优化：只在数据真正发生变化时才更新状态
        setSections(prevSections => {
          let hasChanges = false;
          const updatedSections = prevSections.map(section => {
            const newProgress = progressMap.get(section.id) || null;
            const oldProgress = section.progress;
            
            // 检查进度是否真的发生了变化
            const progressChanged = !oldProgress && newProgress || 
                                  oldProgress && !newProgress ||
                                  oldProgress && newProgress && (
                                    oldProgress.current_position !== newProgress.current_position ||
                                    oldProgress.progress_percentage !== newProgress.progress_percentage ||
                                    oldProgress.is_completed !== newProgress.is_completed ||
                                    oldProgress.last_played_at !== newProgress.last_played_at
                                  );
            
            if (progressChanged) {
              hasChanges = true;
              console.log(`📝 更新章节进度: ${section.title}`);
            }
            
            return {
              ...section,
              progress: newProgress
            };
          });
          
          if (hasChanges) {
            console.log('✅ 检测到进度变化，更新状态');
            // 在状态更新后立即重新计算课程进度（包括学习中的进度）
            setTimeout(() => {
              calculateCourseProgressWithSections(updatedSections);
            }, 0);
            
            return updatedSections;
          } else {
            console.log('ℹ️ 无进度变化，跳过状态更新');
            return prevSections;
          }
        });
      }
      
      const endTime = performance.now();
      console.log(`⚡ 视频进度刷新完成，耗时: ${Math.round(endTime - startTime)}ms`);

    } catch (error: any) {
      console.error('刷新视频进度失败:', error);
    }
  };

  // 计算课程整体进度（使用提供的章节数据）
  const calculateCourseProgressWithSections = async (sectionsData: CourseSection[]) => {
    if (!user?.id || !courseId) return;

    try {
      // 获取所有考点的播放进度
      const { data: progressData, error } = await supabase
        .from('video_progress')
        .select('section_id, is_completed, progress_percentage')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (error) throw error;

      const totalSections = sectionsData.length;
      
      if (totalSections > 0) {
        // 创建进度映射
        const progressMap = new Map<string, { is_completed: boolean; progress_percentage: number }>();
        progressData?.forEach(progress => {
          progressMap.set(progress.section_id, {
            is_completed: progress.is_completed || false,
            progress_percentage: progress.progress_percentage || 0
          });
        });

        // 计算总进度：已完成考点算100%，学习中考点按实际进度计算
        let totalProgressPoints = 0;
        let completedSections = 0;
        
        sectionsData.forEach(section => {
          const sectionProgress = progressMap.get(section.id);
          if (sectionProgress) {
            if (sectionProgress.is_completed) {
              totalProgressPoints += 100; // 已完成考点贡献100%
              completedSections++;
            } else {
              totalProgressPoints += sectionProgress.progress_percentage; // 学习中考点按实际进度
            }
          }
          // 未开始学习的考点贡献0%
        });

        let courseProgress: number;
        
        // 🔧 修复：只有当所有考点都完成时，才设置为100%
        if (completedSections === totalSections && totalSections > 0) {
          courseProgress = 100;
        } else {
          // 否则按加权平均计算（每个考点的进度贡献相等）
          courseProgress = Math.round(totalProgressPoints / totalSections);
        }

        console.log(`📊 课程进度计算: 已完成 ${completedSections}/${totalSections} 个考点，总进度: ${courseProgress}%`);
        
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

  // 处理播放视频（稳定引用）
  const handlePlayVideo = useCallback(async (section: CourseSection) => {
    if (!section.video) {
      toast({
        variant: "destructive",
        title: "播放失败",
        description: "该章节暂无视频"
      });
      return;
    }

    // 防止重复点击
    if (loadingVideoId === section.video.id) {
      return;
    }

    try {
      setLoadingVideoId(section.video.id);
      setPlayingVideoId(section.video.id);
      
      // 立即打开播放器，显示加载状态
      setVideoDialog({ 
        open: true, 
        url: '', // 先设置为空，加载完成后更新
        title: section.title,
        sectionId: section.id,
        videoId: section.video.id,
        startTime: section.progress?.current_position || 0
      });
      
      // 如果是第一章且状态为未开始，更新进度为1%
      if (section.order === 1 && enrollment?.status === 'not_started') {
        await updateCourseProgress(1);
      }

      let playUrl = section.video.play_url;
      
      // 🚀 优先检查预加载缓存（修复版）
      const cachedVideo = preloadCache.current.get(section.video.id);
      if (cachedVideo && cachedVideo.url !== 'triggered') {
        console.log(`⚡ 发现预加载缓存: ${section.title}`);
        
        // 🔧 修复：检查预加载URL是否过期
        try {
          const cachedExpiresAt = new Date(cachedVideo.expiresAt);
          const now = new Date();
          const timeUntilExpiry = cachedExpiresAt.getTime() - now.getTime();
          
          // 如果预加载URL仍然有效（还有至少6小时）
          if (timeUntilExpiry > 6 * 60 * 60 * 1000) {
            console.log(`✅ 使用有效的预加载URL: ${section.title}`);
            setVideoDialog(prev => ({ 
              ...prev,
              url: cachedVideo.url
            }));
            return;
          } else {
            console.log(`⚠️ 预加载URL已过期，清除缓存: ${section.title}`);
            // 清除过期的预加载缓存
            preloadCache.current.delete(section.video.id);
          }
        } catch (error) {
          console.error('预加载URL过期检查失败:', error);
          // 如果时间解析失败，清除可能损坏的缓存
          preloadCache.current.delete(section.video.id);
        }
      }
      
      // 检查是否有存储的播放URL且未过期
      if (section.video.play_url && section.video.play_url_expires_at) {
        const expiresAt = new Date(section.video.play_url_expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        
        // 如果URL将在10小时内过期，则重新生成（适应长视频播放）
        if (timeUntilExpiry > 10 * 60 * 60 * 1000) {
          // URL仍然有效，直接使用 - 更快加载
          setVideoDialog(prev => ({ 
            ...prev,
            url: section.video.play_url!
          }));
          
          console.log(`🎯 使用缓存URL: ${section.title}`);
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
        // 🔧 修复：先更新数据库中的播放URL
        if (data.expiresAt && section.video) {
          try {
            await supabase
              .from('minio_videos')
              .update({
                play_url: data.playUrl,
                play_url_expires_at: data.expiresAt
              })
              .eq('id', section.video.id);
            
            console.log(`📝 数据库URL已更新: ${section.title}`);
          } catch (dbError) {
            console.error('数据库URL更新失败:', dbError);
            // 即使数据库更新失败，也继续使用新URL播放
          }
        }
        
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
        
        // 更新播放器URL
        setVideoDialog(prev => ({ 
          ...prev,
          url: data.playUrl
        }));

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
      setLoadingVideoId(null);
    }
  }, [
    loadingVideoId, 
    enrollment?.status, 
    preloadCache, 
    setVideoDialog, 
    setLoadingVideoId, 
    setPlayingVideoId, 
    setSections, 
    toast
  ]);

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

    // 防止重复点击
    if (loadingVideoId === section.video.id) {
      return;
    }



    try {
      setLoadingVideoId(section.video.id);
      setPlayingVideoId(section.video.id);
      
      // 立即打开播放器，显示加载状态
      setVideoDialog({ 
        open: true, 
        url: '', // 先设置为空，加载完成后更新
        title: section.title,
        sectionId: section.id,
        videoId: section.video.id,
        startTime: 0 // 从头开始播放
      });

      // 🔧 新设计：立即重置进度状态（包括数据库）
      if (section.progress) {
        await supabase
          .from('video_progress')
          .upsert({
            user_id: user.id,
            course_id: courseId,
            section_id: section.id,
            video_id: section.video.id,
            current_position: 0,
            duration: section.progress.duration,
            progress_percentage: 0,
            is_completed: false,
            last_played_at: toSafeISOString(new Date()),
            completed_at: null
          }, {
            onConflict: 'user_id,section_id'
          });
      }

      // 更新本地状态
      setSections(prevSections => 
        prevSections.map(s => 
          s.id === section.id ? {
            ...s,
            progress: section.progress ? {
              ...section.progress,
              current_position: 0,
              progress_percentage: 0,
              is_completed: false,
              last_played_at: toSafeISOString(new Date()),
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
          setVideoDialog(prev => ({ 
            ...prev,
            url: section.video.play_url!
          }));
          
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
        // 🔧 修复：先更新数据库中的播放URL
        if (data.expiresAt && section.video) {
          try {
            await supabase
              .from('minio_videos')
              .update({
                play_url: data.playUrl,
                play_url_expires_at: data.expiresAt
              })
              .eq('id', section.video.id);
            
            console.log(`📝 数据库URL已更新: ${section.title}`);
          } catch (dbError) {
            console.error('数据库URL更新失败:', dbError);
            // 即使数据库更新失败，也继续使用新URL播放
          }
        }
        
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
        
        // 更新播放器URL
        setVideoDialog(prev => ({ 
          ...prev,
          url: data.playUrl
        }));
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
      setLoadingVideoId(null);
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
          last_accessed_at: toSafeISOString(new Date())
        })
        .eq('id', enrollment.id);

      if (error) throw error;

      // 更新本地状态
      setEnrollment(prev => prev ? {
        ...prev,
        progress: newProgress,
        status: newStatus as 'not_started' | 'learning' | 'completed' | 'paused',
        last_accessed_at: toSafeISOString(new Date())
      } : null);



    } catch (error: any) {
      console.error('更新课程进度失败:', error);
    }
  };

  // 新增：自适应预加载下一个视频
  const preloadNextVideo = async (currentSectionId: string) => {
    const nextSection = getNextPlayableSection(currentSectionId);
    
    if (!nextSection?.video) {
      console.log('没有下一个视频需要预加载');
      return;
    }

    // 检查是否正在预加载
    if (preloadingVideos.has(nextSection.video.id)) {
      console.log(`下一个视频正在预加载中: ${nextSection.title}`);
      return;
    }

    // 🔧 检查URL有效性：确保预加载的URL至少还有10小时有效期
    if (nextSection.video.play_url && nextSection.video.play_url_expires_at) {
      const expiresAt = new Date(nextSection.video.play_url_expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // 如果URL还有超过10小时有效期，则无需重新生成
      if (timeUntilExpiry >= 10 * 60 * 60 * 1000) {
        console.log(`✅ 下一个视频URL仍有效: ${nextSection.title} (剩余: ${Math.round(timeUntilExpiry / (60 * 60 * 1000))}小时)`);
        
        // 缓存有效的URL
        preloadCache.current.set(nextSection.video.id, { 
          url: nextSection.video.play_url, 
          expiresAt: nextSection.video.play_url_expires_at 
        });
        return;
      } else {
        console.log(`🔄 下一个视频URL即将过期，需要重新生成: ${nextSection.title} (剩余: ${Math.round(timeUntilExpiry / (60 * 60 * 1000))}小时)`);
      }
    } else {
      console.log(`🆕 下一个视频首次生成URL: ${nextSection.title}`);
    }

    // 检查缓存
    if (preloadCache.current.has(nextSection.video.id)) {
      console.log(`下一个视频已在缓存中: ${nextSection.title}`);
      return;
    }

    console.log(`🎯 开始自适应预加载下一个视频: ${nextSection.title}`);

    // 设置预加载状态
    setPreloadingVideos(prev => new Set([...prev, nextSection.video!.id]));

    try {
      const result = await generateVideoPlayURL(nextSection.video);
      
      if (result) {
        // 缓存预加载结果
        preloadCache.current.set(nextSection.video.id, { url: result.playUrl, expiresAt: result.expiresAt });
        
        // 更新本地sections状态
        setSections(prevSections => 
          prevSections.map(s => 
            s.id === nextSection.id && s.video ? {
              ...s,
              video: {
                ...s.video,
                play_url: result.playUrl,
                play_url_expires_at: result.expiresAt
              }
            } : s
          )
        );

        console.log(`✅ 下一个视频预加载完成: ${nextSection.title}`);
      }
    } catch (error) {
      console.error(`❌ 预加载下一个视频失败: ${nextSection.title}`, error);
    } finally {
      // 清除预加载状态
      setPreloadingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(nextSection.video!.id);
        return newSet;
      });
    }
  };

  // 新增：标记视频为完成状态的专用函数
  const markVideoAsCompleted = async (
    sectionId: string, 
    videoId: string, 
    duration: number
  ) => {
    if (!user?.id || !courseId) return;

    try {
      // 强制标记为完成状态
      const { data, error } = await supabase
        .from('video_progress')
        .upsert({
          user_id: user.id,
          course_id: courseId,
          section_id: sectionId,
          video_id: videoId,
          current_position: Math.floor(duration),
          duration: Math.floor(duration),
          progress_percentage: 100,
          is_completed: true, // 强制设置为完成
          last_played_at: new Date().toISOString(),
          completed_at: new Date().toISOString() // 设置完成时间
        }, {
          onConflict: 'user_id,section_id'
        })
        .select()
        .single();

      if (error) throw error;

      // 更新课程的最后访问时间
      if (enrollment) {
        await supabase
          .from('course_enrollments')
          .update({
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', enrollment.id);

        setEnrollment(prev => prev ? {
          ...prev,
          last_accessed_at: new Date().toISOString()
        } : null);
      }

      // 重新计算课程整体进度
      await calculateCourseProgress();

      // 更新本地状态
      setSections(prevSections => 
        prevSections.map(section => 
          section.id === sectionId ? {
            ...section,
            progress: {
              id: data.id,
              current_position: Math.floor(duration),
              duration: Math.floor(duration),
              progress_percentage: 100,
              is_completed: true,
              section_id: sectionId,
              video_id: videoId,
              last_played_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            }
          } : section
        )
      );

      console.log(`✅ 视频已标记为完成: ${sectionId}`);

    } catch (error: any) {
      console.error('标记视频完成失败:', error);
    }
  };

  // 修改视频进度保存函数，添加自适应预加载触发
  const saveVideoProgress = async (
    sectionId: string, 
    videoId: string, 
    currentTime: number, 
    duration: number,
    forceComplete = false // 新增参数：强制标记为完成
  ) => {
    if (!user?.id || !courseId) return;

    const progressPercentage = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
    // 只有播放到99%以上才算完成（防止四舍五入误差），或者由forceComplete参数强制完成
    const isCompleted = forceComplete || progressPercentage >= 99;

    // 🚀 优化：立即更新本地状态，提供即时UI反馈
    const currentTimestamp = new Date().toISOString();
    setSections(prevSections => 
      prevSections.map(section => 
        section.id === sectionId ? {
          ...section,
          progress: section.progress ? {
            ...section.progress,
            current_position: Math.floor(currentTime),
            duration: Math.floor(duration),
            progress_percentage: progressPercentage,
            is_completed: isCompleted,
            last_played_at: currentTimestamp,
            ...(isCompleted && { completed_at: currentTimestamp })
          } : {
            id: 'temp-' + Date.now(), // 临时ID
            current_position: Math.floor(currentTime),
            duration: Math.floor(duration),
            progress_percentage: progressPercentage,
            is_completed: isCompleted,
            section_id: sectionId,
            video_id: videoId,
            last_played_at: currentTimestamp,
            ...(isCompleted && { completed_at: currentTimestamp })
          }
        } : section
      )
    );

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
          last_played_at: currentTimestamp,
          ...(isCompleted && { completed_at: currentTimestamp })
        }, {
          onConflict: 'user_id,section_id'
        })
        .select()
        .single();

      if (error) throw error;

      // 🚀 优化：数据库操作成功后，用真实的ID更新本地状态
      setSections(prevSections => 
        prevSections.map(section => 
          section.id === sectionId ? {
            ...section,
            progress: {
              id: data.id, // 使用真实的数据库ID
              current_position: Math.floor(currentTime),
              duration: Math.floor(duration),
              progress_percentage: progressPercentage,
              is_completed: isCompleted,
              section_id: sectionId,
              video_id: videoId,
              last_played_at: currentTimestamp,
              completed_at: isCompleted ? currentTimestamp : section.progress?.completed_at
            }
          } : section
        )
      );

      // 更新课程的最后访问时间（学习活动）
      if (enrollment) {
        await supabase
          .from('course_enrollments')
          .update({
            last_accessed_at: currentTimestamp
          })
          .eq('id', enrollment.id);

        // 更新本地状态
        setEnrollment(prev => prev ? {
          ...prev,
          last_accessed_at: currentTimestamp
        } : null);
      }

      // 每次保存进度都重新计算课程整体进度（包括学习中的进度）
      await calculateCourseProgress();

      // 🎯 自适应预加载：当播放进度达到70%时，预加载下一个视频
      if (progressPercentage >= 70) {
        // 使用防抖，避免重复触发
        const preloadKey = `preload_${sectionId}`;
        if (!preloadCache.current.has(preloadKey)) {
          preloadCache.current.set(preloadKey, { url: 'triggered', expiresAt: Date.now().toString() });
          setTimeout(() => {
            preloadNextVideo(sectionId);
          }, 1000); // 延迟1秒执行，避免频繁调用
        }
      }

    } catch (error: any) {
      console.error('保存播放进度失败:', error);
      // 🚀 优化：如果数据库操作失败，恢复到之前的状态或保持乐观更新
      // 这里我们选择保持乐观更新，因为大多数情况下操作会成功
    }
  };

  // 获取考点状态和标签（三种状态：未开始、学习中、已完成 + 上次学习标签）
  const getSectionStatus = (section: CourseSection, allSections: CourseSection[]) => {
    // 基础状态判断
    let status = 'available'; // 默认：未开始
    
    if (section.progress) {
      if (section.progress.is_completed) {
        status = 'completed'; // 已完成
      } else {
        status = 'learning'; // 学习中
      }
    }
    
    return status;
  };

  // 新增：判断是否为"上次学习"
  const isLastLearning = (section: CourseSection, allSections: CourseSection[]) => {
    // 找出所有有播放记录的章节
    const allPlayedSections = allSections
      .filter(s => s.progress && s.progress.last_played_at)
      .map(s => ({
        sectionId: s.id,
        lastPlayedAt: s.progress!.last_played_at
      }))
      .sort((a, b) => new Date(b.lastPlayedAt!).getTime() - new Date(a.lastPlayedAt!).getTime());
    
    // 如果当前章节是最后播放的，则为"上次学习"
    return allPlayedSections.length > 0 && allPlayedSections[0].sectionId === section.id;
  };

  // 获取状态配置（三种状态 + 上次学习标签）
  const getStatusConfig = (status: string, isLastLearning: boolean = false) => {
    const configs = {
      completed: { 
        icon: CheckCircle, 
        color: isLastLearning ? 'text-blue-600' : 'text-gray-500', 
        bgColor: isLastLearning ? 'bg-blue-100' : 'bg-gray-100',
        textColor: isLastLearning ? 'text-blue-800' : 'text-gray-600',
        cardBg: isLastLearning ? 'bg-blue-50/30' : 'bg-gray-50/30',
        cardBorder: isLastLearning ? 'border-blue-200' : 'border-gray-200',
        titleColor: isLastLearning ? 'text-gray-900' : 'text-gray-500'
      },
      learning: { 
        icon: PlayCircle, 
        color: isLastLearning ? 'text-blue-600' : 'text-orange-600', 
        bgColor: isLastLearning ? 'bg-blue-100' : 'bg-orange-100',
        textColor: isLastLearning ? 'text-blue-800' : 'text-orange-800',
        cardBg: isLastLearning ? 'bg-blue-50/30' : 'bg-orange-50/30',
        cardBorder: isLastLearning ? 'border-blue-200' : 'border-orange-200',
        titleColor: 'text-gray-900'
      },
      available: { 
        icon: PlayCircle, 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        cardBg: 'bg-white',
        cardBorder: 'border-gray-200',
        titleColor: 'text-gray-900'
      }
    };
    return configs[status as keyof typeof configs] || configs.available;
  };

  // 获取状态图标（使用统一配置）
  const getStatusIcon = (status: string, section?: CourseSection, allSections?: CourseSection[]) => {
    // 如果正在加载，显示加载图标
    if (section?.video && loadingVideoId === section.video.id) {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    
    const isLast = section && allSections ? isLastLearning(section, allSections) : false;
    const config = getStatusConfig(status, isLast);
    const IconComponent = config.icon;
    return <IconComponent className={`h-5 w-5 ${config.color}`} />;
  };

  // 获取状态徽章（状态 + 标签）
  const getStatusBadge = (status: string, section: CourseSection, allSections: CourseSection[]) => {
    const isLast = isLastLearning(section, allSections);
    const config = getStatusConfig(status, isLast);
    
    let text = '';
    switch (status) {
      case 'completed':
        text = isLast ? '已完成 · 上次学习' : '已完成';
        break;
      case 'learning':
        text = isLast ? '学习中 · 上次学习' : '学习中';
        break;
      case 'available':
        text = '未开始';
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
  const getPlayButtonConfig = (section: CourseSection, status: string, allSections: CourseSection[]) => {
    const isLoading = playingVideoId === section.video?.id;
    const isLast = isLastLearning(section, allSections);
    
    if (isLoading) {
      return {
        text: '加载中...',
        variant: 'default' as const,
        disabled: true
      };
    }
    
    if (status === 'learning') {
      return {
        text: '继续播放',
        variant: isLast ? 'default' : 'secondary',
        disabled: false
      };
    }
    
    if (status === 'completed') {
      return {
        text: '重新播放',
        variant: isLast ? 'default' : 'outline',
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
      
      // 🚀 优化1：立即同步保存播放进度
      const currentProgress = getCurrentVideoProgressAndSave();
      
      // 清除定期保存的定时器
      if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
        setProgressSaveInterval(null);
      }

      // 🚀 优化2：立即更新本地状态，无需等待数据库
      if (videoDialog.sectionId && videoDialog.videoId) {
        const video = document.querySelector('video');
        if (video && video.duration > 0) {
          const progressPercentage = Math.round((video.currentTime / video.duration) * 100);
          const isCompleted = progressPercentage >= 99;
          
          // 立即更新本地状态
          setSections(prevSections => 
            prevSections.map(section => 
              section.id === videoDialog.sectionId ? {
                ...section,
                progress: section.progress ? {
                  ...section.progress,
                  current_position: Math.floor(video.currentTime),
                  progress_percentage: progressPercentage,
                  is_completed: isCompleted,
                  last_played_at: new Date().toISOString(),
                  ...(isCompleted && { completed_at: new Date().toISOString() })
                } : {
                  id: '', // 临时ID，数据库保存后会更新
                  current_position: Math.floor(video.currentTime),
                  duration: Math.floor(video.duration),
                  progress_percentage: progressPercentage,
                  is_completed: isCompleted,
                  section_id: videoDialog.sectionId,
                  video_id: videoDialog.videoId,
                  last_played_at: new Date().toISOString(),
                  ...(isCompleted && { completed_at: new Date().toISOString() })
                }
              } : section
            )
          );
        }
      }

      // 🚀 优化3：大幅减少延迟时间，从500ms降低到100ms
      setTimeout(() => {
        refreshVideoProgress();
      }, 100); // 仅100ms延迟确保数据库写入完成
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

  // 检查课程是否真正完成
  const isCourseCompleted = () => {
    // 🔍 详细调试：打印所有章节信息
    console.group('🔍 检查课程完成状态 - 详细信息');
    console.log(`所有章节数量: ${sections.length}`);
    
    sections.forEach((section, index) => {
      console.log(`章节${index + 1}: ${section.title}`);
      console.log(`  - 有视频: ${!!section.video}`);
      console.log(`  - 视频ID: ${section.video?.id || 'N/A'}`);
      console.log(`  - 有进度记录: ${!!section.progress}`);
      console.log(`  - 是否已完成: ${section.progress?.is_completed || false}`);
    });
    
    // 获取所有有视频的章节
    const sectionsWithVideo = sections.filter(section => section.video);
    console.log(`过滤后有视频的章节数: ${sectionsWithVideo.length}`);
    
    if (sectionsWithVideo.length === 0) {
      console.log('没有找到有视频的章节，返回 false');
      console.groupEnd();
      return false;
    }
    
    // 检查是否所有有视频的章节都已完成
    const allCompleted = sectionsWithVideo.every(section => section.progress?.is_completed);
    console.log(`所有有视频章节都已完成: ${allCompleted}`);
    console.groupEnd();
    
    return allCompleted;
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
            // 🔧 修复：如果下一个视频是已完成状态，使用重播逻辑
            if (nextSection.progress?.is_completed) {
              console.log('倒计时自动播放：下一个视频已完成，使用重播逻辑');
              await handleResetAndPlayVideo(nextSection);
              toast({
                title: "自动重播",
                description: `正在从头播放：${nextSection.title}`,
                duration: 3000
              });
            } else {
              console.log('倒计时自动播放：下一个视频未完成，使用普通播放逻辑');
              await handlePlayVideo(nextSection);
              toast({
                title: "自动播放",
                description: `正在播放下一章节：${nextSection.title}`,
                duration: 3000
              });
            }
          }, 100);
        } else {
          setNextVideoDialog(prev => ({ ...prev, countdown: timeLeft }));
        }
      }, 1000);
      
      setCountdownTimer(timer);
    } else {
      // 🔧 修复：只有真正完成所有视频才显示完成提示
      if (isCourseCompleted()) {
        toast({
          title: "🎉 恭喜完成课程！",
          description: "您已经观看完所有视频章节",
          duration: 5000
        });
      }
      // 如果还有未完成的视频，不显示任何提示
      
      // 刷新进度状态
      setTimeout(() => {
        refreshVideoProgress();
      }, 1000);
    }
  };



  // 🔧 新增：专门处理立即播放的函数
  const handleImmediatePlay = useCallback(async () => {
    const { nextSection } = nextVideoDialog;
    if (!nextSection) {
      console.error('立即播放：nextSection为空');
      return;
    }

    console.log('立即播放：开始处理', nextSection.title);
    
    try {
      // 1. 清除倒计时
      if (countdownTimer) {
        console.log('立即播放：清除倒计时');
        clearInterval(countdownTimer);
        setCountdownTimer(null);
      }
      
      // 2. 关闭倒计时对话框
      console.log('立即播放：关闭倒计时对话框');
      setNextVideoDialog({ open: false, currentSectionId: '', nextSection: null, countdown: 10 });
      
      // 3. 等待一个微任务确保状态更新完成
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // 4. 🔧 修复：如果下一个视频是已完成状态，使用重播逻辑
      console.log('立即播放：检查下一个视频状态', { 
        isCompleted: nextSection.progress?.is_completed,
        title: nextSection.title 
      });
      
      if (nextSection.progress?.is_completed) {
        console.log('立即播放：下一个视频已完成，使用重播逻辑');
        await handleResetAndPlayVideo(nextSection);
        toast({
          title: "重新播放",
          description: `正在从头播放：${nextSection.title}`,
          duration: 3000
        });
      } else {
        console.log('立即播放：下一个视频未完成，使用普通播放逻辑');
        await handlePlayVideo(nextSection);
        toast({
          title: "立即播放",
          description: `正在播放下一章节：${nextSection.title}`,
          duration: 3000
        });
      }
      
      console.log('立即播放：播放逻辑执行成功');
      
    } catch (error) {
      console.error('立即播放：播放失败', error);
      toast({
        variant: "destructive",
        title: "立即播放失败",
        description: `无法播放下一章节：${nextSection.title}`,
        duration: 3000
      });
    }
  }, [nextVideoDialog, countdownTimer, handlePlayVideo, handleResetAndPlayVideo, toast]);

  // 退出播放，关闭视频对话框
  const exitVideoPlayback = useCallback(() => {
    // 清除倒计时
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }
    
    setNextVideoDialog({ open: false, currentSectionId: '', nextSection: null, countdown: 10 });
    setVideoDialog(prev => ({ ...prev, open: false }));
  }, [countdownTimer, setCountdownTimer, setNextVideoDialog, setVideoDialog]); // 🔧 修复：添加所有必要的依赖

  // 获取"上次学习"的章节
  const getLastLearningSection = () => {
    return sections.find(section => isLastLearning(section, sections));
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
              console.log('键盘事件：使用专门的立即播放函数');
              // 🔧 修复：使用专门的立即播放函数
              handleImmediatePlay();
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
  }, [nextVideoDialog, handleImmediatePlay, exitVideoPlayback]); // 🔧 修复：更新依赖数组

  // 清理倒计时器
  useEffect(() => {
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, [countdownTimer]);

  // 按章节分组sections
  const groupSectionsByChapter = () => {
    const grouped: { chapter: any, sections: CourseSection[] }[] = [];
    const chapterMap = new Map<string, any>();
    
    // 创建章节映射
    chapters.forEach(chapter => {
      chapterMap.set(chapter.id, chapter);
    });
    
    // 获取所有相关的章节ID（按章节order排序）
    const relevantChapters = chapters
      .filter(chapter => sections.some(s => s.chapter_id === chapter.id))
      .sort((a, b) => a.order - b.order);
    
    // 按排序后的章节分组
    relevantChapters.forEach(chapter => {
      const chapterSections = sections.filter(s => s.chapter_id === chapter.id);
      
      if (chapterSections.length > 0) {
        grouped.push({
          chapter,
          sections: chapterSections.sort((a, b) => a.order - b.order) // 确保考点也按order排序
        });
      }
    });
    
    return grouped;
  };

  // 新增：用户行为预测预加载
  const predictivePreload = async () => {
    console.log('🧠 开始用户行为预测预加载...');

    try {
      // 1. 查找"上次学习"的章节（优先级最高）
      const lastLearningSection = getLastLearningSection();
      if (lastLearningSection?.video && !lastLearningSection.video.play_url) {
        console.log(`🎯 预测用户会继续学习: ${lastLearningSection.title}`);
        await predictivePreloadSingleVideo(lastLearningSection, '继续学习');
      }

      // 2. 查找第一个未完成的章节（适合新用户）
      const firstIncompleteSection = sections.find(section => 
        section.video && 
        (!section.progress || !section.progress.is_completed) &&
        !section.video.play_url
      );
      
      if (firstIncompleteSection && firstIncompleteSection.id !== lastLearningSection?.id) {
        console.log(`📚 预测新用户从第一章节开始: ${firstIncompleteSection.title}`);
        await predictivePreloadSingleVideo(firstIncompleteSection, '新课程开始');
      }

      // 3. 基于学习模式预测（连续学习模式）
      const completedSections = sections.filter(s => s.progress?.is_completed);
      if (completedSections.length > 0) {
        // 找到最后完成的章节，预加载其下一个章节
        const lastCompletedSection = completedSections
          .sort((a, b) => new Date(b.progress!.completed_at!).getTime() - new Date(a.progress!.completed_at!).getTime())[0];
        
        const nextAfterCompleted = getNextPlayableSection(lastCompletedSection.id);
        if (nextAfterCompleted?.video && !nextAfterCompleted.video.play_url) {
          console.log(`⏭️ 预测连续学习下一章节: ${nextAfterCompleted.title}`);
          await predictivePreloadSingleVideo(nextAfterCompleted, '连续学习');
        }
      }

    } catch (error) {
      console.error('用户行为预测预加载失败:', error);
    }
  };

  // 预测性预加载单个视频的辅助函数
  const predictivePreloadSingleVideo = async (section: CourseSection, reason: string) => {
    if (!section.video || preloadingVideos.has(section.video.id)) {
      return;
    }

    // 🔧 检查URL有效性：确保预加载的URL至少还有10小时有效期
    if (section.video.play_url && section.video.play_url_expires_at) {
      const expiresAt = new Date(section.video.play_url_expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // 如果URL还有超过10小时有效期，则无需重新生成
      if (timeUntilExpiry >= 10 * 60 * 60 * 1000) {
        console.log(`✅ 预测性预加载URL仍有效 (${reason}): ${section.title} (剩余: ${Math.round(timeUntilExpiry / (60 * 60 * 1000))}小时)`);
        
        // 缓存有效的URL
        preloadCache.current.set(section.video.id, { 
          url: section.video.play_url, 
          expiresAt: section.video.play_url_expires_at 
        });
        return;
      } else {
        console.log(`🔄 预测性预加载URL即将过期 (${reason}): ${section.title} (剩余: ${Math.round(timeUntilExpiry / (60 * 60 * 1000))}小时)`);
      }
    } else {
      console.log(`🆕 预测性预加载首次生成URL (${reason}): ${section.title}`);
    }

    // 检查缓存
    if (preloadCache.current.has(section.video.id)) {
      console.log(`预测性预加载跳过 (${reason})，已在缓存中: ${section.title}`);
      return;
    }

    console.log(`🔮 预测性预加载 (${reason}): ${section.title}`);

    // 设置预加载状态
    setPreloadingVideos(prev => new Set([...prev, section.video!.id]));

    try {
      const result = await generateVideoPlayURL(section.video);
      
      if (result) {
        // 缓存预加载结果
        preloadCache.current.set(section.video.id, { url: result.playUrl, expiresAt: result.expiresAt });
        
        // 更新本地sections状态
        setSections(prevSections => 
          prevSections.map(s => 
            s.id === section.id && s.video ? {
              ...s,
              video: {
                ...s.video,
                play_url: result.playUrl,
                play_url_expires_at: result.expiresAt
              }
            } : s
          )
        );

        console.log(`✅ 预测性预加载完成 (${reason}): ${section.title}`);
      }
    } catch (error) {
      console.error(`❌ 预测性预加载失败 (${reason}): ${section.title}`, error);
    } finally {
      // 清除预加载状态
      setPreloadingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(section.video!.id);
        return newSet;
      });
    }
  };

  // 新增：延迟缓存全部剩余章节
  const delayedPreloadAllRemaining = async (sectionsData: CourseSection[]) => {
    if (!sectionsData.length) return;

    console.log('🕒 开始延迟缓存全部剩余章节...');

    try {
      // 获取所有需要预加载的视频（智能过滤）
      const remainingVideos = sectionsData.filter(section => {
        // 必须有视频
        if (!section.video) return false;
        
        // 排除正在预加载的视频
        if (preloadingVideos.has(section.video.id)) return false;
        
        // 排除已在缓存中的视频
        if (preloadCache.current.has(section.video.id)) return false;
        
        // 🔧 检查URL是否需要重新生成：只有过期或即将过期的才需要
        if (section.video.play_url && section.video.play_url_expires_at) {
          const expiresAt = new Date(section.video.play_url_expires_at);
          const now = new Date();
          const timeUntilExpiry = expiresAt.getTime() - now.getTime();
          
          // 如果URL还有超过10小时有效期，则无需重新生成，但要缓存
          if (timeUntilExpiry >= 10 * 60 * 60 * 1000) {
            // 缓存有效的URL
            preloadCache.current.set(section.video.id, { 
              url: section.video.play_url, 
              expiresAt: section.video.play_url_expires_at 
            });
            return false; // 不需要重新生成
          }
        }
        
        return true;
      });

      if (remainingVideos.length === 0) {
        console.log('✅ 所有视频都已预加载或正在预加载中，无需延迟缓存');
        return;
      }

      console.log(`📦 发现 ${remainingVideos.length} 个剩余视频需要延迟缓存`);

      // 设置预加载状态
      const remainingVideoIds = new Set(remainingVideos.map(s => s.video!.id));
      setPreloadingVideos(prev => new Set([...prev, ...remainingVideoIds]));

      // 分批预加载，避免同时发起太多请求
      const batchSize = 3; // 每批预加载3个视频
      const batches = [];
      for (let i = 0; i < remainingVideos.length; i += batchSize) {
        batches.push(remainingVideos.slice(i, i + batchSize));
      }

      let totalSuccessCount = 0;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`🔄 处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个视频`);

        // 并行处理当前批次
        const batchPromises = batch.map(async (section) => {
          if (!section.video) return null;

          try {
            const result = await generateVideoPlayURL(section.video);
            if (result) {
              // 缓存预加载结果
              preloadCache.current.set(section.video.id, { url: result.playUrl, expiresAt: result.expiresAt });
              
              // 更新本地sections状态
              setSections(prevSections => 
                prevSections.map(s => 
                  s.id === section.id && s.video ? {
                    ...s,
                    video: {
                      ...s.video,
                      play_url: result.playUrl,
                      play_url_expires_at: result.expiresAt
                    }
                  } : s
                )
              );

              console.log(`✅ 延迟缓存完成: ${section.title}`);
              return { sectionId: section.id, success: true };
            }
            return { sectionId: section.id, success: false };
          } catch (error) {
            console.error(`❌ 延迟缓存失败: ${section.title}`, error);
            return { sectionId: section.id, success: false };
          }
        });

        // 等待当前批次完成
        const batchResults = await Promise.allSettled(batchPromises);
        const batchSuccessCount = batchResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        totalSuccessCount += batchSuccessCount;

        console.log(`✅ 第 ${batchIndex + 1} 批完成: ${batchSuccessCount}/${batch.length} 个视频`);

        // 批次之间添加延迟，避免过于频繁的请求
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
        }
      }

      console.log(`🎯 延迟缓存全部完成: ${totalSuccessCount}/${remainingVideos.length} 个剩余视频`);

    } catch (error) {
      console.error('延迟缓存全部剩余章节失败:', error);
    } finally {
      // 清除预加载状态
      const remainingVideoIds = sectionsData
        .filter(s => s.video)
        .map(s => s.video!.id);
      
      setPreloadingVideos(prev => {
        const newSet = new Set(prev);
        remainingVideoIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  if (isLoading && dataCache.current.isInitialLoad) {
    return <CourseStudySkeleton />;
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
                {/* 章节信息 */}
                {lastLearningSection.chapter_id && chapters.find(c => c.id === lastLearningSection.chapter_id) && (
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-3 bg-blue-400 rounded-full"></div>
                    <span className="text-xs text-blue-600 font-medium">
                      {chapters.find(c => c.id === lastLearningSection.chapter_id)?.title}
                    </span>
                  </div>
                )}
                
                {/* 考点标题 */}
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
                      // 🔧 优化：如果上次学习的视频已完成，则播放下一个视频
                      if (lastLearningSection.progress?.is_completed) {
                        const nextSection = getNextPlayableSection(lastLearningSection.id);
                        if (nextSection) {
                          // 播放下一个视频
                          if (nextSection.progress?.is_completed) {
                            handleResetAndPlayVideo(nextSection);
                            toast({
                              title: "智能播放",
                              description: `当前视频已完成，正在从头播放下一章节：${nextSection.title}`,
                              duration: 3000
                            });
                          } else {
                            handlePlayVideo(nextSection);
                            toast({
                              title: "智能播放",
                              description: `当前视频已完成，正在播放下一章节：${nextSection.title}`,
                              duration: 3000
                            });
                          }
                        } else {
                          // 没有下一个视频，重播当前视频
                          handleResetAndPlayVideo(lastLearningSection);
                          toast({
                            title: "重新播放",
                            description: `已完成课程，正在重播：${lastLearningSection.title}`,
                            duration: 3000
                          });
                        }
                      } else {
                        // 未完成，继续播放当前视频
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
            <div className="space-y-6">
              {groupSectionsByChapter().map((group, groupIndex) => (
                <div key={group.chapter.id} className="space-y-3">
                  {/* 章节标题 */}
                  <div className="flex items-center space-x-2 pb-2">
                    <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                    <h3 className="text-sm font-medium text-gray-700">{group.chapter.title}</h3>
                  </div>
                  
                  {/* 该章节的考点列表 */}
                  <div className="space-y-3">
                    {group.sections.map((section, index) => {
                      const status = getSectionStatus(section, sections);
                      const isLast = isLastLearning(section, sections);
                      const config = getStatusConfig(status, isLast);
                      
                      return (
                        <div
                          key={section.id}
                          className={`
                            border rounded-xl p-3 transition-all duration-200 cursor-pointer
                            ${config.cardBg} ${config.cardBorder}
                            active:scale-[0.98] hover:shadow-md
                            md:p-4
                            ${!section.video ? 'cursor-not-allowed opacity-60' : ''}
                            ${loadingVideoId === section.video?.id ? 'cursor-wait opacity-70' : ''}
                          `}
                          onClick={() => {
                            if (section.video && loadingVideoId !== section.video.id) {
                              // 🔧 修复：对于已完成的视频（无论显示什么状态），都重置播放
                              if (section.progress?.is_completed) {
                                handleResetAndPlayVideo(section);
                              } else {
                                handlePlayVideo(section);
                              }
                            }
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 pt-1">
                              {getStatusIcon(status, section, sections)}
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
                                {getStatusBadge(status, section, sections)}
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
                  </div>
                </div>
              ))}
              
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
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 bg-black border-0 overflow-hidden [&>button]:!hidden [&_button[type='button']]:!hidden">
          
          <div className="aspect-video bg-black">
            <VideoPlayer
              src={videoDialog.url}
              title={videoDialog.title}
              autoPlay={true}
              autoFullscreen={false}
              className="w-full h-full"
              startTime={videoDialog.startTime}
              onLoadStart={() => {
                // 视频开始加载
                console.log('视频开始加载');
              }}
              onCanPlay={() => {
                // 视频可以播放
                console.log('视频可以播放');
              }}
              onPlay={() => {
                // 视频开始播放时启动自动保存进度
                startProgressAutoSave();
              }}
              onPause={() => {
                // 视频暂停时保存进度
                getCurrentVideoProgressAndSave();
              }}
              onEnded={() => {
                // 视频播放结束时，使用专门的完成函数标记为完成
                const video = document.querySelector('video');
                if (video && videoDialog.sectionId && videoDialog.videoId) {
                  markVideoAsCompleted(
                    videoDialog.sectionId,
                    videoDialog.videoId,
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
          // 🔧 修复：自动获得焦点，支持键盘快捷键
          tabIndex={-1}
          ref={(el) => {
            if (el && nextVideoDialog.open) {
              // 延迟获得焦点，确保DOM已渲染
              setTimeout(() => el.focus(), 0);
            }
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
                      
                      // 🔧 修复：使用专门的立即播放函数
                      handleImmediatePlay();
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