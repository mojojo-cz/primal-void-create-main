import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, 
  Calendar, 
  BookOpen, 
  ChevronRight, 
  Plus, 
  Layers, 
  Users, 
  Clock, 
  MapPin, 
  Edit2, 
  Trash2,
  UserPlus,
  Save,
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  Settings,
  X,
  User
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { 
  getSchedulePlansWithStats,
  createSchedulePlanWithParticipants,
  createPlanSchedulesBatch,
  getAvailableStudents
} from "@/services/scheduleWorkbenchService";
import type { 
  SchedulePlanWithStats, 
  SchedulePlanFormData, 
  StudentParticipation 
} from "@/types/schedule-workbench.types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// 简化的排课数据类型，用于回调
interface CreatedScheduleData {
  id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  lesson_title: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  venue_id?: string | null;
  plan_id?: string | null;
  // 显示用的关联数据
  class_name: string;
  subject_name: string;
  teacher_name: string;
  venue_name?: string;
  plan_name?: string;
}

interface SmartScheduleWorkbenchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduleCreated?: (createdSchedules?: {
    newSchedules: CreatedScheduleData[];
    updatedSchedules: CreatedScheduleData[];
    deletedScheduleIds: string[];
  }) => void;
}

// 预览课程项类型
interface PreviewScheduleItem {
  id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  lesson_title: string;
  teacher_id: string;
  subject_id: string;
  venue_id?: string;
  lesson_description?: string;
  location?: string;
  duration_minutes?: number;
  // 参与者信息
  participants?: StudentParticipation[];
  // 临时数据标识
  isNew?: boolean;
  isEdited?: boolean;
  // 冲突检测信息
  teacher_conflict_info?: { conflicting_item_id?: string; schedule_id?: string; lesson_title: string; plan_name?: string; } | null;
  venue_conflict_info?: { conflicting_item_id?: string; schedule_id?: string; lesson_title: string; plan_name?: string; } | null;
}

// 重复频率类型
type RepeatFrequency = 'single' | 'daily' | 'weekly';

export default function SmartScheduleWorkbench({ 
  open, 
  onOpenChange, 
  onScheduleCreated 
}: SmartScheduleWorkbenchProps) {
  
  // =============================================================================
  // 状态管理
  // =============================================================================
  
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'single' | 'batch'>('batch');
  const [isConflictChecking, setIsConflictChecking] = useState(false);
  
  // 课表相关状态
  const [selectedPlan, setSelectedPlan] = useState<SchedulePlanWithStats | null>(null);
  const [isCreatingNewPlan, setIsCreatingNewPlan] = useState(false);
  const [isEditingExistingPlan, setIsEditingExistingPlan] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<SchedulePlanWithStats[]>([]);
  
  // 计划级参与者状态
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [additionalStudents, setAdditionalStudents] = useState<string[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]); // 班级内学员
  const [availableAdditionalStudents, setAvailableAdditionalStudents] = useState<any[]>([]); // 可选插班学员（不在班级内的其他正式学员）
  const [selectedAdditionalStudents, setSelectedAdditionalStudents] = useState<any[]>([]); // 已选择的插班学员完整信息
  
  // 课程信息状态
  const [lessonTitle, setLessonTitle] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  
  // 内联编辑主题状态
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [isComposing, setIsComposing] = useState(false); // 用于处理中文输入法
  
  // 排课工具状态
  const [scheduleDate, setScheduleDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('weekly');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [repeatStartDate, setRepeatStartDate] = useState('');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  
  // 预览列表状态
  const [previewSchedules, setPreviewSchedules] = useState<PreviewScheduleItem[]>([]);
  // 删除的已有课程ID列表
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<string[]>([]);
  
  // 用于防止删除操作中的状态竞争
  const conflictCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 新计划表单状态
  const [newPlanForm, setNewPlanForm] = useState({
    name: '',
    venue_id: ''
  });

  // 单课级学员管理状态
  const [participantDialog, setParticipantDialog] = useState<{
    open: boolean;
    scheduleId: string | null;
    scheduleTitle: string;
  }>({
    open: false,
    scheduleId: null,
    scheduleTitle: ''
  });
  const [scheduleParticipants, setScheduleParticipants] = useState<{
    classStudents: StudentParticipation[];
    planStudents: StudentParticipation[];
    scheduleStudents: StudentParticipation[];
  }>({
    classStudents: [],
    planStudents: [],
    scheduleStudents: []
  });
  const [participantLoading, setParticipantLoading] = useState(false);

  // 基础数据 - 应该从API获取
  const [baseData, setBaseData] = useState({
    classes: [] as any[],
    subjects: [] as any[],
    teachers: [] as any[],
    venues: [] as any[]
  });

  // 课程编辑状态
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    scheduleId: string | null;
    scheduleData: PreviewScheduleItem | null;
  }>({
    open: false,
    scheduleId: null,
    scheduleData: null
  });
  const [editForm, setEditForm] = useState({
    schedule_date: '',
    start_time: '',
    end_time: '',
    lesson_title: '',
    lesson_description: '',
    location: '',
    teacher_id: '',
    notes: ''
  });
  const [editLoading, setEditLoading] = useState(false);

  // 新增搜索相关状态
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);
  const [studentSearchValue, setStudentSearchValue] = useState('');
  const [teacherSearchOpen, setTeacherSearchOpen] = useState(false);

  // 关闭确认对话框状态
  const [closeConfirmDialog, setCloseConfirmDialog] = useState(false);

  // 清空预览确认对话框状态
  const [clearPreviewDialog, setClearPreviewDialog] = useState(false);

  // =============================================================================
  // 关闭确认处理
  // =============================================================================
  
  const handleCloseRequest = (requestedOpen: boolean) => {
    // 如果是要打开对话框，直接执行
    if (requestedOpen) {
      onOpenChange(requestedOpen);
      return;
    }
    
    // 如果是要关闭对话框，检查是否有未保存的数据
    if (previewSchedules.length > 0) {
      // 显示确认对话框
      setCloseConfirmDialog(true);
    } else {
      // 没有未保存数据，重置状态并关闭
      resetWorkbench();
      onOpenChange(false);
    }
  };

  // 确认关闭处理
  const handleConfirmClose = () => {
    // 用户确认关闭，清空数据并关闭
    resetWorkbench();
    setCloseConfirmDialog(false);
    onOpenChange(false);
  };

  // 取消关闭处理
  const handleCancelClose = () => {
    setCloseConfirmDialog(false);
    // 对话框保持打开状态，数据得以保留
  };

  // 清空预览处理
  const handleClearPreview = () => {
    if (previewSchedules.length > 0) {
      setClearPreviewDialog(true);
    }
  };

  // 确认清空预览
  const handleConfirmClearPreview = () => {
    setPreviewSchedules([]);
    setClearPreviewDialog(false);
  };

  // 取消清空预览
  const handleCancelClearPreview = () => {
    setClearPreviewDialog(false);
  };



  // =============================================================================
  // 数据获取
  // =============================================================================
  
  useEffect(() => {
    if (open) {
      // 每次打开时都重置状态，确保获得干净的工作台
      resetWorkbench();
      loadBaseData();
      loadAvailablePlans();
    }
  }, [open]);

  useEffect(() => {
    if (selectedClass) {
      loadStudentsForClass(selectedClass);
    }
  }, [selectedClass]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (conflictCheckTimeoutRef.current) {
        clearTimeout(conflictCheckTimeoutRef.current);
      }
      setIsConflictChecking(false);
    };
  }, []);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      
      // 加载班级列表
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, description, head_teacher_id')
        .eq('status', 'active')
        .order('name');
      
      if (classesError) throw classesError;

      // 加载科目列表  
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, category, description')
        .eq('status', 'active')
        .order('name');
      
      if (subjectsError) throw subjectsError;

      // 加载教师列表
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('user_type', 'teacher')
        .order('full_name');
      
      if (teachersError) throw teachersError;

      // 加载场地列表（教室类型且状态为可用）
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select('id, name, details, capacity')
        .eq('type', 'classroom')
        .eq('status', 'available')
        .order('name');
      
      if (venuesError) throw venuesError;

      setBaseData({
        classes: classesData || [],
        subjects: subjectsData || [],
        teachers: teachersData || [],
        venues: venuesData || []
      });
      
    } catch (error) {
      console.error('加载基础数据失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载基础数据，请检查网络连接"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePlans = async () => {
    try {
      const { data, error } = await supabase.rpc('get_schedule_plans_with_stats', {
        p_limit: 100,
        p_offset: 0,
        p_status: 'active'
      });

      if (error) throw error;

      setAvailablePlans(data || []);
    } catch (error) {
      console.error('加载可用计划失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载可用计划列表"
      });
    }
  };

  const loadStudentsForClass = async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('class_members')
        .select(`
          student_id,
          profiles:student_id (
            id,
            full_name,
            username
          )
        `)
        .eq('class_id', classId)
        .eq('enrollment_status', 'enrolled');

      if (error) throw error;

             const students = (data || []).map((member: any) => ({
         id: member.student_id,
         full_name: member.profiles?.full_name || '',
         username: member.profiles?.username || ''
       }));

      setAvailableStudents(students);
      
      // 同时加载可选的插班学员（不在当前班级的其他正式学员）
      // 如果是编辑已有课表，需要传入课表ID以排除已加入的插班学员
      const planId = selectedPlan?.id;
      await loadAvailableAdditionalStudents(classId, planId);
    } catch (error) {
      console.error('加载班级学员失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载班级学员列表"
      });
    }
  };

  const loadAvailableAdditionalStudents = async (excludeClassId: string, planId?: string) => {
    try {
      // 先获取已在选定班级中的学员ID列表
      const { data: classMembers, error: classMembersError } = await supabase
        .from('class_members')
        .select('student_id')
        .eq('class_id', excludeClassId)
        .eq('enrollment_status', 'enrolled');

      if (classMembersError) throw classMembersError;

      const excludeStudentIds = (classMembers || []).map(member => member.student_id);

      // 如果是编辑已有课表，还需要排除已加入该课表计划的插班学员
      if (planId) {
        const { data: planParticipants, error: planParticipantsError } = await supabase
          .from('plan_participants')
          .select('student_id')
          .eq('plan_id', planId)
          .eq('status', 'active');

        if (planParticipantsError) throw planParticipantsError;

        const planStudentIds = (planParticipants || []).map(participant => participant.student_id);
        excludeStudentIds.push(...planStudentIds);
      }

      // 获取所有正式学员，但排除已在选定班级中的学员和已加入课表计划的插班学员
      let query = supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('user_type', 'student')
        .order('full_name');

      // 如果有需要排除的学员ID，则添加过滤条件
      if (excludeStudentIds.length > 0) {
        query = query.not('id', 'in', `(${excludeStudentIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const additionalStudents = (data || []).map((student: any) => ({
        id: student.id,
        full_name: student.full_name || '',
        username: student.username || ''
      }));

      setAvailableAdditionalStudents(additionalStudents);
    } catch (error) {
      console.error('加载可选插班学员失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载可选插班学员列表"
      });
    }
  };

  // =============================================================================
  // 冲突检测
  // =============================================================================

  const runConflictChecks = async (currentSchedules: PreviewScheduleItem[]): Promise<PreviewScheduleItem[]> => {
    const checkedSchedules = await Promise.all(
      currentSchedules.map(async (schedule) => {
        let inPreviewTeacherConflict: any = null;
        let inPreviewVenueConflict: any = null;

        // 检查预览列表内部冲突
        for (const otherSchedule of currentSchedules) {
          if (schedule.id === otherSchedule.id) continue;

          const isOverlapping =
            schedule.schedule_date === otherSchedule.schedule_date &&
            schedule.end_time > otherSchedule.start_time &&
            schedule.start_time < otherSchedule.end_time;

          if (isOverlapping) {
            if (schedule.teacher_id === otherSchedule.teacher_id) {
              inPreviewTeacherConflict = {
                conflicting_item_id: otherSchedule.id,
                lesson_title: otherSchedule.lesson_title,
              };
            }
            if (schedule.venue_id && schedule.venue_id === otherSchedule.venue_id) {
              inPreviewVenueConflict = {
                conflicting_item_id: otherSchedule.id,
                lesson_title: otherSchedule.lesson_title,
              };
            }
          }
        }

        // 检查与数据库中已有课程的冲突
        try {
          const { data: dbConflicts, error } = await supabase.rpc('check_schedule_conflicts', {
            p_teacher_id: schedule.teacher_id,
            p_venue_id: schedule.venue_id || null,
            p_schedule_date: schedule.schedule_date,
            p_start_time: schedule.start_time,
            p_end_time: schedule.end_time,
            p_exclude_schedule_id: schedule.isNew ? null : schedule.id,
          });

          if (error) {
            console.error(`DB Conflict check for ${schedule.lesson_title} failed:`, error);
          }

          return {
            ...schedule,
            teacher_conflict_info: inPreviewTeacherConflict || dbConflicts?.teacher_conflict || null,
            venue_conflict_info: inPreviewVenueConflict || dbConflicts?.venue_conflict || null,
          };
        } catch (error) {
          console.error(`冲突检测失败 for ${schedule.lesson_title}:`, error);
          return {
            ...schedule,
            teacher_conflict_info: inPreviewTeacherConflict,
            venue_conflict_info: inPreviewVenueConflict,
          };
        }
      })
    );
    return checkedSchedules;
  };

  // 包装冲突检测功能，添加状态管理
  const runConflictChecksWithStatus = async (currentSchedules: PreviewScheduleItem[]): Promise<PreviewScheduleItem[]> => {
    setIsConflictChecking(true);
    try {
      const result = await runConflictChecks(currentSchedules);
      return result;
    } catch (error) {
      console.error('冲突检测失败:', error);
      return currentSchedules;
    } finally {
      setIsConflictChecking(false);
    }
  };

  // =============================================================================
  // 课表管理
  // =============================================================================

  // 加载课表的完整信息（用于编辑模式）
  const loadPlanCompleteInfo = async (plan: SchedulePlanWithStats) => {
    try {
    setLoading(true);
      
      // 1. 填充基本信息
      setSelectedClass(plan.class_id || '');
      setTeacherId(plan.teacher_id || '');
      setSelectedSubjectId(plan.subject_id || '');
      setNewPlanForm({
        name: plan.name,
        venue_id: plan.venue_id || ''
      });
      
      // 2. 加载学员信息
      await Promise.all([
        loadPlanSchedules(plan.id, plan),
        loadPlanAdditionalStudents(plan.id)
      ]);
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "加载课表详细信息时出错，请稍后重试"
      });
      console.error('加载课表详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载课表的计划级插班学员
  const loadPlanAdditionalStudents = async (planId: string) => {
    try {
      const { data, error } = await supabase
        .from('plan_participants')
        .select(`
          student_id,
          profiles!inner(
            id,
            full_name,
            username
          )
        `)
        .eq('plan_id', planId)
        .eq('status', 'active');

      if (error) throw error;

      const studentIds = (data || []).map(item => item.student_id);
      const studentsInfo = (data || []).map(item => ({
        id: item.student_id,
        full_name: item.profiles?.full_name || '',
        username: item.profiles?.username || ''
      }));
      
      setAdditionalStudents(studentIds);
      setSelectedAdditionalStudents(studentsInfo);
      
    } catch (error) {
      console.error('加载课表插班学员失败:', error);
      throw error;
    }
  };

  // 加载课表下的已有排课
  const loadPlanSchedules = async (planId: string, plan: SchedulePlanWithStats | null) => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          schedule_date,
          start_time,
          end_time,
          lesson_title,
          lesson_description,
          status,
          teacher_id,
          venue_id,
          venues(name)
        `)
        .eq('plan_id', planId)
        .order('schedule_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      // 转换为预览格式
      const schedules: PreviewScheduleItem[] = (data || []).map(schedule => ({
        id: schedule.id,
        schedule_date: schedule.schedule_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        lesson_title: schedule.lesson_title || '',
        teacher_id: schedule.teacher_id,
        subject_id: plan?.subject_id || '',
        venue_id: schedule.venue_id || undefined,
        lesson_description: schedule.lesson_description || undefined,
        location: (schedule.venues as any)?.name || undefined,
        isNew: false, // 标记为已存在的排课
        isEdited: false
      }));
      
      // 运行冲突检测并设置预览列表
      const checkedSchedules = await runConflictChecksWithStatus(schedules);
      setPreviewSchedules(checkedSchedules);
      
    } catch (error) {
      console.error('加载课表排课失败:', error);
      throw error;
    }
  };

  const handlePlanSelect = (planId: string) => {
    if (planId === 'new') {
      setIsCreatingNewPlan(true);
      setIsEditingExistingPlan(false);
      setSelectedPlan(null);
      // 清空表单状态
      setNewPlanForm({ name: '', venue_id: '' });
      setSelectedClass('');
      setTeacherId('');
      setSelectedSubjectId('');
      setAdditionalStudents([]);
      setSelectedAdditionalStudents([]);
      setPreviewSchedules([]);
      setDeletedScheduleIds([]);
    } else {
      const plan = availablePlans.find(p => p.id === planId);
      setSelectedPlan(plan || null);
      setIsCreatingNewPlan(false);
      setIsEditingExistingPlan(true); // 选择已有课表后自动进入编辑模式
      
      if (plan) {
        // 加载完整的课表信息
        loadPlanCompleteInfo(plan);
      }
    }
  };

  const handleCreateNewPlan = async (): Promise<string | null> => {
    if (!newPlanForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请填写课表名称"
      });
      return null;
    }

    if (!newPlanForm.venue_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择上课教室"
      });
      return null;
    }

    if (!selectedClass || !teacherId) {
      toast({
        variant: "destructive",
        title: "验证失败", 
        description: "请选择班级和任课老师"
      });
      return null;
    }

    try {
      setLoading(true);
      
      // 使用新的RPC函数创建课表计划
      const { data: result, error } = await supabase.rpc('create_schedule_plan_with_venue', {
        p_name: newPlanForm.name,
        p_description: '',
        p_class_id: selectedClass,
        p_subject_id: selectedSubjectId,
        p_teacher_id: teacherId,
        p_venue_id: newPlanForm.venue_id,
        p_start_date: null,
        p_end_date: null,
        p_extra_students: additionalStudents
      });

      if (error) throw error;

      if (result.success) {
        const planId = result.plan_id;
        
        // 重新加载计划列表
        await loadAvailablePlans();
        
        // 找到刚创建的课表并设置为选中状态
        const updatedPlans = await supabase.rpc('get_schedule_plans_with_stats', {
          p_limit: 1000,
          p_offset: 0
        });
        
        if (updatedPlans.data) {
          const newPlan = updatedPlans.data.find(p => p.id === planId);
          if (newPlan) {
            setSelectedPlan(newPlan);
          }
        }
        
        setIsCreatingNewPlan(false);
        
        toast({
          title: "创建成功",
          description: `课表"${newPlanForm.name}"创建成功，已添加 ${additionalStudents.length} 位插班学员`
        });
        
                 // 返回新创建的计划ID
         return planId;
      } else {
        throw new Error(result.error || '创建课表失败');
      }
      
    } catch (error) {
      console.error('创建课表失败:', error);
      toast({
        variant: "destructive",
        title: "创建失败",
        description: "创建课表失败，请重试"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 更新已有课表信息
  const handleUpdateExistingPlan = async (): Promise<boolean> => {
    if (!selectedPlan) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "没有选择要编辑的课表"
      });
      return false;
    }

    if (!newPlanForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请填写课表名称"
      });
      return false;
    }

    if (!newPlanForm.venue_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择上课教室"
      });
      return false;
    }

    if (!selectedClass || !teacherId) {
      toast({
        variant: "destructive",
        title: "验证失败", 
        description: "请选择班级和任课老师"
      });
      return false;
    }

    try {
      setLoading(true);

      // 使用新的RPC函数更新课表计划
      const { data: result, error } = await supabase.rpc('update_schedule_plan_with_venue', {
        p_plan_id: selectedPlan.id,
        p_name: newPlanForm.name,
        p_description: '',
        p_class_id: selectedClass,
        p_subject_id: selectedSubjectId,
        p_teacher_id: teacherId,
        p_venue_id: newPlanForm.venue_id,
        p_start_date: null,
        p_end_date: null,
        p_extra_students: additionalStudents
      });

      if (error) throw error;

      if (!result.success) {
        throw new Error(result.error || '更新课表失败');
      }

      // 3. 更新本地状态
      const updatedPlan: SchedulePlanWithStats = {
        ...selectedPlan,
        name: newPlanForm.name,
        subject_id: selectedSubjectId,
        class_id: selectedClass,
        teacher_id: teacherId,
        class_name: baseData.classes.find(c => c.id === selectedClass)?.name || '',
        subject_name: baseData.subjects.find(s => s.id === selectedSubjectId)?.name || '',
        teacher_name: baseData.teachers.find(t => t.id === teacherId)?.full_name || '',
        plan_participants_count: additionalStudents.length,
        updated_at: new Date().toISOString()
      };

      setSelectedPlan(updatedPlan);
      setIsEditingExistingPlan(false);

      // 重新加载计划列表
      await loadAvailablePlans();

      toast({
        title: "更新成功",
        description: `课表"${newPlanForm.name}"信息已更新，插班学员 ${additionalStudents.length} 人`
      });

      return true;

    } catch (error) {
      console.error('更新课表失败:', error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: "更新课表信息失败，请重试"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // 单课级学员管理
  // =============================================================================

  const openParticipantDialog = async (scheduleId: string, scheduleTitle: string) => {
    setParticipantDialog({
      open: true,
      scheduleId,
      scheduleTitle
    });
    
    // 加载该课程的参与者信息
    await loadScheduleParticipants(scheduleId);
  };

  const loadScheduleParticipants = async (scheduleId: string) => {
    setParticipantLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_schedule_participants', {
        p_schedule_id: scheduleId
      });

      if (error) throw error;

      // 按来源分组参与者数据
      const groupedParticipants = {
        classStudents: [] as any[],
        planStudents: [] as any[],
        scheduleStudents: [] as any[]
      };

      (data || []).forEach((participant: any) => {
        switch (participant.participation_source) {
          case 'class':
            groupedParticipants.classStudents.push({
              student_id: participant.student_id,
              student_name: participant.full_name || participant.username,
              full_name: participant.full_name,
              source: 'class' as const,
              participation_type: participant.participation_type,
              status: 'active' as const
            });
            break;
          case 'plan':
            groupedParticipants.planStudents.push({
              student_id: participant.student_id,
              student_name: participant.full_name || participant.username,
              full_name: participant.full_name,
              source: 'plan' as const,
              participation_type: participant.participation_type,
              status: 'active' as const
            });
            break;
          case 'schedule':
            groupedParticipants.scheduleStudents.push({
              student_id: participant.student_id,
              student_name: participant.full_name || participant.username,
              full_name: participant.full_name,
              source: 'schedule' as const,
              participation_type: participant.participation_type,
              status: 'active' as const,
              action: participant.participation_action,
              notes: participant.notes
            });
            break;
        }
      });
      
      setScheduleParticipants(groupedParticipants);
    } catch (error) {
      console.error('加载课程参与者失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载课程参与者信息"
      });
    } finally {
      setParticipantLoading(false);
    }
  };

  const handleAddScheduleParticipant = async (studentId: string, participationType: string, notes?: string) => {
    try {
      // const result = await manageScheduleParticipants(
      //   participantDialog.scheduleId!,
      //   studentId,
      //   { action: 'add', participation_type: participationType, notes }
      // );
      
      // 模拟添加成功
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 重新加载参与者列表
      await loadScheduleParticipants(participantDialog.scheduleId!);
      
      toast({
        title: "添加成功",
        description: "学员已成功添加到本节课"
      });
    } catch (error) {
      console.error('添加学员失败:', error);
      toast({
        variant: "destructive",
        title: "添加失败",
        description: "添加学员时发生错误"
      });
    }
  };

  const handleRemoveScheduleParticipant = async (studentId: string, notes?: string) => {
    try {
      // const result = await manageScheduleParticipants(
      //   participantDialog.scheduleId!,
      //   studentId,
      //   { action: 'remove', notes }
      // );
      
      // 模拟移除成功
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 重新加载参与者列表
      await loadScheduleParticipants(participantDialog.scheduleId!);
      
      toast({
        title: "移除成功", 
        description: "学员已从本节课移除"
      });
    } catch (error) {
      console.error('移除学员失败:', error);
      toast({
        variant: "destructive",
        title: "移除失败",
        description: "移除学员时发生错误"
      });
    }
  };

  // =============================================================================
  // 预览列表管理
  // =============================================================================

  const addToPreview = async () => {
    if (!teacherId) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择任课老师"
      });
      return;
    }

    if (currentView === 'single') {
      if (!scheduleDate || !startTime || !endTime) {
        toast({
          variant: "destructive",
          title: "验证失败",
          description: "请填写上课日期和时间"
        });
        return;
      }

      // 时间验证
      if (startTime >= endTime) {
        toast({
          variant: "destructive",
          title: "时间错误",
          description: "课程的结束时间不能早于开始时间！"
        });
        return;
      }

      // 获取教室名称和ID
      let locationName = '';
      const venueId = newPlanForm.venue_id || undefined;
      if (venueId) {
        locationName = baseData.venues.find(v => v.id === venueId)?.name || '';
      }

      const newItem: PreviewScheduleItem = {
        id: 'preview_' + Date.now(),
        schedule_date: scheduleDate,
        start_time: startTime,
        end_time: endTime,
        lesson_title: '未设置本节课主题',
        teacher_id: teacherId,
        subject_id: selectedSubjectId,
        venue_id: venueId,
        location: locationName,
        isNew: true
      };

      const updatedPreview = [...previewSchedules, newItem];
      setPreviewSchedules(updatedPreview);
      
      // 成功反馈
      toast({
        title: "添加成功",
        description: `课程已添加到预览列表，请设置课程主题`,
        duration: 2000
      });
      
      // 乐观更新：在后台进行冲突检测
      setTimeout(async () => {
        try {
          const checkedPreview = await runConflictChecksWithStatus(updatedPreview);
          setPreviewSchedules(checkedPreview);
        } catch (error) {
          console.error('后台冲突检测失败:', error);
        }
      }, 0);
      
      // 保留上课日期，方便用户在同一天添加多个时间段的课程
      
    } else {
      // 批量添加逻辑
      const addedCount = await generateBatchSchedules();
      if (addedCount > 0) {
        toast({
          title: "批量添加成功",
          description: `已添加 ${addedCount} 节课到预览列表`,
          duration: 2000
        });
      }
    }
  };

  const generateBatchSchedules = async () => {
    if (!repeatStartDate || !repeatEndDate) {
      toast({
        variant: "destructive",
        title: "验证失败", 
        description: "请选择重复时间范围"
      });
      return 0;
    }

    // 时间验证
    if (startTime >= endTime) {
      toast({
        variant: "destructive",
        title: "时间错误",
        description: "课程的结束时间不能早于开始时间！"
      });
      return 0;
    }

    // 获取教室名称和ID
    let locationName = '';
    const venueId = newPlanForm.venue_id || undefined;
    if (venueId) {
      locationName = baseData.venues.find(v => v.id === venueId)?.name || '';
    }

    const newSchedules: PreviewScheduleItem[] = [];
    const startDate = new Date(repeatStartDate);
    const endDate = new Date(repeatEndDate);

    if (repeatFrequency === 'weekly' && weeklyDays.length > 0) {
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        
        if (weeklyDays.includes(dayOfWeek)) {
          newSchedules.push({
            id: 'preview_' + Date.now() + '_' + currentDate.getTime(),
            schedule_date: currentDate.toISOString().split('T')[0],
            start_time: startTime,
            end_time: endTime,
            lesson_title: '未设置本节课主题',
            teacher_id: teacherId,
            subject_id: selectedSubjectId,
            venue_id: venueId,
            location: locationName,
            isNew: true
          });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (repeatFrequency === 'daily') {
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        newSchedules.push({
          id: 'preview_' + Date.now() + '_' + currentDate.getTime(),
          schedule_date: currentDate.toISOString().split('T')[0],
          start_time: startTime,
          end_time: endTime,
          lesson_title: '未设置本节课主题',
          teacher_id: teacherId,
          subject_id: selectedSubjectId,
          venue_id: venueId,
          location: locationName,
          isNew: true
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    if (newSchedules.length > 0) {
      const updatedPreview = [...previewSchedules, ...newSchedules];
      setPreviewSchedules(updatedPreview);
    
      // 乐观更新：在后台进行冲突检测
      setTimeout(async () => {
        try {
          const checkedPreview = await runConflictChecksWithStatus(updatedPreview);
          setPreviewSchedules(checkedPreview);
        } catch (error) {
          console.error('后台冲突检测失败:', error);
        }
      }, 0);
    }
    
    // 保留日期范围和周期选择，方便用户继续添加相同配置的课程

    return newSchedules.length;
  };

  const removeFromPreview = (id: string) => {
    // 使用函数式更新，确保基于最新状态进行删除操作
    setPreviewSchedules(currentSchedules => {
    // 找到要删除的课程
      const scheduleToRemove = currentSchedules.find(item => item.id === id);
    
    // 如果是已有课程（不是新创建的），记录其ID用于后续删除
    if (scheduleToRemove && scheduleToRemove.isNew === false) {
      setDeletedScheduleIds(prev => [...prev, id]);
    }
    
    // 从预览列表中移除
      const updatedPreview = currentSchedules.filter(item => item.id !== id);
      
      // 清除之前的定时器，防止重复的冲突检测
      if (conflictCheckTimeoutRef.current) {
        clearTimeout(conflictCheckTimeoutRef.current);
      }
    
      // 删除后重新检测冲突（使用防抖机制）
    if (updatedPreview.length > 0) {
        conflictCheckTimeoutRef.current = setTimeout(async () => {
        try {
          const checkedPreview = await runConflictChecksWithStatus(updatedPreview);
            // 使用函数式更新确保基于最新状态
            setPreviewSchedules(currentPreview => {
              // 只有当前预览列表长度与检测时的长度一致时才更新
              // 这样可以避免在连续删除过程中的状态不一致
              if (currentPreview.length === checkedPreview.length) {
                return checkedPreview;
              }
              return currentPreview;
            });
        } catch (error) {
          console.error('删除后冲突检测失败:', error);
        }
        }, 300); // 300ms 防抖延迟
    }
      
      return updatedPreview;
    });
  };

  // 复制课程功能
  const copySchedule = (schedule: PreviewScheduleItem) => {
    const copiedSchedule: PreviewScheduleItem = {
      ...schedule,
      id: 'preview_' + Date.now() + '_copy',
      lesson_title: schedule.lesson_title + ' (副本)',
      isNew: true,
      isEdited: false
    };
    
    setPreviewSchedules(prev => [...prev, copiedSchedule]);
    
    toast({
      title: "复制成功",
      description: `课程"${schedule.lesson_title}"已复制到预览列表`,
      duration: 2000
    });
  };

  const editPreviewItem = async (id: string, updates: Partial<PreviewScheduleItem>) => {
    // 如果更新包含时间信息，需要验证时间
    if (updates.start_time || updates.end_time) {
      let updatedSchedules = previewSchedules.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, ...updates, isEdited: true };
          // 验证时间
          if (updatedItem.start_time >= updatedItem.end_time) {
            toast({
              variant: "destructive",
              title: "时间错误",
              description: "课程的结束时间不能早于开始时间！"
            });
            return item; // 返回原始项，不应用更新
          }
          return updatedItem;
        }
        return item;
      });
      const checkedSchedules = await runConflictChecksWithStatus(updatedSchedules);
      setPreviewSchedules(checkedSchedules);
    } else {
      // 如果不涉及时间更新，直接应用更新
      const updatedSchedules = previewSchedules.map(item => 
        item.id === id ? { ...item, ...updates, isEdited: true } : item
      );
      const checkedSchedules = await runConflictChecksWithStatus(updatedSchedules);
      setPreviewSchedules(checkedSchedules);
    }
  };

  // 开始编辑课程主题
  const startEditingTitle = (scheduleId: string, currentTitle: string) => {
    setEditingTitleId(scheduleId);
    if (currentTitle === '未设置本节课主题' || currentTitle === '未设置主题') {
      setEditingTitleValue('');
    } else {
    setEditingTitleValue(currentTitle);
    }
  };

  // 保存课程主题
  const saveEditingTitle = async (scheduleId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    
    // 如果输入为空，则将主题重置为默认占位符，不显示错误
    if (trimmedTitle === '') {
      await editPreviewItem(scheduleId, { 
        lesson_title: '未设置本节课主题',
        isEdited: true 
      });
    } else {
      // 否则，更新为新主题
      await editPreviewItem(scheduleId, { 
      lesson_title: trimmedTitle,
      isEdited: true
    });
    }
    
    // 无论结果如何，都关闭编辑状态
    setEditingTitleId(null);
  };

  // 取消编辑课程主题
  const cancelEditingTitle = () => {
    setEditingTitleId(null);
  };

  // =============================================================================
  // 最终保存
  // =============================================================================

  const handleSavePlan = async () => {
    if (!selectedPlan && !isCreatingNewPlan) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: "请先选择或创建一个课表"
      });
      return;
    }

    if (previewSchedules.length === 0) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: "预览列表为空，请先添加课程"
      });
      return;
    }

    // 检查预览列表中是否存在冲突
    const hasConflicts = previewSchedules.some(schedule => 
      schedule.teacher_conflict_info || schedule.venue_conflict_info
    );

    if (hasConflicts) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: "预览列表中存在时间冲突，请先解决冲突后再保存"
      });
      return;
    }

    try {
    setLoading(true);
      
      let planId = selectedPlan?.id;
      
      // 如果是创建新计划，先创建计划
      if (isCreatingNewPlan) {
        planId = await handleCreateNewPlan();
      } else if (isEditingExistingPlan && selectedPlan) {
        // 如果是编辑现有计划，先更新计划基本信息
        const updateSuccess = await handleUpdateExistingPlan();
        if (!updateSuccess) {
          throw new Error('更新课表基本信息失败');
        }
        planId = selectedPlan.id;
      }

      if (!planId) {
        throw new Error('无法获取课表ID');
      }

      // 分别处理新增和更新的排课
      const newSchedules = previewSchedules.filter(item => item.isNew !== false);
      const updatedSchedules = previewSchedules.filter(item => item.isNew === false && item.isEdited);
      // 使用状态中记录的删除课程ID列表
      
      let successCount = 0;
      let errorCount = 0;

      // 处理新增的排课
      if (newSchedules.length > 0) {
        const schedulesData = newSchedules.map(item => ({
          schedule_date: item.schedule_date,
          start_time: item.start_time,
          end_time: item.end_time,
          lesson_title: item.lesson_title,
          lesson_description: item.lesson_description || null,
          venue_id: (isCreatingNewPlan || isEditingExistingPlan) ? newPlanForm.venue_id : null,
          status: 'scheduled',
          notes: null
        }));
        
        const { data: result, error: batchError } = await supabase.rpc('create_plan_schedules_batch', {
          p_plan_id: planId,
          p_schedules: schedulesData
        });
        
        if (batchError) {
          throw batchError;
        }
        
        if (result.success) {
          successCount += result.success_count;
          errorCount += result.error_count;
        }
      }

      // 处理更新的排课
      for (const schedule of updatedSchedules) {
        try {
          const { error: updateError } = await supabase
            .from('schedules')
            .update({
              schedule_date: schedule.schedule_date,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              lesson_title: schedule.lesson_title,
              lesson_description: schedule.lesson_description || null,
              venue_id: schedule.venue_id || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', schedule.id);

          if (updateError) {
            throw updateError;
          }
          successCount++;
        } catch (error) {
          console.error(`更新排课 ${schedule.id} 失败:`, error);
          errorCount++;
        }
      }

      // 处理删除的排课
      for (const scheduleId of deletedScheduleIds) {
        try {
          const { error: deleteError } = await supabase
            .from('schedules')
            .delete()
            .eq('id', scheduleId);

          if (deleteError) {
            throw deleteError;
          }
          successCount++;
        } catch (error) {
          console.error(`删除排课 ${scheduleId} 失败:`, error);
          errorCount++;
        }
      }
      
      // 显示结果
      const isEditMode = !isCreatingNewPlan;
      const actionText = isEditMode ? '更新' : '创建';
      
      const operationSummary = [];
      if (newSchedules.length > 0) operationSummary.push(`新增 ${newSchedules.length} 节`);
      if (updatedSchedules.length > 0) operationSummary.push(`更新 ${updatedSchedules.length} 节`);
      if (deletedScheduleIds.length > 0) operationSummary.push(`删除 ${deletedScheduleIds.length} 节`);
      
      toast({
        title: "保存成功",
        description: `成功${actionText}课程：${operationSummary.join('，')}${errorCount > 0 ? `，失败 ${errorCount} 节` : ''}`
      });
      
      // 立即关闭工作台，提升用户体验
      onOpenChange(false);
      
      // 异步执行重置和数据刷新，不阻塞对话框关闭
      requestAnimationFrame(() => {
        resetWorkbench();
        setTimeout(() => {
          // 构造回调数据进行乐观更新
          const callbackData = constructCallbackData(newSchedules, updatedSchedules);
          onScheduleCreated?.(callbackData);
        }, 0);
      });
      
    } catch (error) {
      console.error('保存计划失败:', error);
      toast({
        variant: "destructive",
        title: "保存失败",
        description: "保存课表时发生错误"
      });
    } finally {
      setLoading(false);
    }
  };

  // 构造回调数据用于乐观更新
  const constructCallbackData = (
    newSchedules: PreviewScheduleItem[], 
    updatedSchedules: PreviewScheduleItem[]
  ) => {
    const convertToCreatedScheduleData = (schedules: PreviewScheduleItem[], isNew: boolean = false): CreatedScheduleData[] => {
      return schedules.map(schedule => ({
        id: isNew ? `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : schedule.id, // 为新排课生成临时ID
        schedule_date: schedule.schedule_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        lesson_title: schedule.lesson_title,
        class_id: selectedClass,
        subject_id: selectedSubjectId,
        teacher_id: teacherId,
        venue_id: schedule.venue_id || null,
        plan_id: selectedPlan?.id || null,
        // 关联数据
        class_name: baseData.classes.find(c => c.id === selectedClass)?.name || '',
        subject_name: baseData.subjects.find(s => s.id === selectedSubjectId)?.name || '',
        teacher_name: baseData.teachers.find(t => t.id === teacherId)?.full_name || '',
        venue_name: schedule.location || baseData.venues.find(v => v.id === schedule.venue_id)?.name || '',
        plan_name: selectedPlan?.name || undefined
      }));
    };

    return {
      newSchedules: convertToCreatedScheduleData(newSchedules, true), // 标记为新排课，使用临时ID
      updatedSchedules: convertToCreatedScheduleData(updatedSchedules, false),
      deletedScheduleIds: deletedScheduleIds
    };
  };

  // 重置工作台
  const resetWorkbench = () => {
    setIsConflictChecking(false);
    setSelectedPlan(null);
    setIsCreatingNewPlan(false);
    setIsEditingExistingPlan(false);
    
    setSelectedClass('');
    setAdditionalStudents([]);
    setAvailableStudents([]);
    setAvailableAdditionalStudents([]);
    setSelectedAdditionalStudents([]);
    
    setLessonTitle('');
    setTeacherId('');
    setSelectedSubjectId('');
    
    setEditingTitleId(null);
    setEditingTitleValue('');
    
    setCurrentView('batch');
    setScheduleDate('');
    setStartTime('09:00');
    setEndTime('10:30');
    setRepeatFrequency('weekly');
    setWeeklyDays([]);
    setRepeatStartDate('');
    setRepeatEndDate('');
    
    setPreviewSchedules([]);
    setDeletedScheduleIds([]);
    
    setNewPlanForm({
      name: '',
      venue_id: ''
    });
    
    setParticipantDialog({
      open: false,
      scheduleId: null,
      scheduleTitle: ''
    });
    setScheduleParticipants({
      classStudents: [],
      planStudents: [],
      scheduleStudents: []
    });
    
    // 重置搜索相关状态
    setStudentSearchOpen(false);
    setStudentSearchValue('');
    setTeacherSearchOpen(false);
    
    // 重置编辑对话框状态
    setEditDialog({
      open: false,
      scheduleId: null,
      scheduleData: null
    });
    setEditForm({
      schedule_date: '',
      start_time: '',
      end_time: '',
      lesson_title: '',
      lesson_description: '',
      location: '',
      teacher_id: '',
      notes: ''
    });
    
    // 重置确认对话框状态
    setCloseConfirmDialog(false);
    setClearPreviewDialog(false);
  };

  // =============================================================================
  // 课程编辑管理
  // =============================================================================

  const openEditDialog = (schedule: PreviewScheduleItem) => {
    setEditDialog({
      open: true,
      scheduleId: schedule.id,
      scheduleData: schedule
    });
    
    // 填充编辑表单
    setEditForm({
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      lesson_title: schedule.lesson_title || '',
      lesson_description: schedule.lesson_description || '',
      location: schedule.location || '',
      teacher_id: '', // 需要从课程数据中获取
      notes: ''
    });
  };

  const handleSaveEditedSchedule = async () => {
    if (!editDialog.scheduleId) return;
    
    // 基础验证
    if (!editForm.schedule_date || !editForm.start_time || !editForm.end_time || !editForm.lesson_title.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请填写必填字段：日期、时间、课程主题"
      });
      return;
    }

    // 时间验证
    if (editForm.start_time >= editForm.end_time) {
      toast({
        variant: "destructive",
        title: "时间错误",
        description: "结束时间必须晚于开始时间"
      });
      return;
    }

    setEditLoading(true);
    try {
      // const result = await updateSchedule(editDialog.scheduleId, editForm);
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 更新预览列表中的数据
      setPreviewSchedules(prev => prev.map(schedule => 
        schedule.id === editDialog.scheduleId 
          ? {
              ...schedule,
              schedule_date: editForm.schedule_date,
              start_time: editForm.start_time,
              end_time: editForm.end_time,
              lesson_title: editForm.lesson_title,
              lesson_description: editForm.lesson_description,
              location: editForm.location,
              isEdited: true // 标记为已编辑
            }
          : schedule
      ));
      
      toast({
        title: "保存成功",
        description: "课程信息已更新"
      });
      
      // 关闭对话框
      setEditDialog({
        open: false,
        scheduleId: null,
        scheduleData: null
      });
      
    } catch (error) {
      console.error('保存课程失败:', error);
      toast({
        variant: "destructive",
        title: "保存失败",
        description: "更新课程信息时发生错误"
      });
    } finally {
      setEditLoading(false);
    }
  };

  // =============================================================================
  // 渲染函数
  // =============================================================================

  // 渲染课表选择器
  const renderPlanSelector = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="plan-selector" className="text-sm font-medium">
          课表计划 *
        </Label>
        <Select 
          value={selectedPlan?.id || (isCreatingNewPlan ? 'new' : '')} 
          onValueChange={handlePlanSelect}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择已有课表，或创建新课表" />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="new">+ 创建新的课表计划</SelectItem>
            {availablePlans.map(plan => (
              <SelectItem key={plan.id} value={plan.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{plan.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {plan.total_schedules}节课
                  </Badge>
                </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
      {(isCreatingNewPlan || isEditingExistingPlan) && (
        <Card className={`p-4 ${isEditingExistingPlan ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {isEditingExistingPlan ? '编辑课表信息' : '创建新的课表'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-name">课表名称 *</Label>
                <p className="text-xs text-gray-500 mb-1">为此课表设置一个清晰的名称</p>
          <Input
            id="plan-name"
                  value={newPlanForm.name}
                  onChange={(e) => setNewPlanForm(prev => ({...prev, name: e.target.value}))}
                  placeholder="例如：考研数学冲刺班"
                />
              </div>
              <div>
                <Label htmlFor="plan-venue">上课地点 *</Label>
                <p className="text-xs text-gray-500 mb-1">为此计划设置默认上课地点，单节课程可单独调整</p>
                <Select 
                  value={newPlanForm.venue_id} 
                  onValueChange={(value) => setNewPlanForm(prev => ({...prev, venue_id: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择默认教室" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseData.venues.map(venue => (
                      <SelectItem key={venue.id} value={venue.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{venue.name}</span>
                          {venue.capacity && (
                            <span className="text-xs text-gray-500 ml-2">
                              容量: {venue.capacity}人
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
        </div>
        
          </CardContent>
        </Card>
      )}
    </div>
  );

  // 渲染计划级参与者管理
  const renderParticipantsManagement = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="class-selector" className="text-sm font-medium">
          主要班级 *
        </Label>
        <Select 
          value={selectedClass} 
          onValueChange={(value) => {
            setSelectedClass(value);
            loadStudentsForClass(value);
          }}
        >
            <SelectTrigger>
            <SelectValue placeholder="选择一个主要班级" />
            </SelectTrigger>
            <SelectContent>
            {baseData.classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
      <div>
        <Label htmlFor="additional-students" className="text-sm font-medium">
          添加插班学员 (可选)
        </Label>
        <p className="text-xs text-gray-500 mb-2">
          这些学员将默认参与此课表计划中的 <strong>所有</strong> 课程
        </p>
        
        {/* 智能多选搜索框 */}
        <Popover open={studentSearchOpen} onOpenChange={setStudentSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={studentSearchOpen}
              className="w-full justify-between h-auto min-h-10 px-3 py-2"
            >
              <div className="flex flex-wrap gap-1 flex-1">
                {additionalStudents.length === 0 ? (
                  <span className="text-gray-500">搜索并添加插班学员...</span>
                ) : (
                  <>
                    {additionalStudents.slice(0, 2).map(studentId => {
                      const student = selectedAdditionalStudents.find(s => s.id === studentId) || 
                                     availableAdditionalStudents.find(s => s.id === studentId);
                      return student ? (
                        <Badge key={studentId} variant="secondary" className="text-xs">
                          {student.full_name}
                        </Badge>
                      ) : null;
                    })}
                    {additionalStudents.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{additionalStudents.length - 2} 更多
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="搜索学员姓名或用户名..." 
                value={studentSearchValue}
                onValueChange={setStudentSearchValue}
              />
              <CommandEmpty>未找到匹配的学员</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-y-auto">
                {availableAdditionalStudents
                  .filter(student => !additionalStudents.includes(student.id))
                  .map(student => (
                    <CommandItem
                      key={student.id}
                      value={`${student.full_name} ${student.username}`}
                      onSelect={() => {
                        setAdditionalStudents(prev => [...prev, student.id]);
                        setSelectedAdditionalStudents(prev => [...prev, student]);
                        setStudentSearchValue('');
                        setStudentSearchOpen(false); // 选择完成后关闭下拉框
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="h-4 w-4 text-green-600" />
                      <div className="flex-1">
                        <div className="font-medium">{student.full_name}</div>
                        <div className="text-sm text-gray-500">@{student.username}</div>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
        
                    {/* 已选择的插班学员列表 */}
        {additionalStudents.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium mb-2 text-gray-700">
              已选择 {additionalStudents.length} 位插班学员:
            </div>
            <div className="flex flex-wrap gap-2">
              {additionalStudents.map(studentId => {
                const student = selectedAdditionalStudents.find(s => s.id === studentId) || 
                               availableAdditionalStudents.find(s => s.id === studentId);
                return student ? (
                  <Badge key={studentId} variant="secondary" className="flex items-center gap-1 py-1">
                    {student.full_name}
                    <button 
                      onClick={() => {
                        setAdditionalStudents(prev => prev.filter(id => id !== studentId));
                        setSelectedAdditionalStudents(prev => prev.filter(s => s.id !== studentId));
                      }}
                      className="ml-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 w-4 h-4 flex items-center justify-center text-xs"
                      title="移除"
                    >
                      ×
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );



  // 渲染排课工具
  const renderScheduleTools = () => (
    <div className="space-y-4">
      {/* 课程选择 */}
      <div>
        <Label htmlFor="subject-selector" className="text-sm font-medium">
          课程 *
        </Label>
        <Select 
          value={selectedSubjectId} 
          onValueChange={setSelectedSubjectId}
        >
            <SelectTrigger>
              <SelectValue placeholder="选择该节课所上课程" />
            </SelectTrigger>
            <SelectContent>
            {baseData.subjects.map(subject => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
      {/* 任课老师 */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="teacher-selector" className="text-sm font-medium">
            任课老师 *
          </Label>
          <Popover open={teacherSearchOpen} onOpenChange={setTeacherSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={teacherSearchOpen}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-accent hover:text-accent-foreground"
              >
                <span className={`line-clamp-1 ${teacherId ? "" : "text-muted-foreground"}`}>
                {teacherId
                  ? baseData.teachers.find((teacher) => teacher.id === teacherId)?.full_name
                    : "选择该节课任课老师"}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="搜索老师姓名..." />
                <CommandEmpty>未找到匹配的老师</CommandEmpty>
                <CommandGroup className="max-h-48 overflow-y-auto">
                  {baseData.teachers.map((teacher) => (
                    <CommandItem
                      key={teacher.id}
                      value={teacher.full_name}
                      onSelect={() => {
                        setTeacherId(teacher.id);
                        setTeacherSearchOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                        {teacher.full_name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{teacher.full_name}</div>
                        {teacher.username && (
                          <div className="text-sm text-gray-500">@{teacher.username}</div>
                        )}
                      </div>
                      {teacherId === teacher.id && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as 'single' | 'batch')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">按单次添加（1节）</TabsTrigger>
          <TabsTrigger value="batch">按周期添加（周/日）</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="schedule-date">上课日期 *</Label>
              <Input
                id="schedule-date"
            type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
          />
        </div>
            <div>
              <Label htmlFor="start-time">开始时间 *</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={startTime >= endTime ? "border-red-500" : ""}
              />
              {startTime >= endTime && (
                <p className="text-xs text-red-500 mt-1">开始时间不能晚于结束时间</p>
              )}
            </div>
            <div>
              <Label htmlFor="end-time">结束时间 *</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={startTime >= endTime ? "border-red-500" : ""}
              />
              {startTime >= endTime && (
                <p className="text-xs text-red-500 mt-1">结束时间不能早于开始时间</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="batch" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="repeat-frequency">重复频率</Label>
            <Select value={repeatFrequency} onValueChange={(value) => setRepeatFrequency(value as RepeatFrequency)}>
            <SelectTrigger>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="daily">每天</SelectItem>
                <SelectItem value="weekly">每周</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
          {repeatFrequency === 'weekly' && (
            <div>
              <Label>选择每周的哪几天上课</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { value: 1, label: '周一' },
                  { value: 2, label: '周二' }, 
                  { value: 3, label: '周三' },
                  { value: 4, label: '周四' },
                  { value: 5, label: '周五' },
                  { value: 6, label: '周六' },
                  { value: 0, label: '周日' }
                ].map(day => (
                  <Button
                    key={day.value}
                    variant={weeklyDays.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (weeklyDays.includes(day.value)) {
                        setWeeklyDays(prev => prev.filter(d => d !== day.value));
                      } else {
                        setWeeklyDays(prev => [...prev, day.value]);
                      }
                    }}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="repeat-start">周期开始日期 *</Label>
          <Input
                id="repeat-start"
            type="date"
                value={repeatStartDate}
                onChange={(e) => setRepeatStartDate(e.target.value)}
          />
        </div>
            <div>
              <Label htmlFor="repeat-end">周期结束日期 *</Label>
          <Input
                id="repeat-end"
            type="date"
                value={repeatEndDate}
                onChange={(e) => setRepeatEndDate(e.target.value)}
          />
        </div>
      </div>
      
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batch-start-time">开始时间 *</Label>
              <Input
                id="batch-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={startTime >= endTime ? "border-red-500" : ""}
        />
              {startTime >= endTime && (
                <p className="text-xs text-red-500 mt-1">开始时间不能晚于结束时间</p>
              )}
      </div>
            <div>
              <Label htmlFor="batch-end-time">结束时间 *</Label>
              <Input
                id="batch-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={startTime >= endTime ? "border-red-500" : ""}
              />
              {startTime >= endTime && (
                <p className="text-xs text-red-500 mt-1">结束时间不能早于开始时间</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Button 
        onClick={addToPreview} 
        className="w-full" 
        disabled={
          !selectedSubjectId ||
          !teacherId || 
          (currentView === 'single' && (!scheduleDate || !startTime || !endTime)) ||
          (currentView === 'batch' && (!repeatStartDate || !repeatEndDate || (repeatFrequency === 'weekly' && weeklyDays.length === 0)))
        }
      >
        <Plus className="h-4 w-4 mr-2" />
        {currentView === 'single' ? '添加到预览列表' : '生成并添加到预览'}
      </Button>
    </div>
  );

  // 获取时段标识和样式（上午/下午/晚上）
  const getTimePeriodInfo = (startTime: string): { text: string; className: string } => {
    const hour = parseInt(startTime.split(':')[0]);
    if (hour < 12) {
      return {
        text: '上午',
        className: 'text-orange-600 bg-orange-50 border-orange-200'
      };
    } else if (hour < 17) {
      return {
        text: '下午',
        className: 'text-blue-600 bg-blue-50 border-blue-200'
      };
    } else {
      return {
        text: '晚上',
        className: 'text-purple-600 bg-purple-50 border-purple-200'
      };
    }
  };

  // 极致紧凑的课程项组件 (信息流布局)
  const ScheduleItem = ({ 
    schedule, 
    index, 
    onRemoveClick 
  }: {
    schedule: PreviewScheduleItem;
    index: number;
    onRemoveClick: () => void;
  }) => {
    const isExistingSchedule = schedule.isNew === false;
    const subject = baseData.subjects.find(s => s.id === schedule.subject_id);
    const teacher = baseData.teachers.find(t => t.id === schedule.teacher_id);

    const hasConflicts = schedule.teacher_conflict_info || schedule.venue_conflict_info;
    
    return (
      <div 
        className={cn(
          `flex items-center gap-2 p-2 border-b border-l-4 hover:bg-gray-50/80 transition-colors`,
          isExistingSchedule ? 'border-l-green-500' : 'border-l-blue-500',
          hasConflicts && 'bg-red-50/50 border-red-200'
        )}
      >
        {/* 序号 */}
        <div className="text-xs font-medium text-gray-400 w-5 text-center">
          #{index + 1}
            </div>

        {/* 课程信息主体 (弹性占据空间) */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* 第一行：时间、课程、老师 */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">
              {new Date(schedule.schedule_date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
              <span className="ml-1 font-normal text-gray-500">{new Date(schedule.schedule_date).toLocaleDateString('zh-CN', { weekday: 'short' })}</span>
            </span>
            <span className={`text-xs font-medium whitespace-nowrap px-2 py-0.5 rounded-md border ${getTimePeriodInfo(schedule.start_time).className}`}>
              {getTimePeriodInfo(schedule.start_time).text}
            </span>
            <span className="text-xs text-gray-500 whitespace-nowrap">{schedule.start_time} - {schedule.end_time}</span>
            <span className="text-xs text-gray-800 truncate" title={subject?.name || '未知课程'}>
              <BookOpen className="h-3 w-3 inline-block mr-1 text-gray-400" />
              {subject?.name || '未知课程'}
            </span>
            <span className="text-xs text-gray-800 truncate" title={teacher?.full_name || '未知老师'}>
              <User className="h-3 w-3 inline-block mr-1 text-gray-400" />
              {teacher?.full_name || '未知老师'}
            </span>
            {/* 冲突警告图标 */}
            {(schedule.teacher_conflict_info || schedule.venue_conflict_info) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <div className="space-y-2">
                      {schedule.teacher_conflict_info && (
                        <div>
                          <div className="font-medium text-red-600">教师冲突</div>
                          <div className="text-sm">
                            与"{schedule.teacher_conflict_info.lesson_title}"冲突
                            {schedule.teacher_conflict_info.plan_name && (
                              <span className="text-gray-500"> ({schedule.teacher_conflict_info.plan_name})</span>
                            )}
                </div>
                        </div>
                      )}
                      {schedule.venue_conflict_info && (
                        <div>
                          <div className="font-medium text-red-600">教室冲突</div>
                          <div className="text-sm">
                            与"{schedule.venue_conflict_info.lesson_title}"冲突
                            {schedule.venue_conflict_info.plan_name && (
                              <span className="text-gray-500"> ({schedule.venue_conflict_info.plan_name})</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
              </div>

          {/* 第二行：主题 */}
          <div className="flex items-center">
                {editingTitleId === schedule.id ? (
                    <Input
                key={schedule.id}
                defaultValue={editingTitleValue}
                placeholder="请输入本节课主题..."
                className="text-sm h-7 flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEditingTitle(schedule.id, (e.target as HTMLInputElement).value);
                  }
                  if (e.key === 'Escape') {
                          cancelEditingTitle();
                        }
                      }}
                onBlur={(e) => {
                  saveEditingTitle(schedule.id, e.target.value);
                }}
                      autoFocus
                    />
                ) : (
                  <div 
                className={`flex-1 text-sm font-medium truncate cursor-pointer hover:text-blue-600 ${
                  (schedule.lesson_title === '未设置本节课主题' || !schedule.lesson_title) ? 'text-gray-400 italic' : 'text-gray-900'
                    }`}
                    onClick={() => startEditingTitle(schedule.id, schedule.lesson_title)}
                title="点击设置本节课主题"
                  >
                {schedule.lesson_title || '未设置本节课主题'}
                  </div>
                )}
              </div>
              </div>

        {/* 教室标签 (与删除按钮同一层级) */}
        <div className="flex items-center gap-2">
          <Select 
            value={schedule.venue_id || ''} 
            onValueChange={async (value) => {
              const venue = baseData.venues.find(v => v.id === value);
              await editPreviewItem(schedule.id, { 
                venue_id: value, 
                location: venue?.name || '', 
                isEdited: true 
              });
            }}
          >
            <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs px-2 py-1 border-gray-300 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 rounded-md">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-gray-500" />
                <SelectValue placeholder="选择教室" />
                </div>
            </SelectTrigger>
            <SelectContent align="end">
              {baseData.venues.map(venue => (
                <SelectItem key={venue.id} value={venue.id}>
                  <span>{venue.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
            </div>
            
        {/* 操作按钮组 (固定宽度) */}
        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onRemoveClick} className="h-8 w-8 p-0 text-gray-500 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </Button>
              </TooltipTrigger>
              <TooltipContent><p>删除课程</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
            </div>
          </div>
    );
  };

  // 渲染课程预览列表
  const renderPreviewList = () => {
    // 按日期和时间排序
    const sortedSchedules = [...previewSchedules].sort((a, b) => {
      const dateA = new Date(`${a.schedule_date}T${a.start_time}`);
      const dateB = new Date(`${b.schedule_date}T${b.start_time}`);
      return dateA.getTime() - dateB.getTime();
    });

    return (
    <Card className="flex flex-col h-full">
             <CardHeader className="pb-3 flex-shrink-0">
         <CardTitle className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <BookOpen className="h-5 w-5" />
              <span>预览微调</span>
           </div>
           <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              共 {previewSchedules.length} 节待创建课程
           </Badge>
         </CardTitle>
       </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-3 min-h-0">
        {previewSchedules.length === 0 ? (
          <div className="flex items-center justify-center text-gray-500 py-12">
            <div className="text-center">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">预览微调</p>
                <p className="text-sm text-gray-400">您在左侧添加的课程将在这里显示，按上课日期自动排序。</p>
            </div>
          </div>
                 ) : (
            <div className="space-y-0">
              {sortedSchedules.map((schedule, index) => (
                <ScheduleItem
                     key={schedule.id}
                     schedule={schedule}
                     index={index}
                     onRemoveClick={() => removeFromPreview(schedule.id)}
                   />
                 ))}
               </div>
         )}
      </CardContent>
    </Card>
  );
  };

  // 渲染最终操作区
  const renderFinalActions = () => (
    <Card className="border-t-4 border-t-green-500">
      <CardContent className="pt-4">
    <div className="space-y-4">
          {/* 汇总信息 */}
      <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="text-lg font-medium">
                {selectedPlan && !isCreatingNewPlan ? 
                  `课表编辑 - ${previewSchedules.length} 节课` : 
                  `准备创建 ${previewSchedules.length} 节课`
                }
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {previewSchedules.length > 0 && new Date().toLocaleDateString()}
            </div>
          </div>

          {/* 计划信息标识 */}
          {(selectedPlan || isCreatingNewPlan) && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border">
              <Layers className="h-4 w-4 text-blue-600" />
              <div className="flex-1">
                {selectedPlan && !isCreatingNewPlan && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-900">编辑课表:</span>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      {selectedPlan.name}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      ({selectedPlan.total_schedules} 节已有课程)
                    </span>
                  </div>
                )}
                {isCreatingNewPlan && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-900">新建课表:</span>
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      {newPlanForm.name || '未命名课表'}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 操作按钮区 */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <AlertCircle className="h-4 w-4" />
              <span>
                {selectedPlan && !isCreatingNewPlan ? 
                  `点击后，预览列表中的所有课程将被保存到 "${selectedPlan.name}" 课表中` : 
                  `点击后，预览列表中的所有课程将被保存到 "${newPlanForm.name || '新课表'}" 课表中`
                }
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleClearPreview}
                disabled={previewSchedules.length === 0}
                className="text-gray-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                清空预览
              </Button>
              
              <Button 
                onClick={handleSavePlan} 
                disabled={
                  loading || 
                  isConflictChecking ||
                  previewSchedules.length === 0 || 
                  (!selectedPlan && !isCreatingNewPlan) ||
                  previewSchedules.some(schedule => schedule.teacher_conflict_info || schedule.venue_conflict_info)
                }
                className={cn(
                  "min-w-32",
                  previewSchedules.some(schedule => schedule.teacher_conflict_info || schedule.venue_conflict_info)
                    ? "bg-red-600 hover:bg-red-700"
                    : isConflictChecking
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-green-600 hover:bg-green-700"
                )}
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    保存中...
                  </>
                ) : isConflictChecking ? (
                  <>
                    <span className="animate-spin mr-2">🔍</span>
                    正在进行冲突检测...
                  </>
                ) : previewSchedules.some(schedule => schedule.teacher_conflict_info || schedule.venue_conflict_info) ? (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    存在冲突，无法保存
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {selectedPlan && !isCreatingNewPlan ? 
                      `确认并更新 ${previewSchedules.length} 节课` : 
                      `确认并创建 ${previewSchedules.length} 节课`
                    }
                  </>
                )}
        </Button>
      </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // 渲染学员管理对话框
  const renderParticipantManagementDialog = () => (
    <Dialog 
      open={participantDialog.open} 
      onOpenChange={(open) => setParticipantDialog(prev => ({ ...prev, open }))}
    >
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            管理学员 - {participantDialog.scheduleTitle}
          </DialogTitle>
        </DialogHeader>

        {participantLoading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">加载学员信息中...</p>
            </div>
        </div>
      ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 min-h-0">
            {/* 来自班级的学员 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    班级学员
                  </Badge>
                  <span className="text-sm text-gray-500">
                    ({scheduleParticipants.classStudents.length}人)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scheduleParticipants.classStudents.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暂无班级学员</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {scheduleParticipants.classStudents.map(student => (
                      <div key={student.student_id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                                 <div>
                           <div className="font-medium">{student.full_name}</div>
                           <div className="text-xs text-gray-500">默认参与</div>
                         </div>
                         <Badge variant="secondary">
                           {student.participation_type === 'full' ? '全程' : 
                            student.participation_type === 'partial' ? '部分' : '旁听'}
                         </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

                              {/* 计划级插班学员 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    插班学员
                  </Badge>
                  <span className="text-sm text-gray-500">
                    ({scheduleParticipants.planStudents.length}人)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scheduleParticipants.planStudents.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暂无计划级插班学员</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {scheduleParticipants.planStudents.map(student => (
                      <div key={student.student_id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                                 <div>
                           <div className="font-medium">{student.full_name}</div>
                           <div className="text-xs text-gray-500">插班参与</div>
                         </div>
                         <div className="flex items-center gap-2">
                           <Badge variant="secondary">
                             {student.participation_type === 'full' ? '全程' : 
                              student.participation_type === 'partial' ? '部分' : '旁听'}
                           </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                            onClick={() => handleRemoveScheduleParticipant(student.student_id, '从本节课临时移除')}
                            className="text-red-500 hover:text-red-700 p-1 h-auto"
                >
                            <Trash2 className="h-3 w-3" />
                </Button>
              </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 本节课临时学员 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-50 text-orange-700">
                    本节课学员
                  </Badge>
                  <span className="text-sm text-gray-500">
                    ({scheduleParticipants.scheduleStudents.length}人)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // TODO: 实现添加学员功能
                      toast({
                        title: "功能提示",
                        description: "添加临时学员功能将在下个版本实现"
                      });
                    }}
                    className="ml-auto"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    添加学员
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scheduleParticipants.scheduleStudents.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暂无临时学员</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {scheduleParticipants.scheduleStudents.map(student => (
                      <div key={student.student_id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div>
                          <div className="font-medium">{student.full_name}</div>
                          <div className="text-xs text-gray-500">
                            {student.notes || '临时参与'}
                          </div>
                        </div>
                                                 <div className="flex items-center gap-2">
                           <Badge variant="secondary">
                             {student.participation_type === 'full' ? '全程' : 
                              student.participation_type === 'partial' ? '部分' : '旁听'}
                           </Badge>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleRemoveScheduleParticipant(student.student_id, '移除临时学员')}
                             className="text-red-500 hover:text-red-700 p-1 h-auto"
                           >
                             <Trash2 className="h-3 w-3" />
                           </Button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 汇总信息 */}
            <Card className="bg-gray-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-6">
                    <span>
                      <strong>班级学员:</strong> {scheduleParticipants.classStudents.length}人
                    </span>
                    <span>
                      <strong>插班学员:</strong> {scheduleParticipants.planStudents.length}人
                    </span>
                    <span>
                      <strong>临时学员:</strong> {scheduleParticipants.scheduleStudents.length}人
                    </span>
                  </div>
                  <div className="font-medium">
                    总计: {
                      scheduleParticipants.classStudents.length + 
                      scheduleParticipants.planStudents.length + 
                      scheduleParticipants.scheduleStudents.length
                    } 人参与本节课
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button 
            variant="outline" 
            onClick={() => setParticipantDialog(prev => ({ ...prev, open: false }))}
          >
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // 渲染课程编辑对话框
  const renderEditDialog = () => (
    <Dialog 
      open={editDialog.open} 
      onOpenChange={(open) => setEditDialog(prev => ({ ...prev, open }))}
    >
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            编辑课程 - {editDialog.scheduleData?.lesson_title}
          </DialogTitle>
        </DialogHeader>

        {editLoading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">保存中...</p>
            </div>
          </div>
                 ) : (
           <div className="flex-1 overflow-y-auto min-h-0">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
               {/* 时间信息 */}
               <Card>
                 <CardHeader className="pb-3">
                   <CardTitle className="text-base flex items-center gap-2">
                     <Clock className="h-4 w-4" />
                     时间安排
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div>
                     <Label htmlFor="schedule-date">上课日期 *</Label>
                  <Input
                       id="schedule-date"
                    type="date"
                       value={editForm.schedule_date}
                       onChange={(e) => setEditForm(prev => ({ ...prev, schedule_date: e.target.value }))}
                       className="mt-1"
                  />
                </div>
                   <div className="grid grid-cols-2 gap-2">
                     <div>
                       <Label htmlFor="start-time">开始时间 *</Label>
                  <Input
                         id="start-time"
                    type="time"
                         value={editForm.start_time}
                         onChange={(e) => setEditForm(prev => ({ ...prev, start_time: e.target.value }))}
                         className="mt-1"
                  />
                </div>
                     <div>
                       <Label htmlFor="end-time">结束时间 *</Label>
                  <Input
                         id="end-time"
                    type="time"
                         value={editForm.end_time}
                         onChange={(e) => setEditForm(prev => ({ ...prev, end_time: e.target.value }))}
                         className="mt-1"
                  />
                </div>
                   </div>
                 </CardContent>
               </Card>

               {/* 课程信息 */}
               <Card>
                 <CardHeader className="pb-3">
                   <CardTitle className="text-base flex items-center gap-2">
                     <BookOpen className="h-4 w-4" />
                     课程信息
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div>
                     <Label htmlFor="lesson-title">课程主题 *</Label>
                  <Input
                       id="lesson-title"
                       value={editForm.lesson_title}
                       onChange={(e) => setEditForm(prev => ({ ...prev, lesson_title: e.target.value }))}
                       placeholder="请输入课程主题"
                       className="mt-1"
                  />
                </div>
                   <div>
                     <Label htmlFor="location">上课地点</Label>
                     <Select value={editForm.location} onValueChange={(value) => setEditForm(prev => ({ ...prev, location: value }))}>
                       <SelectTrigger className="mt-1">
                         <SelectValue placeholder="选择上课地点" />
                    </SelectTrigger>
                    <SelectContent>
                         {baseData.venues.map(venue => (
                           <SelectItem key={venue.id} value={venue.name}>
                          {venue.name}
                        </SelectItem>
                      ))}
                         <SelectItem value="在线">在线课程</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                 </CardContent>
               </Card>

               {/* 详细信息 - 占两列 */}
               <Card className="md:col-span-2">
                 <CardHeader className="pb-3">
                   <CardTitle className="text-base flex items-center gap-2">
                     <Edit2 className="h-4 w-4" />
                     详细说明
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div>
                     <Label htmlFor="lesson-description">课程描述</Label>
                     <Textarea
                       id="lesson-description"
                       value={editForm.lesson_description}
                       onChange={(e) => setEditForm(prev => ({ ...prev, lesson_description: e.target.value }))}
                       placeholder="请输入课程详细描述"
                       rows={3}
                       className="mt-1"
                     />
              </div>
                   <div>
                     <Label htmlFor="notes">备注信息</Label>
                     <Textarea
                       id="notes"
                       value={editForm.notes}
                       onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                       placeholder="其他备注信息"
                       rows={2}
                       className="mt-1"
                     />
                   </div>
                 </CardContent>
            </Card>
             </div>
        </div>
      )}

        <div className="flex justify-between pt-4 border-t flex-shrink-0">
          <div className="flex items-center text-sm text-gray-500">
            <AlertCircle className="h-4 w-4 mr-2" />
            修改将立即反映在预览列表中
    </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setEditDialog(prev => ({ ...prev, open: false }))}
              disabled={editLoading}
            >
              取消
            </Button>
            <Button 
              onClick={handleSaveEditedSchedule}
              disabled={editLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  保存修改
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );



  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseRequest}>
        <DialogContent 
          className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col"
          aria-describedby="smart-schedule-description"
        >
          <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              {selectedPlan && !isCreatingNewPlan ? 
                `编辑 '${selectedPlan.name}'` : 
                isCreatingNewPlan ? 
                '创建新课表并排课' : 
                '智能排课工作台'
              }
          </DialogTitle>
            <div id="smart-schedule-description" className="sr-only">
              智能排课工具，可以创建课表、配置课程信息并批量生成排课
            </div>
        </DialogHeader>

          {/* 双栏布局：左栏配置区 + 右栏预览区 */}
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-hidden">
            
            {/* 左栏：排课生成器 */}
            <div className="flex flex-col min-h-0 overflow-y-auto">
              <Card className="flex flex-col h-full">
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      <span>课表配置</span>
                </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {selectedPlan ? '已选择课表' : isCreatingNewPlan ? '新建课表' : '未选择课表'}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                    <AlertCircle className="h-3 w-3" />
                    按步骤完成配置，然后生成课程预览
                  </p>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-y-auto p-4 min-h-0">
                  <Accordion type="multiple" defaultValue={["plan", "course", "tools"]} className="w-full">
                
                {/* 第一步：设置课表计划 */}
                <AccordionItem value="plan" className="border rounded-lg mb-3">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                        1
              </div>
                      <div className="text-left">
                        <div className="font-medium">第一步：设置课表计划</div>
                        <div className="text-sm text-gray-500">
                          {selectedPlan ? `已选择: ${selectedPlan.name}` : 
                           isCreatingNewPlan ? `新建: ${newPlanForm.name || '未命名'}` : 
                           '创建或选择课表计划'}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {renderPlanSelector()}
                  </AccordionContent>
                </AccordionItem>

                {/* 第二步：指定参与学员 */}
                <AccordionItem value="participants" className="border rounded-lg mb-3">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-medium">
                        2
                </div>
                      <div className="text-left">
                        <div className="font-medium">第二步：指定参与学员</div>
                                                <div className="text-sm text-gray-500">
                          {(() => {
                            const classStudentsCount = selectedClass ? availableStudents.length : 0;
                            const additionalStudentsCount = additionalStudents.length;
                            const totalStudents = classStudentsCount + additionalStudentsCount;
                            
                            if (totalStudents > 0) {
                              if (classStudentsCount > 0 && additionalStudentsCount > 0) {
                                return `已选择 ${totalStudents} 位学员 (班级 ${classStudentsCount} 人 + 插班 ${additionalStudentsCount} 人)`;
                              } else if (classStudentsCount > 0) {
                                return `已选择 ${classStudentsCount} 位班级学员`;
                              } else {
                                return `已选择 ${additionalStudentsCount} 位插班学员`;
                              }
                            }
                            return '选择主要班级，并可按需添加全程参与的插班学员';
                          })()}
              </div>
          </div>
        </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {renderParticipantsManagement()}
                  </AccordionContent>
                </AccordionItem>

                {/* 第三步：添加课程到预览列表 */}
                <AccordionItem value="tools" className="border rounded-lg">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-medium">
                        3
                      </div>
                      <div className="text-left">
                        <div className="font-medium">第三步：添加课程到预览列表</div>
                        <div className="text-sm text-gray-500">
                          {currentView === 'single' ? '生成单次或周期性课程，它们将出现在右侧预览区' : '生成单次或周期性课程，它们将出现在右侧预览区'}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {renderScheduleTools()}
                  </AccordionContent>
                </AccordionItem>

                  </Accordion>
                </CardContent>
              </Card>
            </div>

            {/* 右栏：预览区域 */}
            <div className="flex flex-col gap-4 min-h-0">
              {/* 课程预览列表 */}
              <div className="flex-1 min-h-0">
                {renderPreviewList()}
              </div>

              {/* 最终操作区 */}
              <div className="flex-shrink-0">
                {renderFinalActions()}
              </div>
            </div>

          </div>

          {/* 渲染学员管理对话框 */}
          {renderParticipantManagementDialog()}

          {/* 渲染课程编辑对话框 */}
          {renderEditDialog()}
      </DialogContent>
    </Dialog>

      {/* 关闭确认对话框 */}
      <AlertDialog open={closeConfirmDialog} onOpenChange={setCloseConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-orange-600" />
              您有未保存的排课
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="text-base">
                您已在预览列表中生成了 <span className="font-semibold text-orange-600">{previewSchedules.length}</span> 节课但尚未保存。确定要关闭吗？所有未保存的排课都将丢失。
              </div>
              <div className="text-sm text-gray-600">
                建议先点击"保存计划"按钮保存当前配置的课程，或者点击"取消"继续编辑。
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClose}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确定关闭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清空预览确认对话框 */}
      <AlertDialog open={clearPreviewDialog} onOpenChange={setClearPreviewDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              确认清空预览
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="text-base">
                确定要清空所有 <span className="font-semibold text-red-600">{previewSchedules.length}</span> 节预览课程吗？
              </div>
              <div className="text-sm text-gray-600">
                清空后将无法恢复，如需保留请先点击"保存计划"。
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClearPreview}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmClearPreview}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确定清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 