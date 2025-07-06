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
import { Edit, Trash2, Search, X, User, Plus, FileEdit, Info, AlertCircle, ChevronLeft, ChevronRight, Key, ArrowUp, UserCheck, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import EnhancedPagination from "@/components/ui/enhanced-pagination";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";
import { 
  formatDateForDisplay, 
  formatForDateTimeInput,
  toSafeISOString 
} from "@/utils/timezone";

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
  student: "正式学员",
  teacher: "任课老师",
  head_teacher: "班主任",
  business_teacher: "业务老师",
  trial_user: "体验用户",
  admin: "管理员"
};

// 用户类型颜色配置 - 简洁版本，仅使用文字颜色
const userTypeColors: Record<string, string> = {
  registered: "text-gray-600",      // 注册用户 - 灰色
  student: "text-blue-600",         // 正式学员 - 蓝色
  teacher: "text-indigo-600",       // 任课老师 - 靛蓝色
  head_teacher: "text-green-600",   // 班主任 - 绿色
  business_teacher: "text-purple-600", // 业务老师 - 紫色
  trial_user: "text-orange-600",    // 体验用户 - 橙色
  admin: "text-red-600"             // 管理员 - 红色
};

// 特殊调试信息
const DEBUG_MODE = true;

const AccountManagement = () => {
  // 获取认证信息
  const { user, profile } = useAuth();
  const [authLoading, setAuthLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // 使用用户偏好设置
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());
  
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

  // 重置密码相关状态
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ 
    open: boolean; 
    profile: Profile | null; 
  }>({
    open: false,
    profile: null
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);

  // 判断当前用户是否为班主任
  const isHeadTeacher = profile?.user_type === "head_teacher";
  // 判断当前用户是否为业务老师
  const isBusinessTeacher = profile?.user_type === "business_teacher";
  // 判断当前用户是否为教师角色（班主任或业务老师）
  const isTeacherRole = isHeadTeacher || isBusinessTeacher;
  // 判断当前用户是否为管理员
  const isAdmin = profile?.user_type === "admin";

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
      
      // 根据用户角色控制查看权限
      if (profile.user_type === "head_teacher") {
        log("班主任账号查询: 只能查看注册用户、体验用户和正式学员");
        query = query.in("user_type", ["registered", "trial_user", "student"]);
      } else if (profile.user_type === "business_teacher") {
        log("业务老师账号查询: 只能查看注册用户和体验用户");
        query = query.in("user_type", ["registered", "trial_user"]);
      }
      // 管理员可以查看所有用户类型，不需要额外过滤
      
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

  // 初始化加载数据
  useEffect(() => {
    if (profile && !authLoading) {
      log("初始化或用户切换，加载数据");
      fetchProfiles();
    }
  }, [profile?.id, profile?.user_type, authLoading]);

  // 监听搜索词变化，用于调试
  useEffect(() => {
    if (searchTerm !== "") {
      log("搜索词发生变化:", searchTerm);
      console.trace("搜索词变化的调用堆栈");
    }
  }, [searchTerm]); // 只在用户ID或用户类型变化时重新加载

  // 编辑账号
  const handleEdit = (profile: Profile) => {
    setEditForm({
      ...profile,
      full_name: profile.full_name || ""
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
      // 如果用户名发生变化，检查新用户名是否已存在
      if (editForm.username?.trim() !== editDialog.profile.username) {
        const { data: usernameExists, error: usernameCheckError } = await supabase
          .rpc('check_username_exists', { username: editForm.username?.trim() });
          
        if (usernameCheckError) {
          log("检查用户名失败", usernameCheckError);
          throw new Error("检查用户名时发生错误");
        }
        
        if (usernameExists) {
          toast({
            variant: "destructive",
            title: "验证失败",
            description: "该用户名已被使用，请选择其他用户名"
          });
          setSubmitting(false);
          return;
        }
      }
      // 构建更新数据，确保格式正确
      const updateData: Record<string, any> = {
        username: editForm.username?.trim(),
        full_name: editForm.full_name?.trim(),
        user_type: editForm.user_type,
        phone_number: editForm.phone_number?.trim()
      };
      
      // 仅当有值时才添加可选字段，避免写入undefined
      
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

  // 打开重置密码对话框
  const handleResetPassword = (profile: Profile) => {
    log("点击重置密码按钮，目标用户:", profile.username);
    log("当前搜索词:", searchTerm);
    setResetPasswordDialog({ open: true, profile });
    setNewPassword("");
    setConfirmPassword("");
    log("重置密码对话框已打开，当前搜索词:", searchTerm);
  };

  // 关闭重置密码对话框
  const closeResetPasswordDialog = () => {
    if (resetPasswordSubmitting) return;
    setResetPasswordDialog({ open: false, profile: null });
    setNewPassword("");
    setConfirmPassword("");
    setResetPasswordSubmitting(false);
  };

  // 验证密码重置表单
  const validatePasswordForm = () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "新密码至少需要6个字符"
      });
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "两次输入的密码不一致"
      });
      return false;
    }
    
    return true;
  };

  // 执行密码重置
  const handlePasswordReset = async () => {
    if (!resetPasswordDialog.profile?.id) return;
    
    // 表单验证
    if (!validatePasswordForm()) return;
    
    setResetPasswordSubmitting(true);
    try {
      log("开始重置密码，用户ID:", resetPasswordDialog.profile.id);
      
      // 调用 Edge Function 来重置密码
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          userId: resetPasswordDialog.profile.id,
          newPassword: newPassword,
          adminUserId: user?.id
        }
      });
      
      if (error) {
        log("Edge Function 调用失败", error);
        throw new Error(error.message || "调用密码重置服务失败");
      }
      
      if (!data?.success) {
        log("Edge Function 返回失败", data);
        throw new Error(data?.error || "密码重置服务返回失败");
      }
      
      log("密码重置成功", data);
      
      toast({
        title: "重置成功",
        description: `用户"${resetPasswordDialog.profile.username}"的密码已重置`
      });
      
      closeResetPasswordDialog();
      
    } catch (error: any) {
      log("密码重置异常", error);
      
      // 提供更详细的错误信息
      let errorMessage = "无法重置密码";
      if (error.message?.includes("服务角色密钥未配置")) {
        errorMessage = "系统配置错误：服务角色密钥未配置，请联系系统管理员";
      } else if (error.message?.includes("只有管理员才能重置")) {
        errorMessage = "权限不足：只有管理员才能重置用户密码";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "重置失败",
        description: errorMessage
      });
    } finally {
      setResetPasswordSubmitting(false);
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
          // 班主任和管理员设置正式学员为3年后过期
          if (isHeadTeacher || isAdmin) {
            expiresAt = new Date(now.setFullYear(now.getFullYear() + 3));
          }
        } else if (value === "registered") {
          // 管理员、班主任和业务老师设置注册用户为1个月后过期
          if (isAdmin || isHeadTeacher || isBusinessTeacher) {
            expiresAt = new Date(now.setMonth(now.getMonth() + 1));
          }
        } else if (value === "trial_user") {
          // 管理员、班主任和业务老师设置体验用户为1个月后过期
          if (isAdmin || isHeadTeacher || isBusinessTeacher) {
            expiresAt = new Date(now.setMonth(now.getMonth() + 1));
          }
        } else if (value === "teacher" || value === "head_teacher" || value === "business_teacher") {
          // 管理员设置任课老师、班主任和业务老师为20年后过期
          if (isAdmin) {
            expiresAt = new Date(now.setFullYear(now.getFullYear() + 20));
          }
        }
        
        return {
          ...prev,
          [name]: value,
          // 如果有设置过期时间，则更新过期时间
          ...(expiresAt ? { access_expires_at: toSafeISOString(expiresAt) } : {})
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
    return formatForDateTimeInput(dateString);
  };

  // 处理每页显示数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize);
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  // 过滤和分页逻辑
  const filteredProfiles = profiles.filter(profile =>
    profile.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.phone_number.includes(searchTerm) ||
    userTypeMap[profile.user_type]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProfiles.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProfiles = filteredProfiles.slice(startIndex, startIndex + pageSize);

  // 分页控制
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 检查是否可以修改用户类型
  const canModifyUserType = (targetProfile: Profile) => {
    // 管理员可以修改所有用户类型
    if (isAdmin) return true;
    
    // 班主任可以修改注册用户、体验用户和正式学员
    if (isHeadTeacher && (targetProfile.user_type === "registered" || targetProfile.user_type === "trial_user" || targetProfile.user_type === "student")) {
      return true;
    }
    
    // 业务老师可以修改注册用户和体验用户
    if (isBusinessTeacher && (targetProfile.user_type === "registered" || targetProfile.user_type === "trial_user")) {
      return true;
    }
    
    return false;
  };

  // 获取特定用户可选的用户类型选项
  const getAvailableUserTypesForProfile = (targetProfile: Profile) => {
    const options = [
      { value: "registered", label: "注册用户" }
    ];
    
    // 班主任可以设置正式学员和体验用户
    if (isHeadTeacher) {
      options.push(
        { value: "student", label: "正式学员" },
        { value: "trial_user", label: "体验用户" }
      );
    }
    
    // 业务老师可以设置体验用户
    if (isBusinessTeacher) {
      options.push({ value: "trial_user", label: "体验用户" });
    }
    
    // 管理员可以设置所有用户类型
    if (isAdmin) {
      options.push(
        { value: "student", label: "正式学员" },
        { value: "teacher", label: "任课老师" },
        { value: "head_teacher", label: "班主任" },
        { value: "business_teacher", label: "业务老师" },
        { value: "trial_user", label: "体验用户" },
        { value: "admin", label: "管理员" }
      );
    }
    
    return options;
  };

  // 处理业务老师升级用户为体验用户
  const handleUpgradeToTrialUser = async (profileId: string, username: string) => {
    try {
      log(`业务老师升级用户为体验用户: ${profileId} -> trial_user`);
      
      const now = new Date();
      const updateData = {
        user_type: "trial_user",
        access_expires_at: new Date(now.setMonth(now.getMonth() + 1)).toISOString()
      };
      
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profileId);

      if (error) throw error;

      await fetchProfiles();
      
      toast({
        title: "升级成功",
        description: `用户 ${username} 已升级为体验用户`
      });
      
    } catch (error: any) {
      log("升级体验用户失败", error);
      toast({
        variant: "destructive",
        title: "升级失败",
        description: error.message || "无法升级用户类型"
      });
    }
  };

  // 处理班主任升级用户为正式学员
  const handleUpgradeToStudent = async (profileId: string, username: string) => {
    try {
      log(`班主任升级用户为正式学员: ${profileId} -> student`);
      
      const now = new Date();
      const updateData = {
        user_type: "student",
        access_expires_at: new Date(now.setFullYear(now.getFullYear() + 3)).toISOString()
      };
      
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profileId);

      if (error) throw error;

      await fetchProfiles();
      
      toast({
        title: "升级成功",
        description: `用户 ${username} 已升级为正式学员`
      });
      
    } catch (error: any) {
      log("升级正式学员失败", error);
      toast({
        variant: "destructive",
        title: "升级失败",
        description: error.message || "无法升级用户类型"
      });
    }
  };

  // 处理快速修改用户类型
  const handleQuickUserTypeChange = async (profileId: string, newUserType: string, currentProfile: Profile) => {
    try {
      log(`快速修改用户类型: ${profileId} -> ${newUserType}`);
      
      // 构建更新数据
      const now = new Date();
      let updateData: Record<string, any> = {
        user_type: newUserType
      };
      
      // 根据新用户类型设置过期时间
      if (newUserType === "student") {
        // 班主任和管理员设置正式学员为3年后过期
        if (isHeadTeacher || isAdmin) {
          updateData.access_expires_at = new Date(now.setFullYear(now.getFullYear() + 3)).toISOString();
        }
      } else if (newUserType === "registered") {
        // 管理员、班主任和业务老师设置注册用户为1个月后过期
        if (isAdmin || isHeadTeacher || isBusinessTeacher) {
          updateData.access_expires_at = new Date(now.setMonth(now.getMonth() + 1)).toISOString();
        }
      } else if (newUserType === "trial_user") {
        // 管理员、班主任和业务老师设置体验用户为1个月后过期
        if (isAdmin || isHeadTeacher || isBusinessTeacher) {
          updateData.access_expires_at = new Date(now.setMonth(now.getMonth() + 1)).toISOString();
        }
      } else if (newUserType === "teacher" || newUserType === "head_teacher" || newUserType === "business_teacher") {
        // 管理员设置任课老师、班主任和业务老师为20年后过期
        if (isAdmin) {
          updateData.access_expires_at = new Date(now.setFullYear(now.getFullYear() + 20)).toISOString();
        }
      }
      
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profileId);

      if (error) throw error;

      // 刷新用户列表
      await fetchProfiles();
      
      toast({
        title: "修改成功",
        description: `用户类型已修改为 ${userTypeMap[newUserType] || newUserType}`
      });
      
    } catch (error: any) {
      log("快速修改用户类型失败", error);
      toast({
        variant: "destructive",
        title: "修改失败",
        description: error.message || "无法修改用户类型"
      });
    }
  };

  if (authLoading) {
    return <div className="container mx-auto p-4 md:p-8 text-center">加载用户信息中...</div>;
  }

  if (!user || !profile) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在验证权限...</p>
        </div>
      </div>
    );
  }

  if (profile.user_type !== 'admin' && profile.user_type !== 'head_teacher' && profile.user_type !== 'business_teacher') {
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
                只有管理员、班主任和业务老师才能管理用户账号
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
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
            placeholder="搜索用户名、手机号或用户类型..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // 搜索时重置到第一页
            }}
            className="pl-10"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            name="accountSearchTerm"
            id="accountSearchTerm"
            data-form-type="other"
          />
          {searchTerm && (
            <Button
              type="button"
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
                      <th className="py-3 px-4 text-left">姓名</th>
                      <th className="py-3 px-4 text-left">手机号</th>
                      <th className="py-3 px-4 text-left">用户类型</th>
                      <th className="py-3 px-4 text-left">过期时间</th>
                      <th className="py-3 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProfiles.map(profile => (
                    <tr key={profile.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{profile.username}</td>
                      <td className="py-3 px-4">{profile.full_name || "-"}</td>
                      <td className="py-3 px-4">{profile.phone_number}</td>
                      <td className="py-3 px-4">
                        {canModifyUserType(profile) ? (
                          <Select
                            value={profile.user_type}
                            onValueChange={(value) => handleQuickUserTypeChange(profile.id, value, profile)}
                          >
                            <SelectTrigger className="h-7 w-auto min-w-20 border-none shadow-none hover:bg-gray-50 p-0 text-sm">
                              <SelectValue>
                                <span className={`text-sm font-medium ${userTypeColors[profile.user_type] || userTypeColors.registered}`}>
                                  {userTypeMap[profile.user_type] || profile.user_type}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableUserTypesForProfile(profile).map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  <span className={`${userTypeColors[option.value] || userTypeColors.registered}`}>
                                    {option.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`text-sm font-medium ${userTypeColors[profile.user_type] || userTypeColors.registered}`}>
                            {userTypeMap[profile.user_type] || profile.user_type}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {profile.access_expires_at ? 
                          formatDateForDisplay(profile.access_expires_at) : 
                          "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          {/* 管理员显示编辑、重置密码、删除按钮 */}
                          {isAdmin && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors"
                                onClick={() => handleEdit(profile)}
                              >
                                <FileEdit className="h-4 w-4 mr-1" />
                                编辑
                              </Button>
                              
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-colors"
                                onClick={() => handleResetPassword(profile)}
                              >
                                <Key className="h-4 w-4 mr-1" />
                                重置密码
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 transition-colors"
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
                            </>
                          )}
                          
                          {/* 业务老师显示升级体验用户按钮 */}
                          {isBusinessTeacher && profile.user_type === "registered" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 transition-colors"
                              onClick={() => handleUpgradeToTrialUser(profile.id, profile.username)}
                            >
                              <ArrowUp className="h-4 w-4 mr-1" />
                              升级体验用户
                            </Button>
                          )}
                          
                          {/* 班主任显示升级正式学员按钮 */}
                          {isHeadTeacher && (profile.user_type === "registered" || profile.user_type === "trial_user") && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors"
                              onClick={() => handleUpgradeToStudent(profile.id, profile.username)}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              升级正式学员
                            </Button>
                          )}
                          
                          {/* 业务老师：对于已升级的用户显示状态按钮 */}
                          {isBusinessTeacher && profile.user_type === "trial_user" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled
                              className="h-8 text-green-600 cursor-default"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              已升级体验用户
                            </Button>
                          )}
                          
                          {/* 班主任：对于已升级的用户显示状态按钮 */}
                          {isHeadTeacher && profile.user_type === "student" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled
                              className="h-8 text-green-600 cursor-default"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              已升级正式学员
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                                  </tbody>
                </table>
              </div>
              <EnhancedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredProfiles.length}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
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
                  {/* 班主任可以设置正式学员和体验用户 */}
                  {isHeadTeacher && (
                    <>
                      <SelectItem value="student">正式学员</SelectItem>
                      <SelectItem value="trial_user">体验用户</SelectItem>
                    </>
                  )}
                  {/* 业务老师可以设置体验用户 */}
                  {isBusinessTeacher && (
                    <SelectItem value="trial_user">体验用户</SelectItem>
                  )}
                  {/* 管理员可以设置所有用户类型 */}
                  {isAdmin && (
                    <>
                      <SelectItem value="student">正式学员</SelectItem>
                      <SelectItem value="teacher">任课老师</SelectItem>
                      <SelectItem value="head_teacher">班主任</SelectItem>
                      <SelectItem value="business_teacher">业务老师</SelectItem>
                      <SelectItem value="trial_user">体验用户</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block mb-1 font-medium">访问过期时间</label>
              <div className="flex items-center gap-2">
                <Input
                  name="access_expires_at"
                  type="datetime-local"
                  value={formatDateForInput(editForm.access_expires_at)}
                  onChange={handleChange}
                  disabled={isTeacherRole} // 班主任和业务老师无法编辑过期时间
                  className={`flex-1 ${editForm.user_type === "student" || editForm.user_type === "head_teacher" || editForm.user_type === "business_teacher" ? "border-blue-300 bg-blue-50" : ""} ${isTeacherRole ? "bg-gray-100 cursor-not-allowed" : ""}`}
                />
                {isHeadTeacher && (
                  <span className="text-xs text-gray-500 ml-2">
                    正式学员:3年，注册用户、体验用户:1个月
                  </span>
                )}
                {isBusinessTeacher && (
                  <span className="text-xs text-gray-500 ml-2">
                    注册用户、体验用户:1个月
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditDialog} disabled={submitting}>
              取消
            </Button>
            <Button type="button" onClick={handleSaveEdit} disabled={submitting}>
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

      {/* 重置密码弹窗 */}
      <Dialog open={resetPasswordDialog.open} onOpenChange={(open) => !resetPasswordSubmitting && open === false && closeResetPasswordDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Key className="h-5 w-5 mr-2 text-orange-600" />
              重置用户密码
            </DialogTitle>
          </DialogHeader>
          {resetPasswordDialog.profile && (
            <div className="space-y-4 py-4">
              {/* 用户信息 */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">为以下用户重置密码：</p>
                <p className="font-medium">{resetPasswordDialog.profile.username}</p>
                <p className="text-sm text-gray-500">{resetPasswordDialog.profile.full_name}</p>
              </div>
              
              {/* 新密码输入 */}
              <div>
                <label className="block mb-1 font-medium">新密码</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码（至少6位）"
                  disabled={resetPasswordSubmitting}
                  autoComplete="new-password"
                  name="resetNewPassword"
                  id="resetNewPassword"
                />
              </div>
              
              {/* 确认密码输入 */}
              <div>
                <label className="block mb-1 font-medium">确认新密码</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  disabled={resetPasswordSubmitting}
                  autoComplete="new-password"
                  name="resetConfirmPassword"
                  id="resetConfirmPassword"
                />
              </div>
              
              {/* 安全提示 */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">安全提示：</p>
                    <ul className="mt-1 space-y-1">
                      <li>• 重置后用户需要使用新密码登录</li>
                      <li>• 建议通知用户新密码并提醒其及时修改</li>
                      <li>• 此操作会立即生效，无法撤销</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              type="button"
              variant="outline" 
              onClick={closeResetPasswordDialog} 
              disabled={resetPasswordSubmitting}
            >
              取消
            </Button>
            <Button 
              type="button"
              onClick={handlePasswordReset} 
              disabled={resetPasswordSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              {resetPasswordSubmitting ? "重置中..." : "确认重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountManagement; 