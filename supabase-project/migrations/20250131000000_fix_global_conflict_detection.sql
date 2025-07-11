-- =============================================================================
-- 修复全局冲突检测问题
-- 创建时间：2025-01-31
-- 功能：确保跨课表的教师和教室冲突检测正常工作
-- =============================================================================

-- =============================================================================
-- 第一步：删除可能存在的旧版本冲突检测函数
-- =============================================================================

DROP FUNCTION IF EXISTS check_schedule_conflicts(UUID, UUID, DATE, TIME, TIME, UUID);
DROP FUNCTION IF EXISTS check_schedule_conflict(UUID, UUID, DATE, TIME, TIME, UUID);

-- =============================================================================
-- 第二步：创建强化版全局冲突检测函数
-- =============================================================================

CREATE OR REPLACE FUNCTION check_schedule_conflicts(
    p_teacher_id UUID,
    p_venue_id UUID,
    p_schedule_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_schedule_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    teacher_conflict_info JSONB;
    venue_conflict_info JSONB;
    debug_info JSONB;
BEGIN
    -- 检查教师冲突（全局检测，不限制课表）
    SELECT
        jsonb_build_object(
            'schedule_id', s.id,
            'lesson_title', s.lesson_title,
            'plan_name', COALESCE(sp.name, '独立排课'),
            'class_name', c.name,
            'start_time', s.start_time::text,
            'end_time', s.end_time::text,
            'teacher_name', COALESCE(t.full_name, t.username),
            'venue_name', v.name
        )
    INTO
        teacher_conflict_info
    FROM
        schedules s
    LEFT JOIN
        schedule_plans sp ON s.plan_id = sp.id
    LEFT JOIN
        classes c ON s.class_id = c.id
    LEFT JOIN
        profiles t ON s.teacher_id = t.id
    LEFT JOIN
        venues v ON s.venue_id = v.id
    WHERE
        s.teacher_id = p_teacher_id
        AND s.schedule_date = p_schedule_date
        AND (s.start_time, s.end_time) OVERLAPS (p_start_time, p_end_time)
        AND s.status NOT IN ('cancelled', 'postponed')
        AND (p_exclude_schedule_id IS NULL OR s.id <> p_exclude_schedule_id)
    ORDER BY s.created_at ASC
    LIMIT 1;

    -- 检查教室冲突（全局检测，不限制课表）
    IF p_venue_id IS NOT NULL THEN
        SELECT
            jsonb_build_object(
                'schedule_id', s.id,
                'lesson_title', s.lesson_title,
                'plan_name', COALESCE(sp.name, '独立排课'),
                'class_name', c.name,
                'start_time', s.start_time::text,
                'end_time', s.end_time::text,
                'teacher_name', COALESCE(t.full_name, t.username),
                'venue_name', v.name
            )
        INTO
            venue_conflict_info
        FROM
            schedules s
        LEFT JOIN
            schedule_plans sp ON s.plan_id = sp.id
        LEFT JOIN
            classes c ON s.class_id = c.id
        LEFT JOIN
            profiles t ON s.teacher_id = t.id
        LEFT JOIN
            venues v ON s.venue_id = v.id
        WHERE
            s.venue_id = p_venue_id
            AND s.schedule_date = p_schedule_date
            AND (s.start_time, s.end_time) OVERLAPS (p_start_time, p_end_time)
            AND s.status NOT IN ('cancelled', 'postponed')
            AND (p_exclude_schedule_id IS NULL OR s.id <> p_exclude_schedule_id)
        ORDER BY s.created_at ASC
        LIMIT 1;
    END IF;

    -- 添加调试信息
    SELECT jsonb_build_object(
        'search_params', jsonb_build_object(
            'teacher_id', p_teacher_id,
            'venue_id', p_venue_id,
            'schedule_date', p_schedule_date,
            'start_time', p_start_time,
            'end_time', p_end_time,
            'exclude_schedule_id', p_exclude_schedule_id
        ),
        'found_teacher_conflict', teacher_conflict_info IS NOT NULL,
        'found_venue_conflict', venue_conflict_info IS NOT NULL
    ) INTO debug_info;

    RETURN jsonb_build_object(
        'teacher_conflict', teacher_conflict_info,
        'venue_conflict', venue_conflict_info,
        'debug', debug_info
    );
END;
$$;

-- =============================================================================
-- 第三步：添加函数注释和权限
-- =============================================================================

COMMENT ON FUNCTION check_schedule_conflicts IS '全局排课冲突检测：检查指定教师和教室在指定时间段是否与任何课表中的排课冲突';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION check_schedule_conflicts TO anon, authenticated;

-- =============================================================================
-- 第四步：创建快速测试查询
-- =============================================================================

-- 测试查询：查找所有可能的教师冲突
/*
SELECT 
  s1.lesson_title as course1,
  s1.start_time as start1,
  s1.end_time as end1,
  s2.lesson_title as course2,
  s2.start_time as start2,
  s2.end_time as end2,
  COALESCE(t.full_name, t.username) as teacher_name,
  COALESCE(sp1.name, '独立排课') as plan1,
  COALESCE(sp2.name, '独立排课') as plan2
FROM schedules s1
JOIN schedules s2 ON s1.teacher_id = s2.teacher_id 
  AND s1.schedule_date = s2.schedule_date
  AND s1.id < s2.id
  AND (s1.start_time, s1.end_time) OVERLAPS (s2.start_time, s2.end_time)
LEFT JOIN profiles t ON s1.teacher_id = t.id
LEFT JOIN schedule_plans sp1 ON s1.plan_id = sp1.id
LEFT JOIN schedule_plans sp2 ON s2.plan_id = sp2.id
WHERE s1.status NOT IN ('cancelled', 'postponed')
  AND s2.status NOT IN ('cancelled', 'postponed')
ORDER BY s1.schedule_date DESC, s1.start_time;
*/ 