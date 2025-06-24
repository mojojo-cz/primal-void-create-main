import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client } from "npm:minio@8.0.5";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefreshRequest {
  action: 'check' | 'refresh' | 'status';
  batchSize?: number;
  onlyExpired?: boolean;
  videoIds?: string[]; // 指定要刷新的视频ID
}

interface RefreshResult {
  total: number;
  expired: number;
  refreshed: number;
  failed: number;
  errors: string[];
  details: Array<{
    id: string;
    title: string;
    status: 'valid' | 'expired' | 'expiring_soon' | 'refreshed' | 'failed';
    error?: string;
    oldExpiry?: string;
    newExpiry?: string;
  }>;
}

// MinIO配置 - 从环境变量读取
const getMinIOConfig = () => {
  const endPoint = Deno.env.get('MINIO_ENDPOINT');
  const port = parseInt(Deno.env.get('MINIO_PORT') || '9000');
  const useSSL = Deno.env.get('MINIO_USE_SSL') === 'true';
  const accessKey = Deno.env.get('MINIO_ACCESS_KEY');
  const secretKey = Deno.env.get('MINIO_SECRET_KEY');
  const bucketName = Deno.env.get('MINIO_BUCKET_NAME') || 'videos';

  if (!endPoint || !accessKey || !secretKey) {
    throw new Error('缺少必需的MinIO环境变量');
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

// 初始化Supabase客户端
const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('缺少Supabase配置');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

// 检查URL过期状态
const getUrlExpiryStatus = (expiresAt: string | null, hoursThreshold = 24): 'valid' | 'expiring_soon' | 'expired' => {
  if (!expiresAt) {
    return 'expired';
  }
  
  const expiry = new Date(expiresAt);
  const now = new Date();
  const timeUntilExpiry = expiry.getTime() - now.getTime();
  
  if (timeUntilExpiry <= 0) {
    return 'expired'; // 已过期
  } else if (timeUntilExpiry < (hoursThreshold * 60 * 60 * 1000)) {
    return 'expiring_soon'; // 即将过期（24小时内）
  } else {
    return 'valid'; // 有效
  }
};

// 向后兼容的函数
const isUrlExpiringSoon = (expiresAt: string, hoursThreshold = 24): boolean => {
  const status = getUrlExpiryStatus(expiresAt, hoursThreshold);
  return status === 'expired' || status === 'expiring_soon';
};

// 获取需要刷新的视频列表
const getVideosToRefresh = async (supabase: any, options: {
  onlyExpired?: boolean;
  videoIds?: string[];
  batchSize?: number;
}) => {
  let query = supabase
    .from('minio_videos')
    .select('id, title, minio_object_name, play_url, play_url_expires_at');

  // 如果指定了视频ID，只查询这些视频
  if (options.videoIds && options.videoIds.length > 0) {
    query = query.in('id', options.videoIds);
  }

  // 如果只查询过期的视频
  if (options.onlyExpired) {
    const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    query = query.or(`play_url_expires_at.is.null,play_url_expires_at.lt.${threshold}`);
  }

  // 批量大小限制
  if (options.batchSize) {
    query = query.limit(options.batchSize);
  }

  const { data, error } = await query;
  
  if (error) {
    throw new Error(`查询视频失败: ${error.message}`);
  }
  
  return data || [];
};

// 刷新单个视频的URL
const refreshVideoUrl = async (
  minioClient: Client, 
  supabase: any, 
  video: any, 
  bucketName: string
): Promise<{
  status: 'valid' | 'expired' | 'refreshed' | 'failed';
  error?: string;
  oldExpiry?: string;
  newExpiry?: string;
}> => {
  try {
    const oldExpiry = video.play_url_expires_at;
    
    // 检查当前URL是否即将过期
    if (oldExpiry && !isUrlExpiringSoon(oldExpiry)) {
      return {
        status: 'valid',
        oldExpiry
      };
    }

    // 检查MinIO对象是否存在
    try {
      await minioClient.statObject(bucketName, video.minio_object_name);
    } catch (error) {
      return {
        status: 'failed',
        error: `MinIO对象不存在: ${video.minio_object_name}`
      };
    }

    // 生成新的7天有效期URL
    const newPlayUrl = await minioClient.presignedGetObject(
      bucketName,
      video.minio_object_name,
      7 * 24 * 60 * 60 // 7天有效期
    );

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 更新数据库
    const { error: updateError } = await supabase
      .from('minio_videos')
      .update({
        play_url: newPlayUrl,
        play_url_expires_at: newExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', video.id);

    if (updateError) {
      return {
        status: 'failed',
        error: `数据库更新失败: ${updateError.message}`,
        oldExpiry
      };
    }

    return {
      status: oldExpiry ? 'refreshed' : 'refreshed',
      oldExpiry,
      newExpiry: newExpiresAt
    };

  } catch (error) {
    return {
      status: 'failed',
      error: error.message,
      oldExpiry: video.play_url_expires_at
    };
  }
};

// 主处理函数
const processRefresh = async (request: RefreshRequest): Promise<RefreshResult> => {
  const minioConfig = getMinIOConfig();
  const supabase = getSupabaseClient();
  
  const minioClient = new Client({
    endPoint: minioConfig.endPoint,
    port: minioConfig.port,
    useSSL: minioConfig.useSSL,
    accessKey: minioConfig.accessKey,
    secretKey: minioConfig.secretKey
  });

  // 获取需要处理的视频
  const videos = await getVideosToRefresh(supabase, {
    onlyExpired: request.onlyExpired,
    videoIds: request.videoIds,
    batchSize: request.batchSize || 100
  });

  const result: RefreshResult = {
    total: videos.length,
    expired: 0,
    refreshed: 0,
    failed: 0,
    errors: [],
    details: []
  };

  // 如果是检查模式，只检查不更新
  if (request.action === 'check') {
    let expiredCount = 0;
    let expiringSoonCount = 0;
    
    for (const video of videos) {
      const expiryStatus = getUrlExpiryStatus(video.play_url_expires_at);
      
      // 分别统计已过期和即将过期的数量
      if (expiryStatus === 'expired') {
        expiredCount++;
      } else if (expiryStatus === 'expiring_soon') {
        expiringSoonCount++;
      }
      
      // 将状态映射为前端可识别的状态
      let displayStatus: 'valid' | 'expired' | 'expiring_soon';
      if (expiryStatus === 'expired') {
        displayStatus = 'expired';
      } else if (expiryStatus === 'expiring_soon') {
        displayStatus = 'expiring_soon';
      } else {
        displayStatus = 'valid';
      }
      
      result.details.push({
        id: video.id,
        title: video.title,
        status: displayStatus,
        oldExpiry: video.play_url_expires_at
      });
    }
    
    // 设置统计结果：只统计需要刷新的URL数量（已过期+即将过期）
    result.expired = expiredCount + expiringSoonCount;
    
    return result;
  }

  // 批量处理视频URL刷新
  const batchSize = 10; // 并发处理数量
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);
    
    const batchPromises = batch.map(video => 
      refreshVideoUrl(minioClient, supabase, video, minioConfig.bucketName)
        .then(refreshResult => ({
          video,
          result: refreshResult
        }))
    );

    const batchResults = await Promise.allSettled(batchPromises);

    for (const promiseResult of batchResults) {
      if (promiseResult.status === 'fulfilled') {
        const { video, result: refreshResult } = promiseResult.value;
        
        result.details.push({
          id: video.id,
          title: video.title,
          status: refreshResult.status,
          error: refreshResult.error,
          oldExpiry: refreshResult.oldExpiry,
          newExpiry: refreshResult.newExpiry
        });

        if (refreshResult.status === 'refreshed') {
          result.refreshed++;
        } else if (refreshResult.status === 'failed') {
          result.failed++;
          if (refreshResult.error) {
            result.errors.push(`${video.title}: ${refreshResult.error}`);
          }
        } else if (refreshResult.status === 'expired') {
          result.expired++;
        }
      } else {
        result.failed++;
        result.errors.push(`处理失败: ${promiseResult.reason}`);
      }
    }

    // 在批次之间添加短暂延迟，避免过载
    if (i + batchSize < videos.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return result;
};

Deno.serve(async (req: Request) => {
  // 处理CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('只支持POST请求');
    }

    const request: RefreshRequest = await req.json();
    
    // 验证请求参数
    if (!['check', 'refresh', 'status'].includes(request.action)) {
      throw new Error('无效的action参数');
    }

    console.log(`开始执行URL刷新任务: ${request.action}`);
    const startTime = Date.now();

    const result = await processRefresh(request);
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`URL刷新任务完成: ${JSON.stringify({
      action: request.action,
      duration: `${duration}ms`,
      summary: {
        total: result.total,
        expired: result.expired,
        refreshed: result.refreshed,
        failed: result.failed
      }
    })}`);

    return new Response(
      JSON.stringify({
        success: true,
        action: request.action,
        duration,
        timestamp: new Date().toISOString(),
        result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('URL刷新任务失败:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}); 