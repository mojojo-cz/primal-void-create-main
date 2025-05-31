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

    // 解析请求体
    const { objectName } = await req.json()

    if (!objectName) {
      return new Response(
        JSON.stringify({ error: '没有提供对象名称' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 生成预签名URL（有效期1小时）
    const videoUrl = await minioClient.presignedGetObject(MINIO_BUCKET, objectName, 60 * 60)

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: videoUrl
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('MinIO流式传输错误:', error)
    return new Response(
      JSON.stringify({ error: error.message || '获取视频失败' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 