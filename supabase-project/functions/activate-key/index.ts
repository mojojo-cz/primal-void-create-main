import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 创建Supabase客户端
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 获取当前用户
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '用户未登录' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // 获取请求参数
    const { activation_key } = await req.json()

    if (!activation_key) {
      return new Response(
        JSON.stringify({ error: '请提供激活密钥' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // 调用数据库函数进行激活
    const { data: result, error: activationError } = await supabaseClient
      .rpc('use_activation_key', {
        p_key: activation_key,
        p_user_id: user.id
      })

    if (activationError) {
      console.error('激活密钥失败:', activationError)
      return new Response(
        JSON.stringify({ error: '激活密钥时发生错误' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // 检查激活结果
    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // 返回成功结果
    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        new_user_type: result.new_user_type,
        expires_at: result.expires_at
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('云函数执行错误:', error)
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 