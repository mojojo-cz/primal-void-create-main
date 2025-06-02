import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileVideo, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface VideoFolder {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  color?: string;
}

interface VideoUploadToMinIOProps {
  folders: VideoFolder[];
  onUploadComplete: () => void;
  onCancel: () => void;
}

interface UploadResponse {
  success: boolean;
  uploadUrl: string;
  downloadUrl: string;
  playUrl: string | null;
  playUrlExpiresAt: string | null;
  fileName: string;
  originalFileName: string;
  contentType: string;
  expiresIn: number;
  bucket: string;
  metadata: {
    uploadedAt: string;
    size: number | null;
    etag: string | null;
  };
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  eta: number;
}

const SUPABASE_URL = 'https://sxsyprzckdnfyhadodhj.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/minio-presigned-upload`;

const VideoUploadToMinIO: React.FC<VideoUploadToMinIOProps> = ({ folders, onUploadComplete, onCancel }) => {
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('default');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return '--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${remainingSeconds}秒`;
  };

  // 格式化速度
  const formatSpeed = (bytesPerSecond: number): string => {
    if (!isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 请求预签名URL
  const requestPresignedUrl = async (fileName: string, contentType: string): Promise<UploadResponse> => {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs',
        'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs'
      },
      body: JSON.stringify({
        fileName,
        contentType,
        expires: 3600, // 1小时有效期
        generatePlayUrl: true // 新增：生成长效播放URL
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`获取预签名URL失败: ${errorData.error || '未知错误'}`);
    }

    return await response.json();
  };

  // 使用预签名URL上传文件
  const uploadWithPresignedUrl = async (file: File, uploadUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      // 监听上传进度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const total = event.total;
          const percentage = Math.round((loaded / total) * 100);
          
          // 计算上传速度和剩余时间
          const timeElapsed = (Date.now() - startTime) / 1000;
          const speed = timeElapsed > 0 ? loaded / timeElapsed : 0;
          const eta = speed > 0 ? (total - loaded) / speed : 0;

          setProgress({
            loaded,
            total,
            percentage,
            speed,
            eta
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('上传被取消'));
      });

      // 开始上传
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  };

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    // 检查文件大小 (限制50GB)
    if (file.size > 50 * 1024 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "文件过大",
        description: "文件大小不能超过50GB"
      });
      return;
    }

    setSelectedFile(file);
    
    // 如果没有标题，使用文件名
    if (!videoTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setVideoTitle(nameWithoutExt);
    }
  };

  // 处理上传
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "请选择文件",
        description: "请先选择要上传的视频文件"
      });
      return;
    }

    if (!videoTitle.trim()) {
      toast({
        variant: "destructive",
        title: "请输入标题",
        description: "视频标题不能为空"
      });
      return;
    }

    try {
      setUploading(true);
      setProgress(null);

      // 1. 请求预签名URL
      const uploadResponse = await requestPresignedUrl(selectedFile.name, selectedFile.type || 'application/octet-stream');

      // 2. 使用预签名URL上传文件
      await uploadWithPresignedUrl(selectedFile, uploadResponse.uploadUrl);

      // 3. 根据选择的文件夹调整描述（用于分类）
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

      // 4. 保存到minio_videos表（而不是videos表）
      const { error: insertError } = await supabase
        .from('minio_videos')
        .insert([{
          title: videoTitle.trim(),
          description: finalDescription || null,
          video_url: uploadResponse.downloadUrl,
          minio_object_name: uploadResponse.fileName,
          file_size: selectedFile.size,
          content_type: selectedFile.type,
          play_url: uploadResponse.playUrl,
          play_url_expires_at: uploadResponse.playUrlExpiresAt ? new Date(uploadResponse.playUrlExpiresAt) : null
        }]);

      if (insertError) throw new Error('保存视频信息失败：' + insertError.message);

      toast({
        title: "上传成功",
        description: `视频 "${videoTitle}" 已成功上传到MinIO服务器`
      });

      // 清空表单
      setVideoTitle('');
      setVideoDescription('');
      setSelectedFolderId('default');
      setSelectedFile(null);
      setProgress(null);

      // 通知父组件上传完成
      onUploadComplete();

    } catch (error: any) {
      console.error('视频上传失败:', error);
      toast({
        variant: "destructive",
        title: "上传失败",
        description: error.message || '上传视频失败'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 文件选择区域 */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <FileVideo className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-700">选择视频文件</p>
          <p className="text-sm text-gray-500">支持最大50GB视频文件</p>
          <Input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="max-w-xs mx-auto"
          />
        </div>
        
        {selectedFile && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-blue-700">
              <FileVideo className="w-4 h-4" />
              <span className="font-medium">{selectedFile.name}</span>
            </div>
            <p className="text-sm text-blue-600 mt-1">
              大小: {formatFileSize(selectedFile.size)}
            </p>
          </div>
        )}
      </div>

      {/* 表单字段 */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="videoTitle">视频标题 *</Label>
          <Input
            id="videoTitle"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="请输入视频标题"
            disabled={uploading}
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
            disabled={uploading}
          />
        </div>

        <div>
          <Label htmlFor="videoCategory">选择分类</Label>
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId} disabled={uploading}>
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
      </div>

      {/* 上传进度 */}
      {uploading && progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>上传进度: {progress.percentage}%</span>
            <span>{formatSpeed(progress.speed)} • 剩余{formatTime(progress.eta)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* 状态指示 */}
      {uploading && (
        <div className="flex items-center justify-center gap-2 text-blue-600">
          <Clock className="w-4 h-4 animate-spin" />
          <span>正在上传到MinIO服务器...</span>
        </div>
      )}

      {/* 安全提示 */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="text-sm text-green-700">
            <p className="font-medium mb-1">🔒 安全上传特性</p>
            <ul className="space-y-1 text-xs">
              <li>• 使用预签名URL安全上传，前端不暴露MinIO密钥</li>
              <li>• 文件自动重命名和安全验证</li>
              <li>• 临时访问权限，1小时有效期</li>
              <li>• 支持大文件上传（最大50GB）</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || !videoTitle.trim() || uploading}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? '上传中...' : '开始上传'}
        </Button>
        <Button 
          variant="outline" 
          onClick={onCancel}
          disabled={uploading}
        >
          取消
        </Button>
      </div>
    </div>
  );
};

export default VideoUploadToMinIO; 