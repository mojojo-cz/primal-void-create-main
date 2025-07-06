import { supabase } from '@/integrations/supabase/client';
import {
  SchedulePlanWithStats,
  ScheduleWithDetails,
  SchedulePlanFormData,
  BatchScheduleData,
  BatchOperationResult,
  StudentParticipation,
  PlanParticipantFormData,
  ScheduleParticipantFormData,
  SchedulePlanStatsResponse,
  ScheduleParticipantsResponse
} from '@/types/schedule-workbench.types';
import {
  SchedulePlanInsert,
  PlanParticipantInsert,
  ScheduleParticipantInsert
} from '@/types/database.types';

// =============================================================================
// 课表计划相关服务
// =============================================================================

/**
 * 获取课表计划列表（带统计信息）
 */
export async function getSchedulePlansWithStats(params: {
  limit?: number;
  offset?: number;
  search_term?: string | null;
  class_id?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  status?: string | null;
} = {}) {
  const { 
    limit = 20, 
    offset = 0, 
    search_term = null,
    class_id = null,
    subject_id = null,
    teacher_id = null,
    status = null
  } = params;

  const { data, error } = await supabase.rpc('get_schedule_plans_with_stats', {
    p_limit: limit,
    p_offset: offset,
    p_search_term: search_term,
    p_class_id: class_id,
    p_subject_id: subject_id,
    p_teacher_id: teacher_id,
    p_status: status
  });

  if (error) {
    console.error('获取课表计划失败:', error);
    throw error;
  }

  return {
    plans: (data || []) as SchedulePlanStatsResponse[],
    total_count: data && data.length > 0 ? data[0]?.total_count || 0 : 0
  };
}

/**
 * 创建课表计划（带额外学员）
 */
export async function createSchedulePlanWithParticipants(
  planData: SchedulePlanFormData
): Promise<{ plan_id: string; added_students_count: number }> {
  const { extra_students, ...planInfo } = planData;

  const { data, error } = await supabase.rpc('create_schedule_plan_with_participants', {
    p_plan_name: planInfo.name,
    p_plan_description: planInfo.description,
    p_class_id: planInfo.class_id,
    p_subject_id: planInfo.subject_id,
    p_teacher_id: planInfo.teacher_id,
    p_start_date: planInfo.start_date || null,
    p_end_date: planInfo.end_date || null,
    p_additional_student_ids: extra_students || []
  });

  if (error) {
    console.error('创建课表计划失败:', error);
    throw error;
  }

  return {
    plan_id: data.plan_id,
    added_students_count: extra_students ? extra_students.length : 0
  };
}

/**
 * 更新课表计划
 */
export async function updateSchedulePlan(planId: string, updates: Partial<SchedulePlanFormData>) {
  const { extra_students, ...planUpdates } = updates;

  const { error } = await supabase
    .from('schedule_plans')
    .update({
      ...planUpdates,
      updated_at: new Date().toISOString()
    })
    .eq('id', planId);

  if (error) {
    console.error('更新课表计划失败:', error);
    throw error;
  }

  // 如果需要更新额外学员，调用专门的函数
  if (extra_students !== undefined) {
    await managePlanParticipants(planId, {
      action: 'replace',
      student_ids: extra_students,
      participation_type: 'full'
    });
  }
}

/**
 * 删除课表计划
 */
export async function deleteSchedulePlan(planId: string) {
  const { error } = await supabase
    .from('schedule_plans')
    .delete()
    .eq('id', planId);

  if (error) {
    console.error('删除课表计划失败:', error);
    throw error;
  }
}

// =============================================================================
// 排课相关服务（智能扩展）
// =============================================================================

/**
 * 获取排课列表（支持计划筛选）
 */
export async function getSchedulesWithDetails(params: {
  limit?: number;
  offset?: number;
  search_term?: string | null;
  class_id?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  venue_id?: string | null;
  status?: string | null;
  plan_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
} = {}) {
  const { 
    limit = 20, 
    offset = 0, 
    search_term = null,
    class_id = null,
    subject_id = null,
    teacher_id = null,
    venue_id = null,
    status = null,
    plan_id = null,
    date_from = null,
    date_to = null
  } = params;

  const { data, error } = await supabase.rpc('get_schedules_with_details', {
    p_limit: limit,
    p_offset: offset,
    p_search_term: search_term,
    p_class_id: class_id,
    p_subject_id: subject_id,
    p_teacher_id: teacher_id,
    p_venue_id: venue_id,
    p_status: status,
    p_plan_id: plan_id,
    p_date_from: date_from,
    p_date_to: date_to
  });

  if (error) {
    console.error('获取排课列表失败:', error);
    throw error;
  }

  return {
    schedules: (data || []).map(schedule => ({
      ...schedule,
      venue_id: schedule.venue_id || null,
    })) as ScheduleWithDetails[],
    total_count: data && data.length > 0 ? data[0]?.total_count || 0 : 0
  };
}

/**
 * 批量创建排课到计划
 */
export async function createPlanSchedulesBatch(
  planId: string | null,
  schedulesData: BatchScheduleData['schedules']
): Promise<BatchOperationResult> {
  const { data, error } = await supabase.rpc('create_plan_schedules_batch', {
    p_plan_id: planId,
    p_schedules: schedulesData
  });

  if (error) {
    console.error('批量创建排课失败:', error);
    throw error;
  }

  return data;
}

/**
 * 获取可用教室列表
 */
export async function getAvailableVenues() {
  const { data, error } = await supabase.rpc('get_available_venues');

  if (error) {
    console.error('获取可用教室失败:', error);
    throw error;
  }

  return data || [];
}

// =============================================================================
// 参与者管理服务
// =============================================================================

/**
 * 获取排课参与者列表
 */
export async function getScheduleParticipants(scheduleId: string): Promise<StudentParticipation[]> {
  const { data, error } = await supabase.rpc('get_schedule_participants', {
    p_schedule_id: scheduleId
  });

  if (error) {
    console.error('获取排课参与者失败:', error);
    throw error;
  }

  return (data || []).map((participant: ScheduleParticipantsResponse) => ({
    student_id: participant.student_id,
    student_name: participant.student_name,
    full_name: participant.full_name,
    source: participant.source,
    participation_type: participant.participation_type,
    action: participant.action,
    status: participant.status,
    notes: participant.notes
  })) as StudentParticipation[];
}

/**
 * 管理计划级参与者
 */
export async function managePlanParticipants(
  planId: string, 
  params: {
    action: 'add' | 'remove' | 'replace';
    student_ids: string[];
    participation_type?: 'full' | 'partial' | 'observer';
    notes?: string;
  }
) {
  const { data, error } = await supabase.rpc('manage_plan_participants', {
    p_plan_id: planId,
    p_action: params.action,
    p_student_ids: params.student_ids,
    p_participation_type: params.participation_type || 'full',
    p_notes: params.notes || null
  });

  if (error) {
    console.error('管理计划参与者失败:', error);
    throw error;
  }

  return data;
}

/**
 * 管理单课级参与者
 */
export async function manageScheduleParticipants(
  scheduleId: string,
  studentId: string,
  params: {
    action: 'add' | 'remove';
    participation_type?: 'full' | 'partial' | 'observer';
    notes?: string;
  }
) {
  const { data, error } = await supabase.rpc('manage_schedule_participants', {
    p_schedule_id: scheduleId,
    p_student_id: studentId,
    p_action: params.action,
    p_participation_type: params.participation_type || 'full',
    p_notes: params.notes || null
  });

  if (error) {
    console.error('管理单课参与者失败:', error);
    throw error;
  }

  return data;
}

// =============================================================================
// 数据查询服务
// =============================================================================

/**
 * 获取可用学员列表
 */
export async function getAvailableStudents(classId?: string) {
  const { data, error } = await supabase.rpc('get_available_students', {
    p_class_id: classId || null
  });

  if (error) {
    console.error('获取可用学员失败:', error);
    throw error;
  }

  return data || [];
}

/**
 * 获取基础数据（班级、课程、教师、场地）
 */
export async function getBaseData() {
  try {
    const [classesResult, subjectsResult, teachersResult, venuesResult] = await Promise.all([
      // 获取班级列表
      supabase
        .from('classes')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      
      // 获取课程列表
      supabase
        .from('subjects')
        .select('*')
        .eq('status', 'active')
        .order('name'),
      
      // 获取教师列表
      supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('user_type', 'teacher')
        .order('full_name'),
      
      // 获取场地列表
      supabase
        .from('venues')
        .select('*')
        .eq('status', 'available')
        .eq('type', 'classroom')
        .order('name')
    ]);

    if (classesResult.error) throw classesResult.error;
    if (subjectsResult.error) throw subjectsResult.error;
    if (teachersResult.error) throw teachersResult.error;
    if (venuesResult.error) throw venuesResult.error;

    return {
      classes: classesResult.data || [],
      subjects: subjectsResult.data || [],
      teachers: teachersResult.data || [],
      venues: venuesResult.data || []
    };
  } catch (error) {
    console.error('获取基础数据失败:', error);
    throw error;
  }
}

// =============================================================================
// 统计查询服务
// =============================================================================

/**
 * 获取工作台统计概览
 */
export async function getWorkbenchStats() {
  try {
    const [plansResult, schedulesResult] = await Promise.all([
      // 获取计划统计
      supabase
        .from('schedule_plans')
        .select('status')
        .eq('status', 'active'),
      
      // 获取本月排课统计
      supabase
        .from('schedules')
        .select('status, schedule_date')
        .gte('schedule_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
        .lte('schedule_date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0])
    ]);

    if (plansResult.error) throw plansResult.error;
    if (schedulesResult.error) throw schedulesResult.error;

    const activePlansCount = plansResult.data?.length || 0;
    const monthlySchedulesCount = schedulesResult.data?.length || 0;
    const completedSchedulesCount = schedulesResult.data?.filter(s => s.status === 'completed').length || 0;

    return {
      active_plans_count: activePlansCount,
      monthly_schedules_count: monthlySchedulesCount,
      completed_schedules_count: completedSchedulesCount,
      pending_schedules_count: monthlySchedulesCount - completedSchedulesCount
    };
  } catch (error) {
    console.error('获取工作台统计失败:', error);
    throw error;
  }
} 