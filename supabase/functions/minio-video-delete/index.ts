import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Client } from "npm:minio@8.0.5"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteRequest {
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

serve(async (req) => {
  // 处理CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('只支持POST请求');
    }

    const { objectName }: DeleteRequest = await req.json();

    if (!objectName) {
      throw new Error('缺少objectName参数');
    }

    console.log(`删除MinIO对象: ${objectName}`);

    // 获取MinIO配置
    const config = getMinIOConfig();

    // 创建MinIO客户端
    const minioClient = new Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });

    // 检查对象是否存在
    try {
      await minioClient.statObject(config.bucketName, objectName);
    } catch (error) {
      console.warn(`对象不存在或已删除: ${objectName}`, error);
      // 如果对象不存在，我们认为删除成功
      return new Response(
        JSON.stringify({
          success: true,
          message: '对象不存在或已删除',
          objectName: objectName
        }),
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
        },
      )
    }

    // 删除MinIO对象
    await minioClient.removeObject(config.bucketName, objectName);

    console.log(`成功删除MinIO对象: ${objectName}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: '视频文件删除成功',
        objectName: objectName
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      },
    )

  } catch (error) {
    console.error('删除MinIO对象失败:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      },
    )
  }
}) 