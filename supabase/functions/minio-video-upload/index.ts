import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as minio from 'https://deno.land/x/minio@v7.1.3/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取环境变量
    const MINIO_ENDPOINT = Deno.env.get('MINIO_ENDPOINT') || 'localhost:9000'
    const MINIO_ACCESS_KEY = Deno.env.get('MINIO_ACCESS_KEY') || 'minioadmin'
    const MINIO_SECRET_KEY = Deno.env.get('MINIO_SECRET_KEY') || 'minioadmin'
    const MINIO_BUCKET = Deno.env.get('MINIO_BUCKET') || 'videos'
    const MINIO_USE_SSL = Deno.env.get('MINIO_USE_SSL') === 'true'

    // 创建MinIO客户端
    const minioClient = new minio.Client({
      endPoint: MINIO_ENDPOINT.split(':')[0],
      port: parseInt(MINIO_ENDPOINT.split(':')[1] || '9000'),
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    })

    // 创建Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 解析multipart/form-data
    const formData = await req.formData()
    const videoFile = formData.get('video') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string

    if (!videoFile) {
      return new Response(
        JSON.stringify({ error: '没有提供视频文件' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 验证文件类型
    if (!videoFile.type.startsWith('video/')) {
      return new Response(
        JSON.stringify({ error: '文件必须是视频格式' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 生成唯一的对象名称
    const timestamp = Date.now()
    const fileExtension = videoFile.name.split('.').pop() || 'mp4'
    const objectName = `videos/${timestamp}-${Math.random().toString(36).substring(2, 10)}.${fileExtension}`

    // 确保bucket存在
    const bucketExists = await minioClient.bucketExists(MINIO_BUCKET)
    if (!bucketExists) {
      await minioClient.makeBucket(MINIO_BUCKET)
    }

    // 将文件转换为ArrayBuffer
    const videoBuffer = await videoFile.arrayBuffer()
    const videoUint8Array = new Uint8Array(videoBuffer)

    // 上传到MinIO
    await minioClient.putObject(
      MINIO_BUCKET,
      objectName,
      videoUint8Array,
      videoFile.size,
      {
        'Content-Type': videoFile.type,
        'Content-Disposition': `attachment; filename="${videoFile.name}"`
      }
    )

    // 生成预签名URL（有效期7天）
    const videoUrl = await minioClient.presignedGetObject(MINIO_BUCKET, objectName, 7 * 24 * 60 * 60)

    // 保存到数据库
    const { data, error } = await supabase
      .from('minio_videos')
      .insert([
        {
          title: title || videoFile.name,
          description: description || null,
          video_url: videoUrl,
          minio_object_name: objectName,
          file_size: videoFile.size,
          content_type: videoFile.type,
        }
      ])
      .select()
      .single()

    if (error) {
      // 如果数据库保存失败，删除已上传的文件
      try {
        await minioClient.removeObject(MINIO_BUCKET, objectName)
      } catch (cleanupError) {
        console.error('清理MinIO文件失败:', cleanupError)
      }
      
      return new Response(
        JSON.stringify({ error: '保存视频信息失败: ' + error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        video: data,
        message: '视频上传成功'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('MinIO上传错误:', error)
    return new Response(
      JSON.stringify({ error: error.message || '上传失败' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 