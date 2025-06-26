import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileVideo, X, Check, AlertCircle, Play, Trash2, Folder } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface VideoFolder {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  color?: string;
}

interface VideoBatchUploadToMinIOProps {
  folders: VideoFolder[];
  onUploadComplete: () => void;
  onCancel: () => void;
  defaultFolderId?: string; // 新增：智能默认分类ID
}

interface BatchFile {
  id: string;
  file: File;
  title: string;
  description: string;
  folderId: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  speed: number;
  eta: number;
  error?: string;
  uploadedVideoId?: string;
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

const SUPABASE_URL = 'https://sxsyprzckdnfyhadodhj.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/minio-presigned-upload`;
const MAX_CONCURRENT_UPLOADS = 3; // 最大并发上传数

const VideoBatchUploadToMinIO: React.FC<VideoBatchUploadToMinIOProps> = ({ 
  folders, 
  onUploadComplete, 
  onCancel,
  defaultFolderId: propDefaultFolderId
}) => {
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [defaultFolderId, setDefaultFolderId] = useState(propDefaultFolderId || 'default');
  const [currentlyUploading, setCurrentlyUploading] = useState(0);

  // 监听propDefaultFolderId变化，动态更新默认分类
  useEffect(() => {
    if (propDefaultFolderId) {
      setDefaultFolderId(propDefaultFolderId);
    }
  }, [propDefaultFolderId]);

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

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;

    // 验证文件
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('video/')) {
        toast({
          variant: "destructive",
          title: "文件类型错误",
          description: `${file.name} 不是视频文件`
        });
        return false;
      }

      if (file.size > 50 * 1024 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "文件过大",
          description: `${file.name} 文件大小不能超过50GB`
        });
        return false;
      }

      return true;
    });

    // 添加到批量文件列表
    const newBatchFiles: BatchFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 15),
      file,
      title: file.name.replace(/\.[^/.]+$/, ""), // 去掉扩展名作为标题
      description: '',
      folderId: defaultFolderId,
      status: 'pending',
      progress: 0,
      speed: 0,
      eta: 0
    }));

    setBatchFiles(prev => [...prev, ...newBatchFiles]);
    
    // 清空input
    event.target.value = '';
  };

  // 移除文件
  const removeFile = (fileId: string) => {
    setBatchFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 更新文件信息
  const updateFile = (fileId: string, updates: Partial<BatchFile>) => {
    setBatchFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, ...updates } : f
    ));
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
        expires: 3600,
        generatePlayUrl: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`获取预签名URL失败: ${errorData.error || '未知错误'}`);
    }

    return await response.json();
  };

  // 使用预签名URL上传单个文件
  const uploadSingleFile = async (batchFile: BatchFile): Promise<void> => {
    const startTime = Date.now();

    try {
      // 更新状态为上传中
      updateFile(batchFile.id, { status: 'uploading', progress: 0 });

      // 1. 请求预签名URL
      const uploadResponse = await requestPresignedUrl(
        batchFile.file.name,
        batchFile.file.type || 'application/octet-stream'
      );

      // 2. 上传文件
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const loaded = event.loaded;
            const total = event.total;
            const progress = Math.round((loaded / total) * 100);
            
            const timeElapsed = (Date.now() - startTime) / 1000;
            const speed = timeElapsed > 0 ? loaded / timeElapsed : 0;
            const eta = speed > 0 ? (total - loaded) / speed : 0;

            updateFile(batchFile.id, { progress, speed, eta });
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

        xhr.open('PUT', uploadResponse.uploadUrl);
        xhr.setRequestHeader('Content-Type', batchFile.file.type || 'application/octet-stream');
        xhr.send(batchFile.file);
      });

      // 3. 保存到数据库
      const selectedFolder = folders.find(f => f.id === batchFile.folderId);
      let finalDescription = batchFile.description;
      if (selectedFolder && !selectedFolder.is_default) {
        finalDescription = `${selectedFolder.name} ${batchFile.description || batchFile.title}`.trim();
      }

      const { data: insertData, error: insertError } = await supabase
        .from('minio_videos')
        .insert([{
          title: batchFile.title.trim(),
          description: finalDescription || null,
          video_url: uploadResponse.downloadUrl,
          minio_object_name: uploadResponse.fileName,
          file_size: batchFile.file.size,
          content_type: batchFile.file.type,
          play_url: uploadResponse.playUrl,
          play_url_expires_at: uploadResponse.playUrlExpiresAt ? new Date(uploadResponse.playUrlExpiresAt) : null
        }])
        .select('id')
        .single();

      if (insertError) throw new Error('保存视频信息失败：' + insertError.message);

      // 更新状态为完成
      updateFile(batchFile.id, { 
        status: 'completed', 
        progress: 100,
        uploadedVideoId: insertData?.id 
      });

    } catch (error: any) {
      console.error(`上传 ${batchFile.file.name} 失败:`, error);
      updateFile(batchFile.id, { 
        status: 'error', 
        error: error.message || '上传失败' 
      });
    }
  };

  // 开始批量上传
  const startBatchUpload = async () => {
    if (batchFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "没有文件",
        description: "请先选择要上传的视频文件"
      });
      return;
    }

    // 检查是否有未填写标题的文件
    const missingTitles = batchFiles.filter(f => !f.title.trim());
    if (missingTitles.length > 0) {
      toast({
        variant: "destructive",
        title: "标题不能为空",
        description: `请为所有文件填写标题`
      });
      return;
    }

    setUploading(true);
    setCurrentlyUploading(0);

    const pendingFiles = batchFiles.filter(f => f.status === 'pending');
    let uploadIndex = 0;
    let activeUploads = 0;

    // 检查是否全部完成的函数
    const checkIfAllCompleted = () => {
      // 当所有文件都已启动上传且没有活跃上传时才完成
      if (uploadIndex >= pendingFiles.length && activeUploads === 0) {
        setUploading(false);
        
        // 重新计算统计，因为这时状态应该已经更新
        setBatchFiles(currentFiles => {
          const completed = currentFiles.filter(f => f.status === 'completed').length;
          const failed = currentFiles.filter(f => f.status === 'error').length;
          
          toast({
            title: "批量上传完成",
            description: `成功: ${completed} 个，失败: ${failed} 个`
          });

          if (completed > 0) {
            // 延迟1秒后关闭对话框并刷新，确保用户能看到完成状态
            setTimeout(() => {
              onUploadComplete();
            }, 1000);
          }
          
          return currentFiles;
        });
      }
    };

    // 并发上传控制
    const uploadNext = () => {
      while (uploadIndex < pendingFiles.length && activeUploads < MAX_CONCURRENT_UPLOADS) {
        const fileToUpload = pendingFiles[uploadIndex];
        uploadIndex++;
        activeUploads++;
        setCurrentlyUploading(activeUploads);

        uploadSingleFile(fileToUpload).finally(() => {
          activeUploads--;
          setCurrentlyUploading(activeUploads);
          // 尝试继续上传下一个
          uploadNext();
          // 检查是否全部完成
          checkIfAllCompleted();
        });
      }
    };

    uploadNext();
  };

  // 重试失败的上传
  const retryFailedUploads = () => {
    setBatchFiles(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'pending', progress: 0, error: undefined } : f
    ));
  };

  // 移除已完成和失败的文件
  const clearCompleted = () => {
    setBatchFiles(prev => prev.filter(f => f.status === 'pending' || f.status === 'uploading'));
  };

  // 获取统计信息
  const getStats = () => {
    const pending = batchFiles.filter(f => f.status === 'pending').length;
    const uploading = batchFiles.filter(f => f.status === 'uploading').length;
    const completed = batchFiles.filter(f => f.status === 'completed').length;
    const failed = batchFiles.filter(f => f.status === 'error').length;
    const totalSize = batchFiles.reduce((sum, f) => sum + f.file.size, 0);

    return { pending, uploading, completed, failed, totalSize, total: batchFiles.length };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      {/* 文件选择区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            批量选择视频文件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 默认分类选择 */}
            <div>
              <Label htmlFor="defaultFolder">默认分类</Label>
              <Select value={defaultFolderId} onValueChange={setDefaultFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择默认分类" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name} {folder.is_default && '（默认）'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                新添加的文件将使用此分类，您可以单独修改每个文件的分类
              </p>
            </div>

            {/* 文件选择 */}
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              batchFiles.length > 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
            }`}>
              <FileVideo className={`w-12 h-12 mx-auto mb-4 ${
                batchFiles.length > 0 ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <div className="space-y-2">
                {batchFiles.length === 0 ? (
                  <>
                    <p className="text-lg font-medium text-gray-700">选择多个视频文件</p>
                    <p className="text-sm text-gray-500">支持最大50GB单文件，可选择任意数量文件，同时并发上传{MAX_CONCURRENT_UPLOADS}个</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-blue-700">已选择 {batchFiles.length} 个视频文件</p>
                    <p className="text-sm text-blue-600">总大小: {formatFileSize(stats.totalSize)}</p>
                  </>
                )}
                <Input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="max-w-xs mx-auto"
                />
                {batchFiles.length > 0 && (
                  <p className="text-xs text-gray-500">点击继续添加更多文件</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 文件列表 */}
      {batchFiles.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileVideo className="h-5 w-5" />
                文件列表 ({stats.total})
              </CardTitle>
              <div className="flex items-center gap-2">
                {stats.failed > 0 && (
                  <Button variant="outline" size="sm" onClick={retryFailedUploads}>
                    重试失败
                  </Button>
                )}
                {(stats.completed > 0 || stats.failed > 0) && (
                  <Button variant="outline" size="sm" onClick={clearCompleted}>
                    清除已完成
                  </Button>
                )}
              </div>
            </div>
            
            {/* 统计信息 */}
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">总共 {stats.total} 个</Badge>
              <Badge variant="outline">等待 {stats.pending} 个</Badge>
              <Badge variant="default">上传中 {stats.uploading} 个</Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700">完成 {stats.completed} 个</Badge>
              {stats.failed > 0 && (
                <Badge variant="destructive">失败 {stats.failed} 个</Badge>
              )}
              <Badge variant="outline">总大小 {formatFileSize(stats.totalSize)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {batchFiles.map(batchFile => (
                <div key={batchFile.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {/* 状态图标 */}
                    <div className="flex-shrink-0 mt-1">
                      {batchFile.status === 'pending' && <FileVideo className="h-5 w-5 text-gray-400" />}
                      {batchFile.status === 'uploading' && <Upload className="h-5 w-5 text-blue-500 animate-pulse" />}
                      {batchFile.status === 'completed' && <Check className="h-5 w-5 text-green-500" />}
                      {batchFile.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* 文件信息 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{batchFile.file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(batchFile.file.size)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(batchFile.id)}
                          disabled={uploading && batchFile.status === 'uploading'}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* 编辑字段 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs">标题 *</Label>
                          <Input
                            value={batchFile.title}
                            onChange={(e) => updateFile(batchFile.id, { title: e.target.value })}
                            placeholder="视频标题"
                            disabled={uploading}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">分类</Label>
                          <Select 
                            value={batchFile.folderId} 
                            onValueChange={(value) => updateFile(batchFile.id, { folderId: value })}
                            disabled={uploading}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {folders.map(folder => (
                                <SelectItem key={folder.id} value={folder.id} className="text-sm">
                                  {folder.name} {folder.is_default && '（默认）'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* 进度条和状态 */}
                      {batchFile.status === 'uploading' && (
                        <div className="space-y-1">
                          <Progress value={batchFile.progress} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{batchFile.progress}%</span>
                            <span>{formatSpeed(batchFile.speed)} • 剩余 {formatTime(batchFile.eta)}</span>
                          </div>
                        </div>
                      )}

                      {batchFile.status === 'error' && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertCircle className="h-4 w-4" />
                          <span>{batchFile.error}</span>
                        </div>
                      )}

                      {batchFile.status === 'completed' && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <Check className="h-4 w-4" />
                          <span>上传成功</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel} disabled={uploading}>
          取消
        </Button>
        <div className="flex gap-2">
          {batchFiles.length > 0 && (
            <Button 
              onClick={startBatchUpload}
              disabled={uploading || batchFiles.length === 0 || stats.pending === 0}
              className="min-w-[160px]"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? (
                <span>
                  上传中... {Math.round(((stats.completed + stats.failed) / stats.total) * 100)}%
                  <span className="text-xs ml-1">
                    ({stats.completed + stats.failed}/{stats.total})
                  </span>
                </span>
              ) : (
                `开始批量上传 (${stats.pending})`
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoBatchUploadToMinIO;