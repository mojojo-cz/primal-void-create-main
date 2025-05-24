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
  },
  {
    id: 'course-videos',
    name: '课程视频',
    description: '课程相关的教学视频',
    is_default: false,
    color: 'blue'
  },
  {
    id: 'demo-videos',
    name: '演示视频',
    description: '产品演示和介绍视频',
    is_default: false,
    color: 'green'
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

// 视频类型
interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
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
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [uploadedVideoTitle, setUploadedVideoTitle] = useState('');
  const [selectedUploadFolderId, setSelectedUploadFolderId] = useState<string>('course-videos');
  const [videoUploadDescription, setVideoUploadDescription] = useState('');
  const [selectedBrowseFolderId, setSelectedBrowseFolderId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('upload');
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; courseId: string; title: string }>({ open: false, courseId: '', title: '' });
  const [deleteSectionDialog, setDeleteSectionDialog] = useState<{ open: boolean; sectionId: string; title: string }>({ open: false, sectionId: '', title: '' });
  const [previewCoverImage, setPreviewCoverImage] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string | undefined>(undefined);
  
  // 文件夹管理
  const [folders] = useState<VideoFolder[]>(loadFoldersFromStorage());

  // 获取课程及章节和视频信息
  const fetchCourses = async () => {
    setLoading(true);
    // 查询课程
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("id, title, description, cover_image, status, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (courseError || !courseData) {
      setCourses([]);
      setLoading(false);
      return;
    }
    // 查询所有章节及视频
    const { data: sectionData, error: sectionError } = await supabase
      .from("course_sections")
      .select("id, title, description, order, course_id, video_id, videos(id, title, video_url)")
      .order("order", { ascending: true });
    if (sectionError || !sectionData) {
      setCourses(courseData.map(c => ({ ...c, sections: [] })));
      setLoading(false);
      return;
    }
    // 按课程分组章节
    const courseMap: Record<string, SectionWithVideo[]> = {};
    sectionData.forEach((s: any) => {
      if (!s.course_id) return;
      if (!courseMap[s.course_id]) courseMap[s.course_id] = [];
      courseMap[s.course_id].push({
        id: s.id,
        title: s.title,
        description: s.description,
        order: s.order,
        video_id: s.video_id,
        video: s.videos ? {
          id: s.videos.id,
          title: s.videos.title,
          video_url: s.videos.video_url,
        } : null,
      });
    });
    // 合并到课程
    setCourses(courseData.map(c => ({ ...c, sections: courseMap[c.id] || [] })));
    setLoading(false);
  };

  // 获取视频库
  const fetchVideoLibrary = async () => {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, description, video_url, created_at")
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

  // 局部刷新某课程的章节
  const fetchSections = async (courseId: string) => {
    const { data: sectionData, error: sectionError } = await supabase
      .from("course_sections")
      .select("id, title, description, order, course_id, video_id, videos(id, title, video_url)")
      .eq("course_id", courseId)
      .order("order", { ascending: true });
    if (!sectionError && sectionData) {
      setCourses(prev => prev.map(c => c.id === courseId ? {
        ...c,
        sections: sectionData.map((s: any) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          order: s.order,
          video_id: s.video_id,
          video: s.videos ? {
            id: s.videos.id,
            title: s.videos.title,
            video_url: s.videos.video_url,
          } : null,
        }))
      } : c));
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchVideoLibrary();
  }, []);

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

  // 播放视频
  const handlePlayVideo = (url: string, title: string) => {
    setVideoDialog({ open: true, url, title });
  };

  // 打开新增/编辑章节弹窗
  const openSectionDialog = (mode: 'add' | 'edit', courseId: string, section?: SectionWithVideo) => {
    setSectionDialog({ open: true, mode, courseId, section });
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
      // 只刷新当前课程的章节
      fetchSections(sectionDialog.courseId);
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
    setUploadedVideoTitle('');
  };

  // 关闭视频上传/选择弹窗
  const closeVideoDialog = () => {
    setVideoUploadDialog({ open: false, sectionId: '', courseId: '' });
    setSelectedVideoId('');
    setUploadedVideoTitle('');
    setVideoUploadDescription('');
    setSelectedUploadFolderId('course-videos');
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

  // 视频上传
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('video/')) {
      toast({
        variant: "destructive",
        title: "文件类型错误",
        description: "请选择视频文件"
      });
      return;
    }
    
    try {
      setUploadingVideo(true);
      
      // 处理文件名，避免使用中文和特殊字符
      const timestamp = Date.now();
      // 提取文件扩展名
      const fileExtension = file.name.split('.').pop() || '';
      // 创建安全的文件名：时间戳 + 随机字符串 + 扩展名
      const safeFileName = `${timestamp}_${Math.random().toString(36).substring(2, 10)}.${fileExtension}`;
      
      // 1. 上传到 Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos') // 需要先在 Supabase 创建名为 videos 的 bucket
        .upload(safeFileName, file);
      
      if (uploadError) throw new Error('视频上传失败：' + uploadError.message);
      
      // 2. 获取公开URL
      const { data: urlData } = await supabase.storage
        .from('videos')
        .getPublicUrl(safeFileName);
      
      const videoUrl = urlData?.publicUrl;
      
      // 根据选择的文件夹调整描述（用于分类）
      let finalDescription = videoUploadDescription;
      const selectedFolder = folders.find(f => f.id === selectedUploadFolderId);
      if (selectedFolder && !selectedFolder.is_default) {
        // 自定义文件夹：在描述中添加文件夹名称标签
        finalDescription = `${selectedFolder.name} ${finalDescription || uploadedVideoTitle}`.trim();
      } else if (selectedUploadFolderId === 'course-videos' && !finalDescription?.includes('课程')) {
        finalDescription = `课程视频：${finalDescription || uploadedVideoTitle}`;
      } else if (selectedUploadFolderId === 'demo-videos' && !finalDescription?.includes('演示')) {
        finalDescription = `演示视频：${finalDescription || uploadedVideoTitle}`;
      }
      
      // 3. 保存到视频表
      const { data: videoData, error: insertError } = await supabase
        .from('videos')
        .insert([{
          title: uploadedVideoTitle || file.name,
          description: finalDescription || null,
          video_url: videoUrl,
        }])
        .select('id')
        .single();
      
      if (insertError) throw new Error('保存视频信息失败：' + insertError.message);
      
      setSelectedVideoId(videoData.id);
      fetchVideoLibrary(); // 刷新视频库
      
      if (event.target.files) {
        event.target.value = '';
      }
      
      // 清空表单
      setUploadedVideoTitle('');
      setVideoUploadDescription('');
      setSelectedUploadFolderId('course-videos');
      
      toast({
        title: "上传成功",
        description: "视频已成功上传"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "上传失败",
        description: error.message || '上传失败'
      });
    } finally {
      setUploadingVideo(false);
    }
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
      
      // 默认文件夹的智能分类逻辑
      return videos.filter(video => {
        try {
          const content = `${video?.title || ''} ${video?.description || ''}`.toLowerCase();
          switch (folderId) {
            case 'course-videos':
              return content.includes('课程') || content.includes('教学') || content.includes('学习');
            case 'demo-videos':
              return content.includes('演示') || content.includes('展示') || content.includes('介绍');
            case 'default':
              // 默认文件夹：不属于其他分类的视频
              const belongsToOther = folders.some(folder => {
                try {
                  if (folder.is_default && folder.id !== 'default') {
                    if (folder.id === 'course-videos') {
                      return content.includes('课程') || content.includes('教学') || content.includes('学习');
                    }
                    if (folder.id === 'demo-videos') {
                      return content.includes('演示') || content.includes('展示') || content.includes('介绍');
                    }
                  } else if (!folder.is_default) {
                    return content.includes(folder.name.toLowerCase());
                  }
                  return false;
                } catch (error) {
                  console.error('检查文件夹归属时出错:', error, folder);
                  return false;
                }
              });
              return !belongsToOther;
            default:
              return false;
          }
        } catch (error) {
          console.error('过滤视频时出错:', error, video);
          return false;
        }
      });
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
  const addSectionToNewCourse = () => {
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

  // 分页和搜索状态
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // 过滤和分页
  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCourses = filteredCourses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // 分页控制
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        {startPage > 1 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
            >
              1
            </Button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => handlePageChange(page)}
          >
            {page}
          </Button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
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
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className="w-full border rounded-md overflow-hidden"
                            >
                              <table className="w-full text-sm">
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
                                                  onClick={() => handlePlayVideo(section.video!.video_url, section.video!.title)}
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
              {renderPagination()}
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
        <DialogContent className="sm:max-w-md w-full">
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
            
            {/* 上传新视频Tab */}
            {activeTab === 'upload' && (
              <div className="space-y-4 py-4">
                <div>
                  <label className="block mb-1 font-medium">视频标题</label>
                  <Input value={uploadedVideoTitle} onChange={(e) => setUploadedVideoTitle(e.target.value)} placeholder="请输入视频标题（可选）" />
                </div>
                <div>
                  <label className="block mb-1 font-medium">视频描述</label>
                  <Textarea 
                    value={videoUploadDescription} 
                    onChange={(e) => setVideoUploadDescription(e.target.value)} 
                    placeholder="请输入视频描述（可选）" 
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">选择文件夹</label>
                  <Select value={selectedUploadFolderId} onValueChange={setSelectedUploadFolderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择视频分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map(folder => (
                        <SelectItem key={folder.id} value={folder.id}>
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            {folder.name} {folder.is_default && '（系统）'}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">上传视频文件</label>
                  <Input 
                    type="file" 
                    ref={videoUploadRef}
                    accept="video/*" 
                    onChange={handleVideoUpload}
                    disabled={uploadingVideo}
                  />
                  {uploadingVideo && <div className="mt-2 text-sm">上传中，请稍候...</div>}
                </div>
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
                    <option value="course-videos">课程视频</option>
                    <option value="demo-videos">演示视频</option>
                    <option value="default">默认文件夹</option>
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
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeVideoDialog}>取消</Button>
            <Button 
              type="button" 
              onClick={applyVideoToSection} 
              disabled={!selectedVideoId || uploadingVideo}
            >
              应用所选视频
            </Button>
          </DialogFooter>
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