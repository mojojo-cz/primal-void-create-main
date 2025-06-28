-- 创建批量获取班级列表及学员数量的RPC函数
-- 此函数将原本需要 N+1 次查询（1次获取班级 + N次获取学员数量）优化为单次查询
-- 大幅提升班级管理页面的加载速度

CREATE OR REPLACE FUNCTION public.get_classes_with_student_counts()
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    max_students INTEGER,
    head_teacher_id UUID,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    head_teacher_username TEXT,
    head_teacher_full_name TEXT,
    student_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.max_students,
        c.head_teacher_id,
        c.status,
        c.created_at,
        c.updated_at,
        ht.username as head_teacher_username,
        ht.full_name as head_teacher_full_name,
        COALESCE(cm_counts.student_count, 0) as student_count
    FROM classes c
    LEFT JOIN profiles ht ON c.head_teacher_id = ht.id
    LEFT JOIN (
        SELECT 
            cm.class_id,
            COUNT(*) as student_count
        FROM class_members cm
        INNER JOIN profiles p ON cm.student_id = p.id
        WHERE cm.enrollment_status = 'enrolled'
          AND p.user_type = 'student'
        GROUP BY cm.class_id
    ) cm_counts ON c.id = cm_counts.class_id
    ORDER BY c.created_at DESC;
END;
$$;

-- 设置函数权限
GRANT EXECUTE ON FUNCTION public.get_classes_with_student_counts() TO anon, authenticated;

-- 添加注释
COMMENT ON FUNCTION public.get_classes_with_student_counts() IS '批量获取班级列表及学员数量，优化页面加载性能，避免N+1查询问题';

-- 创建一个备用的可带条件筛选的版本
CREATE OR REPLACE FUNCTION public.get_classes_with_student_counts_filtered(
    p_name_filter TEXT DEFAULT NULL,
    p_status_filter TEXT DEFAULT NULL,
    p_teacher_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    max_students INTEGER,
    head_teacher_id UUID,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    head_teacher_username TEXT,
    head_teacher_full_name TEXT,
    student_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.max_students,
        c.head_teacher_id,
        c.status,
        c.created_at,
        c.updated_at,
        ht.username as head_teacher_username,
        ht.full_name as head_teacher_full_name,
        COALESCE(cm_counts.student_count, 0) as student_count
    FROM classes c
    LEFT JOIN profiles ht ON c.head_teacher_id = ht.id
    LEFT JOIN (
        SELECT 
            cm.class_id,
            COUNT(*) as student_count
        FROM class_members cm
        INNER JOIN profiles p ON cm.student_id = p.id
        WHERE cm.enrollment_status = 'enrolled'
          AND p.user_type = 'student'
        GROUP BY cm.class_id
    ) cm_counts ON c.id = cm_counts.class_id
    WHERE 
        (p_name_filter IS NULL OR c.name ILIKE '%' || p_name_filter || '%')
        AND (p_status_filter IS NULL OR c.status = p_status_filter)
        AND (p_teacher_filter IS NULL OR 
             ht.username ILIKE '%' || p_teacher_filter || '%' OR 
             ht.full_name ILIKE '%' || p_teacher_filter || '%')
    ORDER BY c.created_at DESC;
END;
$$;

-- 设置权限
GRANT EXECUTE ON FUNCTION public.get_classes_with_student_counts_filtered(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 添加注释
COMMENT ON FUNCTION public.get_classes_with_student_counts_filtered(TEXT, TEXT, TEXT) IS '支持条件筛选的班级列表查询，包含学员数量统计'; 