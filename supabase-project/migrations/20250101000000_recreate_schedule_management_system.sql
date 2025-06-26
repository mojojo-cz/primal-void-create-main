-- 课表管理系统重新设计
-- 文件名：20250101000000_recreate_schedule_management_system.sql
-- 基于用户核心概念：用户(User)、课程(Course)、班级(Class/Cohort)、排课记录(Schedule Entry)

-- =============================================================================
-- 第一步：删除旧的不合理表结构
-- =============================================================================

-- 删除旧的课表管理相关表
DROP TABLE IF EXISTS public.student_schedules CASCADE;
DROP TABLE IF EXISTS public.class_schedules CASCADE;

-- =============================================================================
-- 第二步：更新用户表，增加"任课老师"用户类型
-- =============================================================================

-- 更新 profiles 表的用户类型约束，增加 teacher 类型
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN (
  'registered',        -- 注册用户
  'trial_user',        -- 体验用户
  'student',           -- 正式学员
  'teacher',           -- 任课老师 (新增)
  'head_teacher',      -- 班主任
  'business_teacher',  -- 业务老师
  'admin'              -- 管理员
));

-- 更新用户类型说明注释
COMMENT ON COLUMN public.profiles.user_type IS '用户类型: registered(注册用户), trial_user(体验用户), student(学员), teacher(任课老师), head_teacher(班主任), business_teacher(业务老师), admin(管理员)';

-- =============================================================================
-- 第三步：创建核心概念表结构
-- =============================================================================

-- 1. 课程表 (subjects) - 抽象课程概念
CREATE TABLE public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,                    -- 课程名称，如"高等数学"、"政治经济学"
  category TEXT NOT NULL,                       -- 所属学科，如"数学"、"英语"、"政治"
  description TEXT,                             -- 课程简介
  difficulty_level TEXT DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  credit_hours INTEGER DEFAULT 0,              -- 总学分/课时
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. 班级表 (classes) - 学生群体概念  
CREATE TABLE public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,                   -- 班级名称，如"2025考研数学暑期强化班"
  description TEXT,                            -- 班级描述
  start_date DATE,                             -- 开班日期
  end_date DATE,                               -- 结束日期
  max_students INTEGER DEFAULT 50,             -- 预计最大学员数
  head_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- 班主任/负责人
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 约束：结束日期不能早于开始日期
  CONSTRAINT classes_date_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- 3. 班级成员表 (class_members) - 学生与班级的多对多关系
CREATE TABLE public.class_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  enrollment_status TEXT DEFAULT 'enrolled' CHECK (enrollment_status IN ('enrolled', 'withdrawn', 'completed', 'suspended')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  notes TEXT,                                  -- 备注信息
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 防止学生重复加入同一班级
  UNIQUE (class_id, student_id)
);

-- 4. 排课表 (schedules) - 具体的课程安排
CREATE TABLE public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  
  -- 时间安排
  schedule_date DATE NOT NULL,                 -- 上课日期
  start_time TIME NOT NULL,                    -- 开始时间
  end_time TIME NOT NULL,                      -- 结束时间
  duration_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  ) STORED,                                    -- 自动计算课程时长
  
  -- 地点信息
  location TEXT,                               -- 上课地点/教室
  online_meeting_url TEXT,                     -- 线上直播链接
  
  -- 课程信息
  lesson_title TEXT NOT NULL,                  -- 本节课标题
  lesson_description TEXT,                     -- 本节课描述
  course_hours DECIMAL(3,1) DEFAULT 1.0,      -- 本节课课时数
  
  -- 状态管理
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed')),
  
  -- 备注
  notes TEXT,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 约束：结束时间必须晚于开始时间
  CONSTRAINT schedules_time_check CHECK (end_time > start_time),
  -- 约束：教师必须是teacher用户类型 (通过触发器检查)
  -- 约束：排课日期不能是过去的日期 (允许当天)
  CONSTRAINT schedules_date_check CHECK (schedule_date >= CURRENT_DATE)
);

-- =============================================================================
-- 第四步：创建索引优化查询性能
-- =============================================================================

-- subjects表索引
CREATE INDEX idx_subjects_category ON public.subjects(category);
CREATE INDEX idx_subjects_status ON public.subjects(status);
CREATE INDEX idx_subjects_name ON public.subjects(name);

-- classes表索引  
CREATE INDEX idx_classes_head_teacher ON public.classes(head_teacher_id);
CREATE INDEX idx_classes_status ON public.classes(status);
CREATE INDEX idx_classes_dates ON public.classes(start_date, end_date);

-- class_members表索引
CREATE INDEX idx_class_members_class_id ON public.class_members(class_id);
CREATE INDEX idx_class_members_student_id ON public.class_members(student_id);
CREATE INDEX idx_class_members_status ON public.class_members(enrollment_status);

-- schedules表索引
CREATE INDEX idx_schedules_class_id ON public.schedules(class_id);
CREATE INDEX idx_schedules_subject_id ON public.schedules(subject_id);
CREATE INDEX idx_schedules_teacher_id ON public.schedules(teacher_id);
CREATE INDEX idx_schedules_date ON public.schedules(schedule_date);
CREATE INDEX idx_schedules_status ON public.schedules(status);
CREATE INDEX idx_schedules_datetime ON public.schedules(schedule_date, start_time);

-- =============================================================================
-- 第五步：创建更新时间戳触发器
-- =============================================================================

-- 为新表创建自动更新时间戳触发器
CREATE TRIGGER update_subjects_updated_at 
  BEFORE UPDATE ON public.subjects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at 
  BEFORE UPDATE ON public.classes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at 
  BEFORE UPDATE ON public.schedules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 第六步：创建数据完整性触发器
-- =============================================================================

-- 检查教师用户类型的触发器
CREATE OR REPLACE FUNCTION check_teacher_user_type()
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

CREATE TRIGGER schedules_check_teacher_type 
  BEFORE INSERT OR UPDATE ON public.schedules 
  FOR EACH ROW EXECUTE FUNCTION check_teacher_user_type();

-- 检查班主任用户类型的触发器
CREATE OR REPLACE FUNCTION check_head_teacher_user_type()
RETURNS TRIGGER AS $$
BEGIN
  -- 检查班主任ID对应的用户类型
  IF NEW.head_teacher_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = NEW.head_teacher_id 
      AND user_type IN ('head_teacher', 'admin')
    ) THEN
      RAISE EXCEPTION '班主任ID % 对应的用户不是班主任或管理员类型', NEW.head_teacher_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER classes_check_head_teacher_type 
  BEFORE INSERT OR UPDATE ON public.classes 
  FOR EACH ROW EXECUTE FUNCTION check_head_teacher_user_type();

-- 检查学生用户类型的触发器
CREATE OR REPLACE FUNCTION check_student_user_type()
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

CREATE TRIGGER class_members_check_student_type 
  BEFORE INSERT OR UPDATE ON public.class_members 
  FOR EACH ROW EXECUTE FUNCTION check_student_user_type();

-- =============================================================================
-- 第七步：启用RLS (Row Level Security)
-- =============================================================================

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 第八步：创建RLS策略
-- =============================================================================

-- subjects表RLS策略
CREATE POLICY "管理员和教师可以查看所有课程" ON public.subjects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher', 'business_teacher', 'teacher')
    )
  );

CREATE POLICY "管理员可以管理所有课程" ON public.subjects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- classes表RLS策略
CREATE POLICY "管理员和教师可以查看所有班级" ON public.classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher', 'business_teacher', 'teacher')
    )
  );

CREATE POLICY "管理员和班主任可以管理班级" ON public.classes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher')
    )
  );

-- class_members表RLS策略
CREATE POLICY "学生可以查看自己的班级" ON public.class_members
  FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher', 'business_teacher', 'teacher')
    )
  );

CREATE POLICY "管理员和班主任可以管理班级成员" ON public.class_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher')
    )
  );

-- schedules表RLS策略
CREATE POLICY "所有认证用户可以查看排课" ON public.schedules
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "管理员、班主任和任课老师可以管理排课" ON public.schedules
  FOR ALL USING (
    teacher_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'head_teacher')
    )
  );

-- =============================================================================
-- 第九步：添加表注释
-- =============================================================================

COMMENT ON TABLE public.subjects IS '课程表 - 抽象课程概念，如高等数学、政治经济学等';
COMMENT ON TABLE public.classes IS '班级表 - 学生群体概念，如2025考研数学暑期强化班';
COMMENT ON TABLE public.class_members IS '班级成员表 - 学生与班级的多对多关系';
COMMENT ON TABLE public.schedules IS '排课表 - 具体的课程安排，绑定班级、课程、教师、时间、地点';

-- 字段注释
COMMENT ON COLUMN public.subjects.name IS '课程名称，如"高等数学"、"政治经济学"';
COMMENT ON COLUMN public.subjects.category IS '所属学科，如"数学"、"英语"、"政治"';
COMMENT ON COLUMN public.classes.name IS '班级名称，如"2025考研数学暑期强化班"';
COMMENT ON COLUMN public.classes.max_students IS '预计最大学员数';
COMMENT ON COLUMN public.class_members.student_id IS '学生ID，支持学生加入多个班级';
COMMENT ON COLUMN public.schedules.lesson_title IS '本节课标题';
COMMENT ON COLUMN public.schedules.location IS '上课地点/教室';
COMMENT ON COLUMN public.schedules.online_meeting_url IS '线上直播链接'; 