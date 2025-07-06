-- =============================================================================
-- 智能排课工作台：核心RPC函数
-- 创建时间：2025-01-13
-- 功能：提供创建计划、批量排课、学员管理等核心功能
-- =============================================================================

-- =============================================================================
-- 第一步：创建课表计划管理相关函数
-- =============================================================================

-- 1.1 创建课表计划（带额外学员）
CREATE OR REPLACE FUNCTION create_schedule_plan_with_participants(
  p_plan_name TEXT,
  p_plan_description TEXT DEFAULT NULL,
  p_class_id UUID,
  p_subject_id UUID,
  p_teacher_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_additional_student_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_student_id UUID;
  v_result JSON;
BEGIN
  -- 插入课表计划
  INSERT INTO public.schedule_plans (
    name, description, class_id, subject_id, teacher_id, 
    start_date, end_date, created_by
  ) VALUES (
    p_plan_name, p_plan_description, p_class_id, p_subject_id, p_teacher_id,
    p_start_date, p_end_date, auth.uid()
  ) RETURNING id INTO v_plan_id;
  
  -- 添加额外学员到计划参与者
  IF p_additional_student_ids IS NOT NULL AND array_length(p_additional_student_ids, 1) > 0 THEN
    FOREACH v_student_id IN ARRAY p_additional_student_ids
    LOOP
      INSERT INTO public.plan_participants (
        plan_id, student_id, created_by
      ) VALUES (
        v_plan_id, v_student_id, auth.uid()
      ) ON CONFLICT (plan_id, student_id) DO NOTHING;
    END LOOP;
  END IF;
  
  -- 返回创建的计划信息
  SELECT json_build_object(
    'success', true,
    'plan_id', v_plan_id,
    'message', '课表计划创建成功'
  ) INTO v_result;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', '创建课表计划失败'
    );
END;
$$;

-- 1.2 批量创建排课到指定计划
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
  -- 获取计划信息
  SELECT class_id, subject_id, teacher_id 
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
        schedule_date,
        start_time,
        end_time,
        lesson_title,
        lesson_description,
        location,
        status,
        notes,
        created_by
      ) VALUES (
        p_plan_id,
        v_plan_info.class_id,
        v_plan_info.subject_id,
        v_plan_info.teacher_id,
        (v_schedule->>'schedule_date')::DATE,
        (v_schedule->>'start_time')::TIME,
        (v_schedule->>'end_time')::TIME,
        v_schedule->>'lesson_title',
        v_schedule->>'lesson_description',
        v_schedule->>'location',
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

-- 1.3 获取课表计划列表（带统计信息）
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
    p.full_name ILIKE '%' || p_search_term || '%'
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
-- 第二步：升级现有的排课查询函数
-- =============================================================================

-- 2.1 升级排课详情查询函数（包含计划信息）
CREATE OR REPLACE FUNCTION get_schedules_with_details_enhanced(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_search_term TEXT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_teacher_id UUID DEFAULT NULL,
  p_venue_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_plan_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  class_id UUID,
  class_name TEXT,
  subject_id UUID,
  subject_name TEXT,
  teacher_id UUID,
  teacher_name TEXT,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  lesson_title TEXT,
  lesson_description TEXT,
  location TEXT,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  venue_id UUID,
  venue_name TEXT,
  -- 新增计划相关字段
  plan_id UUID,
  plan_name TEXT,
  -- 参与者统计
  participants_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.class_id,
    c.name as class_name,
    s.subject_id,
    subj.name as subject_name,
    s.teacher_id,
    p.full_name as teacher_name,
    s.schedule_date,
    s.start_time,
    s.end_time,
    s.duration_minutes,
    s.lesson_title,
    s.lesson_description,
    s.location,
    s.status,
    s.notes,
    s.created_at,
    s.updated_at,
    v.id as venue_id,
    v.name as venue_name,
    -- 计划信息
    s.plan_id,
    sp.name as plan_name,
    -- 参与者统计
    COALESCE(participant_stats.total_count, 0)::INTEGER as participants_count
  FROM public.schedules s
  LEFT JOIN public.classes c ON c.id = s.class_id
  LEFT JOIN public.subjects subj ON subj.id = s.subject_id
  LEFT JOIN public.profiles p ON p.id = s.teacher_id
  LEFT JOIN public.venues v ON v.name = s.location
  LEFT JOIN public.schedule_plans sp ON sp.id = s.plan_id
  LEFT JOIN LATERAL (
    -- 计算参与者总数（班级 + 计划级 + 单课级）
    SELECT COUNT(DISTINCT participant_id) as total_count
    FROM (
      -- 班级学员
      SELECT cm.student_id as participant_id
      FROM public.class_members cm
      WHERE cm.class_id = s.class_id 
        AND cm.enrollment_status = 'enrolled'
      
      UNION
      
      -- 计划级额外学员
      SELECT pp.student_id as participant_id
      FROM public.plan_participants pp
      WHERE pp.plan_id = s.plan_id 
        AND pp.status = 'active'
        AND s.plan_id IS NOT NULL
        
      UNION
      
      -- 单课级临时添加的学员
      SELECT sp_add.student_id as participant_id
      FROM public.schedule_participants sp_add
      WHERE sp_add.schedule_id = s.id 
        AND sp_add.participation_action = 'add'
        AND sp_add.status = 'confirmed'
    ) all_participants
    WHERE participant_id NOT IN (
      -- 排除单课级临时移除的学员
      SELECT sp_remove.student_id
      FROM public.schedule_participants sp_remove
      WHERE sp_remove.schedule_id = s.id 
        AND sp_remove.participation_action = 'remove'
        AND sp_remove.status = 'confirmed'
    )
  ) participant_stats ON true
  WHERE (p_search_term IS NULL OR (
    s.lesson_title ILIKE '%' || p_search_term || '%' OR
    s.lesson_description ILIKE '%' || p_search_term || '%' OR
    c.name ILIKE '%' || p_search_term || '%' OR
    subj.name ILIKE '%' || p_search_term || '%' OR
    p.full_name ILIKE '%' || p_search_term || '%' OR
    sp.name ILIKE '%' || p_search_term || '%'
  ))
  AND (p_class_id IS NULL OR s.class_id = p_class_id)
  AND (p_subject_id IS NULL OR s.subject_id = p_subject_id)
  AND (p_teacher_id IS NULL OR s.teacher_id = p_teacher_id)
  AND (p_venue_id IS NULL OR v.id = p_venue_id)
  AND (p_status IS NULL OR s.status = p_status)
  AND (p_plan_id IS NULL OR s.plan_id = p_plan_id)
  ORDER BY s.schedule_date DESC, s.start_time DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =============================================================================
-- 第三步：学员参与管理相关函数
-- =============================================================================

-- 3.1 管理计划级参与者
CREATE OR REPLACE FUNCTION manage_plan_participants(
  p_plan_id UUID,
  p_student_ids_to_add UUID[] DEFAULT ARRAY[]::UUID[],
  p_student_ids_to_remove UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
  v_result JSON;
BEGIN
  -- 添加学员到计划
  IF p_student_ids_to_add IS NOT NULL AND array_length(p_student_ids_to_add, 1) > 0 THEN
    FOREACH v_student_id IN ARRAY p_student_ids_to_add
    LOOP
      INSERT INTO public.plan_participants (
        plan_id, student_id, created_by
      ) VALUES (
        p_plan_id, v_student_id, auth.uid()
      ) ON CONFLICT (plan_id, student_id) 
      DO UPDATE SET 
        status = 'active',
        withdrawn_at = NULL;
      
      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;
  
  -- 从计划中移除学员
  IF p_student_ids_to_remove IS NOT NULL AND array_length(p_student_ids_to_remove, 1) > 0 THEN
    UPDATE public.plan_participants 
    SET status = 'withdrawn', withdrawn_at = NOW()
    WHERE plan_id = p_plan_id 
      AND student_id = ANY(p_student_ids_to_remove);
    
    GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'added_count', v_added_count,
    'removed_count', v_removed_count,
    'message', format('成功添加 %s 个学员，移除 %s 个学员', v_added_count, v_removed_count)
  ) INTO v_result;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', '管理计划参与者失败'
    );
END;
$$;

-- 3.2 管理单课级参与者  
CREATE OR REPLACE FUNCTION manage_schedule_participants(
  p_schedule_id UUID,
  p_student_ids_to_add UUID[] DEFAULT ARRAY[]::UUID[],
  p_student_ids_to_remove UUID[] DEFAULT ARRAY[]::UUID[],
  p_participation_type TEXT DEFAULT 'regular',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
  v_result JSON;
BEGIN
  -- 添加学员到单课
  IF p_student_ids_to_add IS NOT NULL AND array_length(p_student_ids_to_add, 1) > 0 THEN
    FOREACH v_student_id IN ARRAY p_student_ids_to_add
    LOOP
      INSERT INTO public.schedule_participants (
        schedule_id, student_id, participation_action, 
        participation_type, notes, created_by
      ) VALUES (
        p_schedule_id, v_student_id, 'add',
        p_participation_type, p_notes, auth.uid()
      ) ON CONFLICT (schedule_id, student_id)
      DO UPDATE SET 
        participation_action = 'add',
        participation_type = p_participation_type,
        status = 'confirmed',
        notes = p_notes;
      
      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;
  
  -- 从单课中移除学员  
  IF p_student_ids_to_remove IS NOT NULL AND array_length(p_student_ids_to_remove, 1) > 0 THEN
    FOREACH v_student_id IN ARRAY p_student_ids_to_remove
    LOOP
      INSERT INTO public.schedule_participants (
        schedule_id, student_id, participation_action, 
        participation_type, notes, created_by
      ) VALUES (
        p_schedule_id, v_student_id, 'remove',
        p_participation_type, p_notes, auth.uid()
      ) ON CONFLICT (schedule_id, student_id)
      DO UPDATE SET 
        participation_action = 'remove',
        status = 'confirmed',
        notes = p_notes;
      
      v_removed_count := v_removed_count + 1;
    END LOOP;
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'added_count', v_added_count,
    'removed_count', v_removed_count,
    'message', format('成功添加 %s 个学员，移除 %s 个学员', v_added_count, v_removed_count)
  ) INTO v_result;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', '管理单课参与者失败'
    );
END;
$$;

-- =============================================================================
-- 第四步：设置函数权限
-- =============================================================================

-- 授予执行权限
GRANT EXECUTE ON FUNCTION create_schedule_plan_with_participants(TEXT, TEXT, UUID, UUID, UUID, DATE, DATE, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_plan_schedules_batch(UUID, JSON[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_schedule_plans_with_stats(INTEGER, INTEGER, TEXT, UUID, UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_schedules_with_details_enhanced(INTEGER, INTEGER, TEXT, UUID, UUID, UUID, UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manage_plan_participants(UUID, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_schedule_participants(UUID, UUID[], UUID[], TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 第五步：添加函数注释
-- =============================================================================

COMMENT ON FUNCTION create_schedule_plan_with_participants(TEXT, TEXT, UUID, UUID, UUID, DATE, DATE, UUID[]) IS '创建课表计划并添加额外参与学员';
COMMENT ON FUNCTION create_plan_schedules_batch(UUID, JSON[]) IS '批量创建排课到指定计划';
COMMENT ON FUNCTION get_schedule_plans_with_stats(INTEGER, INTEGER, TEXT, UUID, UUID, UUID, TEXT) IS '获取课表计划列表（含统计信息）';
COMMENT ON FUNCTION get_schedules_with_details_enhanced(INTEGER, INTEGER, TEXT, UUID, UUID, UUID, UUID, TEXT, UUID) IS '获取增强版排课详情（含计划和参与者信息）';
COMMENT ON FUNCTION manage_plan_participants(UUID, UUID[], UUID[]) IS '管理计划级参与者（添加/移除额外学员）';
COMMENT ON FUNCTION manage_schedule_participants(UUID, UUID[], UUID[], TEXT, TEXT) IS '管理单课级参与者（临时调整学员）';

-- =============================================================================
-- RPC函数创建完成
-- ============================================================================= 