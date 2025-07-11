-- =============================================================================
-- 修复排课更新时的日期约束问题
-- 创建时间：2025-01-30
-- 功能：允许编辑历史课程信息，同时保持新建课程的日期验证
-- =============================================================================

-- =============================================================================
-- 第一步：删除现有的严格日期约束
-- =============================================================================

-- 删除过于严格的日期约束，它阻止了对历史课程的编辑
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_date_check;

-- =============================================================================
-- 第二步：创建更智能的日期验证触发器
-- =============================================================================

-- 创建智能日期验证函数：只在INSERT时检查日期，UPDATE时允许修改历史课程
CREATE OR REPLACE FUNCTION validate_schedule_date()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在INSERT操作时检查日期约束
  -- UPDATE操作允许修改历史课程的非日期字段
  IF TG_OP = 'INSERT' THEN
    -- 新建排课时，不允许选择过去的日期
    IF NEW.schedule_date < CURRENT_DATE THEN
      RAISE EXCEPTION '新建排课的日期不能早于今天，请选择今天或未来的日期';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- 更新排课时，如果日期字段被修改，则检查新日期
    IF OLD.schedule_date IS DISTINCT FROM NEW.schedule_date THEN
      -- 如果是修改日期字段，且新日期是过去的日期，则不允许
      IF NEW.schedule_date < CURRENT_DATE THEN
        RAISE EXCEPTION '不能将排课日期修改为过去的日期，请选择今天或未来的日期';
      END IF;
    END IF;
    -- 如果只是修改其他字段（如lesson_title），则允许，无论日期是否为过去
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 第三步：应用新的触发器
-- =============================================================================

-- 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS validate_schedule_date_trigger ON public.schedules;

-- 创建新的智能日期验证触发器
CREATE TRIGGER validate_schedule_date_trigger
  BEFORE INSERT OR UPDATE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION validate_schedule_date();

-- =============================================================================
-- 第四步：添加友好的注释说明
-- =============================================================================

COMMENT ON FUNCTION validate_schedule_date IS '智能排课日期验证：INSERT时检查日期不能为过去，UPDATE时只在修改日期字段时检查，允许编辑历史课程的其他信息';
COMMENT ON TRIGGER validate_schedule_date_trigger ON public.schedules IS '智能日期验证触发器：保护新建课程的日期有效性，同时允许编辑历史课程';

-- =============================================================================
-- 第五步：测试验证（可选）
-- =============================================================================

-- 可以在开发环境中测试以下场景：
-- 1. INSERT过去日期 - 应该失败
-- 2. INSERT今天或未来日期 - 应该成功  
-- 3. UPDATE历史课程的lesson_title - 应该成功
-- 4. UPDATE历史课程的schedule_date为过去日期 - 应该失败
-- 5. UPDATE历史课程的schedule_date为未来日期 - 应该成功 