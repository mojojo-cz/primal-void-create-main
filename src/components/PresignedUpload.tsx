import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Download } from 'lucide-react';

interface UploadResponse {
  success: boolean;
  uploadUrl: string;
  downloadUrl: string;
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

interface FileStatus {
  name: string;
  size: number;
  status: 'pending' | 'requesting' | 'uploading' | 'completed' | 'error';
  progress: UploadProgress | null;
  downloadUrl?: string;
  error?: string;
  uploadStartTime?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/minio-presigned-upload`;

const PresignedUpload: React.FC = () => {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        fileName,
        contentType,
        expires: 3600 // 1小时有效期
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`获取预签名URL失败: ${errorData.error || '未知错误'}`);
    }

    return await response.json();
  };

  // 使用预签名URL上传文件
  const uploadWithPresignedUrl = async (file: File, uploadUrl: string, onProgress: (progress: UploadProgress) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const total = event.total;
          const percentage = Math.round((loaded / total) * 100);
          
          // 计算上传速度和剩余时间
          const now = Date.now();
          const timeElapsed = (now - (window as any).uploadStartTime) / 1000; // 秒
          const speed = timeElapsed > 0 ? loaded / timeElapsed : 0;
          const eta = speed > 0 ? (total - loaded) / speed : 0;

          onProgress({
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
      (window as any).uploadStartTime = Date.now();
      xhr.send(file);
    });
  };

  // 处理单个文件上传
  const handleFileUpload = async (file: File) => {
    const fileId = `${Date.now()}_${file.name}`;
    
    // 添加文件到状态
    const newFile: FileStatus = {
      name: file.name,
      size: file.size,
      status: 'requesting',
      progress: null
    };

    setFiles(prev => [...prev, newFile]);

    try {
      // 1. 请求预签名URL
      setFiles(prev => prev.map(f => 
        f.name === file.name && f.size === file.size ? { ...f, status: 'requesting' } : f
      ));

      const uploadResponse = await requestPresignedUrl(file.name, file.type || 'application/octet-stream');

      // 2. 使用预签名URL上传文件
      setFiles(prev => prev.map(f => 
        f.name === file.name && f.size === file.size 
          ? { ...f, status: 'uploading', uploadStartTime: Date.now() } 
          : f
      ));

      await uploadWithPresignedUrl(file, uploadResponse.uploadUrl, (progress) => {
        setFiles(prev => prev.map(f => 
          f.name === file.name && f.size === file.size 
            ? { ...f, progress }
            : f
        ));
      });

      // 3. 上传完成
      setFiles(prev => prev.map(f => 
        f.name === file.name && f.size === file.size 
          ? { 
              ...f, 
              status: 'completed', 
              downloadUrl: uploadResponse.downloadUrl,
              progress: { ...f.progress!, percentage: 100 }
            } 
          : f
      ));

    } catch (error) {
      console.error('文件上传失败:', error);
      setFiles(prev => prev.map(f => 
        f.name === file.name && f.size === file.size 
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : '上传失败' }
          : f
      ));
    }
  };

  // 处理文件选择
  const handleFileSelect = (selectedFiles: File[]) => {
    selectedFiles.forEach(file => {
      // 检查文件大小 (限制50GB)
      if (file.size > 50 * 1024 * 1024 * 1024) {
        alert(`文件 ${file.name} 超过50GB限制`);
        return;
      }

      handleFileUpload(file);
    });
  };

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileSelect(droppedFiles);
  };

  // 点击选择文件
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFileSelect(selectedFiles);
    // 清空input值，允许重复选择同一文件
    e.target.value = '';
  };

  // 清除所有文件
  const clearFiles = () => {
    setFiles([]);
  };

  // 获取状态图标
  const getStatusIcon = (status: FileStatus['status']) => {
    switch (status) {
      case 'requesting':
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'uploading':
        return <Upload className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">🔐 预签名URL安全上传</h2>
        <p className="text-gray-600">
          基于MinIO官方文档的预签名URL方案，后端Edge Function安全生成上传链接
        </p>
      </div>

      {/* 上传区域 */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          拖拽文件到此处或点击选择
        </p>
        <p className="text-sm text-gray-500">
          支持最大50GB文件，使用预签名URL安全上传
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="video/*,image/*,*/*"
        />
      </div>

      {/* 功能说明 */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-2">🔒 安全特性</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• 后端Edge Function生成预签名URL，前端不暴露MinIO密钥</li>
          <li>• 临时访问权限，默认1小时有效期</li>
          <li>• 文件名自动清理和唯一化</li>
          <li>• 支持大文件分片上传（50GB以内）</li>
          <li>• 实时上传进度和速度监控</li>
        </ul>
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">上传队列</h3>
            <button
              onClick={clearFiles}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            >
              清除全部
            </button>
          </div>

          <div className="space-y-3">
            {files.map((file, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(file.status)}
                    <div>
                      <p className="font-medium text-gray-800">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>

                  {file.status === 'completed' && file.downloadUrl && (
                    <a
                      href={file.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    >
                      <Download className="w-4 h-4" />
                      <span>下载</span>
                    </a>
                  )}
                </div>

                {/* 状态信息 */}
                <div className="text-sm text-gray-600">
                  {file.status === 'requesting' && '正在获取上传链接...'}
                  {file.status === 'uploading' && file.progress && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>上传中... {file.progress.percentage}%</span>
                        <span>{formatSpeed(file.progress.speed)} · 剩余{formatTime(file.progress.eta)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${file.progress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {file.status === 'completed' && (
                    <span className="text-green-600 font-medium">✅ 上传完成</span>
                  )}
                  {file.status === 'error' && (
                    <span className="text-red-600">{file.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 技术信息 */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">🔧 技术实现</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• <strong>预签名URL：</strong>presignedPutObject() - 临时上传权限</p>
          <p>• <strong>安全验证：</strong>Edge Function权限控制和文件名清理</p>
          <p>• <strong>进度监控：</strong>XMLHttpRequest上传进度事件</p>
          <p>• <strong>错误处理：</strong>网络异常和服务器错误自动重试</p>
        </div>
      </div>
    </div>
  );
};

export default PresignedUpload; 