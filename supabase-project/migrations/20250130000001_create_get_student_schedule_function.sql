-- =============================================================================
-- 创建获取学员课表的RPC函数
-- 创建时间：2025-01-30
-- 功能：获取特定学员的所有相关课表信息，包括班级课程、计划参与和单课参与
-- =============================================================================

-- 创建获取学员课表的函数
CREATE OR REPLACE FUNCTION get_student_schedule(
  p_student_id UUID DEFAULT NULL
)
RETURNS TABLE (
  schedule_id UUID,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  period TEXT,
  subject_name TEXT,
  lesson_title TEXT,
  lesson_description TEXT,
  teacher_name TEXT,
  teacher_full_name TEXT,
  venue_name TEXT,
  venue_type TEXT,
  class_name TEXT,
  plan_name TEXT,
  participation_source TEXT, -- 'class', 'plan', 'schedule'
  participation_type TEXT,   -- 'full', 'partial', 'observer', 'regular', 'trial', 'makeup'
  status TEXT,
  notes TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_type TEXT;
BEGIN
  -- 获取当前用户信息
  v_user_id := auth.uid();
  
  -- 获取用户类型
  SELECT user_type INTO v_user_type 
  FROM public.profiles 
  WHERE id = v_user_id;
  
  -- 权限验证：学员只能查看自己的课表，管理员可以查看任何学员的课表
  IF v_user_type NOT IN ('admin') THEN
    IF p_student_id IS NOT NULL AND p_student_id != v_user_id THEN
      RAISE EXCEPTION '权限不足：无法查看其他学员的课表';
    END IF;
    -- 如果没有指定学员ID且不是管理员，则查看自己的课表
    IF p_student_id IS NULL THEN
      p_student_id := v_user_id;
    END IF;
  END IF;
  
  -- 如果是管理员但没有指定学员ID，则抛出错误
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION '请指定要查看课表的学员ID';
  END IF;
  
  RETURN QUERY
  WITH student_schedules AS (
    -- 1. 通过班级参与的课程
    SELECT DISTINCT
      s.id as schedule_id,
      s.schedule_date,
      s.start_time,
      s.end_time,
      s.duration_minutes,
      CASE 
        WHEN EXTRACT(HOUR FROM s.start_time) < 12 THEN '上午'
        WHEN EXTRACT(HOUR FROM s.start_time) < 18 THEN '下午'
        ELSE '晚上'
      END as period,
      sub.name as subject_name,
      s.lesson_title,
      s.lesson_description,
      t.username as teacher_name,
      t.full_name as teacher_full_name,
      v.name as venue_name,
      v.type as venue_type,
      c.name as class_name,
      sp.name as plan_name,
      'class'::TEXT as participation_source,
      'full'::TEXT as participation_type,
      s.status,
      s.notes
    FROM public.schedules s
    LEFT JOIN public.classes c ON s.class_id = c.id
    LEFT JOIN public.subjects sub ON s.subject_id = sub.id
    LEFT JOIN public.profiles t ON s.teacher_id = t.id
    LEFT JOIN public.venues v ON s.venue_id = v.id
    LEFT JOIN public.schedule_plans sp ON s.plan_id = sp.id
    INNER JOIN public.class_members cm ON cm.class_id = s.class_id
    WHERE cm.student_id = p_student_id
      AND cm.enrollment_status = 'enrolled'
      AND s.status NOT IN ('cancelled')
    
    UNION ALL
    
    -- 2. 通过计划级参与的课程
    SELECT DISTINCT
      s.id as schedule_id,
      s.schedule_date,
      s.start_time,
      s.end_time,
      s.duration_minutes,
      CASE 
        WHEN EXTRACT(HOUR FROM s.start_time) < 12 THEN '上午'
        WHEN EXTRACT(HOUR FROM s.start_time) < 18 THEN '下午'
        ELSE '晚上'
      END as period,
      sub.name as subject_name,
      s.lesson_title,
      s.lesson_description,
      t.username as teacher_name,
      t.full_name as teacher_full_name,
      v.name as venue_name,
      v.type as venue_type,
      c.name as class_name,
      sp.name as plan_name,
      'plan'::TEXT as participation_source,
      pp.participation_type,
      s.status,
      COALESCE(pp.notes, s.notes) as notes
    FROM public.schedules s
    LEFT JOIN public.classes c ON s.class_id = c.id
    LEFT JOIN public.subjects sub ON s.subject_id = sub.id
    LEFT JOIN public.profiles t ON s.teacher_id = t.id
    LEFT JOIN public.venues v ON s.venue_id = v.id
    LEFT JOIN public.schedule_plans sp ON s.plan_id = sp.id
    INNER JOIN public.plan_participants pp ON pp.plan_id = s.plan_id
    WHERE pp.student_id = p_student_id
      AND pp.status = 'active'
      AND s.status NOT IN ('cancelled')
      -- 排除已经通过班级参与的课程（避免重复）
      AND NOT EXISTS (
        SELECT 1 FROM public.class_members cm 
        WHERE cm.class_id = s.class_id 
          AND cm.student_id = p_student_id 
          AND cm.enrollment_status = 'enrolled'
      )
    
    UNION ALL
    
    -- 3. 通过单课级临时添加的课程
    SELECT DISTINCT
      s.id as schedule_id,
      s.schedule_date,
      s.start_time,
      s.end_time,
      s.duration_minutes,
      CASE 
        WHEN EXTRACT(HOUR FROM s.start_time) < 12 THEN '上午'
        WHEN EXTRACT(HOUR FROM s.start_time) < 18 THEN '下午'
        ELSE '晚上'
      END as period,
      sub.name as subject_name,
      s.lesson_title,
      s.lesson_description,
      t.username as teacher_name,
      t.full_name as teacher_full_name,
      v.name as venue_name,
      v.type as venue_type,
      c.name as class_name,
      sp.name as plan_name,
      'schedule'::TEXT as participation_source,
      scp.participation_type,
      s.status,
      COALESCE(scp.notes, s.notes) as notes
    FROM public.schedules s
    LEFT JOIN public.classes c ON s.class_id = c.id
    LEFT JOIN public.subjects sub ON s.subject_id = sub.id
    LEFT JOIN public.profiles t ON s.teacher_id = t.id
    LEFT JOIN public.venues v ON s.venue_id = v.id
    LEFT JOIN public.schedule_plans sp ON s.plan_id = sp.id
    INNER JOIN public.schedule_participants scp ON scp.schedule_id = s.id
    WHERE scp.student_id = p_student_id
      AND scp.participation_action = 'add'
      AND scp.status = 'confirmed'
      AND s.status NOT IN ('cancelled')
      -- 排除已经通过班级或计划参与的课程（避免重复）
      AND NOT EXISTS (
        SELECT 1 FROM public.class_members cm 
        WHERE cm.class_id = s.class_id 
          AND cm.student_id = p_student_id 
          AND cm.enrollment_status = 'enrolled'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.plan_participants pp 
        WHERE pp.plan_id = s.plan_id 
          AND pp.student_id = p_student_id 
          AND pp.status = 'active'
          AND s.plan_id IS NOT NULL
      )
  )
  SELECT 
    ss.schedule_id,
    ss.schedule_date,
    ss.start_time,
    ss.end_time,
    ss.duration_minutes,
    ss.period,
    ss.subject_name,
    ss.lesson_title,
    ss.lesson_description,
    ss.teacher_name,
    ss.teacher_full_name,
    ss.venue_name,
    ss.venue_type,
    ss.class_name,
    ss.plan_name,
    ss.participation_source,
    ss.participation_type,
    ss.status,
    ss.notes
  FROM student_schedules ss
  WHERE NOT EXISTS (
    -- 排除被单课级移除的课程
    SELECT 1 FROM public.schedule_participants sp_remove
    WHERE sp_remove.schedule_id = ss.schedule_id
      AND sp_remove.student_id = p_student_id
      AND sp_remove.participation_action = 'remove'
      AND sp_remove.status = 'confirmed'
  )
  ORDER BY ss.schedule_date DESC, ss.start_time ASC;
END;
$$;

-- 设置函数权限
GRANT EXECUTE ON FUNCTION public.get_student_schedule(UUID) TO anon, authenticated;

-- 添加注释
COMMENT ON FUNCTION public.get_student_schedule(UUID) IS '获取学员的完整课表信息，包括班级课程、计划参与和单课参与，支持权限验证'; 