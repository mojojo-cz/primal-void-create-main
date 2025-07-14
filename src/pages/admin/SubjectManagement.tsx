import React, { useState, useEffect } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Plus, Search, Edit, Trash2, RefreshCw, BookOpen, AlertTriangle, ExternalLink } from "lucide-react";
import { EnhancedPagination } from "@/components/ui/enhanced-pagination";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";

interface Subject {
  id: string;
  name: string;
  category: string;
  description?: string;
  credit_hours: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// 状态选项
const STATUS_OPTIONS = [
  { value: "active", label: "启用", color: "green" },
  { value: "inactive", label: "禁用", color: "yellow" },
  { value: "archived", label: "归档", color: "gray" },
];

const SubjectManagement = () => {
  const { user, profile } = useAuth();
  
  // 基础状态
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());
  const [totalCount, setTotalCount] = useState(0);
  
  // 搜索状态
  const [searchTerm, setSearchTerm] = useState("");
  
  // 对话框状态
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; subject: Subject | null }>({
    open: false,
    subject: null
  });
  const [errorDialog, setErrorDialog] = useState<{ 
    open: boolean; 
    title: string; 
    content: React.ReactNode;
  }>({ 
    open: false, 
    title: '', 
    content: null 
  });
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    credit_hours: "",
    status: "active"
  });
  const [submitting, setSubmitting] = useState(false);
  
  // 权限检查 - 只允许管理员访问
  const isAdmin = profile?.user_type === "admin";
  const hasAccess = isAdmin;

  // 分页计算
  const totalPages = Math.ceil(totalCount / pageSize);

  // 获取课程列表
  const fetchSubjects = async () => {
    if (!hasAccess) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('subjects')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // 应用搜索条件
      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      // 应用分页
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize - 1;
      query = query.range(startIndex, endIndex);

      const { data, error, count } = await query;

      if (error) throw error;

      setSubjects(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('获取课程列表失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载课程列表"
      });
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      description: "",
      credit_hours: "",
      status: "active"
    });
  };

  // 创建课程
  const handleCreateSubject = async () => {
    if (!formData.name.trim() || !formData.category.trim()) {
      toast({
        variant: "destructive",
        title: "表单验证失败",
        description: "请填写课程名称和所属学科"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .insert([{
          name: formData.name.trim(),
          category: formData.category.trim(),
          description: formData.description.trim() || null,
          credit_hours: parseInt(formData.credit_hours) || 0,
          status: formData.status,
          created_by: user?.id
        }]);

      if (error) throw error;

      toast({
        title: "创建成功",
        description: "课程已成功创建"
      });

      setCreateDialog(false);
      resetForm();
      fetchSubjects();
    } catch (error: any) {
      console.error('创建课程失败:', error);
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建课程"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 编辑课程
  const handleEditSubject = async () => {
    if (!editDialog.subject || !formData.name.trim() || !formData.category.trim()) {
      toast({
        variant: "destructive",
        title: "表单验证失败",
        description: "请填写课程名称和所属学科"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          name: formData.name.trim(),
          category: formData.category.trim(),
          description: formData.description.trim() || null,
          credit_hours: parseInt(formData.credit_hours) || 0,
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', editDialog.subject.id);

      if (error) throw error;

      toast({
        title: "更新成功",
        description: "课程信息已更新"
      });

      setEditDialog({ open: false, subject: null });
      resetForm();
      fetchSubjects();
    } catch (error: any) {
      console.error('更新课程失败:', error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新课程信息"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除课程
  const handleDeleteSubject = async (subjectId: string) => {
    try {
      console.log('🔍 开始删除课程检查:', subjectId);
      
      // 第一步：检查是否有课表计划引用此课程
      console.log('📋 检查课表计划关联...');
      const { data: schedulePlans, error: checkError } = await supabase
        .from('schedule_plans')
        .select('id, name')
        .eq('subject_id', subjectId);

      if (checkError) {
        console.error('❌ 检查课表计划失败:', checkError);
        throw checkError;
      }

      console.log('📋 课表计划检查结果:', schedulePlans);

      if (schedulePlans && schedulePlans.length > 0) {
        const planNames = schedulePlans.map(plan => plan.name).join('、');
        console.log('⚠️ 发现课表计划关联:', planNames);
        
        setErrorDialog({
          open: true,
          title: "无法删除课程",
          content: (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    该课程正在被 <span className="font-semibold text-amber-700">{schedulePlans.length} 个课表</span> 使用，无法直接删除。
                  </p>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                  <span className="text-sm font-medium text-amber-800">关联的课表：</span>
                </div>
                <p className="text-sm text-amber-700 ml-4">{planNames}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  解决方案
                </h4>
                <ol className="text-sm text-blue-700 space-y-1.5 ml-4">
                  <li className="flex items-start">
                    <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 text-xs flex items-center justify-center mr-2 mt-0.5">1</span>
                    前往 <span className="font-medium">"排课管理"</span> 页面
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 text-xs flex items-center justify-center mr-2 mt-0.5">2</span>
                    找到相关课表并删除，或将课程改为其他课程
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 text-xs flex items-center justify-center mr-2 mt-0.5">3</span>
                    然后返回此页面重新删除课程
                  </li>
                </ol>
              </div>
            </div>
          )
        });
        return;
      }

      // 第二步：检查是否有排课记录引用此课程
      console.log('📅 检查排课记录关联...');
      const { data: schedules, error: scheduleCheckError } = await supabase
        .from('schedules')
        .select('id, lesson_title, schedule_date')
        .eq('subject_id', subjectId)
        .limit(10); // 限制查询数量，避免数据过多

      if (scheduleCheckError) {
        console.error('❌ 检查排课记录失败:', scheduleCheckError);
        throw scheduleCheckError;
      }

      console.log('📅 排课记录检查结果:', schedules);

      if (schedules && schedules.length > 0) {
        console.log('⚠️ 发现排课记录关联');
        
        setErrorDialog({
          open: true,
          title: "无法删除课程",
          content: (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    该课程正在被 <span className="font-semibold text-red-700">{schedules.length} 个排课记录</span> 使用，无法直接删除。
                  </p>
                </div>
              </div>
              
              {schedules.length <= 5 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-sm font-medium text-red-800">排课记录列表：</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    {schedules.map((schedule) => (
                      <p key={schedule.id} className="text-sm text-red-700">
                        • {schedule.lesson_title || '未命名课程'} ({schedule.schedule_date})
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  解决方案
                </h4>
                <ol className="text-sm text-blue-700 space-y-1.5 ml-4">
                  <li className="flex items-start">
                    <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 text-xs flex items-center justify-center mr-2 mt-0.5">1</span>
                    前往 <span className="font-medium">"排课管理"</span> 页面
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 text-xs flex items-center justify-center mr-2 mt-0.5">2</span>
                    使用课程筛选功能找到相关排课记录
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 text-xs flex items-center justify-center mr-2 mt-0.5">3</span>
                    逐一删除这些排课记录
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 text-xs flex items-center justify-center mr-2 mt-0.5">4</span>
                    然后返回此页面重新删除课程
                  </li>
                </ol>
              </div>
            </div>
          )
        });
        return;
      }

      // 第三步：执行删除
      console.log('🗑️ 开始执行删除操作...');
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId);

      if (error) {
        console.error('❌ 删除操作失败:', error);
        throw error;
      }

      console.log('✅ 课程删除成功');
      toast({
        title: "删除成功",
        description: "课程已删除"
      });

      fetchSubjects();
    } catch (error: any) {
      console.error('💥 删除课程失败:', error);
      
      // 处理特定的数据库错误
      let errorMessage = "无法删除课程";
      let errorDescription = "删除失败，请稍后重试";
      let detailedSteps = null;

      if (error.message?.includes('foreign key constraint')) {
        console.log('🔍 检测到外键约束错误:', error.message);
        
        if (error.message?.includes('schedule_plans_subject_id_fkey')) {
          errorMessage = "课程正在被课表使用";
          errorDescription = "该课程被课表计划引用，必须先处理关联数据";
          detailedSteps = [
            "前往 \"排课管理\" 页面",
            "查找使用此课程的课表",
            "删除相关课表或将课表改为其他课程",
            "然后重新尝试删除此课程"
          ];
        } else if (error.message?.includes('schedules_subject_id_fkey')) {
          errorMessage = "课程正在被排课使用";
          errorDescription = "该课程被排课记录引用，必须先处理关联数据";
          detailedSteps = [
            "前往 \"排课管理\" 页面",
            "使用课程筛选功能找到相关排课",
            "删除所有相关的排课记录",
            "然后重新尝试删除此课程"
          ];
        } else {
          errorMessage = "课程正在被其他数据使用";
          errorDescription = "该课程被其他数据引用，请先清理关联数据";
          detailedSteps = [
            "检查课程是否被课表使用",
            "检查课程是否被排课记录使用", 
            "清理所有关联数据",
            "然后重新尝试删除"
          ];
        }
      } else if (error.message?.includes('permission')) {
        errorMessage = "权限不足";
        errorDescription = "您没有删除课程的权限，请联系管理员";
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = "网络连接错误";
        errorDescription = "请检查网络连接，然后重试";
      } else if (error.code === 'PGRST116') {
        errorMessage = "课程不存在";
        errorDescription = "该课程可能已被删除，请刷新页面";
      }

      // 显示详细的错误信息
      setErrorDialog({
        open: true,
        title: errorMessage,
        content: (
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm text-gray-700">{errorDescription}</p>
              </div>
            </div>
            
            {detailedSteps && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  解决方案
                </h4>
                <ol className="text-sm text-blue-700 space-y-1.5 ml-4">
                  {detailedSteps.map((step, index) => (
                    <li key={index} className="flex items-start">
                      <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 text-xs flex items-center justify-center mr-2 mt-0.5">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )
      });
    }
  };

  // 打开编辑对话框
  const openEditDialog = (subject: Subject) => {
    setFormData({
      name: subject.name,
      category: subject.category,
      description: subject.description || "",
      credit_hours: subject.credit_hours?.toString() || "",
      status: subject.status
    });
    setEditDialog({ open: true, subject });
  };

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    if (!option) return <Badge variant="outline">{status}</Badge>;
    
    return (
      <Badge variant={option.color === "green" ? "default" : "secondary"}>
        {option.label}
      </Badge>
    );
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize);
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  // 加载数据
  useEffect(() => {
    if (hasAccess) {
      fetchSubjects();
    }
  }, [hasAccess, currentPage, pageSize, searchTerm]);

  // 权限检查
  if (!profile) {
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
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">权限不足</h2>
          <p className="text-muted-foreground">只有管理员可以访问线下课程管理</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 课程列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>课程列表</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">管理排课所需的教学科目和学科分类</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索课程..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchSubjects} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Dialog open={createDialog} onOpenChange={setCreateDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增课程
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>创建线下课程</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label htmlFor="create-name">课程名称 *</Label>
                    <Input
                      id="create-name"
                      placeholder="如：高等数学、考研英语等"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="create-category">所属学科 *</Label>
                    <Input
                      id="create-category"
                      placeholder="如：数学、英语、政治等"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="create-hours">总课时</Label>
                    <Input
                      id="create-hours"
                      type="number"
                      min="0"
                      placeholder="课时数"
                      value={formData.credit_hours}
                      onChange={(e) => setFormData(prev => ({ ...prev, credit_hours: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="create-status">状态</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="create-description">课程描述</Label>
                    <Textarea
                      id="create-description"
                      placeholder="课程简介或备注"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreateSubject} disabled={submitting}>
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      "创建课程"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
          ) : subjects.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无课程</h3>
              <p className="text-muted-foreground mb-4">还没有创建任何线下课程</p>
              <Button onClick={() => setCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个课程
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>课程名称</TableHead>
                      <TableHead>所属学科</TableHead>
                      <TableHead>总课时</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjects.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="font-medium">{subject.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{subject.category}</Badge>
                        </TableCell>
                        <TableCell>{subject.credit_hours || "-"}</TableCell>
                        <TableCell>{getStatusBadge(subject.status)}</TableCell>
                        <TableCell>{new Date(subject.created_at).toLocaleDateString('zh-CN')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(subject)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    确定要删除课程 "{subject.name}" 吗？此操作不可恢复。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteSubject(subject.id)}
                                  >
                                    删除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
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

      {/* 编辑对话框 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, subject: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑线下课程</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="edit-name">课程名称 *</Label>
              <Input
                id="edit-name"
                placeholder="如：高等数学、考研英语等"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-category">所属学科 *</Label>
              <Input
                id="edit-category"
                placeholder="如：数学、英语、政治等"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-hours">总课时</Label>
              <Input
                id="edit-hours"
                type="number"
                min="0"
                placeholder="课时数"
                value={formData.credit_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, credit_hours: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-status">状态</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="edit-description">课程描述</Label>
              <Textarea
                id="edit-description"
                placeholder="课程简介或备注"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialog({ open: false, subject: null })}>
              取消
            </Button>
            <Button onClick={handleEditSubject} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  更新中...
                </>
              ) : (
                "更新课程"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 错误提示对话框 */}
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>{errorDialog.title}</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>{errorDialog.content}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setErrorDialog({ open: false, title: '', content: null })}
              className="bg-blue-600 hover:bg-blue-700"
            >
              我知道了
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SubjectManagement;
