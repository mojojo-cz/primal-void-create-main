import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Filter, Edit, Trash2, Search, Clock, MapPin, Users, BookOpen, AlertCircle, RefreshCw, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";
import { EnhancedPagination } from "@/components/ui/enhanced-pagination";

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

interface Schedule {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  lesson_title: string;
  lesson_description?: string;
  location?: string;
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
}

// 状态选项
const STATUS_OPTIONS = [
  { value: "scheduled", label: "已安排", color: "blue" },
  { value: "in_progress", label: "进行中", color: "green" },
  { value: "completed", label: "已完成", color: "gray" },
  { value: "cancelled", label: "已取消", color: "red" },
];

const ScheduleManagement = () => {
  const { user, profile } = useAuth();
  
  // 基础状态
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());
  const [totalCount, setTotalCount] = useState(0);
  
  // 搜索和筛选状态
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  
  // 对话框状态
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; schedule: Schedule | null }>({
    open: false,
    schedule: null
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; scheduleId: string }>({
    open: false,
    scheduleId: ""
  });
  
  // 表单状态
  const [formData, setFormData] = useState({
    class_id: "",
    subject_id: "",
    teacher_id: "",
    schedule_date: "",
    start_time: "",
    end_time: "",
    lesson_title: "",
    lesson_description: "",
    location: "",
    online_meeting_url: "",
    course_hours: ""
  });
  const [submitting, setSubmitting] = useState(false);
  
  // 权限检查 - 只允许管理员访问
  const isAdmin = profile?.user_type === "admin";
  const hasAccess = isAdmin;

  // 获取基础数据
  const fetchBaseData = async () => {
    try {
      // 模拟数据，因为RPC函数可能还没有创建
      setSubjects([
        { id: "1", name: "高等数学", category: "数学", description: "高等数学课程" },
        { id: "2", name: "政治经济学", category: "政治", description: "政治经济学课程" },
        { id: "3", name: "英语词汇", category: "英语", description: "英语词汇课程" },
        { id: "4", name: "线性代数", category: "数学", description: "线性代数课程" }
      ]);
      
      setClasses([
        { id: "1", name: "2025考研数学暑期强化班", description: "暑期数学强化训练", student_count: 25 },
        { id: "2", name: "2025考研政治冲刺班", description: "政治冲刺复习", student_count: 30 },
        { id: "3", name: "VIP数学一对一班", description: "个性化数学辅导", student_count: 5 }
      ]);
      
      setTeachers([
        { id: "teacher1", username: "math_teacher", full_name: "张老师", user_type: "teacher" },
        { id: "teacher2", username: "politics_teacher", full_name: "李老师", user_type: "teacher" },
        { id: "teacher3", username: "english_teacher", full_name: "王老师", user_type: "teacher" }
      ]);
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
      // 模拟数据
      const mockSchedules = [
        {
          id: "schedule1",
          class_id: "1",
          subject_id: "1",
          teacher_id: "teacher1",
          schedule_date: "2024-12-20",
          start_time: "09:00",
          end_time: "11:00",
          lesson_title: "高等数学第一章",
          lesson_description: "函数与极限",
          location: "教室A101",
          online_meeting_url: "",
          course_hours: 2,
          status: "scheduled",
          created_at: "2024-12-15T10:00:00Z",
          updated_at: "2024-12-15T10:00:00Z",
          class_name: "2025考研数学暑期强化班",
          subject_name: "高等数学",
          teacher_name: "math_teacher",
          teacher_full_name: "张老师"
        }
      ];
      
      setSchedules(mockSchedules);
      setTotalCount(mockSchedules.length);
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
      schedule_date: "",
      start_time: "",
      end_time: "",
      lesson_title: "",
      lesson_description: "",
      location: "",
      online_meeting_url: "",
      course_hours: ""
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
      // 模拟创建成功
      toast({
        title: "创建成功",
        description: "排课已成功创建"
      });

      setCreateDialog(false);
      resetForm();
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
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
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
    }
  }, [hasAccess]);

  useEffect(() => {
    if (hasAccess) {
      fetchSchedules();
    }
  }, [hasAccess, currentPage, pageSize, searchTerm, filterClass, filterSubject, filterTeacher, filterStatus, filterDateFrom, filterDateTo]);

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
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          排课管理
        </h1>
        <p className="text-muted-foreground mt-1">
          管理班级课程安排，包括创建、编辑和删除排课
        </p>
      </div>

      {/* 搜索和筛选区域 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            搜索和筛选
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 搜索框 */}
            <div className="xl:col-span-2">
              <Label htmlFor="search">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="搜索课程标题、班级名称、教师名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* 班级筛选 */}
            <div>
              <Label>班级</Label>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部班级</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.name}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 课程筛选 */}
            <div>
              <Label>课程</Label>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="选择课程" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部课程</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.name}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 教师筛选 */}
            <div>
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
            
            {/* 状态筛选 */}
            <div>
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
            
            {/* 清空筛选按钮 */}
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                <X className="h-4 w-4 mr-2" />
                清空筛选
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 排课列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              排课列表
              {totalCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  共 {totalCount} 条记录
                  {totalPages > 1 && ` • 第 ${currentPage} / ${totalPages} 页`}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={fetchSchedules} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Dialog open={createDialog} onOpenChange={setCreateDialog}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    创建排课
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>创建排课</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {/* 班级选择 */}
                    <div>
                      <Label htmlFor="create-class">班级 *</Label>
                      <Select value={formData.class_id} onValueChange={(value) => setFormData(prev => ({ ...prev, class_id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择班级" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              <div className="flex items-center gap-2">
                                <span>{cls.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  <Users className="h-3 w-3 mr-1" />
                                  {cls.student_count}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* 课程选择 */}
                    <div>
                      <Label htmlFor="create-subject">课程 *</Label>
                      <Select value={formData.subject_id} onValueChange={(value) => setFormData(prev => ({ ...prev, subject_id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择课程" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              <div className="flex items-center gap-2">
                                <span>{subject.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {subject.category}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* 教师选择 */}
                    <div>
                      <Label htmlFor="create-teacher">任课老师 *</Label>
                      <Select value={formData.teacher_id} onValueChange={(value) => setFormData(prev => ({ ...prev, teacher_id: value }))}>
                        <SelectTrigger>
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
                    <div>
                      <Label htmlFor="create-date">上课日期 *</Label>
                      <Input
                        id="create-date"
                        type="date"
                        value={formData.schedule_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, schedule_date: e.target.value }))}
                      />
                    </div>
                    
                    {/* 开始时间 */}
                    <div>
                      <Label htmlFor="create-start-time">开始时间 *</Label>
                      <Input
                        id="create-start-time"
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      />
                    </div>
                    
                    {/* 结束时间 */}
                    <div>
                      <Label htmlFor="create-end-time">结束时间 *</Label>
                      <Input
                        id="create-end-time"
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      />
                    </div>
                    
                    {/* 课程标题 */}
                    <div className="md:col-span-2">
                      <Label htmlFor="create-title">课程标题 *</Label>
                      <Input
                        id="create-title"
                        placeholder="请输入课程标题"
                        value={formData.lesson_title}
                        onChange={(e) => setFormData(prev => ({ ...prev, lesson_title: e.target.value }))}
                      />
                    </div>
                    
                    {/* 上课地点 */}
                    <div>
                      <Label htmlFor="create-location">上课地点</Label>
                      <Input
                        id="create-location"
                        placeholder="教室或地点"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      />
                    </div>
                    
                    {/* 在线会议链接 */}
                    <div>
                      <Label htmlFor="create-url">在线会议链接</Label>
                      <Input
                        id="create-url"
                        placeholder="线上课程链接"
                        value={formData.online_meeting_url}
                        onChange={(e) => setFormData(prev => ({ ...prev, online_meeting_url: e.target.value }))}
                      />
                    </div>
                    
                    {/* 课时 */}
                    <div>
                      <Label htmlFor="create-hours">课时</Label>
                      <Input
                        id="create-hours"
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="课时数"
                        value={formData.course_hours}
                        onChange={(e) => setFormData(prev => ({ ...prev, course_hours: e.target.value }))}
                      />
                    </div>
                    
                    {/* 课程描述 */}
                    <div className="md:col-span-2">
                      <Label htmlFor="create-description">课程描述</Label>
                      <Textarea
                        id="create-description"
                        placeholder="课程内容描述"
                        value={formData.lesson_description}
                        onChange={(e) => setFormData(prev => ({ ...prev, lesson_description: e.target.value }))}
                        rows={3}
                      />
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">加载中...</p>
              </div>
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无排课</h3>
              <p className="text-muted-foreground mb-4">还没有创建任何排课安排</p>
              <Button onClick={() => setCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个排课
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {schedules.map((schedule) => (
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
                      <TableCell>{schedule.lesson_title}</TableCell>
                      <TableCell>
                        {schedule.location && (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {schedule.location}
                          </div>
                        )}
                        {schedule.online_meeting_url && (
                          <div className="text-sm text-blue-600">在线课程</div>
                        )}
                        {!schedule.location && !schedule.online_meeting_url && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{schedule.course_hours || "-"}</TableCell>
                      <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {}}
                            title="编辑"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {}}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleManagement; 