# 手动部署分块上传Edge Function指南

## 📋 部署步骤

### 1. 安装Supabase CLI (如果还没有)

```bash
# macOS
brew install supabase/tap/supabase

# 或者直接下载
curl -o supabase https://github.com/supabase/cli/releases/latest/download/supabase_darwin_amd64.tar.gz
```

### 2. 登录到Supabase

```bash
supabase login
```

### 3. 关联项目

```bash
supabase link --project-ref eotqgpcgzgjtywddvdpd
```

### 4. 部署分块上传Function

确保你已经创建了文件 `supabase/functions/minio-video-upload-chunked/index.ts`，然后运行：

```bash
supabase functions deploy minio-video-upload-chunked
```

## 🔧 如果遇到问题

### 权限问题解决方案：

1. **检查账户权限**：
   - 确保你的Supabase账户有部署Edge Functions的权限
   - 联系项目管理员获取权限

2. **使用项目所有者账户**：
   - 请项目所有者执行部署操作

3. **通过Supabase Dashboard部署**：
   - 访问: https://supabase.com/dashboard/project/eotqgpcgzgjtywddvdpd
   - 进入 "Edge Functions" 页面
   - 点击 "New Function"
   - 函数名: `minio-video-upload-chunked`
   - 粘贴下面的代码

## 📄 Edge Function代码

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client } from "npm:minio@8.0.1";
import { createClient } from "jsr:@supabase/supabase-js@2";

// MinIO配置
const minioClient = new Client({
  endPoint: 'minio.xianrankaoyan.vip',
  port: 9000,
  useSSL: true,
  accessKey: 'WRJDY2MYP6RF0Y5EO4M2',
  secretKey: 'jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7'
});

// Supabase配置
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ChunkUploadRequest {
  action: 'init' | 'upload' | 'complete';
  filename?: string;
  title?: string;
  description?: string;
  uploadId?: string;
  objectName?: string;
  chunkNumber?: number;
  totalChunks?: number;
  chunkData?: string;
  etags?: string[];
}

Deno.serve(async (req: Request) => {
  try {
    // 处理CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    if (req.method !== 'POST') {
      throw new Error('只支持POST请求');
    }

    const requestData: ChunkUploadRequest = await req.json();
    const { action } = requestData;

    let response;

    switch (action) {
      case 'init':
        response = await initMultipartUpload(requestData);
        break;
      case 'upload':
        response = await uploadChunk(requestData);
        break;
      case 'complete':
        response = await completeMultipartUpload(requestData);
        break;
      default:
        throw new Error('无效的action');
    }

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('分块上传错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});

// 初始化分片上传
async function initMultipartUpload(data: ChunkUploadRequest) {
  const { filename } = data;
  
  if (!filename) {
    throw new Error('文件名不能为空');
  }

  // 生成唯一的对象名
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const objectName = `${timestamp}_${randomStr}_${filename}`;

  console.log(`初始化分片上传: ${objectName}`);

  // 初始化MinIO分片上传
  const uploadId = await minioClient.initiateNewMultipartUpload('videos', objectName, {
    'Content-Type': getContentType(filename)
  });

  return {
    success: true,
    uploadId,
    objectName,
    message: `分片上传初始化成功，uploadId: ${uploadId}`
  };
}

// 上传单个分片
async function uploadChunk(data: ChunkUploadRequest) {
  const { uploadId, objectName, chunkNumber, chunkData } = data;
  
  if (!uploadId || !objectName || chunkNumber === undefined || !chunkData) {
    throw new Error('缺少必需的参数');
  }

  console.log(`上传分片 ${chunkNumber}, uploadId: ${uploadId}`);

  // 解码base64数据
  const buffer = Uint8Array.from(atob(chunkData), c => c.charCodeAt(0));
  
  // 上传分片到MinIO
  const etag = await minioClient.uploadPart(
    'videos',
    objectName,
    uploadId,
    chunkNumber,
    buffer
  );

  return {
    success: true,
    chunkNumber,
    etag,
    message: `分片 ${chunkNumber} 上传成功`
  };
}

// 完成分片上传
async function completeMultipartUpload(data: ChunkUploadRequest) {
  const { uploadId, objectName, title, description, etags } = data;
  
  if (!uploadId || !objectName || !etags) {
    throw new Error('缺少必需的参数');
  }

  console.log(`完成分片上传: ${objectName}, uploadId: ${uploadId}`);

  // 构建分片信息
  const parts = etags.map((etag, index) => ({
    partNumber: index + 1,
    etag
  }));

  // 完成MinIO分片上传
  await minioClient.completeMultipartUpload('videos', objectName, uploadId, parts);

  // 生成文件URL
      const videoUrl = `https://minio.xianrankaoyan.vip:9000/videos/${objectName}`;

  // 计算文件大小 (估算)
  const fileSize = parts.length * 5 * 1024 * 1024; // 假设每个分片5MB

  // 保存到数据库
  const { data: video, error } = await supabase
    .from('minio_videos')
    .insert([
      {
        title: title || objectName.split('_').pop()?.split('.')[0] || 'Unknown',
        description: description || '通过分片上传',
        video_url: videoUrl,
        minio_object_name: objectName,
        file_size: fileSize,
        content_type: getContentType(objectName)
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('保存到数据库失败:', error);
    throw new Error(`保存到数据库失败: ${error.message}`);
  }

  return {
    success: true,
    id: video.id,
    video_url: videoUrl,
    message: '分片上传完成！'
  };
}

// 获取文件类型
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: { [key: string]: string } = {
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska'
  };
  
  return mimeTypes[ext || ''] || 'video/octet-stream';
}
```

## 🚀 部署完成后测试

部署成功后，新的Function URL将是：
```
https://eotqgpcgzgjtywddvdpd.supabase.co/functions/v1/minio-video-upload-chunked
```

可以使用我们提供的调试工具进行测试。

## ⚠️ 注意事项

1. **确保MinIO服务器可访问**
2. **videos存储桶已设置为public**
3. **Supabase项目有足够的资源限制**
4. **分块大小建议设置为5MB** 