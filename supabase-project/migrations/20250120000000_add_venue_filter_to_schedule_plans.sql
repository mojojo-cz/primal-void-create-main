-- =============================================================================
-- 为课表计划查询添加venue筛选支持
-- 创建时间：2025-01-20
-- 功能：升级get_schedule_plans_with_stats函数以支持教室筛选
-- =============================================================================

-- 升级 get_schedule_plans_with_stats 函数，添加 venue 筛选支持
CREATE OR REPLACE FUNCTION get_schedule_plans_with_stats(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_search_term TEXT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_teacher_id UUID DEFAULT NULL,
  p_venue_id TEXT DEFAULT NULL,  -- 支持 "null" 字符串表示无教室
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
  AND (p_venue_id IS NULL OR 
       (p_venue_id = 'null' AND sp.venue_id IS NULL) OR 
       (p_venue_id != 'null' AND sp.venue_id::text = p_venue_id))
  AND (p_status IS NULL OR sp.status = p_status)
  ORDER BY sp.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 更新函数注释
COMMENT ON FUNCTION get_schedule_plans_with_stats IS '获取课表计划列表（含统计信息和venue筛选支持）';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_schedule_plans_with_stats TO anon, authenticated;

-- =============================================================================
-- 迁移完成
-- ============================================================================= 