import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { 
  Play, 
  Edit, 
  Trash2, 
  Video, 
  GripVertical, 
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import VideoPlayer from "@/components/VideoPlayer";
import { Badge } from "@/components/ui/badge";
import EnhancedPagination from "@/components/ui/enhanced-pagination";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";
import VideoUploadToMinIO from "@/components/VideoUploadToMinIO";

// 文件夹类型
interface VideoFolder {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  color?: string;
}

// 默认文件夹
const DEFAULT_FOLDERS: VideoFolder[] = [
  {
    id: 'default',
    name: '默认文件夹',
    description: '系统默认文件夹，用于存放未分类的视频',
    is_default: true,
    color: 'gray'
  }
];

// 本地存储键
const FOLDERS_STORAGE_KEY = 'video_folders';

// 加载文件夹
const loadFoldersFromStorage = (): VideoFolder[] => {
  try {
    const stored = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 确保默认文件夹存在
      const folderIds = parsed.map((f: VideoFolder) => f.id);
      const missingDefaults = DEFAULT_FOLDERS.filter(df => !folderIds.includes(df.id));
      return [...missingDefaults, ...parsed];
    }
  } catch (error) {
    console.error('加载文件夹失败:', error);
  }
  return DEFAULT_FOLDERS;
};



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

// 章节类型
interface SectionWithVideo {
  id: string;
  title: string;
  description: string | null;
  order: number;
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

// 课程类型
interface CourseWithSections extends Omit<Tables<'courses'>, 'price'> {
  sections: SectionWithVideo[];
}

// 章节编辑弹窗初始值
const defaultSectionForm = {
  id: '',
  title: '',
  description: '',
  order: 1,
  video_id: '',
  video: null as SectionWithVideo['video'] | null,
};

// 视频类型 - 匹配minio_videos表基础结构
interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  minio_object_name: string;
  created_at: string;
}

// 新增课程表单类型（包含章节）
interface NewCourseForm extends TablesInsert<'courses'> {
  sections: {
    title: string;
    description: string | null;
    order: number;
    video_id: string | null;
    video: Video | null;
  }[];
}

// 辅助函数：将SectionWithVideo[]转为form.sections需要的格式
function mapSectionsForForm(sections: SectionWithVideo[]): NewCourseForm['sections'] {
  return sections.map(s => ({
    title: s.title,
    description: s.description,
    order: s.order,
    video_id: s.video_id,
    video: s.video ? {
      id: s.video.id,
      title: s.video.title,
      description: '', // 编辑课程时章节视频只需id和title，其他字段可为空
      video_url: s.video.video_url,
      minio_object_name: s.video.minio_object_name,
      created_at: ''
    } : null
  }));
}

const CourseManagement = () => {
  const [courses, setCourses] = useState<CourseWithSections[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState<'add' | 'edit'>("add");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [form, setForm] = useState<NewCourseForm>({...defaultForm, sections: []});
  const [submitting, setSubmitting] = useState(false);
  const [videoDialog, setVideoDialog] = useState<{ open: boolean; url: string; title: string }>({ open: false, url: '', title: '' });
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; courseId: string; section?: SectionWithVideo }>({ open: false, mode: 'add', courseId: '', section: undefined });
  const [sectionForm, setSectionForm] = useState<typeof defaultSectionForm>(defaultSectionForm);
  const [videoUploadDialog, setVideoUploadDialog] = useState<{ open: boolean; sectionId: string; courseId: string }>({ open: false, sectionId: '', courseId: '' });
  const [videoLibrary, setVideoLibrary] = useState<Video[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedBrowseFolderId, setSelectedBrowseFolderId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; courseId: string; title: string }>({ open: false, courseId: '', title: '' });
  const [deleteSectionDialog, setDeleteSectionDialog] = useState<{ open: boolean; sectionId: string; title: string }>({ open: false, sectionId: '', title: '' });
  const [previewCoverImage, setPreviewCoverImage] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string | undefined>(undefined);
  
  // 文件夹管理
  const [folders] = useState<VideoFolder[]>(loadFoldersFromStorage());

  // 分页和搜索状态 - 使用用户偏好设置
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());

  // 处理每页显示数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize);
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  // 获取课程及章节和视频信息
  const fetchCourses = async () => {
    setLoading(true);
    try {
      // 查询课程
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, title, description, cover_image, status, created_at, updated_at")
        .order("created_at", { ascending: false });
      
      if (courseError) {
        console.error('获取课程失败:', courseError);
        toast({
          variant: "destructive",
          title: "获取课程失败",
          description: courseError.message || "无法获取课程信息"
        });
        setCourses([]);
        setLoading(false);
        return;
      }
      
      if (!courseData) {
        setCourses([]);
        setLoading(false);
        return;
      }
      
      // 查询所有章节及视频 - 改为从minio_videos表获取视频信息
      const { data: sectionData, error: sectionError } = await supabase
        .from("course_sections")
        .select("id, title, description, order, course_id, video_id, minio_videos(id, title, video_url, minio_object_name, play_url, play_url_expires_at)")
        .order("order", { ascending: true });
      
      if (sectionError) {
        console.error('获取章节失败:', sectionError);
        console.log('查询语句：SELECT id, title, description, order, course_id, video_id, minio_videos(id, title, video_url) FROM course_sections ORDER BY order ASC');
        // 即使章节查询失败，也显示课程，只是没有章节
        setCourses(courseData.map(c => ({ ...c, sections: [] })));
        setLoading(false);
        toast({
          variant: "destructive",
          title: "获取章节失败",
          description: sectionError.message || "无法获取章节信息，但课程信息已加载"
        });
        return;
      }
      
      // 按课程分组章节
      const courseMap: Record<string, SectionWithVideo[]> = {};
      (sectionData || []).forEach((s: any) => {
        if (!s.course_id) return;
        if (!courseMap[s.course_id]) courseMap[s.course_id] = [];
        courseMap[s.course_id].push({
          id: s.id,
          title: s.title,
          description: s.description,
          order: s.order,
          video_id: s.video_id,
          video: s.minio_videos ? {
            id: s.minio_videos.id,
            title: s.minio_videos.title,
            video_url: s.minio_videos.video_url,
            minio_object_name: s.minio_videos.minio_object_name,
            play_url: s.minio_videos.play_url,
            play_url_expires_at: s.minio_videos.play_url_expires_at,
          } : null,
        });
      });
      
      // 合并到课程
      setCourses(courseData.map(c => ({ ...c, sections: courseMap[c.id] || [] })));
      setLoading(false);
    } catch (error: any) {
      console.error('获取课程和章节异常:', error);
      toast({
        variant: "destructive",
        title: "加载数据异常",
        description: error.message || "获取课程和章节时发生异常"
      });
      setCourses([]);
      setLoading(false);
    }
  };

  // 获取视频库 - 改为从minio_videos表获取，与视频管理模块同步
  const fetchVideoLibrary = async () => {
    try {
      const { data, error } = await supabase
        .from("minio_videos")
        .select("id, title, description, video_url, minio_object_name, created_at")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error('获取视频库失败:', error);
        toast({
          variant: "destructive",
          title: "加载视频库失败",
          description: error.message || "无法加载视频库"
        });
        return;
      }
      
      setVideoLibrary(data || []);
    } catch (error: any) {
      console.error('获取视频库异常:', error);
      toast({
        variant: "destructive",
        title: "加载视频库异常",
        description: error.message || "获取视频库时发生异常"
      });
      setVideoLibrary([]);
    }
  };

  // 局部刷新某课程的章节 - 改为从minio_videos表获取视频信息
  const fetchSections = async (courseId: string) => {
    try {
      const { data: sectionData, error: sectionError } = await supabase
        .from("course_sections")
        .select("id, title, description, order, course_id, video_id, minio_videos(id, title, video_url, minio_object_name, play_url, play_url_expires_at)")
        .eq("course_id", courseId)
        .order("order", { ascending: true });
      
      if (sectionError) {
        console.error('获取章节失败:', sectionError);
        toast({
          variant: "destructive",
          title: "获取章节失败",
          description: sectionError.message || "无法获取章节信息"
        });
        return;
      }
      
      // 即使没有章节也要更新状态
      setCourses(prev => prev.map(c => c.id === courseId ? {
        ...c,
        sections: (sectionData || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          order: s.order,
          video_id: s.video_id,
          video: s.minio_videos ? {
            id: s.minio_videos.id,
            title: s.minio_videos.title,
            video_url: s.minio_videos.video_url,
            minio_object_name: s.minio_videos.minio_object_name,
            play_url: s.minio_videos.play_url,
            play_url_expires_at: s.minio_videos.play_url_expires_at,
          } : null,
        }))
      } : c));
    } catch (error: any) {
      console.error('获取章节异常:', error);
      toast({
        variant: "destructive",
        title: "获取章节异常",
        description: error.message || "获取章节时发生异常"
      });
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchVideoLibrary();
  }, []);

  // 处理表格滚动事件，优化移动端体验
  useEffect(() => {
    const handleTableScroll = () => {
      const scrollContainers = document.querySelectorAll('.overflow-x-auto');
      scrollContainers.forEach(container => {
        const hasScrolled = container.scrollLeft > 0;
        if (hasScrolled) {
          container.classList.add('scrolled');
        } else {
          container.classList.remove('scrolled');
        }
      });
    };

    // 为所有滚动容器添加滚动事件监听
    const scrollContainers = document.querySelectorAll('.overflow-x-auto');
    scrollContainers.forEach(container => {
      container.addEventListener('scroll', handleTableScroll);
    });

    // 清理函数
    return () => {
      scrollContainers.forEach(container => {
        container.removeEventListener('scroll', handleTableScroll);
      });
    };
  }, [courses]);

  // 处理表单输入
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 提交新增课程
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // 1. 插入课程
      const { data: courseData, error: courseError } = await supabase.from('courses').insert([{
        title: form.title,
        description: form.description,
        cover_image: form.cover_image,
        status: form.status,
      }]).select('id').single();
      
      if (courseError || !courseData?.id) {
        throw new Error('新增课程失败：' + courseError?.message);
      }
      
      // 2. 如果有章节，批量插入
      if (form.sections.length > 0) {
        const sections = form.sections.map((section, idx) => ({
          course_id: courseData.id,
          title: section.title,
          description: section.description,
          order: section.order || idx + 1,
          video_id: section.video_id,
        }));
        
        const { error: sectionError } = await supabase.from('course_sections').insert(sections);
        if (sectionError) {
          throw new Error('新增章节失败：' + sectionError.message);
        }
      }
      
      setOpen(false);
      setForm({...defaultForm, sections: []});
      setPreviewCoverImage(false);
      fetchCourses();
      toast({
        title: "添加成功",
        description: "课程已成功添加"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "添加失败",
        description: error.message || '添加失败'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 播放视频 - 适配MinIO视频（智能缓存优化版）
  const handlePlayVideo = async (video: SectionWithVideo['video']) => {
    if (!video) return;
    
    try {
      // 检查是否有存储的播放URL且未过期
      if (video.play_url && video.play_url_expires_at) {
        const expiresAt = new Date(video.play_url_expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        
        // 如果URL将在10小时内过期，则重新生成（适应长视频播放）
        if (timeUntilExpiry > 10 * 60 * 60 * 1000) {
          // URL仍然有效，直接使用
          setVideoDialog({ 
            open: true, 
            url: video.play_url, 
            title: video.title 
          });
          return;
        }
      }
      
      // 如果没有播放URL或将在10小时内过期，调用Edge Function生成新的播放URL
      const { data, error } = await supabase.functions.invoke('minio-presigned-upload', {
        body: { 
          action: 'generatePlayUrl',
          objectName: video.minio_object_name 
        }
      });
      
      if (error) throw error;

      if (data?.playUrl) {
        // 暂时不更新数据库中的播放URL，直接使用生成的URL
        
        setVideoDialog({ 
          open: true, 
          url: data.playUrl, 
          title: video.title 
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
    }
  };

  // 打开新增/编辑章节弹窗
  const openSectionDialog = (mode: 'add' | 'edit', courseId: string, section?: SectionWithVideo) => {
    setSectionDialog({ open: true, mode, courseId, section });
    fetchVideoLibrary(); // 加载视频库
    
    if (mode === 'edit' && section) {
      setSectionForm({
        id: section.id,
        title: section.title,
        description: section.description || '',
        order: section.order,
        video_id: section.video_id || '',
        video: section.video || null,
      });
    } else {
      // 对于现有课程，找到最大order值+1作为新章节的order
      const maxOrder = courseId ? Math.max(0, ...courses.find(c => c.id === courseId)?.sections.map(s => s.order) || [0]) : 0;
      setSectionForm({ ...defaultSectionForm, order: maxOrder + 1 });
    }
  };

  // 关闭章节弹窗
  const closeSectionDialog = () => {
    setSectionDialog({ open: false, mode: 'add', courseId: '', section: undefined });
    setSectionForm(defaultSectionForm);
  };

  // 章节表单输入
  const handleSectionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSectionForm((prev) => ({ ...prev, [name]: value }));
  };

  // 处理章节视频选择
  const handleSectionVideoSelect = (videoId: string) => {
    const selectedVideo = videoLibrary.find(v => v.id === videoId);
    setSectionForm(prev => ({
      ...prev,
      video_id: videoId,
      video: selectedVideo || null
    }));
  };

  // 清除章节视频选择
  const clearSectionVideoSelect = () => {
    setSectionForm(prev => ({
      ...prev,
      video_id: '',
      video: null
    }));
  };

  // 新增/编辑章节提交
  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.title) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "章节标题不能为空"
      });
      return;
    }
    
    try {
      if (sectionDialog.mode === 'add') {
        // 新增章节
        await supabase.from('course_sections').insert([{
          course_id: sectionDialog.courseId,
          title: sectionForm.title,
          description: sectionForm.description,
          order: sectionForm.order,
          video_id: sectionForm.video_id || null,
        }]);
      } else if (sectionDialog.mode === 'edit' && sectionForm.id) {
        // 编辑章节
        await supabase.from('course_sections').update({
          title: sectionForm.title,
          description: sectionForm.description,
          order: sectionForm.order,
          video_id: sectionForm.video_id || null,
        }).eq('id', sectionForm.id);
      }
      closeSectionDialog();
      // 刷新所有课程数据，确保页面显示最新状态
      await fetchCourses();
      toast({
        title: "操作成功",
        description: sectionDialog.mode === 'add' ? "章节已添加" : "章节已更新"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: error.message || '操作失败'
      });
    }
  };

  // 删除章节
  const handleDeleteSection = async (sectionId: string) => {
    try {
      await supabase.from('course_sections').delete().eq('id', sectionId);
      fetchCourses();
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

  // 打开视频上传/选择弹窗
  const openVideoDialog = (sectionId: string, courseId: string) => {
    setVideoUploadDialog({ open: true, sectionId, courseId });
    fetchVideoLibrary(); // 重新加载视频库
    setSelectedVideoId('');
  };

  // 关闭视频上传/选择弹窗
  const closeVideoDialog = () => {
    setVideoUploadDialog({ open: false, sectionId: '', courseId: '' });
    setSelectedVideoId('');
    setSelectedBrowseFolderId('');
    setActiveTab('upload');
  };

  // 视频选择
  const handleVideoSelect = (videoId: string, videoUrl?: string) => {
    setSelectedVideoId(videoId);
    
    // 如果提供了视频URL，则预览视频
    if (videoUrl) {
      const selectedVideo = videoLibrary.find(v => v.id === videoId);
      if (selectedVideo) {
        setVideoDialog({
          open: true,
          url: selectedVideo.video_url,
          title: selectedVideo.title
        });
      }
    }
  };

  // MinIO 视频上传完成处理 - 修复：上传完成后关联章节并关闭对话框
  const handleMinIOUploadComplete = async (uploadedVideoId?: string) => {
    fetchVideoLibrary(); // 刷新视频库
    
    // 如果有上传的视频ID，自动关联到当前章节
    if (uploadedVideoId && videoUploadDialog.sectionId) {
      try {
        await supabase
          .from('course_sections')
          .update({ video_id: uploadedVideoId })
          .eq('id', videoUploadDialog.sectionId);
        
        await fetchCourses(); // 刷新课程数据
        
        toast({
          title: "上传并关联成功",
          description: "视频已成功上传并关联到章节"
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "关联失败",
          description: error.message || "视频上传成功但关联失败"
        });
      }
    } else {
      toast({
        title: "上传成功",
        description: "视频已成功上传到MinIO"
      });
    }
    
    // 关闭对话框
    closeVideoDialog();
  };

  // 根据文件夹过滤视频库
  const getFilteredVideosByFolder = (videos: Video[], folderId: string) => {
    try {
      if (!videos || !Array.isArray(videos)) {
        console.warn('视频列表为空或格式错误');
        return [];
      }
      
      if (!folderId) return videos;
      
      // 如果是自定义文件夹，使用标签匹配
      const customFolder = folders.find(f => f.id === folderId && !f.is_default);
      if (customFolder) {
        return videos.filter(video => {
          try {
            const content = `${video?.title || ''} ${video?.description || ''}`.toLowerCase();
            return content.includes(customFolder.name.toLowerCase());
          } catch (error) {
            console.error('过滤视频时出错:', error, video);
            return false;
          }
        });
      }
      
      // 默认文件夹：返回所有视频
      return videos;
    } catch (error) {
      console.error('getFilteredVideosByFolder函数异常:', error);
      return [];
    }
  };

  // 应用所选视频到章节
  const applyVideoToSection = async () => {
    if (!selectedVideoId || !videoUploadDialog.sectionId) return;
    
    try {
      // 更新章节的 video_id
      await supabase
        .from('course_sections')
        .update({ video_id: selectedVideoId })
        .eq('id', videoUploadDialog.sectionId);
      
      fetchCourses();
      closeVideoDialog();
      toast({
        title: "设置成功",
        description: "视频已成功应用到章节"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "设置失败",
        description: error.message || '设置视频失败'
      });
    }
  };

  // 新增课程中添加章节
  const addSectionToNewCourse = async () => {
    // 如果视频库还没有加载，先加载视频库
    if (!videoLibrary || videoLibrary.length === 0) {
      await fetchVideoLibrary();
    }
    
    const newOrder = form.sections.length > 0 
      ? Math.max(...form.sections.map(s => s.order || 0)) + 1 
      : 1;
      
    setForm(prev => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          title: '',
          description: '',
          order: newOrder,
          video_id: null,
          video: null
        }
      ]
    }));
  };

  // 从新增课程中删除章节
  const removeSectionFromNewCourse = (index: number) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }));
  };

  // 处理新增课程中章节表单输入
  const handleNewCourseSectionChange = (index: number, field: string, value: string) => {
    setForm(prev => {
      const updatedSections = [...prev.sections];
      updatedSections[index] = {
        ...updatedSections[index],
        [field]: field === 'order' ? Number(value) : value
      };
      return { ...prev, sections: updatedSections };
    });
  };

  // 处理新增课程中章节的视频选择
  const handleNewCourseSectionVideoSelect = (index: number, videoId: string) => {
    const selectedVideo = videoLibrary.find(v => v.id === videoId);
    setForm(prev => {
      const updatedSections = [...prev.sections];
      updatedSections[index] = {
        ...updatedSections[index],
        video_id: videoId || null,
        video: selectedVideo || null
      };
      return { ...prev, sections: updatedSections };
    });
  };

  // 清除新增课程中章节的视频选择
  const clearNewCourseSectionVideoSelect = (index: number) => {
    setForm(prev => {
      const updatedSections = [...prev.sections];
      updatedSections[index] = {
        ...updatedSections[index],
        video_id: null,
        video: null
      };
      return { ...prev, sections: updatedSections };
    });
  };

  // 章节排序后的处理函数
  const reorderSections = async (courseId: string, sectionId: string, newOrder: number) => {
    try {
      await supabase
        .from('course_sections')
        .update({ order: newOrder })
        .eq('id', sectionId);
      return true;
    } catch (error) {
      console.error('重新排序失败:', error);
      return false;
    }
  };

  // 处理章节拖拽结束事件
  const handleDragEnd = async (result: any, courseId: string, sections: SectionWithVideo[]) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    if (source.index === destination.index) return;
    
    // 创建新的排序顺序
    const reorderedSections = Array.from(sections);
    const [removed] = reorderedSections.splice(source.index, 1);
    reorderedSections.splice(destination.index, 0, removed);
    
    // 更新本地UI显示
    const newCourses = courses.map(course => {
      if (course.id === courseId) {
        return {
          ...course,
          sections: reorderedSections.map((section, index) => ({
            ...section,
            order: index + 1
          }))
        };
      }
      return course;
    });
    setCourses(newCourses);
    
    // 保存到数据库
    try {
      // 为每个章节创建更新操作
      const updatePromises = reorderedSections.map((section, index) => 
        supabase
          .from('course_sections')
          .update({ order: index + 1 })
          .eq('id', section.id)
      );
      
      await Promise.all(updatePromises);
      toast({
        title: "排序更新成功",
        description: "章节顺序已更新"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "排序更新失败",
        description: error.message || "更新章节顺序失败"
      });
    }
  };

  // 向上移动章节
  const moveSectionUp = async (courseId: string, sectionIndex: number) => {
    if (sectionIndex === 0) return; // 已经是第一个
    
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const sections = [...course.sections];
    const currentSection = sections[sectionIndex];
    const prevSection = sections[sectionIndex - 1];
    
    // 交换顺序
    const tempOrder = currentSection.order;
    
    // 更新本地状态
    const newCourses = courses.map(c => {
      if (c.id === courseId) {
        const newSections = [...c.sections];
        newSections[sectionIndex].order = prevSection.order;
        newSections[sectionIndex - 1].order = tempOrder;
        
        // 按新顺序排序
        newSections.sort((a, b) => a.order - b.order);
        
        return {
          ...c,
          sections: newSections
        };
      }
      return c;
    });
    setCourses(newCourses);
    
    // 保存到数据库
    try {
      await Promise.all([
        supabase
          .from('course_sections')
          .update({ order: prevSection.order })
          .eq('id', currentSection.id),
        supabase
          .from('course_sections')
          .update({ order: tempOrder })
          .eq('id', prevSection.id)
      ]);
      
      toast({
        title: "排序更新成功",
        description: "章节顺序已更新"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "排序更新失败",
        description: error.message || "更新章节顺序失败"
      });
    }
  };
  
  // 向下移动章节
  const moveSectionDown = async (courseId: string, sectionIndex: number) => {
    const course = courses.find(c => c.id === courseId);
    if (!course || sectionIndex === course.sections.length - 1) return; // 已经是最后一个
    
    const sections = [...course.sections];
    const currentSection = sections[sectionIndex];
    const nextSection = sections[sectionIndex + 1];
    
    // 交换顺序
    const tempOrder = currentSection.order;
    
    // 更新本地状态
    const newCourses = courses.map(c => {
      if (c.id === courseId) {
        const newSections = [...c.sections];
        newSections[sectionIndex].order = nextSection.order;
        newSections[sectionIndex + 1].order = tempOrder;
        
        // 按新顺序排序
        newSections.sort((a, b) => a.order - b.order);
        
        return {
          ...c,
          sections: newSections
        };
      }
      return c;
    });
    setCourses(newCourses);
    
    // 保存到数据库
    try {
      await Promise.all([
        supabase
          .from('course_sections')
          .update({ order: nextSection.order })
          .eq('id', currentSection.id),
        supabase
          .from('course_sections')
          .update({ order: tempOrder })
          .eq('id', nextSection.id)
      ]);
      
      toast({
        title: "排序更新成功",
        description: "章节顺序已更新"
      });
    } catch (error: any) {
      toast({
        variant: "destructive", 
        title: "排序更新失败",
        description: error.message || "更新章节顺序失败"
      });
    }
  };

  // 处理课程状态更改
  const handleStatusChange = async (courseId: string, newStatus: string) => {
    try {
      await supabase
        .from('courses')
        .update({ status: newStatus })
        .eq('id', courseId);
      
      // 更新本地状态
      const newCourses = courses.map(course => {
        if (course.id === courseId) {
          return { ...course, status: newStatus };
        }
        return course;
      });
      
      setCourses(newCourses);
      toast({
        title: "状态更新成功",
        description: `课程状态已更改为${statusMap[newStatus] || newStatus}`
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "状态更新失败",
        description: error.message || "更新课程状态失败"
      });
    }
  };

  // 删除课程
  const handleDeleteCourse = async (courseId: string) => {
    try {
      // 1. 先获取课程的所有章节
      const { data: sections } = await supabase
        .from('course_sections')
        .select('id')
        .eq('course_id', courseId);
      
      // 2. 删除所有章节
      if (sections && sections.length > 0) {
        await supabase
          .from('course_sections')
          .delete()
          .eq('course_id', courseId);
      }
      
      // 3. 删除课程
      await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);
      
      // 4. 更新本地状态
      setCourses(courses.filter(course => course.id !== courseId));
      toast({
        title: "删除成功",
        description: "课程及相关章节已删除"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "删除课程失败"
      });
    }
  };

  // 编辑课程提交
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          title: form.title,
          description: form.description,
          cover_image: form.cover_image,
          status: form.status,
        })
        .eq('id', editingCourseId);
      if (error) throw error;
      setOpen(false);
      setEditMode('add');
      setEditingCourseId(null);
      setForm({ ...defaultForm, sections: [] });
      setPreviewCoverImage(false);
      fetchCourses();
      toast({
        title: '保存成功',
        description: '课程信息已更新'
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: error.message || '保存失败'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 过滤和分页
  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredCourses.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCourses = filteredCourses.slice(startIndex, startIndex + pageSize);

  // 分页控制
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="admin-page-container">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">课程管理</h1>
          <p className="text-muted-foreground mt-1">创建和管理课程、章节和视频内容</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索课程..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // 搜索时重置到第一页
              }}
              className="pl-10 w-64"
            />
          </div>
          <Button onClick={() => setOpen(true)}>新增课程</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            课程列表
            {filteredCourses.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                共 {filteredCourses.length} 门课程
                {totalPages > 1 && ` • 第 ${currentPage} / ${totalPages} 页`}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">加载中...</p>
              </div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">
                {searchTerm ? '没有找到匹配的课程' : '暂无课程'}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm ? '尝试使用不同的关键词搜索' : '点击新增课程按钮创建第一门课程'}
              </p>
            </div>
          ) : (
            <>
              <Accordion type="single" collapsible className="w-full" value={activeCourseId} onValueChange={setActiveCourseId}>
                {paginatedCourses.map((course) => (
                <AccordionItem value={course.id} key={course.id}>
                  <AccordionTrigger className="hover:bg-gray-50 px-4">
                    <div className="flex justify-between items-center w-full mr-4">
                      <div className="text-left font-medium flex items-center gap-2">
                        {course.title}
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColorMap[course.status] || 'bg-gray-100 text-gray-500'}`}>{statusMap[course.status] || course.status}</span>
                      </div>
{/* --- 课程状态与删除功能区开始 --- */}
<div className="flex items-center gap-2">
  <Button size="sm" variant="outline" className="hover:no-underline" onClick={e => { e.stopPropagation(); setEditMode('edit'); setEditingCourseId(course.id); setForm({ ...course, sections: mapSectionsForForm(course.sections) }); setOpen(true); }}>编辑</Button>
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="sm" variant="destructive" className="hover:no-underline" onClick={e => { e.stopPropagation(); setDeleteDialog({ open: true, courseId: course.id, title: course.title }); }}>删除</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认删除</AlertDialogTitle>
        <AlertDialogDescription>确定要删除课程"{course.title}"及其所有章节吗？此操作不可撤销。</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction onClick={() => { handleDeleteCourse(course.id); setDeleteDialog({ open: false, courseId: '', title: '' }); }}>确认删除</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</div>
{/* --- 课程状态与删除功能区结束 --- */}
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent>
                    <div className="mb-2 text-gray-700">{course.description}</div>
                    {course.sections.length === 0 ? (
                      <div className="text-muted-foreground">暂无章节</div>
                    ) : (
                      <DragDropContext onDragEnd={(result) => handleDragEnd(result, course.id, course.sections)}>
                        <Droppable droppableId={`course-${course.id}`}>
                          {(provided) => (
                            <div className="w-full border rounded-md overflow-hidden">
                              {/* 移动端水平滚动容器 */}
                              <div className="overflow-x-auto">
                                <div
                                  {...provided.droppableProps}
                                  ref={provided.innerRef}
                                  className="w-full"
                                >
                                  <table className="w-full text-sm min-w-[800px]">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="py-2 px-3 text-left">排序</th>
                                        <th className="py-2 px-3 text-left">序号</th>
                                        <th className="py-2 px-3 text-left">章节标题</th>
                                        <th className="py-2 px-3 text-left">视频</th>
                                        <th className="py-2 px-3 text-right">操作</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {course.sections.map((section, idx) => (
                                        <Draggable 
                                          key={section.id} 
                                          draggableId={section.id} 
                                          index={idx}
                                        >
                                          {(provided, snapshot) => (
                                            <tr 
                                              key={section.id} 
                                              className={`border-b ${snapshot.isDragging ? 'bg-blue-50' : ''}`}
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                            >
                                              <td className="py-2 px-3 w-16" {...provided.dragHandleProps}>
                                                <div className="flex items-center gap-1">
                                                  <GripVertical className="w-4 h-4 text-gray-400" />
                                                  <div className="flex flex-col">
                                                    <Button 
                                                      size="icon" 
                                                      variant="ghost" 
                                                      className="h-6 w-6"
                                                      disabled={idx === 0}
                                                      onClick={() => moveSectionUp(course.id, idx)}
                                                    >
                                                      <ArrowUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button 
                                                      size="icon" 
                                                      variant="ghost" 
                                                      className="h-6 w-6"
                                                      disabled={idx === course.sections.length - 1}
                                                      onClick={() => moveSectionDown(course.id, idx)}
                                                    >
                                                      <ArrowDown className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="py-2 px-3">{section.order}</td>
                                              <td className="py-2 px-3">{section.title}</td>
                                              <td className="py-2 px-3">
                                                {section.video?.title || '无视频'}
                                              </td>
                                              <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end items-center gap-1">
                                                  {section.video?.video_url ? (
                                                    <Button 
                                                      size="sm" 
                                                      variant="secondary"
                                                      className="h-8 gap-1 hover:no-underline"
                                                      onClick={() => handlePlayVideo(section.video)}
                                                    >
                                                      <Play className="h-3 w-3" />
                                                      <span>播放</span>
                                                    </Button>
                                                  ) : (
                                                    <Button 
                                                      size="sm" 
                                                      variant="outline"
                                                      className="h-8 gap-1 hover:no-underline"
                                                      onClick={() => openVideoDialog(section.id, course.id)}
                                                    >
                                                      <Video className="h-3 w-3" />
                                                      <span>添加视频</span>
                                                    </Button>
                                                  )}
                                                  <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="h-8 gap-1 hover:no-underline"
                                                    onClick={() => openSectionDialog('edit', course.id, section)}
                                                  >
                                                    <Edit className="h-3 w-3" />
                                                    <span>编辑</span>
                                                  </Button>
                                                  {section.video?.video_url && (
                                                    <Button 
                                                      size="sm" 
                                                      variant="outline"
                                                      className="h-8 gap-1 hover:no-underline"
                                                      onClick={() => openVideoDialog(section.id, course.id)}
                                                    >
                                                      <Video className="h-3 w-3" />
                                                      <span>更换</span>
                                                    </Button>
                                                  )}
                                                  <Button 
                                                    size="sm" 
                                                    variant="destructive"
                                                    className="h-8 gap-1 hover:no-underline"
                                                    onClick={() => setDeleteSectionDialog({ open: true, sectionId: section.id, title: section.title })}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                    <span>删除</span>
                                                  </Button>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    )}
                    <div className="mt-4">
                      <Button 
                        size="sm" 
                        onClick={() => openSectionDialog('add', course.id)}
                        className="gap-1 hover:no-underline"
                      >
                        <Plus className="h-4 w-4" />
                        <span>新增章节</span>
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
              </Accordion>
              {filteredCourses.length > 0 && (
                <EnhancedPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredCourses.length}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  className="mt-6"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
      {/* 新增课程弹窗 */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditMode('add'); setEditingCourseId(null); setForm({ ...defaultForm, sections: [] }); setPreviewCoverImage(false); } }}>
        <DialogContent className="sm:max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode === 'edit' ? '编辑课程' : '新增课程'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editMode === 'edit' ? handleEditSubmit : handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">标题 *</label>
              <Input name="title" value={form.title} onChange={handleChange} required maxLength={100} placeholder="请输入课程标题" />
            </div>
            <div>
              <label className="block mb-1 font-medium">描述</label>
              <Textarea name="description" value={form.description || ''} onChange={handleChange} maxLength={500} placeholder="请输入课程描述" />
            </div>
            <div>
              <label className="block mb-1 font-medium">封面图片URL</label>
              <div className="flex gap-2">
                <Input 
                  name="cover_image" 
                  value={form.cover_image || ''} 
                  onChange={handleChange} 
                  placeholder="请输入图片链接（可选）" 
                  className="flex-1"
                />
                {form.cover_image && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setPreviewCoverImage(true)}
                  >
                    预览
                  </Button>
                )}
              </div>
              {form.cover_image && previewCoverImage && (
                <div className="mt-2 relative">
                  <img 
                    src={form.cover_image} 
                    alt="封面预览" 
                    className="max-h-[200px] rounded border object-cover"
                    onError={() => {
                      toast({
                        variant: "destructive",
                        title: "图片加载失败",
                        description: "无法加载图片，请检查URL是否正确"
                      });
                    }}
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full bg-background/80"
                    onClick={() => setPreviewCoverImage(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <label className="block mb-1 font-medium">状态</label>
              <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded px-2 py-1">
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
              </select>
            </div>
            
            {/* 章节列表 */}
            <div className="border p-4 rounded">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">章节（可选）</h3>
                <Button type="button" size="sm" onClick={addSectionToNewCourse}>添加章节</Button>
              </div>
              
              {form.sections.length === 0 ? (
                <div className="text-muted-foreground">暂无章节，点击"添加章节"添加</div>
              ) : (
                <div className="space-y-4">
                  {form.sections.map((section, idx) => (
                    <div key={idx} className="border p-3 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">章节 {idx + 1}</h4>
                        <Button type="button" size="sm" variant="destructive" onClick={() => removeSectionFromNewCourse(idx)}>删除</Button>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-sm font-medium">标题 *</label>
                          <Input 
                            value={section.title} 
                            onChange={(e) => handleNewCourseSectionChange(idx, 'title', e.target.value)}
                            placeholder="请输入章节标题" 
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium">描述</label>
                          <Textarea 
                            value={section.description || ''} 
                            onChange={(e) => handleNewCourseSectionChange(idx, 'description', e.target.value)}
                            placeholder="请输入章节描述" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium">排序</label>
                          <Input 
                            type="number"
                            min={1}
                            value={section.order} 
                            onChange={(e) => handleNewCourseSectionChange(idx, 'order', e.target.value)}
                          />
                        </div>
                        
                        {/* 视频选择区域 */}
                        <div>
                          <label className="block text-sm font-medium mb-2">关联视频（可选）</label>
                          {section.video ? (
                            <div className="p-2 border rounded-lg bg-blue-50">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-blue-900 text-sm truncate">{section.video.title}</p>
                                  <p className="text-xs text-blue-700">已选择视频</p>
                                </div>
                                <Button 
                                  type="button" 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => clearNewCourseSectionVideoSelect(idx)}
                                  className="ml-2 text-xs"
                                >
                                  清除
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <select 
                                className="w-full border rounded px-2 py-1 text-sm bg-white"
                                value={section.video_id || ''}
                                onChange={(e) => handleNewCourseSectionVideoSelect(idx, e.target.value)}
                              >
                                <option value="">请选择视频</option>
                                {videoLibrary.map(video => (
                                  <option key={video.id} value={video.id}>
                                    {video.title}
                                  </option>
                                ))}
                              </select>
                              <p className="text-xs text-gray-500">
                                从现有视频库中选择视频，或保持为空
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>取消</Button>
              <Button type="submit" disabled={submitting}>{submitting ? (editMode === 'edit' ? '保存中...' : '提交中...') : (editMode === 'edit' ? '保存' : '提交')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* 章节编辑弹窗 */}
      <Dialog open={sectionDialog.open} onOpenChange={closeSectionDialog}>
        <DialogContent className="sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{sectionDialog.mode === 'add' ? '新增章节' : '编辑章节'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSectionSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">章节标题 *</label>
              <Input name="title" value={sectionForm.title} onChange={handleSectionChange} required maxLength={100} placeholder="请输入章节标题" />
            </div>
            <div>
              <label className="block mb-1 font-medium">章节描述</label>
              <Textarea name="description" value={sectionForm.description || ''} onChange={handleSectionChange} maxLength={500} placeholder="请输入章节描述" />
            </div>
            <div>
              <label className="block mb-1 font-medium">排序（数字越小越靠前）</label>
              <Input name="order" type="number" min={1} value={sectionForm.order} onChange={handleSectionChange} />
            </div>
            
            {/* 视频选择区域 */}
            <div>
              <label className="block mb-2 font-medium">关联视频（可选）</label>
              {sectionForm.video ? (
                <div className="p-3 border rounded-lg bg-blue-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900">{sectionForm.video.title}</p>
                      <p className="text-sm text-blue-700">已选择视频</p>
                    </div>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline"
                      onClick={clearSectionVideoSelect}
                    >
                      清除
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <select 
                    className="w-full border rounded px-3 py-2 bg-white"
                    value={sectionForm.video_id}
                    onChange={(e) => handleSectionVideoSelect(e.target.value)}
                  >
                    <option value="">请选择视频</option>
                    {videoLibrary.map(video => (
                      <option key={video.id} value={video.id}>
                        {video.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500">
                    从现有视频库中选择视频，或保持为空
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeSectionDialog}>取消</Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* 视频上传/选择弹窗 */}
      <Dialog open={videoUploadDialog.open} onOpenChange={closeVideoDialog}>
        <DialogContent className="sm:max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>视频上传/选择</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Tab导航 */}
            <div className="flex border-b">
              <button 
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'upload' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('upload')}
              >
                上传新视频
              </button>
              <button 
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'select' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('select')}
              >
                选择现有视频
              </button>
            </div>
            
            {/* 上传新视频Tab - 使用MinIO上传组件 */}
            {activeTab === 'upload' && (
              <div className="py-4">
                <VideoUploadToMinIO
                  folders={folders}
                  onUploadComplete={handleMinIOUploadComplete}
                  onCancel={closeVideoDialog}
                />
              </div>
            )}
            
            {/* 选择现有视频Tab */}
            {activeTab === 'select' && (
              <div className="space-y-4 py-4">
                <div>
                  <label className="block mb-1 font-medium">筛选文件夹</label>
                  <select 
                    value={selectedBrowseFolderId} 
                    onChange={(e) => setSelectedBrowseFolderId(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">全部视频</option>
                    <option value="default">默认文件夹</option>
                    {folders.filter(f => !f.is_default).map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="h-[400px] overflow-y-auto border rounded bg-white">
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-4">
                      视频库 ({(() => {
                        if (!videoLibrary || videoLibrary.length === 0) return 0;
                        const filteredCount = selectedBrowseFolderId 
                          ? getFilteredVideosByFolder(videoLibrary, selectedBrowseFolderId).length
                          : videoLibrary.length;
                        return selectedBrowseFolderId 
                          ? `${filteredCount}/${videoLibrary.length}` 
                          : filteredCount;
                      })()} 个视频)
                    </h3>
                    
                    {!videoLibrary || videoLibrary.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        暂无视频，请先上传视频
                      </div>
                    ) : (() => {
                      // 根据选择的文件夹筛选视频
                      const filteredVideos = selectedBrowseFolderId 
                        ? getFilteredVideosByFolder(videoLibrary, selectedBrowseFolderId)
                        : videoLibrary;
                      
                      if (filteredVideos.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            {selectedBrowseFolderId ? '该文件夹暂无视频' : '暂无视频'}
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-3">
                          {filteredVideos.map((video) => (
                            <div 
                              key={video.id} 
                              className={`p-3 border rounded cursor-pointer transition-colors ${
                                selectedVideoId === video.id 
                                  ? 'bg-blue-50 border-blue-300' 
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                              onClick={() => setSelectedVideoId(video.id)}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{video.title || '未命名视频'}</h4>
                                  {video.description && (
                                    <p className="text-sm text-gray-600 mt-1">{video.description}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-2">
                                    {video.created_at ? new Date(video.created_at).toLocaleDateString('zh-CN') : ''}
                                  </p>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <button 
                                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVideoDialog({
                                        open: true,
                                        url: video.video_url,
                                        title: video.title
                                      });
                                    }}
                                  >
                                    预览
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    
                    {selectedVideoId && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-green-800 font-medium">
                          ✅ 已选择视频：{videoLibrary?.find(v => v.id === selectedVideoId)?.title || selectedVideoId}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* 只在"选择现有视频"Tab时显示DialogFooter */}
          {activeTab === 'select' && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeVideoDialog}>取消</Button>
              <Button 
                type="button" 
                onClick={applyVideoToSection} 
                disabled={!selectedVideoId}
              >
                应用所选视频
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      
      {/* 视频播放弹窗 */}
      <Dialog open={videoDialog.open} onOpenChange={open => setVideoDialog(v => ({ ...v, open }))}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>{videoDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="w-full aspect-video">
            {videoDialog.url ? (
              <VideoPlayer
                src={videoDialog.url}
                title={videoDialog.title}
                autoPlay={true}
                autoFullscreen={false}
                className="w-full h-full rounded-lg"
              />
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center rounded-lg">
                <span className="text-white">无视频资源</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 章节删除确认对话框 */}
      <AlertDialog 
        open={deleteSectionDialog.open} 
        onOpenChange={(open) => {
          if (!open) setDeleteSectionDialog({ open: false, sectionId: '', title: '' });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除章节"{deleteSectionDialog.title}"吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              handleDeleteSection(deleteSectionDialog.sectionId);
              setDeleteSectionDialog({ open: false, sectionId: '', title: '' });
            }}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CourseManagement; 