import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Filter, Edit, Trash2, Search, Clock, MapPin, Users, BookOpen, AlertCircle, RefreshCw, X, RotateCcw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";
import { EnhancedPagination } from "@/components/ui/enhanced-pagination";
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

// 状态选项
const STATUS_OPTIONS = [
  { value: "scheduled", label: "已安排", color: "blue" },
  { value: "in_progress", label: "进行中", color: "green" },
  { value: "completed", label: "已完成", color: "gray" },
  { value: "cancelled", label: "已取消", color: "red" },
];

// 扩展的排课类型，包含关联数据
interface ScheduleWithDetails extends DatabaseSchedule {
  class_name: string;
  subject_name: string;
  teacher_name: string;
  teacher_full_name: string;
  venue_name?: string;
}

// 表单数据类型
interface ScheduleFormData {
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
}

// 教师信息类型
interface Teacher {
  id: string;
  username: string;
  full_name: string | null;
}

const ScheduleManagement = () => {
  const { user, profile } = useAuth();
  
  // 基础状态
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [subjects, setSubjects] = useState<DatabaseSubject[]>([]);
  const [classes, setClasses] = useState<DatabaseClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [venues, setVenues] = useState<DatabaseVenue[]>([]);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());
  const [totalCount, setTotalCount] = useState(0);
  
  // 搜索和筛选状态
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterVenue, setFilterVenue] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // 对话框状态
  const [createDialog, setCreateDialog] = useState(false);
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
    class_id: "",
    subject_id: "",
    teacher_id: "",
    venue_id: "",
    schedule_date: "",
    start_time: "",
    end_time: "",
    lesson_title: "",
    lesson_description: "",
    online_meeting_url: "",
    course_hours: 2,
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  
  // 权限检查 - 只允许管理员访问
  const isAdmin = profile?.user_type === "admin";
  const hasAccess = isAdmin;

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
        .eq('status', 'active')
        .order('name');

      if (venuesError) throw venuesError;
      setVenues(venuesData || []);

    } catch (error: any) {
      console.error('获取基础数据失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载基础数据"
      });
    }
  };

  // 获取排课列表
  const fetchSchedules = async () => {
    if (!hasAccess) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          classes:class_id(name),
          subjects:subject_id(name),
          profiles:teacher_id(username, full_name),
          venues:venue_id(name)
        `)
        .order('schedule_date', { ascending: false })
        .order('start_time', { ascending: true });

      if (error) throw error;

      // 转换数据格式
      const formattedSchedules: ScheduleWithDetails[] = (data || []).map(schedule => {
        const scheduleData = schedule as any;
        
        return {
          ...scheduleData,
          class_name: scheduleData.classes?.name || '未知班级',
          subject_name: scheduleData.subjects?.name || '未知课程',
          teacher_name: scheduleData.profiles?.username || '未知教师',
          teacher_full_name: scheduleData.profiles?.full_name || '未知教师',
          venue_name: scheduleData.venues?.name || ''
        };
      });

      setSchedules(formattedSchedules);
      setTotalCount(formattedSchedules.length);
    } catch (error: any) {
      console.error('获取排课列表失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载排课列表"
      });
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      class_id: "",
      subject_id: "",
      teacher_id: "",
      venue_id: "",
      schedule_date: "",
      start_time: "",
      end_time: "",
      lesson_title: "",
      lesson_description: "",
      online_meeting_url: "",
      course_hours: 2,
      notes: ""
    });
  };

  // 创建排课
  const handleCreateSchedule = async () => {
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

    setSubmitting(true);
    try {
      // 准备排课数据
      const scheduleData: ScheduleInsert = {
        class_id: formData.class_id,
        subject_id: formData.subject_id,
        teacher_id: formData.teacher_id,
        venue_id: formData.venue_id || null,
        schedule_date: formData.schedule_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        lesson_title: formData.lesson_title.trim(),
        lesson_description: formData.lesson_description.trim() || null,
        online_meeting_url: formData.online_meeting_url.trim() || null,
        course_hours: formData.course_hours,
        notes: formData.notes.trim() || null,
        status: 'scheduled',
        created_by: user?.id
      };

      const { error } = await supabase
        .from('schedules')
        .insert(scheduleData);

      if (error) {
        if (error.code === '23503') {
          toast({
            variant: "destructive",
            title: "数据约束错误",
            description: "所选的班级、课程、教师或场地不存在，请重新选择"
          });
        } else if (error.message.includes('conflict') || error.message.includes('duplicate')) {
          toast({
            variant: "destructive",
            title: "时间冲突",
            description: "该时间段教师或场地已有安排，请选择其他时间"
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "创建成功",
        description: "排课已成功创建"
      });

      // 重置表单并关闭对话框
      resetForm();
      setCreateDialog(false);
      fetchSchedules();

    } catch (error: any) {
      console.error('创建排课失败:', error);
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建排课"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 编辑排课
  const handleEditSchedule = async () => {
    if (!editDialog.schedule) return;

    setSubmitting(true);
    try {
             const scheduleData: Partial<DatabaseSchedule> = {
        class_id: formData.class_id,
        subject_id: formData.subject_id,
        teacher_id: formData.teacher_id,
        venue_id: formData.venue_id || null,
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
        description: "排课信息已成功更新"
      });

      resetForm();
      setEditDialog({ open: false, schedule: null });
      fetchSchedules();

    } catch (error) {
      console.error('更新排课失败:', error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: "更新排课失败，请重试"
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
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      lesson_title: schedule.lesson_title,
      lesson_description: schedule.lesson_description || "",
      online_meeting_url: schedule.online_meeting_url || "",
      course_hours: schedule.course_hours || 2,
      notes: schedule.notes || ""
    });
    
    // 打开编辑对话框
    setEditDialog({ open: true, schedule });
  };

  // 打开删除确认对话框
  const openDeleteDialog = (schedule: ScheduleWithDetails) => {
    setDeleteDialog({ open: true, schedule });
  };

  // 执行删除排课
  const handleConfirmDelete = async () => {
    if (!deleteDialog.schedule) return;

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', deleteDialog.schedule.id);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "排课已成功删除"
      });

      setDeleteDialog({ open: false, schedule: null });
      fetchSchedules();

    } catch (error) {
      console.error('删除排课失败:', error);
      toast({
        variant: "destructive",
        title: "删除失败",
        description: "删除排课失败，请重试"
      });
    }
  };

  // 格式化时间
  const formatTime = (time: string) => {
    return time.substring(0, 5); // HH:MM
  };

  // 格式化日期
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('zh-CN');
  };

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    if (!statusOption) return <Badge variant="outline">{status}</Badge>;
    
    const variant = statusOption.color === "blue" ? "default" :
                   statusOption.color === "green" ? "secondary" :
                   statusOption.color === "red" ? "destructive" : "outline";
    
    return <Badge variant={variant}>{statusOption.label}</Badge>;
  };

  // 清空筛选条件
  const clearFilters = () => {
    setSearchTerm("");
    setFilterClass("all");
    setFilterSubject("all");
    setFilterTeacher("all");
    setFilterVenue("all");
    setFilterStatus("all");
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 处理每页显示数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPageSize(newPageSize);
    setCurrentPage(1);
  };

  // 分页逻辑
  const totalPages = Math.ceil(totalCount / pageSize);

  // 初始化数据
  useEffect(() => {
    if (hasAccess) {
      fetchBaseData();
      fetchSchedules();
    }
  }, [hasAccess]);

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
              <Button 
                onClick={() => {
                  resetForm();
                  setCreateDialog(true);
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                创建排课
              </Button>
            </div>
            
            {/* 搜索和筛选区域 */}
            <Card className="border-dashed">
              <CardContent className="pt-6">
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
                    <Label>班级</Label>
                    <Select value={filterClass} onValueChange={setFilterClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择班级" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部班级</SelectItem>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.name}>
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
                          <SelectItem key={subject.id} value={subject.name}>
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
                    <Label>状态</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>教师</Label>
                    <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择教师" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部教师</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.full_name || teacher.username}>
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
                        <SelectItem value="online">在线课程</SelectItem>
                        {venues.map((venue) => (
                          <SelectItem key={venue.id} value={venue.name}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {venue.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <Button 
                      variant="outline" 
                      onClick={clearFilters}
                      className="w-full"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      清除筛选
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">加载中...</p>
              </div>
            </div>
          ) : (
            <>
              {/* 排课列表表格 */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期时间</TableHead>
                      <TableHead>班级</TableHead>
                      <TableHead>课程</TableHead>
                      <TableHead>任课老师</TableHead>
                      <TableHead>课程标题</TableHead>
                      <TableHead>地点</TableHead>
                      <TableHead>课时</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <div className="text-gray-500">
                            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>暂无排课数据</p>
                            {(searchTerm || filterClass !== "all" || filterSubject !== "all" || filterTeacher !== "all" || filterVenue !== "all" || filterStatus !== "all") && (
                              <p className="text-sm mt-1">尝试调整搜索条件或筛选器</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      schedules.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                {formatDate(schedule.schedule_date)}
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {schedule.class_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3 text-muted-foreground" />
                              {schedule.subject_name}
                            </div>
                          </TableCell>
                          <TableCell>{schedule.teacher_full_name || schedule.teacher_name}</TableCell>
                          <TableCell className="font-medium">{schedule.lesson_title}</TableCell>
                          <TableCell>
                            {schedule.venue_name && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {schedule.venue_name}
                              </div>
                            )}
                            {schedule.online_meeting_url && (
                              <div className="text-sm text-blue-600">在线课程</div>
                            )}
                            {!schedule.venue_name && !schedule.online_meeting_url && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {schedule.course_hours ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-gray-400" />
                                {schedule.course_hours}课时
                              </div>
                            ) : (
                              <span className="text-gray-400">未设置</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(schedule)}
                                title="编辑排课"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(schedule)}
                                title="删除排课"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 分页组件 */}
              {totalCount > 0 && (
                <div className="mt-6">
                  <EnhancedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalCount}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 创建排课对话框 */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建排课</DialogTitle>
            <DialogDescription>
              创建新的排课安排，包括班级、课程、教师和时间等信息。
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* 班级选择 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-class" className="text-right">
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
              <Label htmlFor="create-subject" className="text-right">
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
              <Label htmlFor="create-teacher" className="text-right">
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
              <Label htmlFor="create-date" className="text-right">
                上课日期 *
              </Label>
              <Input
                id="create-date"
                type="date"
                value={formData.schedule_date}
                onChange={(e) => setFormData(prev => ({ ...prev, schedule_date: e.target.value }))}
                className="col-span-3"
              />
            </div>
            
            {/* 开始时间 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-start-time" className="text-right">
                开始时间 *
              </Label>
              <Input
                id="create-start-time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="col-span-3"
              />
            </div>
            
            {/* 结束时间 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-end-time" className="text-right">
                结束时间 *
              </Label>
              <Input
                id="create-end-time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="col-span-3"
              />
            </div>
            
            {/* 课程标题 */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="create-title" className="text-right">
                  课程标题 *
                </Label>
                <Input
                  id="create-title"
                  placeholder="请输入课程标题"
                  value={formData.lesson_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, lesson_title: e.target.value }))}
                  className="col-span-3"
                />
              </div>
            </div>
            
            {/* 上课教室 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-venue" className="text-right">
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
              <Label htmlFor="create-hours" className="text-right">
                课时
              </Label>
              <Input
                id="create-hours"
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
                <Label htmlFor="create-url" className="text-right">
                  在线会议链接
                </Label>
                <Input
                  id="create-url"
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
                <Label htmlFor="create-description" className="text-right">
                  课程描述
                </Label>
                <Textarea
                  id="create-description"
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
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateSchedule} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建排课"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Input
                id="edit-date"
                type="date"
                value={formData.schedule_date}
                onChange={(e) => setFormData(prev => ({ ...prev, schedule_date: e.target.value }))}
                className="col-span-3"
              />
            </div>
            
            {/* 开始时间 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-start-time" className="text-right">
                开始时间 *
              </Label>
              <Input
                id="edit-start-time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="col-span-3"
              />
            </div>
            
            {/* 结束时间 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-end-time" className="text-right">
                结束时间 *
              </Label>
              <Input
                id="edit-end-time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="col-span-3"
              />
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
    </div>
  );
};

export default ScheduleManagement; 