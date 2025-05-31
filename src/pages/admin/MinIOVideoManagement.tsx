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
  X,
  Database
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import VideoPlayer from "@/components/VideoPlayer";
import EnhancedPagination from "@/components/ui/enhanced-pagination";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";

// 视频类型
interface MinIOVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  minio_object_name: string;
  created_at: string;
}

// 视图模式
type ViewMode = 'list' | 'grid';

const MinIOVideoManagement = () => {
  const [videos, setVideos] = useState<MinIOVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());
  
  // 对话框状态
  const [uploadDialog, setUploadDialog] = useState(false);
  const [videoDialog, setVideoDialog] = useState<{ open: boolean; url: string; title: string }>({ 
    open: false, url: '', title: '' 
  });
  
  // 表单状态
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const videoUploadRef = useRef<HTMLInputElement>(null);

  // 获取MinIO视频列表
  const fetchMinIOVideos = async () => {
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
        description: error.message || "无法加载MinIO视频列表"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMinIOVideos();
  }, []);

  // 过滤和分页
  const filteredVideos = videos.filter(video => 
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
    setCurrentPage(1);
  };

  // MinIO视频上传
  const handleMinIOVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      
      // 创建FormData
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', videoTitle || file.name);
      formData.append('description', videoDescription || '');
      
      // 调用Edge Function上传到MinIO
      const { data, error } = await supabase.functions.invoke('minio-video-upload', {
        body: formData,
      });
      
      if (error) throw error;
      
      // 清空表单
      setVideoTitle("");
      setVideoDescription("");
      setUploadDialog(false);
      
      if (event.target.files) {
        event.target.value = '';
      }
      
      await fetchMinIOVideos();
      
      toast({
        title: "上传成功",
        description: "视频已成功上传到MinIO服务器"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "上传失败",
        description: error.message || '上传到MinIO失败'
      });
    } finally {
      setUploading(false);
    }
  };

  // 播放MinIO视频
  const handlePlayMinIOVideo = async (objectName: string, title: string) => {
    try {
      // 调用Edge Function获取MinIO视频URL
      const { data, error } = await supabase.functions.invoke('minio-video-stream', {
        body: { objectName },
      });
      
      if (error) throw error;
      
      setVideoDialog({ open: true, url: data.url, title });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "播放失败",
        description: error.message || '无法获取视频播放链接'
      });
    }
  };

  // 删除MinIO视频
  const handleDeleteMinIOVideo = async (videoId: string, objectName: string) => {
    try {
      // 调用Edge Function删除MinIO视频
      const { error: minioError } = await supabase.functions.invoke('minio-video-delete', {
        body: { objectName },
      });
      
      if (minioError) throw minioError;
      
      // 删除数据库记录
      const { error: dbError } = await supabase
        .from("minio_videos")
        .delete()
        .eq("id", videoId);
      
      if (dbError) throw dbError;
      
      await fetchMinIOVideos();
      
      toast({
        title: "删除成功",
        description: "视频已从MinIO服务器删除"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || '删除视频失败'
      });
    }
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
            <TableHead className="hidden lg:table-cell min-w-[120px]">上传时间</TableHead>
            <TableHead className="text-right min-w-[120px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedVideos.map((video, index) => {
            const displayIndex = startIndex + index + 1;
            return (
              <TableRow key={video.id}>
                <TableCell className="text-center font-medium">{displayIndex}</TableCell>
                <TableCell className="font-medium">{video.title}</TableCell>
                <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                  {video.description || '暂无描述'}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {new Date(video.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlayMinIOVideo(video.minio_object_name, video.title)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            此操作将永久删除视频 "{video.title}"，包括MinIO服务器上的文件。此操作无法撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteMinIOVideo(video.id, video.minio_object_name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            删除
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
      {paginatedVideos.map(video => (
        <div key={video.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/20 group">
          <div 
            className="aspect-video bg-black relative cursor-pointer overflow-hidden" 
            onClick={() => handlePlayMinIOVideo(video.minio_object_name, video.title)}
            title="点击播放视频"
          >
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all duration-200">
              <Play className="h-8 w-8 sm:h-12 sm:w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200" />
            </div>
            <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-black/50 text-white text-xs px-1 py-0.5 sm:px-2 sm:py-1 rounded flex items-center gap-1">
              <Database className="h-3 w-3" />
              MinIO
            </div>
          </div>
          <div className="p-3 lg:p-4">
            <h3 className="font-medium text-sm lg:text-base mb-1 lg:mb-2 line-clamp-2">{video.title}</h3>
            <p className="text-xs lg:text-sm text-muted-foreground mb-2 lg:mb-3 line-clamp-2">
              {video.description || '暂无描述'}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(video.created_at).toLocaleDateString()}</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayMinIOVideo(video.minio_object_name, video.title);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <Play className="h-3 w-3" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将永久删除视频 "{video.title}"，包括MinIO服务器上的文件。此操作无法撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDeleteMinIOVideo(video.id, video.minio_object_name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="admin-page-container">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* 标题行 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  MinIO视频管理
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
                  上传到MinIO
                </Button>
              </div>
            </div>
            
            {/* 控制栏 */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              {/* 搜索框 */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索视频..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              
              {/* 右侧控制组 */}
              <div className="flex items-center justify-between sm:justify-end gap-2">
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
                    上传到MinIO
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
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无MinIO视频</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? '没有找到匹配的视频' : '开始上传您的第一个视频到MinIO服务器'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  上传到MinIO
                </Button>
              )}
            </div>
          ) : (
            <>
              {viewMode === 'list' ? renderListView() : renderGridView()}
              
              {totalPages > 1 && (
                <div className="mt-6">
                  <EnhancedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    totalItems={filteredVideos.length}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 上传对话框 */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              上传视频到MinIO
            </DialogTitle>
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
              <Label htmlFor="videoFile">选择视频文件</Label>
              <Input
                id="videoFile"
                type="file"
                accept="video/*"
                onChange={handleMinIOVideoUpload}
                ref={videoUploadRef}
              />
              <p className="text-sm text-muted-foreground mt-1">
                视频将上传到MinIO对象存储服务器
              </p>
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
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {videoDialog.title}
            </DialogTitle>
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
    </div>
  );
};

export default MinIOVideoManagement; 