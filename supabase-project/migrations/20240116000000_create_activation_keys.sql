-- 创建激活密钥表
-- 文件名：20240116000000_create_activation_keys.sql

-- 1. 创建激活密钥表
CREATE TABLE public.activation_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  key_type TEXT NOT NULL CHECK (key_type IN ('upgrade_to_trial', 'upgrade_to_student')),
  is_used BOOLEAN DEFAULT FALSE NOT NULL,
  created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  activated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. 添加索引以提高查询性能
CREATE INDEX idx_activation_keys_key ON public.activation_keys(key);
CREATE INDEX idx_activation_keys_created_by ON public.activation_keys(created_by_user_id);
CREATE INDEX idx_activation_keys_activated_by ON public.activation_keys(activated_by_user_id);
CREATE INDEX idx_activation_keys_type ON public.activation_keys(key_type);
CREATE INDEX idx_activation_keys_is_used ON public.activation_keys(is_used);

-- 3. 创建更新时间戳的触发器
CREATE TRIGGER update_activation_keys_updated_at 
  BEFORE UPDATE ON public.activation_keys 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. 启用RLS (Row Level Security)
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

-- 5. 创建RLS策略
-- 管理员可以查看所有密钥
CREATE POLICY "管理员可以查看所有密钥" ON public.activation_keys
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- 班主任和业务老师只能查看自己创建的密钥
CREATE POLICY "教师只能查看自己创建的密钥" ON public.activation_keys
  FOR SELECT 
  USING (
    created_by_user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('head_teacher', 'business_teacher')
    )
  );

-- 管理员可以插入所有类型的密钥
CREATE POLICY "管理员可以插入所有类型密钥" ON public.activation_keys
  FOR INSERT 
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- 班主任只能插入升级正式学员的密钥
CREATE POLICY "班主任只能插入升级正式学员密钥" ON public.activation_keys
  FOR INSERT 
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND key_type = 'upgrade_to_student'
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'head_teacher'
    )
  );

-- 业务老师只能插入升级体验用户的密钥
CREATE POLICY "业务老师只能插入升级体验用户密钥" ON public.activation_keys
  FOR INSERT 
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND key_type = 'upgrade_to_trial'
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'business_teacher'
    )
  );

-- 6. 创建密钥生成函数
CREATE OR REPLACE FUNCTION generate_activation_key()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  key_string TEXT;
  key_exists BOOLEAN;
BEGIN
  LOOP
    -- 生成16位随机密钥 (大写字母和数字)
    key_string := upper(
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4)
    );
    
    -- 检查密钥是否已存在
    SELECT EXISTS(SELECT 1 FROM public.activation_keys WHERE key = key_string) INTO key_exists;
    
    -- 如果不存在，跳出循环
    IF NOT key_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN key_string;
END;
$$;

-- 7. 创建激活密钥的数据库函数
CREATE OR REPLACE FUNCTION use_activation_key(
  p_key TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activation_key RECORD;
  v_user_profile RECORD;
  v_new_user_type TEXT;
  v_new_expires_at TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- 1. 查找并锁定激活密钥
  SELECT * INTO v_activation_key
  FROM public.activation_keys
  WHERE key = p_key AND is_used = false
  FOR UPDATE;
  
  -- 检查密钥是否存在且未使用
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '密钥不存在或已被使用'
    );
  END IF;
  
  -- 2. 获取用户信息
  SELECT * INTO v_user_profile
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '用户不存在'
    );
  END IF;
  
  -- 3. 检查用户是否有权限使用此密钥
  IF v_user_profile.user_type NOT IN ('registered', 'trial_user') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '只有注册用户和体验用户可以使用激活密钥'
    );
  END IF;
  
  -- 4. 根据密钥类型确定新的用户类型和有效期
  IF v_activation_key.key_type = 'upgrade_to_trial' THEN
    v_new_user_type := 'trial_user';
    v_new_expires_at := NOW() + INTERVAL '1 month';
  ELSIF v_activation_key.key_type = 'upgrade_to_student' THEN
    v_new_user_type := 'student';
    v_new_expires_at := NOW() + INTERVAL '3 years';
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', '无效的密钥类型'
    );
  END IF;
  
  -- 5. 更新用户资料
  UPDATE public.profiles
  SET 
    user_type = v_new_user_type,
    access_expires_at = v_new_expires_at,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- 6. 标记密钥为已使用
  UPDATE public.activation_keys
  SET 
    is_used = true,
    activated_by_user_id = p_user_id,
    activated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_activation_key.id;
  
  -- 7. 返回成功结果
  RETURN jsonb_build_object(
    'success', true,
    'message', '激活成功',
    'new_user_type', v_new_user_type,
    'expires_at', v_new_expires_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '激活过程中发生错误: ' || SQLERRM
    );
END;
$$;

-- 8. 为数据库函数添加权限
GRANT EXECUTE ON FUNCTION generate_activation_key() TO authenticated;
GRANT EXECUTE ON FUNCTION use_activation_key(TEXT, UUID) TO authenticated; 