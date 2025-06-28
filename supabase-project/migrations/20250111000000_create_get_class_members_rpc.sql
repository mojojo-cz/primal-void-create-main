-- 创建优化的班级成员查询RPC函数
-- 此函数将原本需要多个查询的操作合并为单个数据库函数调用，提升性能

CREATE OR REPLACE FUNCTION public.get_class_members_optimized(p_class_id UUID)
RETURNS TABLE (
    member_id UUID,
    student_id UUID,
    enrollment_status TEXT,
    enrolled_at TIMESTAMPTZ,
    student_username TEXT,
    student_full_name TEXT,
    student_phone_number TEXT,
    student_school TEXT,
    student_major TEXT,
    student_user_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id as member_id,
        cm.student_id,
        cm.enrollment_status,
        cm.enrolled_at,
        p.username as student_username,
        p.full_name as student_full_name,
        p.phone_number as student_phone_number,
        p.school as student_school,
        p.major as student_major,
        p.user_type as student_user_type
    FROM class_members cm
    INNER JOIN profiles p ON cm.student_id = p.id
    WHERE cm.class_id = p_class_id
      AND cm.enrollment_status = 'enrolled'
      AND p.user_type = 'student'
    ORDER BY cm.enrolled_at DESC;
END;
$$;

-- 设置函数权限
GRANT EXECUTE ON FUNCTION public.get_class_members_optimized(UUID) TO anon, authenticated;

-- 添加注释
COMMENT ON FUNCTION public.get_class_members_optimized(UUID) IS '优化的班级成员查询函数，减少数据传输和查询时间';
