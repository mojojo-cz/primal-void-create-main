-- 创建排课冲突检测函数
-- 用于检查指定的教师和教室在某个时间段内是否已有其他安排

CREATE OR REPLACE FUNCTION check_schedule_conflicts(
    p_teacher_id UUID,
    p_venue_id UUID,
    p_schedule_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_schedule_id UUID DEFAULT NULL
)
RETURNS JSONB
AS $$
DECLARE
    teacher_conflict_info JSONB;
    venue_conflict_info JSONB;
BEGIN
    -- 检查教师冲突
    SELECT
        jsonb_build_object(
            'schedule_id', s.id,
            'lesson_title', s.lesson_title,
            'plan_name', sp.name
        )
    INTO
        teacher_conflict_info
    FROM
        schedules s
    LEFT JOIN
        schedule_plans sp ON s.plan_id = sp.id
    WHERE
        s.teacher_id = p_teacher_id
        AND s.schedule_date = p_schedule_date
        AND (s.start_time, s.end_time) OVERLAPS (p_start_time, p_end_time)
        AND s.status <> 'cancelled'
        AND (p_exclude_schedule_id IS NULL OR s.id <> p_exclude_schedule_id)
    LIMIT 1;

    -- 检查教室冲突
    IF p_venue_id IS NOT NULL THEN
        SELECT
            jsonb_build_object(
                'schedule_id', s.id,
                'lesson_title', s.lesson_title,
                'plan_name', sp.name
            )
        INTO
            venue_conflict_info
        FROM
            schedules s
        LEFT JOIN
            schedule_plans sp ON s.plan_id = sp.id
        WHERE
            s.venue_id = p_venue_id
            AND s.schedule_date = p_schedule_date
            AND (s.start_time, s.end_time) OVERLAPS (p_start_time, p_end_time)
            AND s.status <> 'cancelled'
            AND (p_exclude_schedule_id IS NULL OR s.id <> p_exclude_schedule_id)
        LIMIT 1;
    END IF;

    RETURN jsonb_build_object(
        'teacher_conflict', teacher_conflict_info,
        'venue_conflict', venue_conflict_info
    );
END;
$$ LANGUAGE plpgsql;

-- 添加函数注释
COMMENT ON FUNCTION check_schedule_conflicts IS '检查指定教师和教室在指定时间段的排课冲突'; 