import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
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
  X,
  Database,
  Shield
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import VideoPlayer from "@/components/VideoPlayer";
import EnhancedPagination from "@/components/ui/enhanced-pagination";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";
import VideoUploadToMinIO from "@/components/VideoUploadToMinIO";

// 视频类型 - 修改为MinIO视频类型
interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  minio_object_name: string;
  created_at: string;
  file_size?: number;
  content_type?: string;
  play_url?: string | null; // 新增：长效播放URL
  play_url_expires_at?: string | null; // 新增：播放URL过期时间
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

// 分页配置 - 现在从用户偏好获取
// const ITEMS_PER_PAGE = 6; // 移除硬编码，改用用户偏好

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
  
  // 分页状态 - 使用用户偏好设置
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());
  
  // 批量选择状态
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [batchDeleteDialog, setBatchDeleteDialog] = useState(false);
  
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
  const [folderForm, setFolderForm] = useState({
    name: "",
    description: "",
    color: "blue"
  });
  const [folderSubmitting, setFolderSubmitting] = useState(false);

  // 获取视频列表
  const fetchVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("minio_videos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      setVideos(data || []);
      setCurrentPage(1);
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
    
    // 默认文件夹：返回所有视频
    return videos;
  };

  // 过滤和分页
  const folderVideos = getFilteredVideosByFolder();
  const filteredVideos = folderVideos.filter(video => 
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (video.description && video.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredVideos.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedVideos = filteredVideos.slice(startIndex, startIndex + pageSize);

  // 处理每页显示数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize);
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  // 批量选择相关函数
  const handleSelectVideo = (videoId: string) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const handleSelectAll = () => {
    if (selectedVideos.length === paginatedVideos.length) {
      setSelectedVideos([]);
    } else {
      setSelectedVideos(paginatedVideos.map(video => video.id));
    }
  };

  const clearSelection = () => {
    setSelectedVideos([]);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedVideos.length === 0) return;

    try {
      // 检查是否有视频被课程使用
      const { data: sections, error: checkError } = await supabase
        .from("course_sections")
        .select("id, title, course_id, video_id")
        .in("video_id", selectedVideos);
      
      if (checkError) throw checkError;
      
      if (sections && sections.length > 0) {
      toast({
        variant: "destructive",
          title: "无法删除",
          description: `选中的视频中有${sections.length}个正在被课程使用，请先移除关联`
      });
      return;
    }
    
      // 获取要删除的视频信息
      const videosToDelete = videos.filter(video => selectedVideos.includes(video.id));
      
      // 批量删除数据库记录
      const { error: dbError } = await supabase
        .from("minio_videos")
        .delete()
        .in("id", selectedVideos);
      
      if (dbError) throw dbError;
      
      // 批量删除MinIO对象
      for (const video of videosToDelete) {
        try {
          await supabase.functions.invoke('minio-video-delete', {
            body: { objectName: video.minio_object_name }
          });
        } catch (error) {
          console.warn(`删除MinIO对象失败: ${video.minio_object_name}`, error);
        }
      }
      
      await fetchVideos();
      clearSelection();
      setBatchDeleteDialog(false);
      
      toast({
        title: "批量删除成功",
        description: `已成功删除${selectedVideos.length}个视频`
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "批量删除失败",
        description: error.message || "批量删除视频失败"
      });
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
      
  // 上传完成处理
  const handleUploadComplete = async (uploadedVideoId?: string) => {
      setUploadDialog(false);
    await fetchVideos();
  };

  // 播放视频 - 适配MinIO视频（优化版）
  const handlePlayVideo = async (video: Video) => {
    // 显示加载提示
    toast({
      title: "🎬 正在加载视频",
      description: `准备播放：${video.title}`,
      duration: 3000
    });
    
    try {
      let playUrl = video.play_url;
      
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
        // 更新数据库中的播放URL
        if (data.expiresAt) {
          await supabase
            .from('minio_videos')
            .update({
              play_url: data.playUrl,
              play_url_expires_at: data.expiresAt
            })
            .eq('id', video.id);
      }
      
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

  // 删除视频 - 适配MinIO视频
  const handleDeleteVideo = async (videoId: string, objectName: string) => {
    try {
      // 检查是否有课程考点使用此视频
      const { data: sections, error: checkError } = await supabase
        .from("course_sections")
        .select("id, title, course_id")
        .eq("video_id", videoId);
      
      if (checkError) throw checkError;
      
      if (sections && sections.length > 0) {
        toast({
          variant: "destructive",
          title: "无法删除",
          description: `该视频正在被${sections.length}个考点使用，请先移除关联`
        });
        return;
      }
      
      // 先从数据库删除记录
      const { error: dbError } = await supabase
        .from("minio_videos")
        .delete()
        .eq("id", videoId);
      
      if (dbError) throw dbError;
      
      // 然后删除MinIO对象
      const { data, error: deleteError } = await supabase.functions.invoke('minio-video-delete', {
        body: { objectName }
      });

      if (deleteError) {
        console.warn('删除MinIO对象失败:', deleteError);
        // 即使MinIO删除失败，数据库记录已删除，继续刷新列表
      }
      
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
    clearSelection(); // 切换页面时清除选择
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // 搜索时重置到第一页
    clearSelection(); // 搜索时清除选择
  };

  // 渲染列表视图
  const renderListView = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] text-center">
              <input
                type="checkbox"
                checked={selectedVideos.length === paginatedVideos.length && paginatedVideos.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4"
                title="全选/取消全选"
              />
            </TableHead>
            <TableHead className="w-[50px] text-center">#</TableHead>
            <TableHead className="min-w-[200px]">标题</TableHead>
            <TableHead className="hidden md:table-cell min-w-[150px]">描述</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[100px]">文件大小</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[120px]">所属分类</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[120px]">上传时间</TableHead>
            <TableHead className="text-right min-w-[120px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedVideos.map((video, index) => {
            const displayIndex = startIndex + index + 1;
            const isSelected = selectedVideos.includes(video.id);
            
            return (
              <TableRow key={video.id} className={`hover:bg-muted/30 ${isSelected ? 'bg-blue-50' : ''}`}>
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectVideo(video.id)}
                    className="h-4 w-4"
                  />
                </TableCell>
                <TableCell className="font-medium text-center text-muted-foreground">
                  {displayIndex}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-16 h-12 bg-black rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all duration-200 hover:scale-105 flex-shrink-0"
                      onClick={() => handlePlayVideo(video)}
                      title="点击播放视频"
                    >
                      <Play className="h-6 w-6 text-white opacity-80 hover:opacity-100" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate pr-2 flex items-center gap-2">
                        <Database className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        {video.title}
                        {video.file_size && video.file_size > 50 * 1024 * 1024 && (
                          <span className="text-xs bg-green-100 text-green-600 px-1 rounded" title="大文件">
                            <Shield className="h-3 w-3" />
                          </span>
                        )}
                      </div>
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
                  {video.file_size ? (
                    <div className="flex items-center gap-1 text-sm">
                      <span>{formatFileSize(video.file_size)}</span>
                      {video.file_size > 50 * 1024 * 1024 && (
                        <span className="text-xs bg-green-100 text-green-600 px-1 rounded" title="大文件">
                          大
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
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
                      onClick={() => handlePlayVideo(video)}
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
                          <AlertDialogAction onClick={() => handleDeleteVideo(video.id, video.minio_object_name)}>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
      {paginatedVideos.map(video => {
        const content = `${video.title} ${video.description || ''}`.toLowerCase();
        
        // 检查是否属于自定义文件夹
        const customFolder = folders.find(f => !f.is_default && content.includes(f.name.toLowerCase()));
        const category = customFolder ? customFolder.name : '默认分类';
        const isSelected = selectedVideos.includes(video.id);
        
        return (
          <div key={video.id} className={`border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/20 group ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''} relative`}>
            {/* 复选框 */}
            <div className="absolute top-2 left-2 z-10">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleSelectVideo(video.id)}
                className="h-4 w-4 rounded border-2 border-white shadow-lg bg-white"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div 
              className="aspect-video bg-black relative cursor-pointer overflow-hidden" 
              onClick={() => handlePlayVideo(video)}
              title="点击播放视频"
            >
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all duration-200">
                <Play className="h-8 w-8 sm:h-12 sm:w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200" />
              </div>
              <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-black/50 text-white text-xs px-1 py-0.5 sm:px-2 sm:py-1 rounded flex items-center gap-1">
                <Database className="h-3 w-3" />
                MinIO
              </div>
              <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-primary/80 text-white text-xs px-1 py-0.5 sm:px-2 sm:py-1 rounded flex items-center gap-1 max-w-[60%]">
                <Folder className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{category}</span>
              </div>
            </div>
            <div className="p-3 lg:p-4">
              <h3 className="font-medium truncate mb-2 group-hover:text-primary transition-colors text-sm lg:text-base" title={video.title}>
                {video.title}
              </h3>
              <div className="min-h-[2rem] lg:min-h-[2.5rem] mb-3">
                {video.description ? (
                  <p className="text-xs lg:text-sm text-muted-foreground line-clamp-2">{video.description}</p>
                ) : (
                  <p className="text-xs lg:text-sm text-muted-foreground italic">无描述</p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{new Date(video.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
                <span className="flex-shrink-0 hidden sm:block">{new Date(video.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handlePlayVideo(video)}
                  className="flex-1 hover:bg-primary hover:text-primary-foreground text-xs lg:text-sm h-8 lg:h-9"
                >
                  <Play className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                  播放
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 h-8 lg:h-9 w-8 lg:w-9 p-0"
                      title="删除视频"
                    >
                      <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
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
                      <AlertDialogAction onClick={() => handleDeleteVideo(video.id, video.minio_object_name)}>
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
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* 左侧文件夹列表 */}
        <div className="lg:w-64 flex-shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base lg:text-lg">视频分类</CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => openFolderDialog('add')}
                  className="h-8 w-8 p-0"
                  title="添加分类"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* 全部视频 */}
              <div
                className={`flex items-center gap-2 p-2 lg:p-3 rounded-lg cursor-pointer transition-colors ${
                  !currentFolder ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
                onClick={() => {
                  setCurrentFolder(null);
                  setCurrentPage(1);
                }}
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium flex-1 min-w-0 truncate">全部视频</span>
                <span className="text-sm flex-shrink-0">({videos.length})</span>
              </div>
              
              {/* 文件夹列表 */}
              {folders.map(folder => {
                const isSelected = currentFolder === folder.id;
                
                // 计算文件夹中的视频数量
                let folderVideoCount = 0;
                if (folder.is_default) {
                  if (folder.id === 'default') {
                    folderVideoCount = videos.length;
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
                    className={`group flex items-center gap-2 p-2 lg:p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 flex-1 min-w-0"
                      onClick={() => {
                        setCurrentFolder(folder.id);
                        setCurrentPage(1);
                      }}
                    >
                      <Folder className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-sm lg:text-base">{folder.name}</span>
                      <span className="text-sm flex-shrink-0">({folderVideoCount})</span>
                    </div>
                    
                    {/* 文件夹操作按钮 */}
                    {!folder.is_default && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 lg:h-7 lg:w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFolderDialog('edit', folder);
                          }}
                          title="编辑分类"
                        >
                          <Edit className="h-3 w-3 lg:h-4 lg:w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 lg:h-7 lg:w-7 text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                              title="删除分类"
                            >
                              <X className="h-3 w-3 lg:h-4 lg:w-4" />
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
              <div className="flex flex-col gap-4">
                {/* 标题行 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {currentFolder ? <Folder className="h-5 w-5" /> : <FolderOpen className="h-5 w-5" />}
                      {getCurrentFolderName()}
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                        MinIO安全上传
                      </span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      共 {filteredVideos.length} 个视频
                      {totalPages > 1 && ` • 第 ${currentPage} / ${totalPages} 页`}
                    </p>
                  </div>
                  
                  {/* 移动端上传按钮 */}
                  <div className="sm:hidden">
                    <Button 
                      onClick={() => setUploadDialog(true)}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      课程视频上传
                    </Button>
                  </div>
                </div>
                
                {/* 批量操作工具栏 */}
                {selectedVideos.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-700">
                        已选择 {selectedVideos.length} 个视频
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="text-blue-600 hover:text-blue-800 h-6 px-2"
                      >
                        取消选择
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setBatchDeleteDialog(true)}
                        className="h-8"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        批量删除
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* 控制栏 */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                  {/* 搜索框 */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索视频..."
                      value={searchTerm}
                      onChange={(e) => {
                        handleSearch(e.target.value);
                      }}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* 右侧控制组 */}
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    {/* 全选按钮 */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-8"
                      title={selectedVideos.length === paginatedVideos.length ? "取消全选" : "全选当前页"}
                    >
                      {selectedVideos.length === paginatedVideos.length && paginatedVideos.length > 0 ? '取消全选' : '全选'}
                    </Button>
                    
                    {/* 视图切换按钮 */}
                    <div className="flex border rounded-lg p-1">
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="h-8 w-8 p-0"
                        title="列表视图"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="h-8 w-8 p-0"
                        title="网格视图"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* 桌面端上传按钮 */}
                    <div className="hidden sm:block">
                      <Button onClick={() => setUploadDialog(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        课程视频上传
                      </Button>
                    </div>
                  </div>
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
                      课程视频上传
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {viewMode === 'list' ? renderListView() : renderGridView()}
                  <EnhancedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredVideos.length}
                    pageSize={pageSize}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    className="mt-6"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 上传视频对话框 */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
              上传视频到MinIO
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                预签名URL
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto">
            <VideoUploadToMinIO
              folders={folders}
              onUploadComplete={handleUploadComplete}
              onCancel={() => setUploadDialog(false)}
              />
            </div>
        </DialogContent>
      </Dialog>

      {/* 视频播放对话框 */}
      <Dialog open={videoDialog.open} onOpenChange={(open) => setVideoDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl p-0 bg-black border-0 overflow-hidden [&>button]:!hidden [&_button[type='button']]:!hidden">
          <div className="aspect-video bg-black">
            <VideoPlayer
              src={videoDialog.url}
              title={videoDialog.title}
              autoPlay={true}
              autoFullscreen={false}
              className="w-full h-full"
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

      {/* 批量删除确认对话框 */}
      <AlertDialog open={batchDeleteDialog} onOpenChange={setBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除视频</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedVideos.length} 个视频吗？此操作不可撤销。
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                系统会自动检查视频是否被课程使用，被使用的视频将无法删除。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VideoManagement; 