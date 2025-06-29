-- =============================================================================
-- 场地管理模块与排课冲突检测升级
-- 文件名：20250101000001_add_venues_and_update_schedules.sql
-- =============================================================================

-- =============================================================================
-- 第一步：创建场地管理表 (venues)
-- =============================================================================

CREATE TABLE public.venues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                                                  -- 场地名称，如 "A101"
  type TEXT NOT NULL CHECK (type IN ('classroom', 'conference_room')), -- 类型：教室、会议室
  capacity INTEGER,                                                    -- 容量
  details TEXT,                                                        -- 其他细节，如设备信息
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'unavailable')), -- 状态
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 场地名称和类型组合应唯一
  UNIQUE (name, type)
);

-- 添加表和列注释
COMMENT ON TABLE public.venues IS '场地信息表，用于管理教室、会议室等';
COMMENT ON COLUMN public.venues.name IS '场地名称，如 A101';
COMMENT ON COLUMN public.venues.type IS '场地类型: classroom(教室), conference_room(会议室)';
COMMENT ON COLUMN public.venues.capacity IS '场地可容纳人数';
COMMENT ON COLUMN public.venues.details IS '场地详细信息，如设备配置等';
COMMENT ON COLUMN public.venues.status IS '场地状态: available(可用), maintenance(维修中), unavailable(不可用)';

-- 为场地表创建索引
CREATE INDEX idx_venues_type ON public.venues(type);
CREATE INDEX idx_venues_status ON public.venues(status);
CREATE INDEX idx_venues_name ON public.venues(name);

-- 为场地表创建更新时间戳触发器
CREATE TRIGGER update_venues_updated_at 
  BEFORE UPDATE ON public.venues 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 第二步：修改排课表 (schedules) 以关联场地
-- =============================================================================

-- 删除旧的文本位置列
ALTER TABLE public.schedules DROP COLUMN IF EXISTS location;

-- 添加 venue_id 列，并设置外键关联
ALTER TABLE public.schedules
ADD COLUMN venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

-- 添加列注释
COMMENT ON COLUMN public.schedules.venue_id IS '外键，关联到 venues 表的 ID，表示上课地点';

-- 为 schedules 表的 venue_id 创建索引
CREATE INDEX idx_schedules_venue_id ON public.schedules(venue_id);

-- =============================================================================
-- 第三步：创建排课冲突检测RPC函数
-- =============================================================================

-- 创建增强版排课冲突检测函数
-- 此函数能同时检查教师和场地的冲突
CREATE OR REPLACE FUNCTION check_schedule_conflict(
  p_teacher_id UUID,
  p_venue_id UUID,
  p_schedule_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_schedule_id_to_exclude UUID DEFAULT NULL -- 用于在编辑时排除当前排课自身
)
RETURNS TABLE (
  conflict_type TEXT, -- 冲突类型 ('teacher' 或 'venue')
  conflicting_schedule_id UUID,
  conflicting_lesson_title TEXT,
  conflicting_teacher_name TEXT,
  conflicting_venue_name TEXT,
  conflicting_class_name TEXT,
  conflicting_start_time TIME,
  conflicting_end_time TIME
) AS $$
BEGIN
  RETURN QUERY
  -- 检查教师冲突
  SELECT 
    'teacher' AS conflict_type,
    s.id AS conflicting_schedule_id,
    s.lesson_title AS conflicting_lesson_title,
    COALESCE(t.full_name, t.username) AS conflicting_teacher_name,
    v.name AS conflicting_venue_name,
    c.name AS conflicting_class_name,
    s.start_time AS conflicting_start_time,
    s.end_time AS conflicting_end_time
  FROM public.schedules s
  LEFT JOIN public.profiles t ON s.teacher_id = t.id
  LEFT JOIN public.venues v ON s.venue_id = v.id
  LEFT JOIN public.classes c ON s.class_id = c.id
  WHERE
    s.teacher_id = p_teacher_id AND
    s.schedule_date = p_schedule_date AND
    (s.start_time, s.end_time) OVERLAPS (p_start_time, p_end_time) AND
    (p_schedule_id_to_exclude IS NULL OR s.id != p_schedule_id_to_exclude) AND
    s.status NOT IN ('cancelled', 'postponed')

  UNION ALL

  -- 检查场地冲突
  SELECT
    'venue' AS conflict_type,
    s.id AS conflicting_schedule_id,
    s.lesson_title AS conflicting_lesson_title,
    COALESCE(t.full_name, t.username) AS conflicting_teacher_name,
    v.name AS conflicting_venue_name,
    c.name AS conflicting_class_name,
    s.start_time AS conflicting_start_time,
    s.end_time AS conflicting_end_time
  FROM public.schedules s
  LEFT JOIN public.profiles t ON s.teacher_id = t.id
  LEFT JOIN public.venues v ON s.venue_id = v.id
  LEFT JOIN public.classes c ON s.class_id = c.id
  WHERE
    s.venue_id = p_venue_id AND
    p_venue_id IS NOT NULL AND -- 只有当指定了场地时才检查场地冲突
    s.schedule_date = p_schedule_date AND
    (s.start_time, s.end_time) OVERLAPS (p_start_time, p_end_time) AND
    (p_schedule_id_to_exclude IS NULL OR s.id != p_schedule_id_to_exclude) AND
    s.status NOT IN ('cancelled', 'postponed');
END;
$$ LANGUAGE plpgsql;

-- 添加函数注释
COMMENT ON FUNCTION check_schedule_conflict IS '检查教师和场地的排课时间是否冲突。返回冲突的类型、排课ID、标题等详细信息。';

-- =============================================================================
-- 第四步：创建获取排课详情的RPC函数
-- =============================================================================

-- 创建获取排课详情的RPC函数，用于排课管理页面
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
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  class_id UUID,
  subject_id UUID,
  teacher_id UUID,
  venue_id UUID,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  lesson_title TEXT,
  lesson_description TEXT,
  online_meeting_url TEXT,
  course_hours DECIMAL,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- 关联数据
  class_name TEXT,
  subject_name TEXT,
  teacher_name TEXT,
  teacher_full_name TEXT,
  venue_name TEXT,
  venue_type TEXT,
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
      s.schedule_date,
      s.start_time,
      s.end_time,
      s.lesson_title,
      s.lesson_description,
      s.online_meeting_url,
      s.course_hours,
      s.status,
      s.created_at,
      s.updated_at,
      c.name AS class_name,
      sub.name AS subject_name,
      t.username AS teacher_name,
      t.full_name AS teacher_full_name,
      v.name AS venue_name,
      v.type AS venue_type,
      COUNT(*) OVER() AS total_count
    FROM public.schedules s
    LEFT JOIN public.classes c ON s.class_id = c.id
    LEFT JOIN public.subjects sub ON s.subject_id = sub.id
    LEFT JOIN public.profiles t ON s.teacher_id = t.id
    LEFT JOIN public.venues v ON s.venue_id = v.id
    WHERE
      (p_search_term IS NULL OR 
       s.lesson_title ILIKE '%' || p_search_term || '%' OR
       c.name ILIKE '%' || p_search_term || '%' OR
       sub.name ILIKE '%' || p_search_term || '%' OR
       t.full_name ILIKE '%' || p_search_term || '%' OR
       t.username ILIKE '%' || p_search_term || '%' OR
       v.name ILIKE '%' || p_search_term || '%')
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      AND (p_subject_id IS NULL OR s.subject_id = p_subject_id)
      AND (p_teacher_id IS NULL OR s.teacher_id = p_teacher_id)
      AND (p_venue_id IS NULL OR s.venue_id = p_venue_id)
      AND (p_status IS NULL OR s.status = p_status)
      AND (p_date_from IS NULL OR s.schedule_date >= p_date_from)
      AND (p_date_to IS NULL OR s.schedule_date <= p_date_to)
    ORDER BY s.schedule_date DESC, s.start_time DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT * FROM filtered_schedules;
END;
$$ LANGUAGE plpgsql;

-- 添加函数注释
COMMENT ON FUNCTION get_schedules_with_details IS '获取排课详情列表，支持搜索、筛选和分页。返回包含班级、课程、教师、场地等关联信息的完整排课数据。';

-- =============================================================================
-- 第五步：插入一些示例场地数据
-- =============================================================================

-- 插入示例教室数据
INSERT INTO public.venues (name, type, capacity, details, status) VALUES
('A101', 'classroom', 50, '多媒体教室，配备投影仪和音响设备', 'available'),
('A102', 'classroom', 30, '小班教室，适合互动教学', 'available'),
('A103', 'classroom', 80, '大教室，配备无线麦克风', 'available'),
('B201', 'classroom', 40, '计算机教室，配备电脑和网络', 'available'),
('B202', 'classroom', 35, '语音教室，配备语音设备', 'available'),
('C301', 'conference_room', 20, '会议室，配备视频会议设备', 'available'),
('C302', 'conference_room', 15, '小型会议室，适合讨论', 'available');

-- =============================================================================
-- 完成
-- ============================================================================= 