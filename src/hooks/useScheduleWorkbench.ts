import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  WorkbenchState,
  WorkbenchViewMode,
  WorkbenchFilters,
  SchedulePlanWithStats,
  ScheduleWithDetails,
  StudentParticipation,
  SchedulePlanFormData,
  BatchScheduleData
} from '@/types/schedule-workbench.types';
import {
  getSchedulePlansWithStats,
  getSchedulesWithDetails,
  createSchedulePlanWithParticipants,
  updateSchedulePlan,
  deleteSchedulePlan,
  createPlanSchedulesBatch,
  getScheduleParticipants,
  managePlanParticipants,
  manageScheduleParticipants,
  getBaseData,
  getWorkbenchStats,
  getAvailableStudents
} from '@/services/scheduleWorkbenchService';

// 初始筛选状态
const initialFilters: WorkbenchFilters = {
  search_term: '',
  class_id: 'all',
  subject_id: 'all',
  teacher_id: 'all',
  venue_id: 'all',
  status: 'all',
  plan_id: 'all',
  date_from: '',
  date_to: ''
};

// 初始工作台状态
const initialState: WorkbenchState = {
  current_view: 'plans',
  loading: false,
  plans: [],
  schedules: [],
  participants: [],
  current_page: 1,
  page_size: 20,
  total_count: 0,
  filters: initialFilters,
  selected_plan: null,
  selected_schedule: null
};

export function useScheduleWorkbench() {
  // =============================================================================
  // 状态管理
  // =============================================================================
  
  const [state, setState] = useState<WorkbenchState>(initialState);
  const [baseData, setBaseData] = useState<{
    classes: any[];
    subjects: any[];
    teachers: any[];
    venues: any[];
  }>({
    classes: [],
    subjects: [],
    teachers: [],
    venues: []
  });
  const [stats, setStats] = useState<{
    active_plans_count: number;
    monthly_schedules_count: number;
    completed_schedules_count: number;
    pending_schedules_count: number;
  }>({
    active_plans_count: 0,
    monthly_schedules_count: 0,
    completed_schedules_count: 0,
    pending_schedules_count: 0
  });

  // =============================================================================
  // 基础操作函数
  // =============================================================================

  // 更新状态的通用函数
  const updateState = useCallback((updates: Partial<WorkbenchState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 更新筛选条件
  const updateFilters = useCallback((newFilters: Partial<WorkbenchFilters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      current_page: 1 // 重置到第一页
    }));
  }, []);

  // 切换视图
  const switchView = useCallback((view: WorkbenchViewMode) => {
    updateState({ 
      current_view: view,
      current_page: 1
    });
  }, [updateState]);

  // 设置页码
  const setPage = useCallback((page: number) => {
    updateState({ current_page: page });
  }, [updateState]);

  // 设置页面大小
  const setPageSize = useCallback((size: number) => {
    updateState({ 
      page_size: size,
      current_page: 1
    });
  }, [updateState]);

  // =============================================================================
  // 数据加载函数
  // =============================================================================

  // 加载基础数据
  const loadBaseData = useCallback(async () => {
    try {
      const data = await getBaseData();
      setBaseData(data);
    } catch (error) {
      console.error('加载基础数据失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载基础数据，请刷新页面重试"
      });
    }
  }, []);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const statsData = await getWorkbenchStats();
      setStats(statsData);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  // 加载课表计划列表
  const loadPlans = useCallback(async (force = false) => {
    if (state.current_view !== 'plans' && !force) return;
    
    updateState({ loading: true });
    try {
      const result = await getSchedulePlansWithStats({
        limit: state.page_size,
        offset: (state.current_page - 1) * state.page_size,
        search_term: state.filters.search_term || null,
        class_id: state.filters.class_id !== 'all' ? state.filters.class_id : null,
        subject_id: state.filters.subject_id !== 'all' ? state.filters.subject_id : null,
        teacher_id: state.filters.teacher_id !== 'all' ? state.filters.teacher_id : null,
        status: state.filters.status !== 'all' ? state.filters.status : null
      });

      updateState({
        plans: result.plans as SchedulePlanWithStats[],
        total_count: result.total_count,
        loading: false
      });
    } catch (error) {
      console.error('加载课表计划失败:', error);
      updateState({ loading: false });
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载课表计划列表"
      });
    }
  }, [state.current_view, state.page_size, state.current_page, state.filters, updateState]);

  // 加载排课列表
  const loadSchedules = useCallback(async (force = false) => {
    if (state.current_view !== 'schedules' && state.current_view !== 'calendar' && !force) return;
    
    updateState({ loading: true });
    try {
      const result = await getSchedulesWithDetails({
        limit: state.page_size,
        offset: (state.current_page - 1) * state.page_size,
        search_term: state.filters.search_term || null,
        class_id: state.filters.class_id !== 'all' ? state.filters.class_id : null,
        subject_id: state.filters.subject_id !== 'all' ? state.filters.subject_id : null,
        teacher_id: state.filters.teacher_id !== 'all' ? state.filters.teacher_id : null,
        venue_id: state.filters.venue_id !== 'all' ? state.filters.venue_id : null,
        status: state.filters.status !== 'all' ? state.filters.status : null,
        plan_id: state.filters.plan_id !== 'all' ? state.filters.plan_id : null,
        date_from: state.filters.date_from || null,
        date_to: state.filters.date_to || null
      });

      updateState({
        schedules: result.schedules,
        total_count: result.total_count,
        loading: false
      });
    } catch (error) {
      console.error('加载排课列表失败:', error);
      updateState({ loading: false });
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载排课列表"
      });
    }
  }, [state.current_view, state.page_size, state.current_page, state.filters, updateState]);

  // 加载参与者列表
  const loadParticipants = useCallback(async (scheduleId: string) => {
    try {
      const participants = await getScheduleParticipants(scheduleId);
      updateState({ participants });
    } catch (error) {
      console.error('加载参与者列表失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载参与者列表"
      });
    }
  }, [updateState]);

  // =============================================================================
  // 业务操作函数
  // =============================================================================

  // 创建课表计划
  const createPlan = useCallback(async (planData: SchedulePlanFormData) => {
    try {
      const result = await createSchedulePlanWithParticipants(planData);
      
      toast({
        title: "创建成功",
        description: `课表计划"${planData.name}"已创建，添加了${result.added_students_count}名额外学员`
      });

      // 刷新数据
      await loadPlans(true);
      await loadStats();
      
      return result;
    } catch (error) {
      console.error('创建课表计划失败:', error);
      toast({
        variant: "destructive",
        title: "创建失败",
        description: "创建课表计划失败，请重试"
      });
      throw error;
    }
  }, [loadPlans, loadStats]);

  // 更新课表计划
  const updatePlanData = useCallback(async (planId: string, updates: Partial<SchedulePlanFormData>) => {
    try {
      await updateSchedulePlan(planId, updates);
      
      toast({
        title: "更新成功",
        description: "课表计划信息已更新"
      });

      // 刷新数据
      await loadPlans(true);
      
    } catch (error) {
      console.error('更新课表计划失败:', error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: "更新课表计划失败，请重试"
      });
      throw error;
    }
  }, [loadPlans]);

  // 删除课表计划
  const deletePlan = useCallback(async (planId: string) => {
    try {
      await deleteSchedulePlan(planId);
      
      toast({
        title: "删除成功",
        description: "课表计划已删除"
      });

      // 刷新数据
      await loadPlans(true);
      await loadStats();
      
    } catch (error) {
      console.error('删除课表计划失败:', error);
      toast({
        variant: "destructive",
        title: "删除失败",
        description: "删除课表计划失败，请重试"
      });
      throw error;
    }
  }, [loadPlans, loadStats]);

  // 批量创建排课
  const batchCreateSchedules = useCallback(async (
    planId: string | null,
    schedulesData: BatchScheduleData['schedules']
  ) => {
    try {
      const result = await createPlanSchedulesBatch(planId, schedulesData);
      
      toast({
        title: "批量创建成功",
        description: `成功创建${result.success_count}节课，失败${result.error_count}节课`
      });

      // 刷新数据
      await loadSchedules(true);
      if (planId) {
        await loadPlans(true);
      }
      
      return result;
    } catch (error) {
      console.error('批量创建排课失败:', error);
      toast({
        variant: "destructive",
        title: "批量创建失败",
        description: "批量创建排课失败，请重试"
      });
      throw error;
    }
  }, [loadSchedules, loadPlans]);

  // 管理计划参与者
  const managePlanStudents = useCallback(async (
    planId: string,
    action: 'add' | 'remove' | 'replace',
    studentIds: string[],
    participationType: 'full' | 'partial' | 'observer' = 'full',
    notes?: string
  ) => {
    try {
      await managePlanParticipants(planId, {
        action,
        student_ids: studentIds,
        participation_type: participationType,
        notes
      });
      
      const actionText = action === 'add' ? '添加' : action === 'remove' ? '移除' : '更新';
      toast({
        title: "操作成功",
        description: `${actionText}计划参与者成功`
      });

      // 刷新数据
      await loadPlans(true);
      
    } catch (error) {
      console.error('管理计划参与者失败:', error);
      toast({
        variant: "destructive",
        title: "操作失败",
        description: "管理计划参与者失败，请重试"
      });
      throw error;
    }
  }, [loadPlans]);

  // 管理单课参与者
  const manageScheduleStudents = useCallback(async (
    scheduleId: string,
    studentId: string,
    action: 'add' | 'remove',
    participationType: 'full' | 'partial' | 'observer' = 'full',
    notes?: string
  ) => {
    try {
      await manageScheduleParticipants(scheduleId, studentId, {
        action,
        participation_type: participationType,
        notes
      });
      
      const actionText = action === 'add' ? '添加' : '移除';
      toast({
        title: "操作成功",
        description: `${actionText}课程参与者成功`
      });

      // 刷新参与者列表
      await loadParticipants(scheduleId);
      
    } catch (error) {
      console.error('管理单课参与者失败:', error);
      toast({
        variant: "destructive",
        title: "操作失败",
        description: "管理课程参与者失败，请重试"
      });
      throw error;
    }
  }, [loadParticipants]);

  // 选择计划
  const selectPlan = useCallback((plan: SchedulePlanWithStats | null) => {
    updateState({ selected_plan: plan });
  }, [updateState]);

  // 选择排课
  const selectSchedule = useCallback((schedule: ScheduleWithDetails | null) => {
    updateState({ selected_schedule: schedule });
    if (schedule) {
      loadParticipants(schedule.id);
    }
  }, [updateState, loadParticipants]);

  // =============================================================================
  // 工具函数
  // =============================================================================

  // 重置筛选条件
  const resetFilters = useCallback(() => {
    updateState({
      filters: initialFilters,
      current_page: 1
    });
  }, [updateState]);

  // 刷新当前视图数据
  const refreshCurrentView = useCallback(async () => {
    switch (state.current_view) {
      case 'plans':
        await loadPlans(true);
        break;
      case 'schedules':
      case 'calendar':
        await loadSchedules(true);
        break;
      default:
        break;
    }
  }, [state.current_view, loadPlans, loadSchedules]);

  // 全量刷新
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadBaseData(),
      loadStats(),
      refreshCurrentView()
    ]);
  }, [loadBaseData, loadStats, refreshCurrentView]);

  // =============================================================================
  // 生命周期
  // =============================================================================

  // 初始化加载
  useEffect(() => {
    loadBaseData();
    loadStats();
  }, [loadBaseData, loadStats]);

  // 当视图或筛选条件改变时重新加载数据
  useEffect(() => {
    if (state.current_view === 'plans') {
      loadPlans();
    } else if (state.current_view === 'schedules' || state.current_view === 'calendar') {
      loadSchedules();
    }
  }, [
    state.current_view,
    state.current_page,
    state.page_size,
    state.filters,
    loadPlans,
    loadSchedules
  ]);

  // =============================================================================
  // 返回API
  // =============================================================================

  return {
    // 状态
    state,
    baseData,
    stats,
    
    // 视图控制
    switchView,
    setPage,
    setPageSize,
    updateFilters,
    resetFilters,
    
    // 数据操作
    createPlan,
    updatePlanData,
    deletePlan,
    batchCreateSchedules,
    managePlanStudents,
    manageScheduleStudents,
    
    // 选择操作
    selectPlan,
    selectSchedule,
    
    // 数据加载
    loadParticipants,
    refreshCurrentView,
    refreshAll,
    
    // 工具函数
    getAvailableStudents
  };
} 