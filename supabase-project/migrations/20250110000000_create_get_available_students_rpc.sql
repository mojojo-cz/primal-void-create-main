-- 创建获取班级可用学员的RPC函数
-- 此函数会返回未加入指定班级的所有学员
CREATE OR REPLACE FUNCTION public.get_available_students_for_class(p_class_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    username TEXT,
    user_type TEXT,
    school TEXT,
    major TEXT,
    phone_number TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.username,
        p.user_type,
        p.school,
        p.major,
        p.phone_number,
        p.created_at,
        p.updated_at
    FROM profiles p
    WHERE p.user_type = 'student'
        AND p.id NOT IN (
            SELECT cm.student_id 
            FROM class_members cm 
            WHERE cm.class_id = p_class_id
              AND cm.enrollment_status = 'enrolled'
        )
    ORDER BY p.full_name;
END;
$$;

-- 确保函数有正确的权限
GRANT EXECUTE ON FUNCTION public.get_available_students_for_class(UUID) TO anon, authenticated;