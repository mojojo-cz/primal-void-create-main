-- =============================================================================
-- 智能排课工作台：课表计划与两级学员管理系统
-- 创建时间：2025-01-13
-- 功能：支持课表计划概念和计划级+单课级的学员管理
-- =============================================================================

-- =============================================================================
-- 第一步：创建课表计划表 (schedule_plans)
-- =============================================================================

-- 课表计划表：每个排课计划的容器，如"秋季物理竞赛"、"雅思冲刺班"等
CREATE TABLE public.schedule_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                          -- 计划名称，如"秋季物理竞赛"
  description TEXT,                            -- 计划描述
  
  -- 关联信息
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,  -- 主要班级
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL, -- 主要课程
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL, -- 主要教师
  
  -- 计划时间范围
  start_date DATE,                             -- 计划开始日期
  end_date DATE,                               -- 计划结束日期
  
  -- 状态管理
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'draft')),
  
  -- 元数据
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 约束：计划名称在同一班级内不能重复
  UNIQUE (class_id, name),
  -- 约束：结束日期必须晚于或等于开始日期
  CONSTRAINT schedule_plans_date_check CHECK (end_date IS NULL OR end_date >= start_date)
);

-- 为计划表创建索引
CREATE INDEX idx_schedule_plans_class_id ON public.schedule_plans(class_id);
CREATE INDEX idx_schedule_plans_subject_id ON public.schedule_plans(subject_id);
CREATE INDEX idx_schedule_plans_teacher_id ON public.schedule_plans(teacher_id);
CREATE INDEX idx_schedule_plans_status ON public.schedule_plans(status);
CREATE INDEX idx_schedule_plans_dates ON public.schedule_plans(start_date, end_date);
CREATE INDEX idx_schedule_plans_name ON public.schedule_plans(name);

-- 为计划表创建更新时间戳触发器
CREATE TRIGGER update_schedule_plans_updated_at 
  BEFORE UPDATE ON public.schedule_plans 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE public.schedule_plans IS '课表计划表：管理排课计划，如"秋季物理竞赛"、"雅思冲刺班"等';
COMMENT ON COLUMN public.schedule_plans.name IS '计划名称，如"秋季物理竞赛"';
COMMENT ON COLUMN public.schedule_plans.class_id IS '主要关联班级ID';
COMMENT ON COLUMN public.schedule_plans.subject_id IS '主要关联课程ID';
COMMENT ON COLUMN public.schedule_plans.teacher_id IS '主要任课教师ID';

-- =============================================================================
-- 第二步：为schedules表添加plan_id外键
-- =============================================================================

-- 为schedules表添加课表计划关联
ALTER TABLE public.schedules 
ADD COLUMN plan_id UUID REFERENCES public.schedule_plans(id) ON DELETE CASCADE;

-- 为新字段创建索引
CREATE INDEX idx_schedules_plan_id ON public.schedules(plan_id);

-- 添加字段注释
COMMENT ON COLUMN public.schedules.plan_id IS '关联的课表计划ID，用于将单节课归组到特定的教学计划中';

-- =============================================================================
-- 第三步：创建计划级参与者表 (plan_participants)
-- =============================================================================

-- 计划级参与者：定义需要全程参与某个排课计划的额外学员
CREATE TABLE public.plan_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES public.schedule_plans(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- 参与状态
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'suspended')),
  participation_type TEXT DEFAULT 'full' CHECK (participation_type IN ('full', 'partial', 'observer')),
  
  -- 加入和退出时间
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  withdrawn_at TIMESTAMPTZ,
  
  -- 备注
  notes TEXT,
  
  -- 元数据
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 约束：同一学员不能重复加入同一计划
  UNIQUE (plan_id, student_id)
);

-- 为计划参与者表创建索引
CREATE INDEX idx_plan_participants_plan_id ON public.plan_participants(plan_id);
CREATE INDEX idx_plan_participants_student_id ON public.plan_participants(student_id);
CREATE INDEX idx_plan_participants_status ON public.plan_participants(status);

-- 添加表注释
COMMENT ON TABLE public.plan_participants IS '计划级参与者：记录需要全程参与某个排课计划的额外学员';
COMMENT ON COLUMN public.plan_participants.participation_type IS '参与类型：full=全程参与，partial=部分参与，observer=旁听';

-- =============================================================================
-- 第四步：创建单课级参与者表 (schedule_participants)
-- =============================================================================

-- 单课级参与者：记录某节具体课程的临时参与者（增加或移除）
CREATE TABLE public.schedule_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- 参与状态
  participation_action TEXT DEFAULT 'add' CHECK (participation_action IN ('add', 'remove')),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  
  -- 参与类型
  participation_type TEXT DEFAULT 'regular' CHECK (participation_type IN ('regular', 'trial', 'makeup', 'substitute')),
  
  -- 备注
  notes TEXT,                                  -- 如"补课"、"试听"、"临时调课"等
  
  -- 元数据
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 约束：同一学员对于同一节课只能有一条有效记录
  UNIQUE (schedule_id, student_id)
);

-- 为单课参与者表创建索引
CREATE INDEX idx_schedule_participants_schedule_id ON public.schedule_participants(schedule_id);
CREATE INDEX idx_schedule_participants_student_id ON public.schedule_participants(student_id);
CREATE INDEX idx_schedule_participants_action ON public.schedule_participants(participation_action);
CREATE INDEX idx_schedule_participants_type ON public.schedule_participants(participation_type);

-- 添加表注释
COMMENT ON TABLE public.schedule_participants IS '单课级参与者：记录某节具体课程的临时参与者调整';
COMMENT ON COLUMN public.schedule_participants.participation_action IS '参与动作：add=临时添加，remove=临时移除';
COMMENT ON COLUMN public.schedule_participants.participation_type IS '参与类型：regular=常规，trial=试听，makeup=补课，substitute=代课';

-- =============================================================================
-- 第五步：创建数据完整性触发器
-- =============================================================================

-- 检查计划参与者的学生用户类型
CREATE OR REPLACE FUNCTION check_plan_participant_student_type()
RETURNS TRIGGER AS $$
BEGIN
  -- 检查学生ID对应的用户类型
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = NEW.student_id 
    AND user_type IN ('student', 'trial_user')
  ) THEN
    RAISE EXCEPTION '学生ID % 对应的用户不是学生或体验用户类型', NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_participants_check_student_type 
  BEFORE INSERT OR UPDATE ON public.plan_participants 
  FOR EACH ROW EXECUTE FUNCTION check_plan_participant_student_type();

CREATE TRIGGER schedule_participants_check_student_type 
  BEFORE INSERT OR UPDATE ON public.schedule_participants 
  FOR EACH ROW EXECUTE FUNCTION check_plan_participant_student_type();

-- 检查计划的教师用户类型
CREATE OR REPLACE FUNCTION check_plan_teacher_user_type()
RETURNS TRIGGER AS $$
BEGIN
  -- 检查教师ID对应的用户类型
  IF NEW.teacher_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = NEW.teacher_id 
      AND user_type = 'teacher'
    ) THEN
      RAISE EXCEPTION '教师ID % 对应的用户不是teacher类型', NEW.teacher_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_plans_check_teacher_type 
  BEFORE INSERT OR UPDATE ON public.schedule_plans 
  FOR EACH ROW EXECUTE FUNCTION check_plan_teacher_user_type();

-- =============================================================================
-- 第六步：启用RLS (Row Level Security)
-- =============================================================================

ALTER TABLE public.schedule_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_participants ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 第七步：创建RLS策略
-- =============================================================================

-- schedule_plans表RLS策略
CREATE POLICY "管理员和教师可以查看所有排课计划" ON public.schedule_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher', 'business_teacher', 'teacher')
    )
  );

CREATE POLICY "管理员可以管理所有排课计划" ON public.schedule_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "教师可以查看自己的排课计划" ON public.schedule_plans
  FOR SELECT USING (
    teacher_id = auth.uid()
  );

-- plan_participants表RLS策略
CREATE POLICY "管理员和教师可以查看计划参与者" ON public.plan_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher', 'business_teacher', 'teacher')
    )
  );

CREATE POLICY "管理员可以管理计划参与者" ON public.plan_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "学员可以查看自己的计划参与记录" ON public.plan_participants
  FOR SELECT USING (
    student_id = auth.uid()
  );

-- schedule_participants表RLS策略
CREATE POLICY "管理员和教师可以查看单课参与者" ON public.schedule_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher', 'business_teacher', 'teacher')
    )
  );

CREATE POLICY "管理员可以管理单课参与者" ON public.schedule_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "学员可以查看自己的单课参与记录" ON public.schedule_participants
  FOR SELECT USING (
    student_id = auth.uid()
  );

-- =============================================================================
-- 第八步：创建数据一致性视图和函数
-- =============================================================================

-- 创建获取某节课完整参与者名单的函数
CREATE OR REPLACE FUNCTION get_schedule_participants(p_schedule_id UUID)
RETURNS TABLE (
  student_id UUID,
  full_name TEXT,
  username TEXT,
  participation_source TEXT,  -- 'class', 'plan', 'schedule'
  participation_action TEXT,  -- 'include', 'exclude'
  participation_type TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH schedule_info AS (
    SELECT s.class_id, s.plan_id
    FROM schedules s
    WHERE s.id = p_schedule_id
  ),
  -- 来自班级的学员
  class_students AS (
    SELECT 
      cm.student_id,
      p.full_name,
      p.username,
      'class'::TEXT as participation_source,
      'include'::TEXT as participation_action,
      'regular'::TEXT as participation_type
    FROM schedule_info si
    JOIN class_members cm ON cm.class_id = si.class_id
    JOIN profiles p ON p.id = cm.student_id
    WHERE cm.enrollment_status = 'enrolled'
      AND p.user_type IN ('student', 'trial_user')
  ),
  -- 来自计划的额外学员
  plan_students AS (
    SELECT 
      pp.student_id,
      p.full_name,
      p.username,
      'plan'::TEXT as participation_source,
      'include'::TEXT as participation_action,
      pp.participation_type::TEXT
    FROM schedule_info si
    JOIN plan_participants pp ON pp.plan_id = si.plan_id
    JOIN profiles p ON p.id = pp.student_id
    WHERE si.plan_id IS NOT NULL
      AND pp.status = 'active'
      AND p.user_type IN ('student', 'trial_user')
  ),
  -- 单课级别的调整
  schedule_adjustments AS (
    SELECT 
      sp.student_id,
      p.full_name,
      p.username,
      'schedule'::TEXT as participation_source,
      sp.participation_action::TEXT,
      sp.participation_type::TEXT
    FROM schedule_participants sp
    JOIN profiles p ON p.id = sp.student_id
    WHERE sp.schedule_id = p_schedule_id
      AND sp.status = 'confirmed'
      AND p.user_type IN ('student', 'trial_user')
  ),
  -- 合并所有来源
  all_participants AS (
    SELECT * FROM class_students
    UNION ALL
    SELECT * FROM plan_students
    UNION ALL
    SELECT * FROM schedule_adjustments
  )
  SELECT DISTINCT
    ap.student_id,
    ap.full_name,
    ap.username,
    ap.participation_source,
    ap.participation_action,
    ap.participation_type
  FROM all_participants ap
  ORDER BY ap.full_name;
END;
$$;

-- 设置函数权限
GRANT EXECUTE ON FUNCTION get_schedule_participants(UUID) TO anon, authenticated;

-- 添加函数注释
COMMENT ON FUNCTION get_schedule_participants(UUID) IS '获取某节课的完整参与者名单，包含来自班级、计划和单课级别的所有学员';

-- =============================================================================
-- 第九步：插入测试数据（可选）
-- =============================================================================

-- 注意：这里不插入测试数据，等待后续步骤中通过应用层创建

-- =============================================================================
-- 迁移完成
-- =============================================================================

-- 迁移文件创建完成，等待部署到数据库 