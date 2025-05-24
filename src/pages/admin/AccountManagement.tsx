import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, Search, X, User, Plus, FileEdit, Info, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// 用户类型
interface Profile {
  id: string;
  username: string;
  full_name?: string;
  user_type: string;
  phone_number: string;
  school: string | null;
  department: string | null;
  major: string | null;
  grade: string | null;
  access_expires_at: string;
  created_at: string;
  updated_at: string;
}

const userTypeMap: Record<string, string> = {
  registered: "注册用户",
  student: "学员",
  teacher: "教师",
  admin: "管理员"
};

// 用户类型颜色配置
const userTypeColors: Record<string, { bg: string; text: string; border?: string }> = {
  registered: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200"
  },
  student: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200"
  },
  teacher: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200"
  },
  admin: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200"
  }
};

  // 特殊调试信息
  const DEBUG_MODE = true;

  // 生成用户类型标签
  const getUserTypeTag = (userType: string) => {
    const colors = userTypeColors[userType] || userTypeColors.registered;
    const label = userTypeMap[userType] || userType;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border || ''}`}>
        {label}
      </span>
    );
  };

const AccountManagement = () => {
  // 获取认证信息
  const { user, profile } = useAuth();
  const [authLoading, setAuthLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [editDialog, setEditDialog] = useState<{ open: boolean; profile: Profile | null }>({
    open: false,
    profile: null
  });
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; profileId: string; username: string }>({
    open: false,
    profileId: "",
    username: ""
  });

  // 判断当前用户是否为教师
  const isTeacher = profile?.user_type === "teacher";

  // 调试日志
  const log = (message: string, data?: any) => {
    if (DEBUG_MODE) {
      console.log(`[账号管理] ${message}`, data || '');
    }
  };

  // 获取用户列表
  const fetchProfiles = async () => {
    if (!profile) {
      log("用户未登录或资料未加载，跳过获取用户列表");
      return;
    }
    
    setLoading(true);
    try {
      log("开始获取用户列表，当前用户类型:", profile.user_type);
      
      // 准备查询
      let query = supabase.from("profiles").select("*");
      
      // 如果是教师账号，在数据库查询级别进行过滤
      if (profile.user_type === "teacher") {
        log("教师账号查询: 添加用户类型过滤条件");
        query = query.in("user_type", ["registered", "student"]);
      }
      
      // 添加排序并执行查询
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        log("获取用户列表失败", error);
        throw error;
      }
      
      log(`获取到 ${data?.length || 0} 个用户`);
      setProfiles(data || []);
    } catch (error: any) {
      log("获取用户列表异常", error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载用户列表"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true);
      // 等待Supabase初始化完成
      await new Promise(resolve => setTimeout(resolve, 500));
      setAuthLoading(false);
    };
    
    checkAuth();
  }, []);

  // 监听用户资料变化，重新加载数据
  useEffect(() => {
    if (profile && !authLoading) {
      log("用户资料变更，重新加载数据");
      fetchProfiles();
    }
  }, [profile, authLoading]);

  // 编辑账号
  const handleEdit = (profile: Profile) => {
    setEditForm({
      ...profile,
      full_name: profile.full_name || "",
      school: profile.school || "",
      department: profile.department || "",
      major: profile.major || "",
      grade: profile.grade || ""
    });
    setEditDialog({ open: true, profile });
  };

  // 关闭编辑对话框并重置表单
  const closeEditDialog = () => {
    if (submitting) return;
    setEditDialog({ open: false, profile: null });
    setEditForm({});
  };

  // 表单验证
  const validateEditForm = () => {
    if (!editForm.username || editForm.username.trim() === "") {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "用户名不能为空"
      });
      return false;
    }
    
    if (!editForm.full_name || editForm.full_name.trim() === "") {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "姓名不能为空"
      });
      return false;
    }

    if (!editForm.phone_number || editForm.phone_number.trim() === "") {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "手机号不能为空"
      });
      return false;
    }

    if (!editForm.user_type) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择用户类型"
      });
      return false;
    }
    
    return true;
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editDialog.profile?.id) return;
    
    // 表单验证
    if (!validateEditForm()) return;
    
    setSubmitting(true);
    try {
      // 构建更新数据，确保格式正确
      const updateData: Record<string, any> = {
        username: editForm.username?.trim(),
        full_name: editForm.full_name?.trim(),
        user_type: editForm.user_type,
        phone_number: editForm.phone_number?.trim()
      };
      
      // 仅当有值时才添加可选字段，避免写入undefined
      if (editForm.school) updateData.school = editForm.school.trim();
      if (editForm.department) updateData.department = editForm.department.trim();
      if (editForm.major) updateData.major = editForm.major.trim();
      if (editForm.grade) updateData.grade = editForm.grade.trim();
      
      // 特殊处理日期字段
      if (editForm.access_expires_at) {
        try {
          // 确保日期格式正确
          const date = new Date(editForm.access_expires_at);
          if (!isNaN(date.getTime())) {
            updateData.access_expires_at = date.toISOString();
          }
        } catch (e) {
          log("日期格式错误", e);
          // 不添加日期字段，保留原值
        }
      }

      log("准备保存的用户数据", updateData);
      
      // 添加时间戳确保更新
      updateData.updated_at = new Date().toISOString();
      
      // 执行更新并获取结果
      const { data, error, status, statusText } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", editDialog.profile.id)
        .select();

      // 记录完整响应以便调试
      log("Supabase响应", { data, error, status, statusText });
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        // 虽然没有错误，但也没有返回更新数据，可能是权限问题
        log("服务器返回成功但没有数据", { status, statusText });
        throw new Error("服务器返回成功但没有数据，请检查权限设置");
      }
      
      log("更新操作已执行", data);
      
      toast({
        title: "更新成功",
        description: "账号信息已更新"
      });
      
      // 更新本地数据
      fetchProfiles();
      closeEditDialog(); // 成功后关闭对话框
    } catch (error: any) {
      log("保存失败详细信息", error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新账号信息，请检查网络连接和权限"
      });
      // 保留表单，不关闭对话框，让用户可以修改后重试
    } finally {
      setSubmitting(false);
    }
  };

  // 删除账号
  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", deleteDialog.profileId);

      if (error) throw error;

      fetchProfiles();
      setDeleteDialog({ open: false, profileId: "", username: "" });
      toast({
        title: "删除成功",
        description: "账号已删除"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除账号"
      });
    }
  };

  // 处理表单输入
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理选择框
  const handleSelectChange = (name: string, value: string) => {
    setEditForm(prev => {
      // 如果是用户类型变更，根据类型设置不同的访问过期时间
      if (name === "user_type") {
        const now = new Date();
        let expiresAt = null;
        
        if (value === "student") {
          // 学员设置为一年后过期
          expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
        } else if (value === "teacher") {
          // 教师设置为20年后过期
          expiresAt = new Date(now.setFullYear(now.getFullYear() + 20));
        }
        
        return {
          ...prev,
          [name]: value,
          // 如果选择了学员或教师，则更新过期时间
          ...(expiresAt ? { access_expires_at: expiresAt.toISOString() } : {})
        };
      }
      
      // 其他选项正常处理
      return {
        ...prev,
        [name]: value
      };
    });
  };

  // 改进日期时间处理 
  const formatDateForInput = (dateString?: string): string => {
    if (!dateString) return "";
    try {
      // 尝试解析日期并转换为本地时间输入格式
      const date = new Date(dateString);
      // 检查日期是否有效
      if (isNaN(date.getTime())) return "";
      return date.toISOString().slice(0, 16);
    } catch (e) {
      console.error("日期解析错误:", e);
      return "";
    }
  };

  // 过滤和分页逻辑
  const filteredProfiles = profiles.filter(profile =>
    profile.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.phone_number.includes(searchTerm) ||
    (profile.school && profile.school.toLowerCase().includes(searchTerm.toLowerCase())) ||
    userTypeMap[profile.user_type]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProfiles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProfiles = filteredProfiles.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // 分页控制
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        {startPage > 1 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
            >
              1
            </Button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => handlePageChange(page)}
          >
            {page}
          </Button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  // 处理教师尝试删除账号的情况
  const handleTeacherDeleteAttempt = (e) => {
    e.preventDefault();
    toast({
      title: "操作受限",
      description: "教师账号无权删除用户",
      variant: "destructive"
    });
  };

  if (authLoading) {
    return <div className="container mx-auto p-4 md:p-8 text-center">加载用户信息中...</div>;
  }

  if (!user || !profile || (profile.user_type !== 'admin' && profile.user_type !== 'teacher')) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                权限受限
              </h3>
              <div className="text-sm text-yellow-700 mt-1">
                {!user 
                  ? "您需要登录才能访问此页面" 
                  : "只有管理员和教师才能管理用户账号"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">账号管理</h1>
          <p className="text-muted-foreground mt-1">查看、编辑和删除用户账号</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="搜索用户名、手机号、学校或用户类型..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // 搜索时重置到第一页
            }}
            className="pl-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            用户列表
            {filteredProfiles.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                共 {filteredProfiles.length} 个用户
                {totalPages > 1 && ` • 第 ${currentPage} / ${totalPages} 页`}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">加载中...</p>
              </div>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">
                {searchTerm ? "没有找到匹配的用户" : "暂无用户"}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm ? "尝试使用不同的关键词搜索" : "系统中还没有注册用户"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="py-3 px-4 text-left">用户名</th>
                      <th className="py-3 px-4 text-left">手机号</th>
                      <th className="py-3 px-4 text-left">用户类型</th>
                      <th className="py-3 px-4 text-left">学校</th>
                      <th className="py-3 px-4 text-left">过期时间</th>
                      <th className="py-3 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProfiles.map(profile => (
                    <tr key={profile.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{profile.username}</td>
                      <td className="py-3 px-4">{profile.phone_number}</td>
                      <td className="py-3 px-4">
                        {getUserTypeTag(profile.user_type)}
                      </td>
                      <td className="py-3 px-4">{profile.school || "-"}</td>
                      <td className="py-3 px-4">
                        {profile.access_expires_at ? 
                          new Date(profile.access_expires_at).toLocaleDateString('zh-CN') : 
                          "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => handleEdit(profile)}
                          >
                            <FileEdit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                          
                          {isTeacher ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 opacity-50 cursor-not-allowed"
                                    onClick={handleTeacherDeleteAttempt}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    删除
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-1 text-amber-500" />
                                    <span>教师账号无权删除用户</span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  删除
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    确定要删除用户"{profile.username}"吗？此操作不可撤销。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => setDeleteDialog({
                                      open: true, 
                                      profileId: profile.id, 
                                      username: profile.username
                                    })}
                                  >
                                    确认删除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                                  </tbody>
                </table>
              </div>
              {renderPagination()}
            </>
          )}
        </CardContent>
      </Card>

      {/* 编辑用户弹窗 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !submitting && open === false && closeEditDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block mb-1 font-medium">用户名</label>
              <Input
                name="username"
                value={editForm.username || ""}
                onChange={handleChange}
                placeholder="请输入用户名"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">姓名</label>
              <Input
                name="full_name"
                value={editForm.full_name || ""}
                onChange={handleChange}
                placeholder="请输入真实姓名"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">手机号</label>
              <Input
                name="phone_number"
                value={editForm.phone_number || ""}
                onChange={handleChange}
                placeholder="请输入手机号"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">用户类型</label>
              <Select 
                value={editForm.user_type || ""}
                onValueChange={(value) => handleSelectChange("user_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择用户类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registered">注册用户</SelectItem>
                  <SelectItem value="student">学员</SelectItem>
                  {/* 教师只能将用户类型设为注册用户或学员 */}
                  {!isTeacher && (
                    <>
                      <SelectItem value="teacher">教师</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block mb-1 font-medium">学校</label>
              <Input
                name="school"
                value={editForm.school || ""}
                onChange={handleChange}
                placeholder="请输入学校名称"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">院系</label>
              <Input
                name="department"
                value={editForm.department || ""}
                onChange={handleChange}
                placeholder="请输入院系"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">专业</label>
              <Input
                name="major"
                value={editForm.major || ""}
                onChange={handleChange}
                placeholder="请输入专业"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">年级</label>
              <Input
                name="grade"
                value={editForm.grade || ""}
                onChange={handleChange}
                placeholder="请输入年级"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">访问过期时间</label>
              <div className="flex items-center gap-2">
                <Input
                  name="access_expires_at"
                  type="datetime-local"
                  value={formatDateForInput(editForm.access_expires_at)}
                  onChange={handleChange}
                  className={`flex-1 ${editForm.user_type === "student" || editForm.user_type === "teacher" ? "border-blue-300 bg-blue-50" : ""}`}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>最终确认</AlertDialogTitle>
            <AlertDialogDescription>
              您即将删除用户"{deleteDialog.username}"，此操作无法撤销且会删除该用户的所有数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountManagement; 