import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Client } from "npm:minio@8.0.5"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PresignedUploadRequest {
  fileName: string;
  contentType?: string;
  expires?: number;
  generatePlayUrl?: boolean;
}

interface GeneratePlayUrlRequest {
  objectName: string;
}

// MinIO配置 - 从环境变量读取
const getMinIOConfig = () => {
  const endPoint = Deno.env.get('MINIO_ENDPOINT');
  const port = parseInt(Deno.env.get('MINIO_PORT') || '9000');
  const useSSL = Deno.env.get('MINIO_USE_SSL') === 'true';
  const accessKey = Deno.env.get('MINIO_ACCESS_KEY');
  const secretKey = Deno.env.get('MINIO_SECRET_KEY');
  const bucketName = Deno.env.get('MINIO_BUCKET_NAME') || 'videos';

  // 验证必需的环境变量
  if (!endPoint || !accessKey || !secretKey) {
    throw new Error('缺少必需的MinIO环境变量: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY');
  }

  return {
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
    bucketName
  };
};

// 文件名清理函数
const sanitizeFileName = (fileName: string): string => {
  // 移除或替换特殊字符
  let sanitized = fileName
    .replace(/[^\w\-_.]/g, '_')  // 替换非法字符为下划线
    .replace(/_{2,}/g, '_')      // 合并多个连续下划线
    .replace(/^_+|_+$/g, '');    // 移除首尾下划线

  // 确保文件名不为空
  if (!sanitized) {
    sanitized = 'unnamed_file';
  }

  // 限制长度
  if (sanitized.length > 100) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized = nameWithoutExt.substring(0, 95 - ext.length) + ext;
  }

  return sanitized;
};

// 生成唯一文件名
const generateUniqueFileName = (originalFileName: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitized = sanitizeFileName(originalFileName);
  const ext = sanitized.substring(sanitized.lastIndexOf('.'));
  const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
  
  return `${timestamp}_${random}_${nameWithoutExt}${ext}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取MinIO配置
    const minioConfig = getMinIOConfig();
    
    // 初始化MinIO客户端
    const minioClient = new Client({
      endPoint: minioConfig.endPoint,
      port: minioConfig.port,
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey
    });

    if (req.method === 'POST') {
      const requestBody = await req.json();
      
      // 检查是否是生成播放URL的请求
      if (requestBody.action === 'generatePlayUrl') {
        const { objectName }: GeneratePlayUrlRequest = requestBody;
        
        if (!objectName) {
          return new Response(
            JSON.stringify({ error: 'objectName不能为空' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // 检查对象是否存在
        try {
          await minioClient.statObject(minioConfig.bucketName, objectName);
        } catch (error) {
          return new Response(
            JSON.stringify({ error: `视频文件不存在: ${objectName}` }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // 生成7天有效期的播放URL
        const playUrl = await minioClient.presignedGetObject(
          minioConfig.bucketName,
          objectName,
          7 * 24 * 60 * 60 // 7天有效期
        );

        return new Response(
          JSON.stringify({
            success: true,
            playUrl: playUrl,
            objectName: objectName,
            expiresIn: 7 * 24 * 60 * 60,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // 原有的预签名上传逻辑
      const { fileName, contentType = 'application/octet-stream', expires = 3600, generatePlayUrl = false } = requestBody as PresignedUploadRequest;

      // 验证输入
      if (!fileName) {
        return new Response(
          JSON.stringify({ error: '文件名不能为空' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 验证过期时间（最大24小时）
      const maxExpires = 24 * 60 * 60; // 24小时
      const validExpires = Math.min(expires, maxExpires);

      // 生成唯一文件名
      const uniqueFileName = generateUniqueFileName(fileName);

      console.log(`生成预签名URL: ${fileName} -> ${uniqueFileName}`);

      // 确保存储桶存在
      const bucketExists = await minioClient.bucketExists(minioConfig.bucketName);
      if (!bucketExists) {
        await minioClient.makeBucket(minioConfig.bucketName, '');
        console.log(`创建存储桶: ${minioConfig.bucketName}`);
      }

      // 生成预签名上传URL
      const uploadUrl = await minioClient.presignedPutObject(
        minioConfig.bucketName,
        uniqueFileName,
        validExpires
      );

      // 生成下载URL（用于上传完成后下载）
      const downloadUrl = await minioClient.presignedGetObject(
        minioConfig.bucketName,
        uniqueFileName,
        24 * 60 * 60 // 24小时有效期
      );

      // 如果需要生成长效播放URL
      let playUrl = null;
      let playUrlExpiresAt = null;
      if (generatePlayUrl) {
        playUrl = await minioClient.presignedGetObject(
          minioConfig.bucketName,
          uniqueFileName,
          7 * 24 * 60 * 60 // 7天有效期
        );
        playUrlExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      // 返回响应
      const response = {
        success: true,
        uploadUrl: uploadUrl,
        downloadUrl: downloadUrl,
        playUrl: playUrl,
        playUrlExpiresAt: playUrlExpiresAt,
        fileName: uniqueFileName,
        originalFileName: fileName,
        contentType: contentType,
        expiresIn: validExpires,
        bucket: minioConfig.bucketName,
        metadata: {
          uploadedAt: new Date().toISOString(),
          size: null,
          etag: null
        }
      };

      return new Response(
        JSON.stringify(response),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // GET请求 - 返回服务信息
    if (req.method === 'GET') {
      const info = {
        service: 'MinIO预签名URL服务',
        version: '2.0.0',
        endpoints: {
          'POST (upload)': '生成预签名上传URL',
          'POST (playUrl)': '生成长效播放URL',
          'GET': '获取服务信息'
        },
        config: {
          maxFileSize: '50GB',
          maxExpires: '24小时',
          playUrlExpires: '7天',
          bucket: minioConfig.bucketName,
          server: `${minioConfig.endPoint}:${minioConfig.port}`
        }
      };

      return new Response(
        JSON.stringify(info),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 不支持的方法
    return new Response(
      JSON.stringify({ error: `方法 ${req.method} 不被支持` }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('预签名URL生成失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    return new Response(
      JSON.stringify({ 
        error: '生成预签名URL失败',
        details: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}) 