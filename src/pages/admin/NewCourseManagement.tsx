import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Plus, Search, Edit, Trash2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import ImageUpload from "@/components/ui/image-upload";

// 考点类型
interface KeyPointWithVideo {
  id: string;
  title: string;
  description: string | null;
  order: number;
  chapter_id: string | null;
  video_id: string | null;
  video?: {
    id: string;
    title: string;
    video_url: string;
    minio_object_name: string;
    play_url?: string | null;
    play_url_expires_at?: string | null;
  } | null;
}

// 章节类型
interface ChapterWithKeyPoints {
  id: string;
  title: string;
  description: string | null;
  order: number;
  course_id: string | null;
  keyPoints: KeyPointWithVideo[];
}

// 课程类型
interface CourseWithChapters extends Omit<Tables<'courses'>, 'price'> {
  chapters: ChapterWithKeyPoints[];
}

// 视频类型
interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  minio_object_name: string;
  created_at: string;
}

// 视频文件夹类型
interface VideoFolder {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  color?: string;
}

const defaultForm: TablesInsert<'courses'> = {
  title: '',
  description: '',
  cover_image: '',
  status: 'draft',
};

const statusMap: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
};

const statusColorMap: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  published: 'bg-green-200 text-green-700',
};

const NewCourseManagement = () => {
  const [courses, setCourses] = useState<CourseWithChapters[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [videoLibrary, setVideoLibrary] = useState<Video[]>([]);
  const [videoFolders, setVideoFolders] = useState<VideoFolder[]>([]);
  const [selectedVideoCategory, setSelectedVideoCategory] = useState<string>('all');

  // 课程编辑状态
  const [courseEditDialog, setCourseEditDialog] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    course?: CourseWithChapters;
  }>({ open: false, mode: 'add', course: undefined });

  // 章节编辑状态
  const [chapterDialog, setChapterDialog] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    courseId: string;
    chapter?: ChapterWithKeyPoints;
  }>({ open: false, mode: 'add', courseId: '', chapter: undefined });
  
  const [chapterForm, setChapterForm] = useState({
    id: '',
    title: '',
    description: '',
    order: 1,
  });

  // 考点编辑状态
  const [keyPointDialog, setKeyPointDialog] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    chapterId: string;
    keyPoint?: KeyPointWithVideo;
  }>({ open: false, mode: 'add', chapterId: '', keyPoint: undefined });
  
  const [keyPointForm, setKeyPointForm] = useState({
    id: '',
    title: '',
    description: '',
    order: 1,
    video_id: '',
    video: null as KeyPointWithVideo['video'] | null,
  });

  // 获取课程、章节和考点数据
  const fetchCourses = async () => {
    setLoading(true);
    try {
      // 1. 获取课程
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (courseError) throw courseError;
      if (!courseData) {
        setCourses([]);
        setLoading(false);
        return;
      }

      // 2. 获取章节
      const { data: chapterData, error: chapterError } = await supabase
        .from("chapters")
        .select("*")
        .order('"order"', { ascending: true });
      
      if (chapterError) console.error('获取章节失败:', chapterError);

      // 3. 获取考点
      const { data: keyPointData, error: keyPointError } = await supabase
        .from("key_points")
        .select(`
          id, title, description, "order", chapter_id, video_id,
          minio_videos(
            id, title, video_url, minio_object_name, play_url, play_url_expires_at
          )
        `)
        .order('"order"', { ascending: true });
      
      if (keyPointError) console.error('获取考点失败:', keyPointError);

      // 4. 组装数据
      const keyPointMap: Record<string, KeyPointWithVideo[]> = {};
      (keyPointData || []).forEach((kp: any) => {
        if (!kp.chapter_id) return;
        if (!keyPointMap[kp.chapter_id]) keyPointMap[kp.chapter_id] = [];
        
        keyPointMap[kp.chapter_id].push({
          id: kp.id,
          title: kp.title,
          description: kp.description,
          order: kp.order,
          chapter_id: kp.chapter_id,
          video_id: kp.video_id,
          video: kp.minio_videos ? {
            id: kp.minio_videos.id,
            title: kp.minio_videos.title,
            video_url: kp.minio_videos.video_url,
            minio_object_name: kp.minio_videos.minio_object_name,
            play_url: kp.minio_videos.play_url,
            play_url_expires_at: kp.minio_videos.play_url_expires_at,
          } : null,
        });
      });

      const chapterMap: Record<string, ChapterWithKeyPoints[]> = {};
      (chapterData || []).forEach((ch: any) => {
        if (!ch.course_id) return;
        if (!chapterMap[ch.course_id]) chapterMap[ch.course_id] = [];
        
        chapterMap[ch.course_id].push({
          id: ch.id,
          title: ch.title,
          description: ch.description,
          order: ch.order,
          course_id: ch.course_id,
          keyPoints: keyPointMap[ch.id] || [],
        });
      });

      const coursesWithChapters = courseData.map(c => ({
        ...c,
        chapters: chapterMap[c.id] || [],
      }));

      setCourses(coursesWithChapters);
    } catch (error: any) {
      console.error('获取课程失败:', error);
      toast({
        variant: "destructive",
        title: "获取课程失败",
        description: error.message || '获取课程失败'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchVideoFolders();
    fetchVideoLibrary();
  }, []);

  // 获取视频库
  const fetchVideoLibrary = async () => {
    try {
      const { data, error } = await supabase
        .from('minio_videos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setVideoLibrary(data || []);
    } catch (error: any) {
      console.error('获取视频库失败:', error);
    }
  };

  // 获取视频文件夹分类
  const fetchVideoFolders = async () => {
    try {
      // 从本地存储加载文件夹
      const loadFoldersFromStorage = (): VideoFolder[] => {
        try {
          const stored = localStorage.getItem('video_folders');
          if (stored) {
            const parsed = JSON.parse(stored);
            const folderIds = parsed.map((f: VideoFolder) => f.id);
            const defaultFolders = [{
              id: 'default',
              name: '默认分类',
              description: '系统默认分类，用于存放未分类的视频',
              is_default: true,
              color: 'gray'
            }];
            const missingDefaults = defaultFolders.filter(df => !folderIds.includes(df.id));
            return [...missingDefaults, ...parsed];
          }
        } catch (error) {
          console.error('加载文件夹失败:', error);
        }
        return [{
          id: 'default',
          name: '默认分类',
          description: '系统默认分类，用于存放未分类的视频',
          is_default: true,
          color: 'gray'
        }];
      };
      
      setVideoFolders(loadFoldersFromStorage());
    } catch (error: any) {
      console.error('获取视频分类失败:', error);
    }
  };

  // 根据分类筛选视频
  const getFilteredVideosByCategory = (videos: Video[], categoryId: string): Video[] => {
    if (categoryId === 'all') return videos;
    
    const selectedFolder = videoFolders.find(f => f.id === categoryId);
    if (!selectedFolder) return videos;
    
    if (selectedFolder.is_default && selectedFolder.id === 'default') {
      // 默认分类：返回不属于任何自定义分类的视频
      return videos.filter(video => {
        const content = `${video.title} ${video.description || ''}`.toLowerCase();
        const customFolders = videoFolders.filter(f => !f.is_default);
        return !customFolders.some(folder => content.includes(folder.name.toLowerCase()));
      });
    }
    
    // 自定义分类：使用标签匹配
    return videos.filter(video => {
      const content = `${video.title} ${video.description || ''}`.toLowerCase();
      return content.includes(selectedFolder.name.toLowerCase());
    });
  };

  // 表单处理
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 新增课程提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("courses").insert([form]).select().single();
      if (error) throw error;
      
      // 局部更新：添加新课程到列表顶部
      setCourses(prev => [{...data, chapters: []}, ...prev]);
      
      setOpen(false);
      setForm(defaultForm);
      toast({
        title: "创建成功",
        description: "课程已创建"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || '创建失败'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 打开课程编辑弹窗
  const openCourseEditDialog = (mode: 'add' | 'edit', course?: CourseWithChapters) => {
    setCourseEditDialog({ open: true, mode, course });
    if (mode === 'edit' && course) {
      setForm({
        title: course.title,
        description: course.description,
        cover_image: course.cover_image,
        status: course.status,
      });
    } else {
      setForm(defaultForm);
    }
  };

  // 关闭课程编辑弹窗
  const closeCourseEditDialog = () => {
    setCourseEditDialog({ open: false, mode: 'add', course: undefined });
    setForm(defaultForm);
  };

  // 编辑课程提交
  const handleCourseEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseEditDialog.course) return;
    
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("courses")
        .update(form)
        .eq('id', courseEditDialog.course.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // 局部更新：更新课程信息
      setCourses(prev => prev.map(course => 
        course.id === courseEditDialog.course!.id 
          ? { ...course, ...data }
          : course
      ));
      
      closeCourseEditDialog();
      toast({
        title: "更新成功",
        description: "课程信息已更新"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || '更新失败'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除课程
  const handleDeleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase.from('courses').delete().eq('id', courseId);
      if (error) throw error;
      
      // 局部更新：从列表中移除课程
      setCourses(prev => prev.filter(course => course.id !== courseId));
      
      toast({
        title: "删除成功",
        description: "课程已删除"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || '删除失败'
      });
    }
  };

  // 打开章节弹窗
  const openChapterDialog = (mode: 'add' | 'edit', courseId: string, chapter?: ChapterWithKeyPoints) => {
    setChapterDialog({ open: true, mode, courseId, chapter });
    
    if (mode === 'edit' && chapter) {
      setChapterForm({
        id: chapter.id,
        title: chapter.title,
        description: chapter.description || '',
        order: chapter.order,
      });
    } else {
      // 计算新章节的order值
      const targetCourse = courses.find(c => c.id === courseId);
      const maxOrder = targetCourse?.chapters.length ? Math.max(...targetCourse.chapters.map(ch => ch.order)) : 0;
      setChapterForm({
        id: '',
        title: '',
        description: '',
        order: maxOrder + 1,
      });
    }
  };

  // 关闭章节弹窗
  const closeChapterDialog = () => {
    setChapterDialog({ open: false, mode: 'add', courseId: '', chapter: undefined });
    setChapterForm({ id: '', title: '', description: '', order: 1 });
  };

  // 章节表单处理
  const handleChapterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setChapterForm((prev) => ({ 
      ...prev, 
      [name]: name === 'order' ? parseInt(value) || 1 : value 
    }));
  };

  // 检查章节排序值是否重复
  const isChapterOrderDuplicate = (order: number, courseId: string, excludeChapterId?: string): boolean => {
    for (const course of courses) {
      if (course.id === courseId) {
        for (const chapter of course.chapters) {
          // 如果是编辑模式，排除当前编辑的章节
          if (excludeChapterId && chapter.id === excludeChapterId) {
            continue;
          }
          if (chapter.order === order) {
            return true;
          }
        }
        break;
      }
    }
    return false;
  };

  // 提交章节 - 优化版本，避免整体刷新
  const handleChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterForm.title) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "章节标题不能为空"
      });
      return;
    }

    // 检查排序值是否重复
    const excludeId = chapterDialog.mode === 'edit' ? chapterForm.id : undefined;
    if (isChapterOrderDuplicate(chapterForm.order, chapterDialog.courseId, excludeId)) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: `排序值 ${chapterForm.order} 已存在，请选择其他数值`
      });
      return;
    }
    
    try {
      if (chapterDialog.mode === 'add') {
        const { data, error } = await supabase.from('chapters').insert([{
          course_id: chapterDialog.courseId,
          title: chapterForm.title,
          description: chapterForm.description,
          order: chapterForm.order,
        }]).select().single();
        
        if (error) throw error;
        
        // 局部更新：添加新章节到对应课程
        setCourses(prev => prev.map(course => 
          course.id === chapterDialog.courseId
            ? {
                ...course, 
                chapters: [...course.chapters, {
                  id: data.id,
                  title: data.title,
                  description: data.description,
                  order: data.order,
                  course_id: data.course_id,
                  keyPoints: []
                }].sort((a, b) => a.order - b.order)
              }
            : course
        ));
      } else if (chapterDialog.mode === 'edit' && chapterForm.id) {
        const { data, error } = await supabase.from('chapters').update({
          title: chapterForm.title,
          description: chapterForm.description,
          order: chapterForm.order,
        }).eq('id', chapterForm.id).select().single();
        
        if (error) throw error;
        
        // 局部更新：更新章节信息
        setCourses(prev => prev.map(course => ({
          ...course,
          chapters: course.chapters.map(chapter =>
            chapter.id === chapterForm.id
              ? { ...chapter, ...data }
              : chapter
          ).sort((a, b) => a.order - b.order)
        })));
      }
      
      closeChapterDialog();
      toast({
        title: "操作成功",
        description: chapterDialog.mode === 'add' ? "章节已添加" : "章节已更新"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: error.message || '操作失败'
      });
    }
  };

  // 删除章节 - 优化版本
  const handleDeleteChapter = async (chapterId: string) => {
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) throw error;
      
      // 局部更新：从课程中移除章节
      setCourses(prev => prev.map(course => ({
        ...course,
        chapters: course.chapters.filter(chapter => chapter.id !== chapterId)
      })));
      
      toast({
        title: "删除成功",
        description: "章节已删除"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || '删除失败'
      });
    }
  };

  // 打开考点弹窗
  const openKeyPointDialog = (mode: 'add' | 'edit', chapterId: string, keyPoint?: KeyPointWithVideo) => {
    setKeyPointDialog({ open: true, mode, chapterId, keyPoint });
    fetchVideoLibrary();
    fetchVideoFolders();
    setSelectedVideoCategory('all'); // 重置分类筛选
    
    if (mode === 'edit' && keyPoint) {
      setKeyPointForm({
        id: keyPoint.id,
        title: keyPoint.title,
        description: keyPoint.description || '',
        order: keyPoint.order,
        video_id: keyPoint.video_id || '',
        video: keyPoint.video || null,
      });
    } else {
      // 计算新考点的order值
      let maxOrder = 0;
      courses.forEach(course => {
        course.chapters.forEach(chapter => {
          if (chapter.id === chapterId) {
            maxOrder = Math.max(maxOrder, ...chapter.keyPoints.map(kp => kp.order));
          }
        });
      });
      setKeyPointForm({
        id: '',
        title: '',
        description: '',
        order: maxOrder + 1,
        video_id: '',
        video: null,
      });
    }
  };

  // 关闭考点弹窗
  const closeKeyPointDialog = () => {
    setKeyPointDialog({ open: false, mode: 'add', chapterId: '', keyPoint: undefined });
    setKeyPointForm({ id: '', title: '', description: '', order: 1, video_id: '', video: null });
    setSelectedVideoCategory('all'); // 重置分类筛选
  };

  // 考点表单处理
  const handleKeyPointChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setKeyPointForm((prev) => ({ 
      ...prev, 
      [name]: name === 'order' ? parseInt(value) || 1 : value 
    }));
  };

  // 处理考点视频选择
  const handleKeyPointVideoSelect = (videoId: string) => {
    const selectedVideo = videoLibrary.find(v => v.id === videoId);
    setKeyPointForm(prev => ({
      ...prev,
      video_id: videoId,
      title: selectedVideo ? selectedVideo.title : prev.title, // 自动填充视频标题作为考点标题
      video: selectedVideo ? {
        id: selectedVideo.id,
        title: selectedVideo.title,
        video_url: selectedVideo.video_url,
        minio_object_name: selectedVideo.minio_object_name,
        play_url: null,
        play_url_expires_at: null,
      } : null
    }));
  };

  // 检查考点排序值是否重复
  const isKeyPointOrderDuplicate = (order: number, chapterId: string, excludeKeyPointId?: string): boolean => {
    for (const course of courses) {
      for (const chapter of course.chapters) {
        if (chapter.id === chapterId) {
          for (const keyPoint of chapter.keyPoints) {
            // 如果是编辑模式，排除当前编辑的考点
            if (excludeKeyPointId && keyPoint.id === excludeKeyPointId) {
              continue;
            }
            if (keyPoint.order === order) {
              return true;
            }
          }
          break;
        }
      }
    }
    return false;
  };

  // 提交考点 - 优化版本，避免整体刷新
  const handleKeyPointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyPointForm.title) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "考点标题不能为空"
      });
      return;
    }
    
    if (!keyPointForm.video_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择关联视频"
      });
      return;
    }

    // 检查排序值是否重复
    const excludeId = keyPointDialog.mode === 'edit' ? keyPointForm.id : undefined;
    if (isKeyPointOrderDuplicate(keyPointForm.order, keyPointDialog.chapterId, excludeId)) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: `排序值 ${keyPointForm.order} 已存在，请选择其他数值`
      });
      return;
    }
    
    try {
      if (keyPointDialog.mode === 'add') {
        const { data, error } = await supabase.from('key_points').insert([{
          chapter_id: keyPointDialog.chapterId,
          title: keyPointForm.title,
          description: keyPointForm.description,
          order: keyPointForm.order,
          video_id: keyPointForm.video_id || null,
        }]).select().single();
        
        if (error) throw error;
        
        // 局部更新：添加新考点到对应章节
        setCourses(prev => prev.map(course => ({
          ...course,
          chapters: course.chapters.map(chapter =>
            chapter.id === keyPointDialog.chapterId
              ? {
                  ...chapter,
                  keyPoints: [...chapter.keyPoints, {
                    id: data.id,
                    title: data.title,
                    description: data.description,
                    order: data.order,
                    chapter_id: data.chapter_id,
                    video_id: data.video_id,
                    video: keyPointForm.video
                  }].sort((a, b) => a.order - b.order)
                }
              : chapter
          )
        })));
      } else if (keyPointDialog.mode === 'edit' && keyPointForm.id) {
        const { data, error } = await supabase.from('key_points').update({
          title: keyPointForm.title,
          description: keyPointForm.description,
          order: keyPointForm.order,
          video_id: keyPointForm.video_id || null,
        }).eq('id', keyPointForm.id).select().single();
        
        if (error) throw error;
        
        // 局部更新：更新考点信息
        setCourses(prev => prev.map(course => ({
          ...course,
          chapters: course.chapters.map(chapter => ({
            ...chapter,
            keyPoints: chapter.keyPoints.map(keyPoint =>
              keyPoint.id === keyPointForm.id
                ? { ...keyPoint, ...data, video: keyPointForm.video }
                : keyPoint
            ).sort((a, b) => a.order - b.order)
          }))
        })));
      }
      
      closeKeyPointDialog();
      toast({
        title: "操作成功",
        description: keyPointDialog.mode === 'add' ? "考点已添加" : "考点已更新"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: error.message || '操作失败'
      });
    }
  };

  // 删除考点 - 优化版本
  const handleDeleteKeyPoint = async (keyPointId: string) => {
    try {
      const { error } = await supabase.from('key_points').delete().eq('id', keyPointId);
      if (error) throw error;
      
      // 局部更新：从章节中移除考点
      setCourses(prev => prev.map(course => ({
        ...course,
        chapters: course.chapters.map(chapter => ({
          ...chapter,
          keyPoints: chapter.keyPoints.filter(keyPoint => keyPoint.id !== keyPointId)
        }))
      })));
      
      toast({
        title: "删除成功",
        description: "考点已删除"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || '删除失败'
      });
    }
  };

  // 过滤课程
  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="admin-page-container"><div className="text-center py-8">加载中...</div></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
                            <CardTitle>自制网课列表</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">创建和管理课程、章节和考点内容</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索课程..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => openCourseEditDialog('add')}>
              <Plus className="mr-2 h-4 w-4" />
              新增课程
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <div className="space-y-4">
              {filteredCourses.map((course) => (
                <Accordion type="single" collapsible className="space-y-4" key={course.id}>
                  <AccordionItem value={course.id} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex justify-between items-center w-full mr-4">
                        <div className="text-left font-medium flex items-center gap-2">
                          {course.title}
                          <Badge className={statusColorMap[course.status] || 'bg-gray-100 text-gray-500'}>
                            {statusMap[course.status] || course.status}
                          </Badge>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCourseEditDialog('edit', course)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="h-8 w-8 p-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除课程"{course.title}"及其所有章节和考点吗？此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCourse(course.id)}>
                                  确认删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent>
                      <div className="px-4 pb-4">
                        <div className="mb-4 text-gray-700">{course.description}</div>
                        
                        {/* 章节列表 */}
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium">章节</h3>
                            <Button 
                              size="sm" 
                              onClick={() => openChapterDialog('add', course.id)}
                              className="gap-1"
                            >
                              <Plus className="h-4 w-4" />
                              添加章节
                            </Button>
                          </div>
                          
                          {course.chapters.length === 0 ? (
                            <div className="text-muted-foreground text-center py-8">
                              暂无章节，点击"添加章节"开始创建
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {course.chapters.map((chapter) => (
                                <Card key={chapter.id} className="border-l-4 border-l-blue-500">
                                  <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <CardTitle className="text-base">{chapter.title}</CardTitle>
                                        {chapter.description && (
                                          <p className="text-sm text-gray-600 mt-1">{chapter.description}</p>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openChapterDialog('edit', course.id, chapter)}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button size="sm" variant="destructive">
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                确定要删除章节"{chapter.title}"及其所有考点吗？此操作不可撤销。
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>取消</AlertDialogCancel>
                                              <AlertDialogAction onClick={() => handleDeleteChapter(chapter.id)}>
                                                确认删除
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  
                                  <CardContent className="pt-0">
                                    {/* 考点列表 */}
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-medium text-gray-700">考点</h4>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => openKeyPointDialog('add', chapter.id)}
                                          className="gap-1 text-xs"
                                        >
                                          <Plus className="h-3 w-3" />
                                          添加考点
                                        </Button>
                                      </div>
                                      
                                      {chapter.keyPoints.length === 0 ? (
                                        <div className="text-sm text-muted-foreground text-center py-4">
                                          暂无考点，点击"添加考点"开始创建
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {chapter.keyPoints.map((keyPoint) => (
                                            <div key={keyPoint.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                              <div className="flex-1">
                                                <div className="font-medium text-sm">{keyPoint.title}</div>
                                                {keyPoint.description && (
                                                  <div className="text-xs text-gray-600 mt-1">{keyPoint.description}</div>
                                                )}
                                                {keyPoint.video && (
                                                  <div className="text-xs text-blue-600 mt-1">
                                                    📹 {keyPoint.video.title}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex gap-1 ml-2">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-7 w-7 p-0"
                                                  onClick={() => openKeyPointDialog('edit', chapter.id, keyPoint)}
                                                >
                                                  <Edit className="h-3 w-3" />
                                                </Button>
                                                <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                    <Button size="sm" variant="destructive" className="h-7 w-7 p-0">
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                                                      <AlertDialogDescription>
                                                        确定要删除考点"{keyPoint.title}"吗？此操作不可撤销。
                                                      </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                      <AlertDialogCancel>取消</AlertDialogCancel>
                                                      <AlertDialogAction onClick={() => handleDeleteKeyPoint(keyPoint.id)}>
                                                        确认删除
                                                      </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                  </AlertDialogContent>
                                                </AlertDialog>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 课程编辑对话框 */}
      <Dialog open={courseEditDialog.open} onOpenChange={(isOpen) => !isOpen && closeCourseEditDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{courseEditDialog.mode === 'add' ? '新增课程' : '编辑课程'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={courseEditDialog.mode === 'add' ? handleSubmit : handleCourseEditSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">标题 *</label>
              <Input name="title" value={form.title} onChange={handleChange} required maxLength={100} placeholder="请输入课程标题" />
            </div>
            <div>
              <label className="block mb-1 font-medium">描述</label>
              <Textarea name="description" value={form.description || ''} onChange={handleChange} maxLength={500} placeholder="请输入课程描述" />
            </div>
            <div>
              <label className="block mb-2 font-medium">封面图片</label>
              <ImageUpload
                value={form.cover_image || ''}
                onChange={(url) => setForm(prev => ({ ...prev, cover_image: url }))}
                bucket="image"
                maxSize={5}
                placeholder="请输入图片链接或上传封面图片"
                showUrlInput={true}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">状态</label>
              <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded px-2 py-1">
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
              </select>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCourseEditDialog} disabled={submitting}>取消</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '提交中...' : (courseEditDialog.mode === 'add' ? '创建课程' : '保存修改')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 章节编辑弹窗 */}
      <Dialog open={chapterDialog.open} onOpenChange={closeChapterDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{chapterDialog.mode === 'add' ? '新增章节' : '编辑章节'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChapterSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">章节标题 *</label>
              <Input name="title" value={chapterForm.title} onChange={handleChapterChange} required maxLength={100} placeholder="请输入章节标题" />
            </div>
            <div>
              <label className="block mb-1 font-medium">章节描述</label>
              <Textarea name="description" value={chapterForm.description || ''} onChange={handleChapterChange} maxLength={500} placeholder="请输入章节描述" />
            </div>
            <div>
              <label className="block mb-1 font-medium">排序（数字越小越靠前）</label>
              <Input 
                name="order" 
                type="number" 
                min={1} 
                value={chapterForm.order} 
                onChange={handleChapterChange}
                className={
                  isChapterOrderDuplicate(
                    chapterForm.order, 
                    chapterDialog.courseId, 
                    chapterDialog.mode === 'edit' ? chapterForm.id : undefined
                  ) ? 'border-red-500' : ''
                }
              />
              {isChapterOrderDuplicate(
                chapterForm.order, 
                chapterDialog.courseId, 
                chapterDialog.mode === 'edit' ? chapterForm.id : undefined
              ) && (
                <p className="text-xs text-red-500 mt-1">
                  排序值 {chapterForm.order} 已存在，请选择其他数值
                </p>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeChapterDialog}>取消</Button>
              <Button 
                type="submit"
                disabled={
                  isChapterOrderDuplicate(
                    chapterForm.order, 
                    chapterDialog.courseId, 
                    chapterDialog.mode === 'edit' ? chapterForm.id : undefined
                  )
                }
              >
                {chapterDialog.mode === 'add' ? '添加章节' : '保存章节'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 考点编辑弹窗 */}
      <Dialog open={keyPointDialog.open} onOpenChange={closeKeyPointDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{keyPointDialog.mode === 'add' ? '新增考点' : '编辑考点'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleKeyPointSubmit} className="space-y-4">
            {/* 视频选择 - 移到最前面且为必选 */}
            <div>
              <label className="block mb-2 font-medium">关联视频 *</label>
              {videoLibrary.length > 0 ? (
                <div className="space-y-3">
                  {/* 分类筛选 */}
                  <div>
                    <label className="block mb-1 text-sm text-gray-600 flex items-center gap-1">
                      <Filter className="h-3 w-3" />
                      按分类筛选
                    </label>
                    <Select value={selectedVideoCategory} onValueChange={setSelectedVideoCategory}>
                      <SelectTrigger className="w-full text-sm bg-gray-50">
                        <SelectValue placeholder="选择分类筛选" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部分类</SelectItem>
                        {videoFolders.map(folder => {
                          const categoryVideos = getFilteredVideosByCategory(videoLibrary, folder.id);
                          return (
                            <SelectItem key={folder.id} value={folder.id}>
                              {folder.name} ({categoryVideos.length})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* 视频选择 */}
                  <div>
                    <label className="block mb-1 text-sm text-gray-600">选择视频</label>
                    <Select 
                      value={keyPointForm.video_id || ''}
                      onValueChange={handleKeyPointVideoSelect}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="请选择视频" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredVideosByCategory(videoLibrary, selectedVideoCategory).length === 0 ? (
                          <SelectItem value="" disabled>
                            当前分类暂无视频
                          </SelectItem>
                        ) : (
                          getFilteredVideosByCategory(videoLibrary, selectedVideoCategory).map(video => {
                            // 获取视频所属分类
                            const videoCategory = videoFolders.find(folder => {
                              if (folder.is_default && folder.id === 'default') {
                                const content = `${video.title} ${video.description || ''}`.toLowerCase();
                                const customFolders = videoFolders.filter(f => !f.is_default);
                                return !customFolders.some(f => content.includes(f.name.toLowerCase()));
                              } else if (!folder.is_default) {
                                const content = `${video.title} ${video.description || ''}`.toLowerCase();
                                return content.includes(folder.name.toLowerCase());
                              }
                              return false;
                            })?.name || '未分类';
                            
                            return (
                              <SelectItem key={video.id} value={video.id} className="text-sm">
                                <div className="flex flex-col items-start">
                                  <span className="font-medium">{video.title}</span>
                                  {selectedVideoCategory === 'all' && (
                                    <span className="text-xs text-gray-500">[{videoCategory}]</span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    <div className="flex items-start justify-between mt-1">
                      <p className="text-xs text-gray-500">
                        选择视频后将自动填充考点标题
                      </p>
                      {selectedVideoCategory !== 'all' && (
                        <p className="text-xs text-blue-600 font-medium">
                          筛选中：{videoFolders.find(f => f.id === selectedVideoCategory)?.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 p-2 border rounded">
                  暂无可用视频，请先到视频管理页面上传视频
                </div>
              )}
            </div>
            
            <div>
              <label className="block mb-1 font-medium">考点标题 *</label>
              <Input name="title" value={keyPointForm.title} onChange={handleKeyPointChange} required maxLength={100} placeholder="请先选择关联视频" />
            </div>
            <div>
              <label className="block mb-1 font-medium">考点描述</label>
              <Textarea name="description" value={keyPointForm.description || ''} onChange={handleKeyPointChange} maxLength={500} placeholder="请输入考点描述" />
            </div>
            <div>
              <label className="block mb-1 font-medium">排序（数字越小越靠前）</label>
              <Input 
                name="order" 
                type="number" 
                min={1} 
                value={keyPointForm.order} 
                onChange={handleKeyPointChange}
                className={
                  isKeyPointOrderDuplicate(
                    keyPointForm.order, 
                    keyPointDialog.chapterId, 
                    keyPointDialog.mode === 'edit' ? keyPointForm.id : undefined
                  ) ? 'border-red-500' : ''
                }
              />
              {isKeyPointOrderDuplicate(
                keyPointForm.order, 
                keyPointDialog.chapterId, 
                keyPointDialog.mode === 'edit' ? keyPointForm.id : undefined
              ) && (
                <p className="text-xs text-red-500 mt-1">
                  排序值 {keyPointForm.order} 已存在，请选择其他数值
                </p>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeKeyPointDialog}>取消</Button>
              <Button 
                type="submit" 
                disabled={
                  isKeyPointOrderDuplicate(
                    keyPointForm.order, 
                    keyPointDialog.chapterId, 
                    keyPointDialog.mode === 'edit' ? keyPointForm.id : undefined
                  )
                }
              >
                {keyPointDialog.mode === 'add' ? '添加考点' : '保存考点'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewCourseManagement; 