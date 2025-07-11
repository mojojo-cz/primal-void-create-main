import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { ScheduleSkeleton } from "@/components/ui/schedule-skeleton";
import { InlineEdit } from "@/components/ui/inline-edit";
import { useStickyTableHeader } from "@/hooks/useStickyHeader";
import { Calendar, Plus, Filter, Edit, Trash2, Search, Clock, MapPin, Users, BookOpen, AlertCircle, RefreshCw, X, RotateCcw, Grid3X3, List, Zap, FileText, User, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

import ScheduleCalendar from "@/components/ScheduleCalendar";
import SmartScheduleWorkbench from "@/components/SmartScheduleWorkbench";
import { 
  Schedule as DatabaseSchedule, 
  ScheduleInsert, 
  Subject as DatabaseSubject, 
  Class as DatabaseClass, 
  Venue as DatabaseVenue 
} from '../../types/database.types';

// 类型定义
interface Subject {
  id: string;
  name: string;
  category: string;
  description?: string;
  difficulty_level?: string;
  credit_hours?: number;
}

interface Class {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  max_students?: number;
  head_teacher_id?: string;
  student_count: number;
}

interface Teacher {
  id: string;
  username: string;
  full_name: string;
  user_type: string;
}

interface Venue {
  id: string;
  name: string;
  type: 'classroom' | 'conference_room';
  capacity: number | null;
  details: string | null;
  status: 'available' | 'maintenance' | 'unavailable';
}

interface Schedule {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  venue_id: string | null;
  schedule_date: string;
  start_time: string;
  end_time: string;
  lesson_title: string;
  lesson_description?: string;
  online_meeting_url?: string;
  course_hours?: number;
  status: string;
  created_at: string;
  updated_at: string;
  // 关联数据
  class_name: string;
  subject_name: string;
  teacher_name: string;
  teacher_full_name?: string;
  venue_name?: string;
  venue_type?: string;
}

// 扩展的排课类型，包含关联数据
interface ScheduleWithDetails extends DatabaseSchedule {
  class_name: string;
  subject_name: string;
  teacher_name: string;
  teacher_full_name: string;
  venue_name?: string;
  // 新增计划相关字段
  plan_name?: string;
  participants_count?: number;
}

// 表单数据类型
interface ScheduleFormData {
  class_id: string;
  subject_id: string;
  teacher_id: string;
  venue_id: string;
  plan_id: string; // 新增计划ID字段
  schedule_date: string;
  start_time: string;
  end_time: string;
  lesson_title: string;
  lesson_description: string;
  online_meeting_url: string;
  course_hours: number;
  notes: string;
}

// 教师信息类型
interface Teacher {
  id: string;
  username: string;
  full_name: string | null;
}

// 日期分组的数据结构
interface DateGroup {
  date: string;
  schedules: ScheduleWithDetails[];
}

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

// 按日期分组课程的工具函数
const groupSchedulesByDate = (schedules: ScheduleWithDetails[]): DateGroup[] => {
  const groups: { [key: string]: ScheduleWithDetails[] } = {};
  
  schedules.forEach(schedule => {
    const date = schedule.schedule_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(schedule);
  });
  
  // 按日期排序，每个日期内按时间排序
  return Object.keys(groups)
    .sort()
    .map(date => ({
      date,
      schedules: groups[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
    }));
};

// 优化的课程项组件
interface OptimizedScheduleItemProps {
  schedule: ScheduleWithDetails;
  index: number;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onDelete: (schedule: ScheduleWithDetails) => void;
  onUpdateTitle: (scheduleId: string, newTitle: string) => Promise<void>;
  formatTime: (time: string) => string;
  venues: DatabaseVenue[];
  onUpdateVenue: (scheduleId: string, venueId: string | null, venueName: string) => void;
}

const OptimizedScheduleItem: React.FC<OptimizedScheduleItemProps> = ({
  schedule,
  index,
  isFirstInGroup = false,
  isLastInGroup = false,
  onDelete,
  onUpdateTitle,
  formatTime,
  venues,
  onUpdateVenue
}) => {
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [editingTitleValue, setEditingTitleValue] = React.useState(schedule.lesson_title);

  const startEditingTitle = () => {
    setEditingTitle(true);
    setEditingTitleValue(schedule.lesson_title);
  };

  const saveEditingTitle = async (newTitle: string) => {
    if (newTitle.trim() !== schedule.lesson_title) {
      try {
        await onUpdateTitle(schedule.id, newTitle.trim());
      } catch (error) {
        // 错误已在onUpdateTitle中处理
      }
    }
    setEditingTitle(false);
  };

  const cancelEditingTitle = () => {
    setEditingTitle(false);
    setEditingTitleValue(schedule.lesson_title);
  };

  return (
    <div 
      className={`flex items-center hover:bg-gray-50/80 transition-colors border-b border-gray-100 ${
        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
      }`}
    >
      {/* 时段标识 */}
      <div className="w-24 p-3 text-center flex-shrink-0">
        <span className={`text-xs font-medium px-2 py-1 rounded-md border ${getTimePeriodInfo(schedule.start_time).className}`}>
          {getTimePeriodInfo(schedule.start_time).text}
        </span>
      </div>

      {/* 具体时间 */}
      <div className="w-36 p-3 text-sm text-gray-600 flex-shrink-0">
        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
      </div>

      {/* 科目 */}
      <div className="w-32 p-3 flex-shrink-0">
        <div className="flex items-center gap-1">
          <BookOpen className="h-3 w-3 text-gray-400" />
          <span className="text-sm text-gray-800 truncate" title={schedule.subject_name || '未知课程'}>
            {schedule.subject_name || '未知课程'}
          </span>
        </div>
      </div>

      {/* 课程主题（行内编辑） */}
      <div className="w-60 min-w-0 p-3 flex-shrink-0 truncate">
        {editingTitle ? (
          <input
            type="text"
            value={editingTitleValue}
            onChange={(e) => setEditingTitleValue(e.target.value)}
            placeholder="请输入本节课主题..."
            className="text-sm h-7 w-full px-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveEditingTitle(editingTitleValue);
              } else if (e.key === 'Escape') {
                cancelEditingTitle();
              }
            }}
            onBlur={() => saveEditingTitle(editingTitleValue)}
            autoFocus
          />
        ) : (
          <button
            onClick={startEditingTitle}
            className="text-sm text-left w-full hover:text-blue-600 transition-colors truncate"
            title={`${schedule.lesson_title || '点击设置本节课主题'} (点击编辑)`}
          >
            {schedule.lesson_title || (
              <span className="text-gray-400 italic">点击设置本节课主题</span>
            )}
          </button>
        )}
      </div>

      {/* 教师 */}
      <div className="w-28 p-3 text-sm text-gray-700 flex-shrink-0 truncate" title={schedule.teacher_full_name || schedule.teacher_name}>
        {schedule.teacher_full_name || schedule.teacher_name}
      </div>

      {/* 教室 */}
      <div className="w-36 p-3 text-sm text-gray-700 flex-shrink-0 truncate" title={schedule.venue_name || '在线课程'}>
        {schedule.venue_name || '在线课程'}
      </div>

      {/* 所属课表 */}
      <div className="w-60 p-3 text-sm text-gray-600 flex-shrink-0 truncate" title={schedule.plan_name || '未分配课表'}>
        {schedule.plan_name || (
          <span className="text-gray-400 italic">未分配</span>
        )}
      </div>

      {/* 备注 */}
      <div className="flex-1 p-3 text-sm text-gray-600 min-w-0 truncate" title={schedule.notes || ''}>
        {schedule.notes || (
          <span className="text-gray-400 italic">无备注</span>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="w-16 p-3 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(schedule)}
          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
          title="删除课程"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// 日期分组头部组件
interface DateGroupHeaderProps {
  date: string;
  scheduleCount: number;
}

const DateGroupHeader: React.FC<DateGroupHeaderProps> = ({ date, scheduleCount }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekday = date.toLocaleDateString('zh-CN', { weekday: 'short' });
    return `${year}/${month}/${day} ${weekday}`;
  };

  return (
    <div className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-800">
            {formatDate(date)}
          </span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {scheduleCount} 节课
        </Badge>
      </div>
    </div>
  );
};

// 表格头部组件
const ScheduleTableHeader: React.FC = () => {
  return (
    <div className="bg-gray-50 text-xs font-medium text-gray-700 border-b-0">
      <div className="flex items-center">
        {/* 日期列 */}
        <div className="w-24 p-3 text-center bg-gray-100 border-r border-gray-200">日期</div>
        {/* 其他列 */}
        <div className="flex-1 flex items-center">
          <div className="w-24 p-3 text-center">时段</div>
          <div className="w-36 p-3">具体时间</div>
          <div className="w-32 p-3">科目</div>
          <div className="w-60 p-3">课程主题</div>
          <div className="w-28 p-3">任课老师</div>
          <div className="w-36 p-3">教室</div>
          <div className="w-60 p-3">所属课表</div>
          <div className="flex-1 p-3">备注</div>
          <div className="w-16 p-3 text-center">操作</div>
        </div>
      </div>
    </div>
  );
};

const ScheduleManagement = () => {
  const { user, profile } = useAuth();
  
  // 基础状态
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [subjects, setSubjects] = useState<DatabaseSubject[]>([]);
  const [classes, setClasses] = useState<DatabaseClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [venues, setVenues] = useState<DatabaseVenue[]>([]);
  const [schedulePlans, setSchedulePlans] = useState<any[]>([]);
  
  // 无限滚动状态
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20; // 每次加载数量
  
  // 搜索和筛选状态
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterVenue, setFilterVenue] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  
  // 视图状态
  const [currentView, setCurrentView] = useState<'table' | 'calendar'>('table');
  
  // 筛选栏展开状态
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // 对话框状态
  const [smartWorkbenchDialog, setSmartWorkbenchDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; schedule: ScheduleWithDetails | null }>({ 
    open: false, 
    schedule: null 
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; schedule: ScheduleWithDetails | null }>({ 
    open: false, 
    schedule: null 
  });
  
  // 表单状态
  const [formData, setFormData] = useState<ScheduleFormData>({
    class_id: '',
    subject_id: '',
    teacher_id: '',
    venue_id: '',
    plan_id: '',
    schedule_date: '',
    start_time: '',
    end_time: '',
    lesson_title: '',
    lesson_description: '',
    online_meeting_url: '',
    course_hours: 1,
    notes: ''
  });
  
  // 权限检查
  const hasAccess = profile?.user_type === 'admin' || 
                   profile?.user_type === 'head_teacher' || 
                   profile?.user_type === 'business_teacher';

  // 无限滚动逻辑 - 移除总页数计算

  // 获取基础数据
  const fetchBaseData = async () => {
    try {
      // 获取课程列表
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // 获取班级列表
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // 获取教师列表
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('user_type', 'teacher')
        .order('full_name');

      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      // 获取场地列表
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .eq('status', 'available')
        .eq('type', 'classroom')
        .order('name');

      if (venuesError) throw venuesError;
      setVenues(venuesData || []);

      // 获取课表列表
      const { data: plansData, error: plansError } = await supabase.rpc('get_schedule_plans_with_stats', {
        p_limit: 1000,
        p_offset: 0,
        p_status: 'active'
      });

      if (plansError) throw plansError;
      setSchedulePlans(plansData || []);

    } catch (error: any) {
      console.error('获取基础数据失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载基础数据"
      });
    }
  };

  // 获取初始课程列表
  const fetchInitialSchedules = async () => {
    if (!hasAccess) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_schedules_with_details', {
          p_limit: pageSize,
          p_offset: 0,
          p_search_term: searchTerm || null,
          p_class_id: filterClass !== "all" ? filterClass : null,
          p_subject_id: filterSubject !== "all" ? filterSubject : null,
          p_teacher_id: filterTeacher !== "all" ? filterTeacher : null,
          p_venue_id: filterVenue !== "all" && filterVenue !== "online" ? filterVenue : null,
          p_plan_id: filterPlan !== "all" ? filterPlan : null,
          p_date_from: null,
          p_date_to: null
        });

      if (error) throw error;

      const formattedSchedules: ScheduleWithDetails[] = (data || []).map(schedule => ({
        id: schedule.id,
        class_id: schedule.class_id,
        subject_id: schedule.subject_id,
        teacher_id: schedule.teacher_id,
        venue_id: schedule.venue_id,
        plan_id: schedule.plan_id || null,
        schedule_date: schedule.schedule_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        duration_minutes: schedule.duration_minutes,
        lesson_title: schedule.lesson_title,
        lesson_description: schedule.lesson_description,
        online_meeting_url: schedule.online_meeting_url,
        course_hours: schedule.course_hours,
        status: schedule.status,
        notes: schedule.notes || '',
        created_by: schedule.created_by,
        created_at: schedule.created_at,
        updated_at: schedule.updated_at,
        // 关联数据
        class_name: schedule.class_name || '未知班级',
        subject_name: schedule.subject_name || '未知课程',
        teacher_name: schedule.teacher_name || '未知教师',
        teacher_full_name: schedule.teacher_full_name || schedule.teacher_name || '未知教师',
        venue_name: schedule.venue_name || '',
        // 新增计划相关字段
        plan_name: schedule.plan_name || undefined,
        participants_count: schedule.participants_count || 0
      }));

      // 前端处理"在线课程"筛选
      let filteredSchedules = formattedSchedules;
      if (filterVenue === "online") {
        filteredSchedules = formattedSchedules.filter(schedule => !schedule.venue_id);
      }

      setSchedules(filteredSchedules);
      setHasMore(filteredSchedules.length === pageSize);

      // 计算总数
      await fetchScheduleCount();

    } catch (error: any) {
      console.error('获取课程列表失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载课程列表"
      });
      setSchedules([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // 加载更多课程
  const loadMoreSchedules = async () => {
    if (!hasAccess || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .rpc('get_schedules_with_details', {
          p_limit: pageSize,
          p_offset: schedules.length,
          p_search_term: searchTerm || null,
          p_class_id: filterClass !== "all" ? filterClass : null,
          p_subject_id: filterSubject !== "all" ? filterSubject : null,
          p_teacher_id: filterTeacher !== "all" ? filterTeacher : null,
          p_venue_id: filterVenue !== "all" && filterVenue !== "online" ? filterVenue : null,
          p_plan_id: filterPlan !== "all" ? filterPlan : null,
          p_date_from: null,
          p_date_to: null
        });

      if (error) throw error;

      const formattedSchedules: ScheduleWithDetails[] = (data || []).map(schedule => ({
        id: schedule.id,
        class_id: schedule.class_id,
        subject_id: schedule.subject_id,
        teacher_id: schedule.teacher_id,
        venue_id: schedule.venue_id,
        plan_id: schedule.plan_id || null,
        schedule_date: schedule.schedule_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        duration_minutes: schedule.duration_minutes,
        lesson_title: schedule.lesson_title,
        lesson_description: schedule.lesson_description,
        online_meeting_url: schedule.online_meeting_url,
        course_hours: schedule.course_hours,
        status: schedule.status,
        notes: schedule.notes || '',
        created_by: schedule.created_by,
        created_at: schedule.created_at,
        updated_at: schedule.updated_at,
        // 关联数据
        class_name: schedule.class_name || '未知班级',
        subject_name: schedule.subject_name || '未知课程',
        teacher_name: schedule.teacher_name || '未知教师',
        teacher_full_name: schedule.teacher_full_name || schedule.teacher_name || '未知教师',
        venue_name: schedule.venue_name || '',
        // 新增计划相关字段
        plan_name: schedule.plan_name || undefined,
        participants_count: schedule.participants_count || 0
      }));

      // 前端处理"在线课程"筛选
      let filteredNewSchedules = formattedSchedules;
      if (filterVenue === "online") {
        filteredNewSchedules = formattedSchedules.filter(schedule => !schedule.venue_id);
      }

      // 追加新数据
      setSchedules(prev => [...prev, ...filteredNewSchedules]);
      setHasMore(filteredNewSchedules.length === pageSize);

    } catch (error: any) {
      console.error('加载更多课程失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载更多课程"
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // 获取课程总数
  const fetchScheduleCount = async () => {
    try {
      let countQuery = supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true });

      // 应用搜索条件
      if (searchTerm) {
        countQuery = countQuery.or(`lesson_title.ilike.%${searchTerm}%`);
      }

      // 应用筛选条件
      if (filterClass !== "all") {
        countQuery = countQuery.eq('class_id', filterClass);
      }
      if (filterSubject !== "all") {
        countQuery = countQuery.eq('subject_id', filterSubject);
      }
      if (filterTeacher !== "all") {
        countQuery = countQuery.eq('teacher_id', filterTeacher);
      }
      if (filterVenue !== "all" && filterVenue !== "online") {
        countQuery = countQuery.eq('venue_id', filterVenue);
      }
      if (filterVenue === "online") {
        countQuery = countQuery.is('venue_id', null);
      }
      if (filterPlan !== "all") {
        countQuery = countQuery.eq('plan_id', filterPlan);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

    } catch (error: any) {
      console.error('获取课程总数失败:', error);
    }
  };

  // 更新课程标题
  const handleUpdateScheduleTitle = async (scheduleId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('schedules')
        .update({ lesson_title: newTitle })
        .eq('id', scheduleId);

      if (error) throw error;

      // 更新本地状态
      setSchedules(prevSchedules => 
        prevSchedules.map(s => 
          s.id === scheduleId ? { ...s, lesson_title: newTitle } : s
        )
      );

      toast({
        title: "更新成功",
        description: "课程主题已更新"
      });

    } catch (error: any) {
      console.error('更新课程标题失败:', error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新课程标题"
      });
    }
  };

  // 删除课程
  const openDeleteDialog = (schedule: ScheduleWithDetails) => {
    setDeleteDialog({ open: true, schedule });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.schedule) return;
    
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', deleteDialog.schedule.id);

      if (error) throw error;

      // 更新本地状态
      setSchedules(prevSchedules => 
        prevSchedules.filter(s => s.id !== deleteDialog.schedule!.id)
      );

      toast({
        title: "删除成功",
        description: "课程已删除"
      });

      setDeleteDialog({ open: false, schedule: null });

      // 重新获取数据
      fetchInitialSchedules();

    } catch (error: any) {
      console.error('删除课程失败:', error);
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除课程"
      });
    }
  };

  // 日期验证函数
  const validateScheduleDate = (date: string): string | null => {
    if (!date) return "请选择上课日期";
    
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 重置时间到当天开始
    
    if (selectedDate < today) {
      return "上课日期不能早于今天，请选择今天或未来的日期";
    }
    
    return null;
  };

  // 时间验证函数
  const validateScheduleTime = (startTime: string, endTime: string): string | null => {
    if (!startTime || !endTime) return "请填写开始时间和结束时间";
    
    if (startTime >= endTime) {
      return "结束时间必须晚于开始时间";
    }
    
    return null;
  };

  // 编辑课程状态
  const [submitting, setSubmitting] = useState(false);

  // 编辑课程
  const handleEditSchedule = async () => {
    if (!editDialog.schedule) return;

    // 基础字段验证
    if (!formData.class_id || !formData.subject_id || !formData.teacher_id || 
        !formData.schedule_date || !formData.start_time || !formData.end_time || 
        !formData.lesson_title) {
      toast({
        variant: "destructive",
        title: "表单验证失败",
        description: "请填写所有必填字段"
      });
      return;
    }

    // 日期验证
    const dateError = validateScheduleDate(formData.schedule_date);
    if (dateError) {
      toast({
        variant: "destructive",
        title: "日期验证失败",
        description: dateError
      });
      return;
    }

    // 时间验证
    const timeError = validateScheduleTime(formData.start_time, formData.end_time);
    if (timeError) {
      toast({
        variant: "destructive",
        title: "时间验证失败",
        description: timeError
      });
      return;
    }

    setSubmitting(true);
    try {
      const scheduleData: Partial<DatabaseSchedule> = {
        class_id: formData.class_id,
        subject_id: formData.subject_id,
        teacher_id: formData.teacher_id,
        venue_id: formData.venue_id || null,
        plan_id: formData.plan_id || null,
        schedule_date: formData.schedule_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        lesson_title: formData.lesson_title.trim(),
        lesson_description: formData.lesson_description.trim() || null,
        online_meeting_url: formData.online_meeting_url.trim() || null,
        course_hours: formData.course_hours,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('schedules')
        .update(scheduleData)
        .eq('id', editDialog.schedule.id);

      if (error) throw error;

      toast({
        title: "更新成功",
        description: "课程信息已成功更新"
      });

      setEditDialog({ open: false, schedule: null });
      fetchInitialSchedules();

    } catch (error: any) {
      console.error('更新课程失败:', error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新课程"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 打开编辑对话框
  const openEditDialog = (schedule: ScheduleWithDetails) => {
    // 设置表单数据
    setFormData({
      class_id: schedule.class_id,
      subject_id: schedule.subject_id,
      teacher_id: schedule.teacher_id,
      venue_id: schedule.venue_id || "",
      plan_id: schedule.plan_id || "",
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      lesson_title: schedule.lesson_title,
      lesson_description: schedule.lesson_description || "",
      online_meeting_url: schedule.online_meeting_url || "",
      course_hours: schedule.course_hours || 1,
      notes: schedule.notes || ""
    });
    
    // 打开编辑对话框
    setEditDialog({ open: true, schedule });
  };

  // 日历事件处理（简化版）
  const handleCalendarEventClick = (schedule: ScheduleWithDetails) => {
    openEditDialog(schedule);
  };

  const handleCalendarDateClick = (date: Date) => {
    // 点击日历上的空白日期，打开智能排课工作台
    const dateString = date.toISOString().split('T')[0];
    
    // 检查日期是否有效（不能是过去的日期）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      toast({
        variant: "destructive",
        title: "日期选择错误",
        description: "不能在过去的日期创建排课，请选择今天或未来的日期"
      });
      return;
    }
    
    setSmartWorkbenchDialog(true);
  };

  const handleCalendarEventDrop = async (info: any) => {
    // 简化处理拖拽功能
    toast({
      title: "功能提示",
      description: "拖拽功能正在开发中，请使用编辑功能修改时间"
    });
    info.revert(); // 恢复到原位置
  };

  // 生成课表的颜色映射
  const planColorMap = React.useMemo(() => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
    ];
    const map: { [key: string]: string } = {};
    
    schedulePlans.forEach((plan, index) => {
      map[plan.name] = colors[index % colors.length];
    });
    
    map['其他排课'] = '#6b7280'; // 灰色用于其他排课
    
    return map;
  }, [schedulePlans]);

  // 工具函数
  const formatTime = (time: string) => {
    return time.slice(0, 5); // 只显示 HH:MM
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterClass("all");
    setFilterSubject("all");
    setFilterTeacher("all");
    setFilterVenue("all");
    setFilterPlan("all");
  };

  // 初始化数据
  useEffect(() => {
    if (hasAccess) {
      fetchBaseData();
    }
  }, [hasAccess]);

  // 筛选条件变化时重置数据和状态
  useEffect(() => {
    setSchedules([]);
    setHasMore(true);
    if (hasAccess) {
      fetchInitialSchedules();
    }
  }, [searchTerm, filterClass, filterSubject, filterTeacher, filterVenue, filterPlan]);

  // 当有其他筛选条件时自动展开筛选栏
  useEffect(() => {
    if (filterClass !== "all" || filterSubject !== "all" || filterTeacher !== "all" || filterVenue !== "all") {
      setFiltersExpanded(true);
    }
  }, [filterClass, filterSubject, filterTeacher, filterVenue]);

  // 动态获取当前课表标题
  const getCurrentScheduleTitle = () => {
    if (filterPlan === "all") {
      return "全部课表";
    }
    
    const selectedPlan = schedulePlans.find(plan => plan.id === filterPlan);
    return selectedPlan ? selectedPlan.name : "课表列表";
  };

  // 初始数据加载
  useEffect(() => {
    if (hasAccess) {
      fetchInitialSchedules();
    }
  }, [hasAccess, currentView]);

  // 无限滚动监听和横向滚动同步
  useEffect(() => {
    const handleScroll = () => {
      // 只在表格视图中启用无限滚动
      if (currentView !== 'table' || loadingMore || !hasMore) return;

      // 查找滚动容器
      const scrollContainer = document.getElementById('schedules-scroll-container') as HTMLElement;
      if (!scrollContainer) return;

      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      
      // 检查是否滚动到接近底部（距离底部300px时开始加载）
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        loadMoreSchedules();
      }
    };

    const handleHorizontalScroll = () => {
      // 同步表头和内容的横向滚动
      const scrollContainer = document.getElementById('schedules-scroll-container') as HTMLElement;
      const headerContainer = document.getElementById('table-header-scroll') as HTMLElement;
      
      if (scrollContainer && headerContainer) {
        headerContainer.scrollLeft = scrollContainer.scrollLeft;
      }
    };

    // 防抖处理，避免频繁触发
    let timeoutId: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleScroll();
        handleHorizontalScroll();
      }, 100);
    };

    // 监听滚动容器的滚动事件
    const scrollContainer = document.getElementById('schedules-scroll-container') as HTMLElement;
    const headerContainer = document.getElementById('table-header-scroll') as HTMLElement;
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', debouncedHandleScroll);
    }

    // 监听表头的横向滚动，同步到内容区域
    const handleHeaderScroll = () => {
      if (scrollContainer && headerContainer) {
        scrollContainer.scrollLeft = headerContainer.scrollLeft;
      }
    };

    if (headerContainer) {
      headerContainer.addEventListener('scroll', handleHeaderScroll);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', debouncedHandleScroll);
      }
      if (headerContainer) {
        headerContainer.removeEventListener('scroll', handleHeaderScroll);
      }
      clearTimeout(timeoutId);
    };
  }, [currentView, loadingMore, hasMore, loadMoreSchedules]);

  // 权限检查
  if (!profile) {
    // 如果profile还在加载，显示加载状态
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在验证权限...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">权限不足</h2>
          <p className="text-muted-foreground">只有管理员可以访问排课管理</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
          排课管理
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* 视图切换按钮 */}
                <div className="flex items-center bg-muted rounded-md p-1">
                  <Button
                    variant={currentView === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('table')}
                    className="h-8 px-3"
                  >
                    <List className="h-4 w-4 mr-1" />
                    表格
                  </Button>
                  <Button
                    variant={currentView === 'calendar' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('calendar')}
                    className="h-8 px-3"
                  >
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    日历
                  </Button>
                </div>
                
                {/* 智能排课工作台按钮 */}
                <Button 
                  onClick={() => setSmartWorkbenchDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  智能排课
                </Button>
              </div>
      </div>

      {/* 搜索和筛选区域 */}
            <Card className="border-dashed">
              <CardContent className="pt-6">
                {/* 默认显示：搜索 + 课表筛选 + 展开按钮 */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">搜索排课</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="search"
                        placeholder="输入课程标题、班级名称..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>课表筛选</Label>
                    <Select value={filterPlan} onValueChange={setFilterPlan}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择课表" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部课表</SelectItem>
                        {schedulePlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              {plan.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setFiltersExpanded(!filtersExpanded)}
                        className="flex-1 relative"
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        {filtersExpanded ? '收起筛选' : '更多筛选'}
                        <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} />
                        {/* 筛选状态指示器 - 只显示除搜索和课表外的其他筛选条件 */}
                        {(filterClass !== "all" || filterSubject !== "all" || filterTeacher !== "all" || filterVenue !== "all") && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={clearFilters}
                        className="flex-1"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        清除筛选
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 展开的完整筛选选项 */}
                {filtersExpanded && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>班级</Label>
                        <Select value={filterClass} onValueChange={setFilterClass}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择班级" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部班级</SelectItem>
                            {classes.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  {cls.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>课程</Label>
                        <Select value={filterSubject} onValueChange={setFilterSubject}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择课程" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部课程</SelectItem>
                            {subjects.map((subject) => (
                              <SelectItem key={subject.id} value={subject.id}>
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4" />
                                  {subject.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>老师</Label>
                        <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择老师" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部老师</SelectItem>
                            {teachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={teacher.id}>
                                {teacher.full_name || teacher.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>教室</Label>
                        <Select value={filterVenue} onValueChange={setFilterVenue}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择教室" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部教室</SelectItem>
                            {venues.map((venue) => (
                              <SelectItem key={venue.id} value={venue.id}>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  {venue.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
          </CardContent>
      </Card>
          </div>
        </CardHeader>

        <CardContent>
          {currentView === 'calendar' ? (
            /* 日历视图 */
            <ScheduleCalendar
              schedules={schedules}
              onEventClick={handleCalendarEventClick}
              onDateClick={handleCalendarDateClick}
              onEventDrop={handleCalendarEventDrop}
              loading={loading}
              planColorMap={planColorMap}
              schedulePlans={schedulePlans}
              filterPlan={filterPlan}
              onPlanFilterChange={setFilterPlan}
            />
          ) : loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">加载中...</p>
              </div>
            </div>
          ) : (
            <>


              {/* 排课列表 */}
              <div className="border rounded-lg bg-white relative">
                {/* 列表信息栏 - 固定在顶部 */}
                <div className="sticky top-0 z-30 bg-gray-50 p-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex-1"></div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">{getCurrentScheduleTitle()}</span>
                    </div>
                    <div className="flex-1 flex justify-end">
                      <div className="text-sm text-gray-500">
                        共 {totalCount} 节课程
                      </div>
                    </div>
                  </div>
                </div>

                {/* 表格头部 - 固定在滚动容器外部 */}
                {schedules.length > 0 && (
                  <div className="sticky top-[45px] z-20 bg-white border-b">
                    <div className="overflow-x-auto" id="table-header-scroll">
                      <ScheduleTableHeader />
                    </div>
                  </div>
                )}

                {/* 滚动容器 */}
                <div className="max-h-[60vh] overflow-y-auto overflow-x-auto" id="schedules-scroll-container">
                  {schedules.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      {(searchTerm || filterClass !== "all" || filterSubject !== "all" || filterTeacher !== "all" || filterVenue !== "all" || filterPlan !== "all") ? (
                        <div>
                          <p className="text-lg font-medium mb-2">未找到匹配的课程</p>
                          <p className="text-sm mb-4">尝试调整搜索条件或筛选器</p>
                          <Button
                            variant="outline"
                            onClick={clearFilters}
                            className="mx-auto"
                          >
                            <X className="h-4 w-4 mr-2" />
                            清除筛选条件
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-lg font-medium mb-2">还没有任何课程安排</p>
                          <p className="text-sm text-gray-400 mb-6">开始创建您的第一个课程安排</p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button
                              onClick={() => setSmartWorkbenchDialog(true)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              智能排课工作台
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setSmartWorkbenchDialog(true)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              快速创建排课
                            </Button>
                          </div>
                          <p className="text-xs text-gray-400 mt-4">
                            💡 推荐使用智能排课工作台，可以快速创建课程安排
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {(() => {
                        const dateGroups = groupSchedulesByDate(schedules);
                        let globalIndex = 0;
                        
                        return dateGroups.map((dateGroup) => (
                          <div key={dateGroup.date} className="border-b border-gray-100 last:border-b-0">
                            {/* 日期分组头部 - 合并单元格效果 */}
                            <div className="relative">
                              <div className="absolute left-0 top-0 bottom-0 w-24 bg-gray-50 border-r border-gray-200 flex items-center justify-center">
                                <div className="text-center px-2">
                                  <div className="text-sm font-semibold text-gray-800 mb-1">
                                    {(() => {
                                      const date = new Date(dateGroup.date);
                                      const month = date.getMonth() + 1;
                                      const day = date.getDate();
                                      return `${month}/${day}`;
                                    })()}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(dateGroup.date).toLocaleDateString('zh-CN', { weekday: 'short' })}
                                  </div>
                                </div>
                              </div>
                              
                              {/* 课程列表 */}
                              <div className="ml-24">
                                {dateGroup.schedules.map((schedule, index) => {
                                  const currentIndex = globalIndex++;
                                  return (
                                    <OptimizedScheduleItem 
                                      key={schedule.id}
                                      schedule={schedule}
                                      index={currentIndex}
                                      isFirstInGroup={index === 0}
                                      isLastInGroup={index === dateGroup.schedules.length - 1}
                                      onDelete={openDeleteDialog}
                                      onUpdateTitle={handleUpdateScheduleTitle}
                                      formatTime={formatTime}
                                      venues={venues}
                                      onUpdateVenue={(scheduleId, venueId, venueName) => {
                                        // 更新本地状态
                                        setSchedules(prevSchedules => 
                                          prevSchedules.map(s => 
                                            s.id === scheduleId ? { ...s, venue_id: venueId, venue_name: venueName } : s
                                          )
                                        );
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* 无限滚动加载指示器 */}
              {currentView === 'table' && loadingMore && (
                <div className="mt-6 flex justify-center py-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    <span className="text-sm">加载更多...</span>
                  </div>
                </div>
              )}
              
              {/* 滚动到底部提示 */}
              {currentView === 'table' && !hasMore && schedules.length > 0 && (
                <div className="mt-6 text-center py-4 text-gray-500 text-sm">
                  已显示全部 {schedules.length} 节课程
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 编辑排课对话框 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, schedule: null })}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑排课</DialogTitle>
            <DialogDescription>
              修改排课安排的信息。
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* 班级选择 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-class" className="text-right">
                班级 *
              </Label>
              <Select value={formData.class_id} onValueChange={(value) => setFormData(prev => ({ ...prev, class_id: value }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 课程选择 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-subject" className="text-right">
                课程 *
              </Label>
              <Select value={formData.subject_id} onValueChange={(value) => setFormData(prev => ({ ...prev, subject_id: value }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择课程" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
            
            {/* 教师选择 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-teacher" className="text-right">
                任课老师 *
              </Label>
              <Select value={formData.teacher_id} onValueChange={(value) => setFormData(prev => ({ ...prev, teacher_id: value }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择教师" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.full_name || teacher.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            
            {/* 上课日期 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-date" className="text-right">
                上课日期 *
              </Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.schedule_date}
                  min={new Date().toISOString().split('T')[0]} // 设置最小日期为今天
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, schedule_date: e.target.value }));
                  }}
                />
                {formData.schedule_date && validateScheduleDate(formData.schedule_date) && (
                  <p className="text-sm text-red-600">
                    {validateScheduleDate(formData.schedule_date)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  只能选择今天或未来的日期
                </p>
            </div>
            </div>
            
            {/* 开始时间 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-start-time" className="text-right">
                开始时间 *
              </Label>
              <div className="col-span-3">
                <Input
                  id="edit-start-time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                />
                          </div>
                          </div>
            
            {/* 结束时间 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-end-time" className="text-right">
                结束时间 *
              </Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="edit-end-time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                />
                {formData.start_time && formData.end_time && validateScheduleTime(formData.start_time, formData.end_time) && (
                  <p className="text-sm text-red-600">
                    {validateScheduleTime(formData.start_time, formData.end_time)}
                  </p>
                )}
                        </div>
                        </div>
            
            {/* 课程标题 */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-title" className="text-right">
                  课程标题 *
                </Label>
                <Input
                  id="edit-title"
                  placeholder="请输入课程标题"
                  value={formData.lesson_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, lesson_title: e.target.value }))}
                  className="col-span-3"
                />
                        </div>
                          </div>
            
            {/* 上课教室 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-venue" className="text-right">
                上课教室
              </Label>
              <Select 
                value={formData.venue_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, venue_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择教室" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无教室（在线课程）</SelectItem>
                  {venues.filter(venue => venue.type === 'classroom' && venue.status === 'available').map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name} {venue.capacity && `(${venue.capacity}人)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 课时 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-hours" className="text-right">
                课时
              </Label>
              <Input
                id="edit-hours"
                type="number"
                step="0.5"
                min="0"
                placeholder="课时数"
                value={formData.course_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, course_hours: parseFloat(e.target.value) }))}
                className="col-span-3"
              />
            </div>
            
            {/* 在线会议链接 */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-url" className="text-right">
                  在线会议链接
                </Label>
                <Input
                  id="edit-url"
                  placeholder="线上课程链接"
                  value={formData.online_meeting_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, online_meeting_url: e.target.value }))}
                  className="col-span-3"
                />
              </div>
            </div>
            
            {/* 课程描述 */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  课程描述
                </Label>
                <Textarea
                  id="edit-description"
                  placeholder="课程内容描述"
                  value={formData.lesson_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, lesson_description: e.target.value }))}
                  rows={3}
                  className="col-span-3"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialog({ open: false, schedule: null })}>
              取消
                          </Button>
            <Button onClick={handleEditSchedule} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  更新中...
                </>
              ) : (
                "更新排课"
              )}
                          </Button>
                        </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, schedule: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              确认删除排课
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>您确定要删除以下排课吗？此操作无法撤销。</p>
              {deleteDialog.schedule && (
                <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
                  <div><strong>课程标题：</strong>{deleteDialog.schedule.lesson_title}</div>
                  <div><strong>班级：</strong>{deleteDialog.schedule.class_name}</div>
                  <div><strong>课程：</strong>{deleteDialog.schedule.subject_name}</div>
                  <div><strong>教师：</strong>{deleteDialog.schedule.teacher_full_name || deleteDialog.schedule.teacher_name}</div>
                  <div><strong>时间：</strong>{formatDate(deleteDialog.schedule.schedule_date)} {formatTime(deleteDialog.schedule.start_time)}-{formatTime(deleteDialog.schedule.end_time)}</div>
            </div>
          )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialog({ open: false, schedule: null })}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 智能排课工作台对话框 */}
      <SmartScheduleWorkbench
        open={smartWorkbenchDialog}
        onOpenChange={setSmartWorkbenchDialog}
        onScheduleCreated={() => {
          // 刷新排课列表
          fetchInitialSchedules();
        }}
      />
    </div>
  );
};

export default ScheduleManagement; 