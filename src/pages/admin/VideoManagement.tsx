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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Play, Trash2, Upload, Search, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// 视频类型
interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  created_at: string;
}

const VideoManagement = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadDialog, setUploadDialog] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoDialog, setVideoDialog] = useState<{ open: boolean; url: string; title: string }>({ open: false, url: '', title: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; videoId: string; title: string }>({ open: false, videoId: '', title: '' });
  
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
        .from('videos')
        .upload(safeFileName, file);
      
      if (uploadError) throw new Error('视频上传失败：' + uploadError.message);
      
      // 2. 获取公开URL
      const { data: urlData } = await supabase.storage
        .from('videos')
        .getPublicUrl(safeFileName);
      
      const videoUrl = urlData?.publicUrl;
      
      // 3. 保存到视频表
      const { data: videoData, error: insertError } = await supabase
        .from('videos')
        .insert([{
          title: videoTitle || file.name,
          description: videoDescription,
          video_url: videoUrl,
        }])
        .select('id')
        .single();
      
      if (insertError) throw new Error('保存视频信息失败：' + insertError.message);
      
      // 清空表单
      setVideoTitle("");
      setVideoDescription("");
      setUploadDialog(false);
      
      if (event.target.files) {
        event.target.value = '';
      }
      
      // 刷新视频列表
      fetchVideos();
      
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

  // 播放视频
  const handlePlayVideo = (url: string, title: string) => {
    setVideoDialog({ open: true, url, title });
  };

  // 删除视频
  const handleDeleteVideo = async (videoId: string) => {
    try {
      // 1. 检查是否有章节使用该视频
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
      
      // 2. 删除视频记录
      const { error: deleteError } = await supabase
        .from("videos")
        .delete()
        .eq("id", videoId);
      
      if (deleteError) throw deleteError;
      
      // 3. 刷新列表
      fetchVideos();
      
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

  // 过滤视频列表
  const filteredVideos = videos.filter(video => 
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (video.description && video.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">视频管理</h1>
          <p className="text-muted-foreground mt-1">管理视频资源库，上传和删除视频</p>
        </div>
        <Button onClick={() => setUploadDialog(true)}>上传视频</Button>
      </div>
      
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="搜索视频..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {searchTerm && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>视频列表 ({filteredVideos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "没有找到匹配的视频" : "暂无视频，点击右上角上传"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map(video => (
                <div key={video.id} className="border rounded-lg overflow-hidden">
                  <div className="aspect-video bg-black relative cursor-pointer" onClick={() => handlePlayVideo(video.video_url, video.title)}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="h-12 w-12 text-white opacity-80" />
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium truncate">{video.title}</h3>
                    {video.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{video.description}</p>
                    )}
                    <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                      <span>{new Date(video.created_at).toLocaleString('zh-CN')}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4 mr-1" />
                            <span>删除</span>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 上传视频弹窗 */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>上传视频</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block mb-1 font-medium">视频标题</label>
              <Input 
                value={videoTitle} 
                onChange={(e) => setVideoTitle(e.target.value)} 
                placeholder="请输入视频标题" 
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">视频描述</label>
              <Textarea 
                value={videoDescription} 
                onChange={(e) => setVideoDescription(e.target.value)} 
                placeholder="请输入视频描述（可选）" 
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">选择视频文件</label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog(false)} disabled={uploadingVideo}>
              取消
            </Button>
            <Button 
              onClick={() => videoUploadRef.current?.click()} 
              disabled={uploadingVideo}
            >
              <Upload className="h-4 w-4 mr-1" />
              {uploadingVideo ? "上传中..." : "上传视频"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 视频播放弹窗 */}
      <Dialog open={videoDialog.open} onOpenChange={open => setVideoDialog(v => ({ ...v, open }))}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>{videoDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="w-full aspect-video bg-black flex items-center justify-center">
            {videoDialog.url ? (
              <video src={videoDialog.url} controls className="w-full h-full max-h-[60vh] bg-black" autoPlay />
            ) : (
              <span className="text-white">无视频资源</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoManagement; 