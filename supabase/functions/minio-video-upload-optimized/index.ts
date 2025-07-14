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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    if (!file) {
      throw new Error('未提供文件');
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new Error('文件大小超过20MB，请使用分块上传');
    }

    console.log(`上传文件: ${file.name}, 大小: ${file.size}`);

    // 生成唯一的对象名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const objectName = `${timestamp}_${randomStr}_${file.name}`;

    // 转换文件为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // 上传到MinIO
    await minioClient.putObject('videos', objectName, buffer, file.size, {
      'Content-Type': file.type || getContentType(file.name)
    });

    // 生成文件URL
    const videoUrl = `https://minio.xianrankaoyan.vip:9000/videos/${objectName}`;

    // 保存到数据库
    const { data: video, error } = await supabase
      .from('minio_videos')
      .insert([
        {
          title: title || file.name.split('.')[0],
          description: description || '通过优化上传',
          video_url: videoUrl,
          minio_object_name: objectName,
          file_size: file.size,
          content_type: file.type || getContentType(file.name)
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('保存到数据库失败:', error);
      throw new Error(`保存到数据库失败: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      id: video.id,
      video_url: videoUrl,
      message: '文件上传成功！'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('上传错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});

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