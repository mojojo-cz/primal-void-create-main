-- =============================================================================
-- 升级排课管理RPC函数 - 新增period字段
-- 创建时间：2025-01-14 (升级)
-- 功能：为 get_schedules_with_details 函数增加 period 字段
-- =============================================================================

-- 先删除旧函数，避免签名冲突
DROP FUNCTION IF EXISTS get_schedules_with_details(INTEGER, INTEGER, TEXT, UUID, UUID, UUID, UUID, TEXT, DATE, DATE, UUID);

-- 重新创建函数，增加 period 字段
CREATE OR REPLACE FUNCTION get_schedules_with_details(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_search_term TEXT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_teacher_id UUID DEFAULT NULL,
  p_venue_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_plan_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  class_id UUID,
  subject_id UUID,
  teacher_id UUID,
  venue_id UUID,
  plan_id UUID,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  title TEXT, -- lesson_title 重命名为 title
  lesson_description TEXT,
  online_meeting_url TEXT,
  course_hours DECIMAL,
  status TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  period TEXT, -- 新增 period 字段
  -- 关联数据
  class_name TEXT,
  subject_name TEXT,
  teacher_name TEXT,
  teacher_full_name TEXT,
  venue_name TEXT,
  venue_type TEXT,
  -- 新增计划相关字段
  plan_name TEXT,
  -- 参与者统计
  participants_count INTEGER,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_schedules AS (
    SELECT 
      s.id,
      s.class_id,
      s.subject_id,
      s.teacher_id,
      s.venue_id,
      s.plan_id,
      s.schedule_date,
      s.start_time,
      s.end_time,
      s.duration_minutes,
      s.lesson_title AS title, -- 重命名字段
      s.lesson_description,
      s.online_meeting_url,
      s.course_hours,
      s.status,
      s.notes,
      s.created_by,
      s.created_at,
      s.updated_at,
      -- 新增 period 字段的计算逻辑
      CASE 
        WHEN s.start_time < '12:00:00' THEN '上午'
        WHEN s.start_time >= '12:00:00' AND s.start_time < '18:00:00' THEN '下午'
        ELSE '晚上'
      END AS period,
      c.name AS class_name,
      sub.name AS subject_name,
      t.username AS teacher_name,
      t.full_name AS teacher_full_name,
      v.name AS venue_name,
      v.type AS venue_type,
      -- 计划信息
      sp.name AS plan_name,
      -- 参与者统计
      COALESCE(participant_stats.total_count, 0)::INTEGER AS participants_count,
      COUNT(*) OVER() AS total_count
    FROM public.schedules s
    LEFT JOIN public.classes c ON s.class_id = c.id
    LEFT JOIN public.subjects sub ON s.subject_id = sub.id
    LEFT JOIN public.profiles t ON s.teacher_id = t.id
    LEFT JOIN public.venues v ON s.venue_id = v.id
    LEFT JOIN public.schedule_plans sp ON sp.id = s.plan_id
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT participant_id) as total_count
      FROM (
        SELECT cm.student_id as participant_id FROM public.class_members cm WHERE cm.class_id = s.class_id AND cm.enrollment_status = 'enrolled'
        UNION
        SELECT pp.student_id as participant_id FROM public.plan_participants pp WHERE pp.plan_id = s.plan_id AND pp.status = 'active' AND s.plan_id IS NOT NULL
        UNION
        SELECT sp_add.student_id as participant_id FROM public.schedule_participants sp_add WHERE sp_add.schedule_id = s.id AND sp_add.participation_action = 'add' AND sp_add.status = 'confirmed'
      ) all_participants
      WHERE participant_id NOT IN (
        SELECT sp_remove.student_id FROM public.schedule_participants sp_remove WHERE sp_remove.schedule_id = s.id AND sp_remove.participation_action = 'remove' AND sp_remove.status = 'confirmed'
      )
    ) participant_stats ON true
    WHERE
      (p_search_term IS NULL OR 
       s.lesson_title ILIKE '%' || p_search_term || '%' OR
       c.name ILIKE '%' || p_search_term || '%' OR
       sub.name ILIKE '%' || p_search_term || '%' OR
       t.full_name ILIKE '%' || p_search_term || '%' OR
       t.username ILIKE '%' || p_search_term || '%' OR
       v.name ILIKE '%' || p_search_term || '%' OR
       sp.name ILIKE '%' || p_search_term || '%')
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      AND (p_subject_id IS NULL OR s.subject_id = p_subject_id)
      AND (p_teacher_id IS NULL OR s.teacher_id = p_teacher_id)
      AND (p_venue_id IS NULL OR s.venue_id = p_venue_id)
      AND (p_status IS NULL OR s.status = p_status)
      AND (p_date_from IS NULL OR s.schedule_date >= p_date_from)
      AND (p_date_to IS NULL OR s.schedule_date <= p_date_to)
      AND (p_plan_id IS NULL OR s.plan_id = p_plan_id)
    ORDER BY s.schedule_date DESC, s.start_time DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT * FROM filtered_schedules;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_schedules_with_details(INTEGER, INTEGER, TEXT, UUID, UUID, UUID, UUID, TEXT, DATE, DATE, UUID) 
IS '获取排课详情列表（升级版），支持搜索、筛选和分页。包含计划信息、参与者统计和上下午时段。';

GRANT EXECUTE ON FUNCTION get_schedules_with_details(INTEGER, INTEGER, TEXT, UUID, UUID, UUID, UUID, TEXT, DATE, DATE, UUID) TO anon, authenticated;

-- =============================================================================
-- 迁移完成
-- ============================================================================= 
