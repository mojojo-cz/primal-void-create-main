import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Image, Link, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  bucket?: string;
  maxSize?: number; // MB
  acceptedTypes?: string[];
  placeholder?: string;
  showUrlInput?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value = '',
  onChange,
  bucket = 'image',
  maxSize = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  placeholder = '请输入图片链接或上传图片',
  showUrlInput = true
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(value);
  const [showPreview, setShowPreview] = useState(!!value);
  const [inputMode, setInputMode] = useState<'url' | 'upload'>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理URL输入
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setPreviewUrl(url);
    onChange(url);
    setShowPreview(!!url);
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  // 验证文件
  const validateFile = (file: File): boolean => {
    // 检查文件类型
    if (!acceptedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "文件类型不支持",
        description: `请选择支持的图片格式：${acceptedTypes.join(', ')}`
      });
      return false;
    }

    // 检查文件大小
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSize) {
      toast({
        variant: "destructive",
        title: "文件太大",
        description: `文件大小不能超过 ${maxSize}MB`
      });
      return false;
    }

    return true;
  };

  // 上传文件到Supabase Storage
  const uploadFile = async (file: File) => {
    if (!validateFile(file)) return;

    setUploading(true);
    try {
      // 生成唯一文件名
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      console.log('开始上传文件:', {
        bucket,
        filePath,
        fileSize: file.size,
        fileType: file.type
      });

      // 上传文件
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('上传错误详情:', error);
        throw error;
      }

      console.log('上传成功:', data);

      // 获取公共URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      
      setPreviewUrl(publicUrl);
      onChange(publicUrl);
      setShowPreview(true);
      setInputMode('url'); // 上传完成后切换到URL模式显示

      toast({
        title: "上传成功",
        description: "图片已成功上传到云存储"
      });

    } catch (error: any) {
      console.error('图片上传失败:', error);
      
      let errorMessage = "图片上传失败，请重试";
      
      if (error.message?.includes('row-level security')) {
        errorMessage = "权限不足，请确保您是管理员用户";
      } else if (error.message?.includes('Unauthorized')) {
        errorMessage = "认证失败，请重新登录";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "上传失败",
        description: errorMessage
      });
    } finally {
      setUploading(false);
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 清除图片
  const clearImage = () => {
    setPreviewUrl('');
    onChange('');
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 触发文件选择
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* 模式切换和操作按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showUrlInput && (
            <>
              <Button
                type="button"
                variant={inputMode === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('url')}
                disabled={uploading}
              >
                <Link className="h-4 w-4 mr-1" />
                链接
              </Button>
              <Button
                type="button"
                variant={inputMode === 'upload' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('upload')}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-1" />
                上传
              </Button>
            </>
          )}
        </div>
        
        {previewUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearImage}
            disabled={uploading}
          >
            <X className="h-4 w-4 mr-1" />
            清除
          </Button>
        )}
      </div>

      {/* 输入区域 */}
      {inputMode === 'url' && showUrlInput && (
        <div className="flex gap-2">
          <Input
            type="url"
            value={previewUrl}
            onChange={handleUrlChange}
            placeholder={placeholder}
            disabled={uploading}
            className="flex-1"
          />
          {previewUrl && !showPreview && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={uploading}
            >
              预览
            </Button>
          )}
        </div>
      )}

      {inputMode === 'upload' && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          
          <Button
            type="button"
            variant="outline"
            onClick={triggerFileSelect}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                选择图片文件
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            支持 JPG、PNG、WebP、GIF 格式，最大 {maxSize}MB
          </p>
        </div>
      )}

      {/* 图片预览 */}
      {showPreview && previewUrl && (
        <div className="relative border rounded-lg overflow-hidden bg-gray-50">
          <img
            src={previewUrl}
            alt="图片预览"
            className="w-full max-h-[200px] object-cover"
            onError={() => {
              toast({
                variant: "destructive",
                title: "图片加载失败",
                description: "无法加载图片，请检查URL是否正确"
              });
              setShowPreview(false);
            }}
            onLoad={() => setShowPreview(true)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full bg-background/80 hover:bg-background"
            onClick={() => setShowPreview(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImageUpload; 