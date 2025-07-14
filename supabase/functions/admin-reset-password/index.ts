// @ts-ignore - Deno Edge Runtime类型声明
/// <reference types="https://deno.land/x/deno@v1.28.0/lib/deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
  adminUserId: string;
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 验证请求方法
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: '只支持POST请求' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        }
      )
    }

    // 获取请求参数
    const { userId, newPassword, adminUserId }: ResetPasswordRequest = await req.json()

    // 验证必需参数
    if (!userId || !newPassword || !adminUserId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '缺少必需参数：userId、newPassword、adminUserId' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // 验证密码强度
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '新密码至少需要6位字符' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // 使用服务角色密钥创建Supabase客户端（具有完整权限）
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseServiceKey) {
      console.error('服务角色密钥未配置')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '服务配置错误：服务角色密钥未配置' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseServiceKey
    )

    // 验证操作者是管理员
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('user_type, username')
      .eq('id', adminUserId)
      .single()

    if (adminError || !adminProfile) {
      console.error('获取管理员信息失败:', adminError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '无法验证操作者身份' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    if (adminProfile.user_type !== 'admin') {
      console.error(`非管理员尝试重置密码: ${adminProfile.username} (${adminProfile.user_type})`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '权限不足：只有管理员才能重置用户密码' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    // 获取目标用户信息（用于日志记录）
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('username, user_type')
      .eq('id', userId)
      .single()

    if (targetError || !targetProfile) {
      console.error('获取目标用户信息失败:', targetError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '目标用户不存在' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    // 使用管理员权限重置用户密码
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error('密码重置失败:', updateError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `密码重置失败: ${updateError.message}` 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // 记录操作日志
    console.log(`管理员 ${adminProfile.username} 重置了用户 ${targetProfile.username} (${targetProfile.user_type}) 的密码`)

    // 返回成功结果
    return new Response(
      JSON.stringify({
        success: true,
        message: `用户 ${targetProfile.username} 的密码已成功重置`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('密码重置Edge Function执行错误:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: '服务器内部错误：请稍后重试' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 