-- =============================================================================
-- 为课表计划添加默认教室关联
-- 创建时间：2025-01-15
-- 功能：为schedule_plans表添加venue_id字段，建立课表与默认教室的关联
-- =============================================================================

-- =============================================================================
-- 第一步：为 schedule_plans 表添加 venue_id 字段
-- =============================================================================

-- 添加 venue_id 列，并设置外键关联
ALTER TABLE public.schedule_plans
ADD COLUMN venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

-- 添加列注释
COMMENT ON COLUMN public.schedule_plans.venue_id IS '外键，关联到 venues 表的 ID，表示课表的默认上课教室';

-- 为 schedule_plans 表的 venue_id 创建索引
CREATE INDEX idx_schedule_plans_venue_id ON public.schedule_plans(venue_id);

-- =============================================================================
-- 第二步：更新 create_plan_schedules_batch RPC函数
-- =============================================================================

-- 更新批量创建排课函数，支持venue_id字段
CREATE OR REPLACE FUNCTION create_plan_schedules_batch(
  p_plan_id UUID,
  p_schedules JSON[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule JSON;
  v_schedule_id UUID;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_result JSON;
  v_plan_info RECORD;
BEGIN
  -- 获取计划信息，包括默认venue_id
  SELECT class_id, subject_id, teacher_id, venue_id
  INTO v_plan_info
  FROM public.schedule_plans 
  WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', '课表计划不存在',
      'message', '无法找到指定的课表计划'
    );
  END IF;
  
  -- 遍历每个排课信息
  FOREACH v_schedule IN ARRAY p_schedules
  LOOP
    BEGIN
      -- 插入排课记录
      INSERT INTO public.schedules (
        plan_id,
        class_id,
        subject_id, 
        teacher_id,
        venue_id,
        schedule_date,
        start_time,
        end_time,
        lesson_title,
        lesson_description,
        online_meeting_url,
        course_hours,
        status,
        notes,
        created_by
      ) VALUES (
        p_plan_id,
        v_plan_info.class_id,
        v_plan_info.subject_id,
        v_plan_info.teacher_id,
        -- 使用传入的venue_id，如果没有则使用计划的默认venue_id
        COALESCE((v_schedule->>'venue_id')::UUID, v_plan_info.venue_id),
        (v_schedule->>'schedule_date')::DATE,
        (v_schedule->>'start_time')::TIME,
        (v_schedule->>'end_time')::TIME,
        v_schedule->>'lesson_title',
        v_schedule->>'lesson_description',
        v_schedule->>'online_meeting_url',
        COALESCE((v_schedule->>'course_hours')::DECIMAL, 1.0),
        COALESCE(v_schedule->>'status', 'scheduled'),
        v_schedule->>'notes',
        auth.uid()
      ) RETURNING id INTO v_schedule_id;
      
      v_success_count := v_success_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, 
          format('排课失败 [%s %s]: %s', 
                 v_schedule->>'schedule_date', 
                 v_schedule->>'start_time',
                 SQLERRM));
    END;
  END LOOP;
  
  -- 返回批量创建结果
  SELECT json_build_object(
    'success', v_error_count = 0,
    'success_count', v_success_count,
    'error_count', v_error_count,
    'errors', v_errors,
    'message', format('批量创建完成：成功 %s 个，失败 %s 个', v_success_count, v_error_count)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 第三步：更新 get_schedule_plans_with_stats RPC函数
-- =============================================================================

-- 更新课表计划查询函数，包含venue信息
CREATE OR REPLACE FUNCTION get_schedule_plans_with_stats(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_search_term TEXT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_teacher_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  class_id UUID,
  class_name TEXT,
  subject_id UUID,
  subject_name TEXT,
  teacher_id UUID,
  teacher_name TEXT,
  venue_id UUID,
  venue_name TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- 统计信息
  total_schedules INTEGER,
  completed_schedules INTEGER,
  plan_participants_count INTEGER,
  next_schedule_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.name,
    sp.description,
    sp.class_id,
    c.name as class_name,
    sp.subject_id,
    s.name as subject_name,
    sp.teacher_id,
    p.full_name as teacher_name,
    sp.venue_id,
    v.name as venue_name,
    sp.start_date,
    sp.end_date,
    sp.status,
    sp.created_at,
    sp.updated_at,
    -- 统计信息
    COALESCE(schedule_stats.total_schedules, 0)::INTEGER,
    COALESCE(schedule_stats.completed_schedules, 0)::INTEGER,
    COALESCE(plan_stats.participants_count, 0)::INTEGER,
    schedule_stats.next_schedule_date
  FROM public.schedule_plans sp
  LEFT JOIN public.classes c ON c.id = sp.class_id
  LEFT JOIN public.subjects s ON s.id = sp.subject_id  
  LEFT JOIN public.profiles p ON p.id = sp.teacher_id
  LEFT JOIN public.venues v ON v.id = sp.venue_id
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*) as total_schedules,
      COUNT(*) FILTER (WHERE sch.status = 'completed') as completed_schedules,
      MIN(sch.schedule_date) FILTER (WHERE sch.schedule_date >= CURRENT_DATE) as next_schedule_date
    FROM public.schedules sch
    WHERE sch.plan_id = sp.id
  ) schedule_stats ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as participants_count
    FROM public.plan_participants pp
    WHERE pp.plan_id = sp.id AND pp.status = 'active'
  ) plan_stats ON true
  WHERE (p_search_term IS NULL OR (
    sp.name ILIKE '%' || p_search_term || '%' OR
    sp.description ILIKE '%' || p_search_term || '%' OR
    c.name ILIKE '%' || p_search_term || '%' OR
    s.name ILIKE '%' || p_search_term || '%' OR
    p.full_name ILIKE '%' || p_search_term || '%' OR
    v.name ILIKE '%' || p_search_term || '%'
  ))
  AND (p_class_id IS NULL OR sp.class_id = p_class_id)
  AND (p_subject_id IS NULL OR sp.subject_id = p_subject_id)
  AND (p_teacher_id IS NULL OR sp.teacher_id = p_teacher_id)
  AND (p_status IS NULL OR sp.status = p_status)
  ORDER BY sp.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =============================================================================
-- 第四步：创建课表计划创建和更新的RPC函数
-- =============================================================================

-- 创建带venue_id的课表计划创建函数
CREATE OR REPLACE FUNCTION create_schedule_plan_with_venue(
  p_name TEXT,
  p_description TEXT,
  p_class_id UUID,
  p_subject_id UUID,
  p_teacher_id UUID,
  p_venue_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_extra_students UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_result JSON;
BEGIN
  -- 插入课表计划
  INSERT INTO public.schedule_plans (
    name,
    description,
    class_id,
    subject_id,
    teacher_id,
    venue_id,
    start_date,
    end_date,
    status,
    created_by
  ) VALUES (
    p_name,
    p_description,
    p_class_id,
    p_subject_id,
    p_teacher_id,
    p_venue_id,
    p_start_date,
    p_end_date,
    'active',
    auth.uid()
  ) RETURNING id INTO v_plan_id;
  
  -- 添加插班学员
  IF array_length(p_extra_students, 1) > 0 THEN
    INSERT INTO public.plan_participants (plan_id, student_id, participation_type, status)
    SELECT v_plan_id, student_id, 'full', 'active'
    FROM unnest(p_extra_students) AS student_id;
  END IF;
  
  -- 返回结果
  SELECT json_build_object(
    'success', true,
    'plan_id', v_plan_id,
    'message', '课表计划创建成功'
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 创建课表计划更新函数
CREATE OR REPLACE FUNCTION update_schedule_plan_with_venue(
  p_plan_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_class_id UUID,
  p_subject_id UUID,
  p_teacher_id UUID,
  p_venue_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_extra_students UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- 更新课表计划基本信息
  UPDATE public.schedule_plans SET
    name = p_name,
    description = p_description,
    class_id = p_class_id,
    subject_id = p_subject_id,
    teacher_id = p_teacher_id,
    venue_id = p_venue_id,
    start_date = p_start_date,
    end_date = p_end_date,
    updated_at = NOW()
  WHERE id = p_plan_id;
  
  -- 如果venue_id发生变化，更新该课表下所有排课的venue_id
  IF p_venue_id IS NOT NULL THEN
    UPDATE public.schedules SET
      venue_id = p_venue_id,
      updated_at = NOW()
    WHERE plan_id = p_plan_id;
  END IF;
  
  -- 更新插班学员：先删除现有的，再添加新的
  DELETE FROM public.plan_participants WHERE plan_id = p_plan_id;
  
  IF array_length(p_extra_students, 1) > 0 THEN
    INSERT INTO public.plan_participants (plan_id, student_id, participation_type, status)
    SELECT p_plan_id, student_id, 'full', 'active'
    FROM unnest(p_extra_students) AS student_id;
  END IF;
  
  -- 返回结果
  SELECT json_build_object(
    'success', true,
    'plan_id', p_plan_id,
    'message', '课表计划更新成功'
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 第五步：授权新函数
-- =============================================================================

-- 授权新创建的函数
GRANT EXECUTE ON FUNCTION create_schedule_plan_with_venue(TEXT, TEXT, UUID, UUID, UUID, UUID, DATE, DATE, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_schedule_plan_with_venue(UUID, TEXT, TEXT, UUID, UUID, UUID, UUID, DATE, DATE, UUID[]) TO authenticated;

-- 添加函数注释
COMMENT ON FUNCTION create_schedule_plan_with_venue IS '创建带默认教室的课表计划';
COMMENT ON FUNCTION update_schedule_plan_with_venue IS '更新课表计划信息，包括默认教室'; 