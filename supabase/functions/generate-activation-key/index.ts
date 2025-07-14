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

    // 获取用户资料
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: '无法获取用户资料' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const { key_type } = await req.json()

    // 验证权限
    let allowedKeyTypes: string[] = []
    
    if (profile.user_type === 'admin') {
      allowedKeyTypes = ['upgrade_to_trial', 'upgrade_to_student']
    } else if (profile.user_type === 'head_teacher') {
      allowedKeyTypes = ['upgrade_to_student']
    } else if (profile.user_type === 'business_teacher') {
      allowedKeyTypes = ['upgrade_to_trial']
    } else {
      return new Response(
        JSON.stringify({ error: '权限不足，只有管理员、班主任和业务老师可以生成密钥' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    if (!allowedKeyTypes.includes(key_type)) {
      return new Response(
        JSON.stringify({ 
          error: `权限不足，您不能生成此类型的密钥`,
          allowed_types: allowedKeyTypes 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    // 生成密钥
    const { data: keyString, error: generateError } = await supabaseClient
      .rpc('generate_activation_key')

    if (generateError) {
      console.error('生成密钥失败:', generateError)
      return new Response(
        JSON.stringify({ error: '生成密钥失败' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // 保存密钥到数据库
    const { data: activationKey, error: insertError } = await supabaseClient
      .from('activation_keys')
      .insert({
        key: keyString,
        key_type: key_type,
        created_by_user_id: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('保存密钥失败:', insertError)
      return new Response(
        JSON.stringify({ error: '保存密钥失败' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // 返回成功结果
    return new Response(
      JSON.stringify({
        success: true,
        key: activationKey.key,
        key_type: activationKey.key_type,
        created_at: activationKey.created_at,
        message: '密钥生成成功'
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