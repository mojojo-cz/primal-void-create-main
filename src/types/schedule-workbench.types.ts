import { 
  SchedulePlan, 
  Schedule, 
  PlanParticipant, 
  ScheduleParticipant,
  Class,
  Subject,
  Venue
} from './database.types';

// =============================================================================
// 课表计划相关类型
// =============================================================================

// 带统计信息的课表计划
export interface SchedulePlanWithStats extends SchedulePlan {
  class_name: string;
  subject_name: string;
  teacher_name: string;
  venue_id?: string | null;
  venue_name?: string | null;
  // 统计信息
  total_schedules: number;
  completed_schedules: number;
  plan_participants_count: number;
  next_schedule_date: string | null;
}

// 课表计划表单数据
export interface SchedulePlanFormData {
  name: string;
  description: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  venue_id?: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'cancelled' | 'draft';
  // 额外学员列表
  extra_students: string[];
}

// 课表计划状态选项
export const PLAN_STATUS_OPTIONS = [
  { value: "active", label: "进行中", color: "blue" },
  { value: "draft", label: "草稿", color: "gray" },
  { value: "completed", label: "已完成", color: "green" },
  { value: "cancelled", label: "已取消", color: "red" },
] as const;

// =============================================================================
// 排课相关类型（扩展）
// =============================================================================

// 带详细信息的排课（包含计划信息）
export interface ScheduleWithDetails extends Omit<Schedule, 'venue_id'> {
  class_name: string;
  subject_name: string;
  teacher_name: string;
  teacher_full_name?: string;
  venue_name?: string;
  venue_id?: string | null;
  // 计划信息
  plan_name?: string;
  // 参与者统计
  participants_count: number;
}

// 智能排课表单数据
export interface SmartScheduleFormData {
  // 计划信息
  plan_id?: string | null;
  // 基础排课信息
  class_id: string;
  subject_id: string;
  teacher_id: string;
  venue_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  lesson_title: string;
  lesson_description: string;
  online_meeting_url: string;
  course_hours: number;
  notes: string;
  // 批量创建相关
  is_batch_create: boolean;
  batch_dates: string[];
  batch_time_slots: {
    start_time: string;
    end_time: string;
    lesson_title: string;
  }[];
}

// =============================================================================
// 参与者管理相关类型
// =============================================================================

// 学员参与信息
export interface StudentParticipation {
  student_id: string;
  student_name: string;
  full_name?: string;
  source: 'class' | 'plan' | 'schedule';
  participation_type: 'full' | 'partial' | 'observer';
  action?: 'add' | 'remove';
  status: 'active' | 'withdrawn' | 'confirmed' | 'pending';
  notes?: string;
}

// 课表计划参与者表单
export interface PlanParticipantFormData {
  plan_id: string;
  student_ids: string[];
  participation_type: 'full' | 'partial' | 'observer';
  notes?: string;
}

// 单课参与者表单
export interface ScheduleParticipantFormData {
  schedule_id: string;
  student_id: string;
  participation_action: 'add' | 'remove';
  participation_type: 'full' | 'partial' | 'observer';
  notes?: string;
}

// 参与类型选项
export const PARTICIPATION_TYPE_OPTIONS = [
  { value: "full", label: "全程参与", color: "green" },
  { value: "partial", label: "部分参与", color: "blue" },
  { value: "observer", label: "旁听", color: "gray" },
] as const;

// 参与动作选项
export const PARTICIPATION_ACTION_OPTIONS = [
  { value: "add", label: "临时添加", color: "green" },
  { value: "remove", label: "临时移除", color: "red" },
] as const;

// =============================================================================
// 批量操作相关类型
// =============================================================================

// 批量创建排课的数据结构
export interface BatchScheduleData {
  plan_id?: string | null;
  schedules: {
    class_id: string;
    subject_id: string;
    teacher_id: string;
    venue_id?: string | null;
    venue_name?: string | null;
    schedule_date: string;
    start_time: string;
    end_time: string;
    lesson_title: string;
    lesson_description?: string;
    online_meeting_url?: string;
    course_hours: number;
    notes?: string;
  }[];
}

// 批量操作结果
export interface BatchOperationResult {
  success_count: number;
  error_count: number;
  total_count: number;
  errors: {
    index: number;
    message: string;
    data?: any;
  }[];
}

// =============================================================================
// RPC函数返回类型
// =============================================================================

// get_schedule_plans_with_stats 返回类型
export interface SchedulePlanStatsResponse {
  id: string;
  name: string;
  description: string | null;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  total_schedules: number;
  completed_schedules: number;
  plan_participants_count: number;
  next_schedule_date: string | null;
}

// get_schedule_participants 返回类型
export interface ScheduleParticipantsResponse {
  student_id: string;
  student_name: string;
  full_name: string | null;
  source: 'class' | 'plan' | 'schedule';
  participation_type: string;
  action?: string;
  status: string;
  notes?: string;
}

// =============================================================================
// 工作台视图状态类型
// =============================================================================

// 工作台视图模式
export type WorkbenchViewMode = 'plans' | 'schedules' | 'calendar' | 'participants';

// 工作台筛选状态
export interface WorkbenchFilters {
  search_term: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  venue_id: string;
  status: string;
  plan_id: string;
  date_from: string;
  date_to: string;
}

// 工作台状态
export interface WorkbenchState {
  // 视图状态
  current_view: WorkbenchViewMode;
  loading: boolean;
  
  // 数据状态
  plans: SchedulePlanWithStats[];
  schedules: ScheduleWithDetails[];
  participants: StudentParticipation[];
  
  // 分页状态
  current_page: number;
  page_size: number;
  total_count: number;
  
  // 筛选状态
  filters: WorkbenchFilters;
  
  // 选中状态
  selected_plan: SchedulePlanWithStats | null;
  selected_schedule: ScheduleWithDetails | null;
}

// =============================================================================
// 工作台操作类型
// =============================================================================

// 创建计划操作数据
export interface CreatePlanOperation {
  plan_data: SchedulePlanFormData;
  extra_students: string[];
}

// 批量创建排课操作数据
export interface BatchCreateSchedulesOperation {
  plan_id?: string | null;
  schedules: BatchScheduleData['schedules'];
}

// 管理参与者操作数据
export interface ManageParticipantsOperation {
  plan_id?: string;
  schedule_id?: string;
  action: 'add' | 'remove' | 'update';
  participants: PlanParticipantFormData | ScheduleParticipantFormData;
} 