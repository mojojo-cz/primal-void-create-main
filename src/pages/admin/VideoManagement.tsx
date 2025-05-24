import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Play, 
  Trash2, 
  Upload, 
  Search, 
  Grid3X3, 
  List, 
  Calendar,
  Folder,
  FolderOpen,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit,
  X
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import VideoPlayer from "@/components/VideoPlayer";

// 视频类型
interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  created_at: string;
}

// 文件夹类型
interface VideoFolder {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  color?: string;
}

// 视图类型
type ViewMode = 'list' | 'grid';

// 分页配置
const ITEMS_PER_PAGE = 6; // 减少每页项目数，更容易看到分页效果

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

// 保存文件夹
const saveFoldersToStorage = (folders: VideoFolder[]) => {
  try {
    // 只保存非默认文件夹
    const customFolders = folders.filter(f => !f.is_default);
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(customFolders));
  } catch (error) {
    console.error('保存文件夹失败:', error);
  }
};

const VideoManagement = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [folders, setFolders] = useState<VideoFolder[]>(loadFoldersFromStorage());
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  
  // 对话框状态
  const [uploadDialog, setUploadDialog] = useState(false);
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; folder?: VideoFolder }>({ 
    open: false, 
    mode: 'add', 
    folder: undefined 
  });
  const [videoDialog, setVideoDialog] = useState<{ open: boolean; url: string; title: string }>({ 
    open: false, url: '', title: '' 
  });
  
  // 表单状态
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("default");
  const [folderForm, setFolderForm] = useState({
    name: "",
    description: "",
    color: "blue"
  });
  const [uploading, setUploading] = useState(false);
  const [folderSubmitting, setFolderSubmitting] = useState(false);
  
  const videoUploadRef = useRef<HTMLInputElement>(null);

  // 获取视频列表
  const fetchVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      setVideos(data || []);
      setCurrentPage(1); // 重置到第一页
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载视频列表"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // 根据当前文件夹过滤视频
  const getFilteredVideosByFolder = () => {
    if (!currentFolder) return videos;
    
    // 如果是自定义文件夹，使用标签匹配
    const customFolder = folders.find(f => f.id === currentFolder && !f.is_default);
    if (customFolder) {
      return videos.filter(video => {
        const content = `${video.title} ${video.description || ''}`.toLowerCase();
        return content.includes(customFolder.name.toLowerCase());
      });
    }
    
    // 默认文件夹的智能分类逻辑
    return videos.filter(video => {
      const content = `${video.title} ${video.description || ''}`.toLowerCase();
      switch (currentFolder) {
        case 'course-videos':
          return content.includes('课程') || content.includes('教学') || content.includes('学习');
        case 'demo-videos':
          return content.includes('演示') || content.includes('展示') || content.includes('介绍');
        case 'default':
        default:
          // 默认文件夹：不属于其他分类的视频
          const belongsToOther = folders.some(folder => {
            if (folder.is_default && folder.id !== 'default') {
              // 检查是否属于其他默认分类
              if (folder.id === 'course-videos') {
                return content.includes('课程') || content.includes('教学') || content.includes('学习');
              }
              if (folder.id === 'demo-videos') {
                return content.includes('演示') || content.includes('展示') || content.includes('介绍');
              }
            } else if (!folder.is_default) {
              // 检查是否属于自定义文件夹
              return content.includes(folder.name.toLowerCase());
            }
            return false;
          });
          return !belongsToOther;
      }
    });
  };

  // 过滤和分页
  const folderVideos = getFilteredVideosByFolder();
  const filteredVideos = folderVideos.filter(video => 
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (video.description && video.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedVideos = filteredVideos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // 视频上传
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      toast({
        variant: "destructive",
        title: "文件类型错误",
        description: "请选择视频文件"
      });
      return;
    }
    
    try {
      setUploading(true);
      
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || '';
      const safeFileName = `${timestamp}_${Math.random().toString(36).substring(2, 10)}.${fileExtension}`;
      
      // 上传到 Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(safeFileName, file);
      
      if (uploadError) throw new Error('视频上传失败：' + uploadError.message);
      
      // 获取公开URL
      const { data: urlData } = await supabase.storage
        .from('videos')
        .getPublicUrl(safeFileName);
      
      const videoUrl = urlData?.publicUrl;

      // 根据选择的文件夹调整描述（用于分类）
      let finalDescription = videoDescription;
      const selectedFolder = folders.find(f => f.id === selectedFolderId);
      if (selectedFolder && !selectedFolder.is_default) {
        // 自定义文件夹：在描述中添加文件夹名称标签
        finalDescription = `${selectedFolder.name} ${finalDescription || videoTitle}`.trim();
      } else if (selectedFolderId === 'course-videos' && !finalDescription?.includes('课程')) {
        finalDescription = `课程视频：${finalDescription || videoTitle}`;
      } else if (selectedFolderId === 'demo-videos' && !finalDescription?.includes('演示')) {
        finalDescription = `演示视频：${finalDescription || videoTitle}`;
      }
      
      // 保存到视频表
      const { error: insertError } = await supabase
        .from('videos')
        .insert([{
          title: videoTitle || file.name,
          description: finalDescription || null,
          video_url: videoUrl,
        }]);
      
      if (insertError) throw new Error('保存视频信息失败：' + insertError.message);
      
      // 清空表单
      setVideoTitle("");
      setVideoDescription("");
      setSelectedFolderId("default");
      setUploadDialog(false);
      
      if (event.target.files) {
        event.target.value = '';
      }
      
      await fetchVideos();
      
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
      setUploading(false);
    }
  };

  // 播放视频
  const handlePlayVideo = (url: string, title: string) => {
    setVideoDialog({ open: true, url, title });
  };

  // 删除视频
  const handleDeleteVideo = async (videoId: string) => {
    try {
      const { data: sections, error: checkError } = await supabase
        .from("course_sections")
        .select("id, title, course_id")
        .eq("video_id", videoId);
      
      if (checkError) throw checkError;
      
      if (sections && sections.length > 0) {
        toast({
          variant: "destructive",
          title: "无法删除",
          description: `该视频正在被${sections.length}个章节使用，请先移除关联`
        });
        return;
      }
      
      const { error: deleteError } = await supabase
        .from("videos")
        .delete()
        .eq("id", videoId);
      
      if (deleteError) throw deleteError;
      
      await fetchVideos();
      
      toast({
        title: "删除成功",
        description: "视频已成功删除"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "删除视频失败"
      });
    }
  };

  // 文件夹管理
  const openFolderDialog = (mode: 'add' | 'edit', folder?: VideoFolder) => {
    setFolderDialog({ open: true, mode, folder });
    if (mode === 'edit' && folder) {
      setFolderForm({
        name: folder.name,
        description: folder.description || "",
        color: folder.color || "blue"
      });
    } else {
      setFolderForm({
        name: "",
        description: "",
        color: "blue"
      });
    }
  };

  const closeFolderDialog = () => {
    setFolderDialog({ open: false, mode: 'add', folder: undefined });
    setFolderForm({ name: "", description: "", color: "blue" });
  };

  const handleFolderSubmit = async () => {
    if (!folderForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "文件夹名称不能为空"
      });
      return;
    }

    setFolderSubmitting(true);
    
    try {
      if (folderDialog.mode === 'add') {
        // 添加新文件夹
        const newFolder: VideoFolder = {
          id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: folderForm.name.trim(),
          description: folderForm.description.trim() || null,
          is_default: false,
          color: folderForm.color
        };
        
        const updatedFolders = [...folders, newFolder];
        setFolders(updatedFolders);
        saveFoldersToStorage(updatedFolders);
        
        toast({
          title: "创建成功",
          description: `文件夹"${newFolder.name}"已创建`
        });
      } else if (folderDialog.mode === 'edit' && folderDialog.folder) {
        // 编辑文件夹
        const updatedFolders = folders.map(f => 
          f.id === folderDialog.folder!.id 
            ? { 
                ...f, 
                name: folderForm.name.trim(),
                description: folderForm.description.trim() || null,
                color: folderForm.color
              }
            : f
        );
        setFolders(updatedFolders);
        saveFoldersToStorage(updatedFolders);
        
        toast({
          title: "更新成功",
          description: `文件夹"${folderForm.name}"已更新`
        });
      }
      
      closeFolderDialog();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: error.message || "操作失败"
      });
    } finally {
      setFolderSubmitting(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    if (folder.is_default) {
      toast({
        variant: "destructive",
        title: "无法删除",
        description: "系统默认文件夹不能删除"
      });
      return;
    }
    
    try {
      const updatedFolders = folders.filter(f => f.id !== folderId);
      setFolders(updatedFolders);
      saveFoldersToStorage(updatedFolders);
      
      // 如果当前选中的是被删除的文件夹，切换到全部视频
      if (currentFolder === folderId) {
        setCurrentFolder(null);
        setCurrentPage(1);
      }
      
      toast({
        title: "删除成功",
        description: `文件夹"${folder.name}"已删除`
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "删除文件夹失败"
      });
    }
  };

  // 分页控制
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    // 降低显示分页的门槛，当有超过3个项目时就显示分页
    if (filteredVideos.length <= ITEMS_PER_PAGE) return null;

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
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
              {startPage > 2 && <span className="px-2 text-muted-foreground">...</span>}
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
              {endPage < totalPages - 1 && <span className="px-2 text-muted-foreground">...</span>}
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
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground ml-4">
          显示第 {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredVideos.length)} 项，共 {filteredVideos.length} 项
        </div>
      </div>
    );
  };

  // 渲染列表视图
  const renderListView = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] text-center">#</TableHead>
            <TableHead className="min-w-[200px]">标题</TableHead>
            <TableHead className="hidden md:table-cell min-w-[150px]">描述</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[120px]">所属分类</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[120px]">上传时间</TableHead>
            <TableHead className="text-right min-w-[120px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedVideos.map((video, index) => {
            const displayIndex = startIndex + index + 1;
            
            return (
              <TableRow key={video.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-center text-muted-foreground">
                  {displayIndex}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-16 h-12 bg-black rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all duration-200 hover:scale-105 flex-shrink-0"
                      onClick={() => handlePlayVideo(video.video_url, video.title)}
                      title="点击播放视频"
                    >
                      <Play className="h-6 w-6 text-white opacity-80 hover:opacity-100" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate pr-2">{video.title}</div>
                      <div className="text-sm text-muted-foreground lg:hidden mt-1">
                        {video.description ? (
                          <span className="line-clamp-1">{video.description}</span>
                        ) : (
                          <span className="italic">无描述</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground md:hidden mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(video.created_at).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="max-w-xs">
                    {video.description ? (
                      <span className="line-clamp-2 text-sm">{video.description}</span>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">无描述</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {(() => {
                        const content = `${video.title} ${video.description || ''}`.toLowerCase();
                        
                        // 检查是否属于自定义文件夹
                        const customFolder = folders.find(f => !f.is_default && content.includes(f.name.toLowerCase()));
                        if (customFolder) return customFolder.name;
                        
                        // 检查默认分类
                        if (content.includes('课程') || content.includes('教学') || content.includes('学习')) return '课程视频';
                        if (content.includes('演示') || content.includes('展示') || content.includes('介绍')) return '演示视频';
                        
                        return '默认分类';
                      })()}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span>{new Date(video.created_at).toLocaleDateString('zh-CN')}</span>
                      <span className="text-xs">{new Date(video.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handlePlayVideo(video.video_url, video.title)}
                      className="hover:bg-primary/10"
                      title="播放视频"
                    >
                      <Play className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">播放</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="删除视频"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline ml-1">删除</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除视频"{video.title}"吗？此操作不可撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteVideo(video.id)}>
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  // 渲染网格视图
  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {paginatedVideos.map(video => {
        const content = `${video.title} ${video.description || ''}`.toLowerCase();
        
        // 检查是否属于自定义文件夹
        const customFolder = folders.find(f => !f.is_default && content.includes(f.name.toLowerCase()));
        const category = customFolder ? customFolder.name :
                        (content.includes('课程') || content.includes('教学') || content.includes('学习')) ? '课程视频' :
                        (content.includes('演示') || content.includes('展示') || content.includes('介绍')) ? '演示视频' : '默认分类';
        
        return (
          <div key={video.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/20 group">
            <div 
              className="aspect-video bg-black relative cursor-pointer overflow-hidden" 
              onClick={() => handlePlayVideo(video.video_url, video.title)}
              title="点击播放视频"
            >
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all duration-200">
                <Play className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200" />
              </div>
              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                视频
              </div>
              <div className="absolute top-2 right-2 bg-primary/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Folder className="h-3 w-3" />
                {category}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-medium truncate mb-2 group-hover:text-primary transition-colors" title={video.title}>
                {video.title}
              </h3>
              <div className="min-h-[2.5rem] mb-3">
                {video.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">{video.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">无描述</p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(video.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
                <span>{new Date(video.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handlePlayVideo(video.video_url, video.title)}
                  className="flex-1 mr-2 hover:bg-primary hover:text-primary-foreground"
                >
                  <Play className="h-4 w-4 mr-1" />
                  播放
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                      title="删除视频"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除视频"{video.title}"吗？此操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteVideo(video.id)}>
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const getCurrentFolderName = () => {
    if (!currentFolder) return "全部视频";
    const folder = folders.find(f => f.id === currentFolder);
    return folder?.name || "未知文件夹";
  };

  return (
    <div className="admin-page-container">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左侧文件夹列表 */}
        <div className="lg:w-64 flex-shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">视频分类</CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => openFolderDialog('add')}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div
                className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                  !currentFolder ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
                onClick={() => {
                  setCurrentFolder(null);
                  setCurrentPage(1);
                }}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="font-medium">全部视频</span>
                <span className="ml-auto text-sm">({videos.length})</span>
              </div>
              
              {folders.map(folder => {
                const isSelected = currentFolder === folder.id;
                
                // 计算文件夹中的视频数量
                let folderVideoCount = 0;
                if (folder.is_default) {
                  switch (folder.id) {
                    case 'course-videos':
                      folderVideoCount = videos.filter(v => {
                        const content = `${v.title} ${v.description || ''}`.toLowerCase();
                        return content.includes('课程') || content.includes('教学') || content.includes('学习');
                      }).length;
                      break;
                    case 'demo-videos':
                      folderVideoCount = videos.filter(v => {
                        const content = `${v.title} ${v.description || ''}`.toLowerCase();
                        return content.includes('演示') || content.includes('展示') || content.includes('介绍');
                      }).length;
                      break;
                    case 'default':
                      folderVideoCount = videos.filter(v => {
                        const content = `${v.title} ${v.description || ''}`.toLowerCase();
                        const belongsToOther = folders.some(f => {
                          if (f.is_default && f.id !== 'default') {
                            if (f.id === 'course-videos') {
                              return content.includes('课程') || content.includes('教学') || content.includes('学习');
                            }
                            if (f.id === 'demo-videos') {
                              return content.includes('演示') || content.includes('展示') || content.includes('介绍');
                            }
                          } else if (!f.is_default) {
                            return content.includes(f.name.toLowerCase());
                          }
                          return false;
                        });
                        return !belongsToOther;
                      }).length;
                      break;
                    default:
                      folderVideoCount = 0;
                  }
                } else {
                  // 自定义文件夹
                  folderVideoCount = videos.filter(v => {
                    const content = `${v.title} ${v.description || ''}`.toLowerCase();
                    return content.includes(folder.name.toLowerCase());
                  }).length;
                }
                
                return (
                  <div
                    key={folder.id}
                    className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 flex-1"
                      onClick={() => {
                        setCurrentFolder(folder.id);
                        setCurrentPage(1);
                      }}
                    >
                      <Folder className="h-4 w-4" />
                      <span className="flex-1 truncate">{folder.name}</span>
                      <span className="text-sm">({folderVideoCount})</span>
                    </div>
                    
                    {/* 文件夹操作按钮 */}
                    {!folder.is_default && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFolderDialog('edit', folder);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>
                                确定要删除文件夹"{folder.name}"吗？此操作不可撤销。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteFolder(folder.id)}>
                                确认删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* 右侧视频列表 */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {currentFolder ? <Folder className="h-5 w-5" /> : <FolderOpen className="h-5 w-5" />}
                    {getCurrentFolderName()}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    共 {filteredVideos.length} 个视频
                    {totalPages > 1 && ` • 第 ${currentPage} / ${totalPages} 页`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索视频..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1); // 搜索时重置到第一页
                      }}
                      className="pl-10 w-64"
                    />
                  </div>
                  <div className="flex border rounded-lg p-1">
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-8 w-8 p-0"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="h-8 w-8 p-0"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={() => setUploadDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    上传视频
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">加载中...</p>
                  </div>
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="text-center py-12">
                  <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {searchTerm ? '没有找到匹配的视频' : '暂无视频'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? '尝试使用不同的关键词搜索' : '点击上传按钮添加第一个视频'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setUploadDialog(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      上传视频
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {viewMode === 'list' ? renderListView() : renderGridView()}
                  {renderPagination()}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 上传视频对话框 */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上传视频</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="videoTitle">视频标题</Label>
              <Input
                id="videoTitle"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="请输入视频标题"
              />
            </div>
            <div>
              <Label htmlFor="videoDescription">视频描述</Label>
              <Textarea
                id="videoDescription"
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="请输入视频描述"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="videoCategory">选择分类</Label>
              <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择视频分类" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name} {folder.is_default && '（默认）'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="videoFile">选择视频文件</Label>
              <Input
                id="videoFile"
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                ref={videoUploadRef}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog(false)} disabled={uploading}>
              取消
            </Button>
            <Button onClick={() => videoUploadRef.current?.click()} disabled={uploading}>
              {uploading ? '上传中...' : '选择文件'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 视频播放对话框 */}
      <Dialog open={videoDialog.open} onOpenChange={(open) => setVideoDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl">
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
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 文件夹管理对话框 */}
      <Dialog open={folderDialog.open} onOpenChange={closeFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderDialog.mode === 'add' ? '添加文件夹' : '编辑文件夹'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">文件夹名称</Label>
              <Input
                id="folderName"
                value={folderForm.name}
                onChange={(e) => setFolderForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入文件夹名称"
              />
            </div>
            <div>
              <Label htmlFor="folderDescription">文件夹描述</Label>
              <Textarea
                id="folderDescription"
                value={folderForm.description}
                onChange={(e) => setFolderForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="请输入文件夹描述"
                rows={3}
              />
            </div>
                         <div>
               <Label htmlFor="folderColor">文件夹颜色</Label>
               <Select value={folderForm.color} onValueChange={(value) => setFolderForm(prev => ({ ...prev, color: value }))}>
                 <SelectTrigger>
                   <SelectValue placeholder="选择文件夹颜色" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="blue">蓝色</SelectItem>
                   <SelectItem value="green">绿色</SelectItem>
                   <SelectItem value="purple">紫色</SelectItem>
                   <SelectItem value="orange">橙色</SelectItem>
                   <SelectItem value="red">红色</SelectItem>
                   <SelectItem value="gray">灰色</SelectItem>
                 </SelectContent>
               </Select>
             </div>
          </div>
                     <DialogFooter>
             <Button variant="outline" onClick={closeFolderDialog} disabled={folderSubmitting}>
               取消
             </Button>
             <Button onClick={handleFolderSubmit} disabled={folderSubmitting}>
               {folderSubmitting ? '处理中...' : (folderDialog.mode === 'add' ? '创建' : '更新')}
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoManagement; 