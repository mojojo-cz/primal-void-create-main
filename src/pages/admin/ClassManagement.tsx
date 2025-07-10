import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit,
  Trash2,
  Search,
  Users,
  GraduationCap,
  User,
  ChevronDown,
  ChevronRight,
  UserPlus,
  UserMinus,
  Phone,
  School,
  RotateCcw
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import EnhancedPagination from "@/components/ui/enhanced-pagination";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";
import { pinyin } from "pinyin-pro";

// 班级状态类型 - 简化为两种状态
type ClassStatus = 'active' | 'completed';

// 班级类型 - 简化版本，移除日期和最大学员数限制
interface Class {
  id: string;
  name: string;
  description: string | null;
  head_teacher_id: string | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
  head_teacher?: {
    username: string;
    full_name: string | null;
  };
  student_count?: number;
  // 保留数据库字段但不在UI中使用
  start_date?: string | null;
  end_date?: string | null;
  max_students?: number;
}

// 学员类型
interface Student {
  id: string;
  username: string;
  full_name: string | null;
  phone_number: string;
  school: string | null;
  major: string | null;
  user_type: string;
}

// 班级成员类型
interface ClassMember {
  member_id: string;
  student_id: string;
  enrollment_status: string;
  enrolled_at: string;
  student: Student;
}

// 教师类型
interface Teacher {
  id: string;
  username: string;
  full_name: string | null;
  user_type: string;
}

const ClassManagement = () => {
  // 获取认证信息和用户权限
  const { user, profile } = useAuth();
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // 权限检查
  const isAdmin = profile?.user_type === "admin";
  const isHeadTeacher = profile?.user_type === "head_teacher";
  const hasAccess = isAdmin || isHeadTeacher;
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());

  // 展开状态
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [classMembers, setClassMembers] = useState<Record<string, ClassMember[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set());
  
  // 智能缓存系统 - 提升数据加载性能
  const [membersCacheTime, setMembersCacheTime] = useState<Record<string, number>>({});
  const [classesCache, setClassesCache] = useState<{ data: Class[]; timestamp: number } | null>(null);
  const [teachersCache, setTeachersCache] = useState<{ data: Teacher[]; timestamp: number } | null>(null);
  
  // 缓存有效期配置（分钟）
  const CLASSES_CACHE_DURATION = 5; // 班级列表缓存5分钟
  const TEACHERS_CACHE_DURATION = 10; // 教师列表缓存10分钟
  const MEMBERS_CACHE_DURATION = 5; // 班级成员缓存5分钟

  // 对话框状态
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; class?: Class }>({ 
    open: false, 
    class: undefined 
  });
  const [addStudentDialog, setAddStudentDialog] = useState<{ open: boolean; classId?: string }>({
    open: false,
    classId: undefined
  });

  // 表单状态 - 简化版本
  const [classForm, setClassForm] = useState({
    name: "",
    description: "",
    head_teacher_id: "",
    status: "active" as ClassStatus
  });
  const [submitting, setSubmitting] = useState(false);

  // 学员相关状态
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);

  // 智能缓存的获取班级列表 - 使用RPC函数和缓存策略，大幅提升性能
  const fetchClasses = async (forceRefresh = false) => {
    // 检查缓存有效性
    const now = Date.now();
    if (!forceRefresh && classesCache && 
        (now - classesCache.timestamp < CLASSES_CACHE_DURATION * 60 * 1000)) {
      setClasses(classesCache.data);
      return;
    }

    setLoading(true);
    try {
      // 使用优化的RPC函数，避免N+1查询问题，大幅提升加载速度
      const { data, error } = await supabase.rpc('get_classes_with_student_counts');
      
      if (error) throw error;
      
      // 直接将RPC结果转换为Class类型，无需额外的数据处理
      let classes: Class[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        head_teacher_id: item.head_teacher_id,
        status: item.status as ClassStatus,
        created_at: item.created_at,
        updated_at: item.updated_at,
        head_teacher: item.head_teacher_username ? {
          username: item.head_teacher_username,
          full_name: item.head_teacher_full_name
        } : undefined,
        student_count: Number(item.student_count),
        // 保留数据库字段但不在UI中显示
        start_date: item.start_date,
        end_date: item.end_date,
        max_students: item.max_students
      }));
      
      // 如果是班主任，只显示被指定到自己的班级
      if (isHeadTeacher && profile?.id) {
        classes = classes.filter(classItem => classItem.head_teacher_id === profile.id);
      }
      
      // 更新缓存
      setClassesCache({ data: classes, timestamp: now });
      setClasses(classes);
    } catch (error: any) {
      console.error("获取班级列表失败:", error);
      setClasses([]); // 确保classes始终是数组
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载班级列表，请检查网络连接"
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取班级成员列表
  // 优化后的获取班级成员函数 - 使用RPC函数和智能缓存提升性能
  const fetchClassMembers = async (classId: string, forceRefresh = false) => {
    // 检查缓存是否有效
    const cacheTime = membersCacheTime[classId];
    const now = Date.now();
    const CACHE_DURATION = MEMBERS_CACHE_DURATION * 60 * 1000;
    
    if (!forceRefresh && cacheTime && (now - cacheTime < CACHE_DURATION) && classMembers[classId]) {
      return; // 使用缓存数据，避免不必要的网络请求
    }

    setLoadingMembers(prev => new Set([...prev, classId]));
    try {
      // 使用优化的RPC函数，大大提升查询性能
      const { data, error } = await supabase.rpc('get_class_members_optimized', {
        p_class_id: classId
      });

      if (error) throw error;

      // 直接将RPC结果转换为ClassMember类型
      const members: ClassMember[] = (data || []).map(item => ({
        member_id: item.member_id,
        student_id: item.student_id,
        enrollment_status: item.enrollment_status,
        enrolled_at: item.enrolled_at,
        student: {
          id: item.student_id,
          username: item.student_username,
          full_name: item.student_full_name,
          phone_number: item.student_phone_number,
          school: item.student_school,
          major: item.student_major,
          user_type: item.student_user_type
        }
      }));

      setClassMembers(prev => ({
        ...prev,
        [classId]: members
      }));
      
      // 更新缓存时间
      setMembersCacheTime(prev => ({
        ...prev,
        [classId]: now
      }));
    } catch (error: any) {
      console.error("加载班级成员失败:", error);
      toast({
        variant: "destructive",
        title: "加载学员失败",
        description: error.message || "无法加载班级学员列表"
      });
    } finally {
      setLoadingMembers(prev => {
        const newSet = new Set(prev);
        newSet.delete(classId);
        return newSet;
      });
    }
  };

  // 获取可用学员列表（使用RPC函数优化性能）
  const fetchAvailableStudents = async (classId: string) => {
    setLoadingStudents(true);
    try {
      // 使用RPC函数一次性获取可用学员，大大提升加载速度
      const { data, error } = await supabase.rpc('get_available_students_for_class', {
        p_class_id: classId
      });

      if (error) throw error;

      // 直接将数据转换为Student类型，无需额外处理
      const availableStudents: Student[] = (data || []).map(student => ({
        id: student.id,
        username: student.username,
        full_name: student.full_name,
        phone_number: student.phone_number,
        school: student.school,
        major: student.major,
        user_type: student.user_type
      }));

      setAvailableStudents(availableStudents);
    } catch (error: any) {
      console.error("获取可用学员失败:", error);
      toast({
        variant: "destructive",
        title: "加载可用学员失败",
        description: error.message || "无法加载可用学员列表"
      });
    } finally {
      setLoadingStudents(false);
    }
  };

  // 智能缓存的获取教师列表 - 提升用户体验
  const fetchTeachers = async (forceRefresh = false) => {
    // 检查缓存有效性
    const now = Date.now();
    if (!forceRefresh && teachersCache && 
        (now - teachersCache.timestamp < TEACHERS_CACHE_DURATION * 60 * 1000)) {
      setTeachers(teachersCache.data);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, user_type")
        .eq("user_type", "head_teacher")
        .order("username", { ascending: true });
      
      if (error) throw error;
      
      const teachers = data || [];
      
      // 更新缓存
      setTeachersCache({ data: teachers, timestamp: now });
      setTeachers(teachers);
    } catch (error: any) {
      console.error("获取教师列表失败:", error);
      // 确保teachers始终是一个数组，即使出错也不会导致页面崩溃
      setTeachers([]);
      toast({
        variant: "destructive",
        title: "加载教师列表失败",
        description: "无法加载班主任选项，请刷新页面重试"
      });
    }
  };

  useEffect(() => {
    if (hasAccess) {
    fetchClasses();
    fetchTeachers();
    }
  }, [hasAccess]);

  // 优化后的切换班级展开状态 - 立即响应UI，异步加载数据
  const toggleClassExpansion = (classId: string) => {
    const newExpanded = new Set(expandedClasses);
    if (newExpanded.has(classId)) {
      newExpanded.delete(classId);
    } else {
      newExpanded.add(classId);
      // 立即更新UI状态
      setExpandedClasses(newExpanded);
      
      // 异步加载数据，不阻塞UI
      if (!classMembers[classId]) {
        fetchClassMembers(classId).catch(console.error);
      }
      return; // 提前返回，避免重复设置状态
    }
    setExpandedClasses(newExpanded);
  };

  // 刷新指定班级的成员列表（用于添加/删除学员后的局部刷新）
  const refreshClassMembers = async (classId: string) => {
    await fetchClassMembers(classId, true); // 强制刷新
  };

  // 清理所有缓存并重新加载
  const clearCacheAndRefresh = async () => {
    setClassesCache(null);
    setTeachersCache(null);
    setMembersCacheTime({});
    setClassMembers({});
    await Promise.all([
      fetchClasses(true),
      fetchTeachers(true)
    ]);
    toast({
      title: "刷新完成",
      description: "页面数据已更新"
    });
  };

  // 过滤和分页
  const filteredClasses = (classes || []).filter(classItem => {
    if (!classItem || !classItem.name) return false;
    
    const matchesSearch = 
      classItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (classItem.description && classItem.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (classItem.head_teacher?.username?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (classItem.head_teacher?.full_name && classItem.head_teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredClasses.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedClasses = filteredClasses.slice(startIndex, startIndex + pageSize);

  // 处理每页显示数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize);
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  // 重置表单
  const resetForm = () => {
    setClassForm({
      name: "",
      description: "",
      head_teacher_id: "",
      status: "active"
    });
  };

  // 创建班级 - 简化版本
  const handleCreateClass = async () => {
    if (!classForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: "请输入班级名称"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("classes")
        .insert([{
          name: classForm.name.trim(),
          description: classForm.description.trim() || null,
          head_teacher_id: classForm.head_teacher_id || null,
          status: classForm.status
        }]);

      if (error) throw error;

      toast({
        title: "创建成功",
        description: "班级已成功创建"
      });

      setCreateDialog(false);
      resetForm();
      fetchClasses();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "创建班级时发生错误"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 编辑班级 - 简化版本
  const openEditDialog = (classItem: Class) => {
    setClassForm({
      name: classItem.name,
      description: classItem.description || "",
      head_teacher_id: classItem.head_teacher_id || "",
      status: classItem.status
    });
    setEditDialog({ open: true, class: classItem });
  };

  // 关闭编辑对话框
  const closeEditDialog = () => {
    setEditDialog({ open: false, class: undefined });
    resetForm();
  };

  // 更新班级 - 简化版本
  const handleUpdateClass = async () => {
    if (!classForm.name.trim() || !editDialog.class) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: "请输入班级名称"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("classes")
        .update({
          name: classForm.name.trim(),
          description: classForm.description.trim() || null,
          head_teacher_id: classForm.head_teacher_id || null,
          status: classForm.status,
          updated_at: new Date().toISOString()
        })
        .eq("id", editDialog.class.id);

      if (error) throw error;

      toast({
        title: "更新成功",
        description: "班级信息已成功更新"
      });

      closeEditDialog();
      fetchClasses();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "更新班级时发生错误"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除班级
  const handleDeleteClass = async (classId: string) => {
    try {
      const { count } = await supabase
        .from("class_members")
        .select("*, profiles!inner(user_type)", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("enrollment_status", "enrolled")
        .eq("profiles.user_type", "student");

      if (count && count > 0) {
        toast({
          variant: "destructive",
          title: "删除失败",
          description: "该班级还有正式学员，请先移除所有学员后再删除"
        });
        return;
      }

      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", classId);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "班级已成功删除"
      });

      fetchClasses();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "删除班级时发生错误"
      });
    }
  };

  // 移除学员
  const handleRemoveStudent = async (memberId: string, classId: string) => {
    try {
      const { error } = await supabase
        .from("class_members")
        .update({
          enrollment_status: "withdrawn",
          withdrawn_at: new Date().toISOString()
        })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "移除成功",
        description: "学员已从班级中移除"
      });

      // 局部刷新：从本地状态中移除该学员
      setClassMembers(prev => ({
        ...prev,
        [classId]: (prev[classId] || []).filter(member => member.member_id !== memberId)
      }));

      // 更新班级列表中的学员数量（局部减一）
      setClasses(prev => prev.map(classItem => {
        if (classItem.id === classId) {
          return {
            ...classItem,
            student_count: Math.max(0, (classItem.student_count || 0) - 1)
          };
        }
        return classItem;
      }));
    } catch (error: any) {
      console.error("移除学员失败:", error);
      toast({
        variant: "destructive",
        title: "移除失败",
        description: error.message || "移除学员时发生错误"
      });
    }
  };

  // 打开添加学员对话框
  const openAddStudentDialog = async (classId: string) => {
    setAddStudentDialog({ open: true, classId });
    setSelectedStudents([]);
    await fetchAvailableStudents(classId);
  };

  // 关闭添加学员对话框
  const closeAddStudentDialog = () => {
    setAddStudentDialog({ open: false, classId: undefined });
    setSelectedStudents([]);
    setAvailableStudents([]);
    setStudentSearchTerm("");
    setLoadingStudents(false);
  };

  // 添加学员到班级
  const handleAddStudents = async () => {
    if (!addStudentDialog.classId || selectedStudents.length === 0) {
      toast({
        variant: "destructive",
        title: "添加失败",
        description: "请选择要添加的学员"
      });
      return;
    }

    const classId = addStudentDialog.classId;
    const studentsToAdd = selectedStudents;
    
    // 获取将要添加的学员详细信息，用于乐观更新
    const selectedStudentDetails = availableStudents.filter(student => 
      studentsToAdd.includes(student.id)
    );

    setSubmitting(true);

    // 🚀 乐观更新策略：立即更新UI，提升用户体验
    // 1. 立即关闭对话框
    closeAddStudentDialog();
    
    // 2. 立即显示成功提示
    toast({
      title: "添加成功",
      description: `正在添加 ${studentsToAdd.length} 名学员到班级...`
    });

    // 3. 立即更新班级成员列表（乐观更新）
    const optimisticMembers: ClassMember[] = selectedStudentDetails.map(student => ({
      member_id: `temp_${student.id}_${Date.now()}`, // 临时ID
      student_id: student.id,
      enrollment_status: "enrolled",
      enrolled_at: new Date().toISOString(),
      student: student
    }));

    // 立即更新本地状态
    setClassMembers(prev => ({
      ...prev,
      [classId]: [...(prev[classId] || []), ...optimisticMembers]
    }));

    // 立即更新班级列表中的学员数量
    setClasses(prev => prev.map(classItem => {
      if (classItem.id === classId) {
        return {
          ...classItem,
          student_count: (classItem.student_count || 0) + studentsToAdd.length
        };
      }
      return classItem;
    }));

    try {
      // 🔄 后台执行实际的数据库操作
      let newStudents = 0;
      let rejoinedStudents = 0;

      for (const studentId of studentsToAdd) {
        // 检查该学员是否曾经在班级中
        const { data: existingRecord, error: checkError } = await supabase
          .from("class_members")
          .select("id, enrollment_status")
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 表示没有找到记录
          throw checkError;
        }

        if (existingRecord) {
          // 如果记录存在，更新状态为 enrolled
          const { error: updateError } = await supabase
            .from("class_members")
            .update({
        enrollment_status: "enrolled",
        enrolled_at: new Date().toISOString()
            })
            .eq("id", existingRecord.id);

          if (updateError) throw updateError;
          rejoinedStudents++;
        } else {
          // 如果记录不存在，创建新记录
          const { error: insertError } = await supabase
        .from("class_members")
            .insert({
              class_id: classId,
              student_id: studentId,
              enrollment_status: "enrolled",
              enrolled_at: new Date().toISOString()
            });

          if (insertError) throw insertError;
          newStudents++;
        }
      }

      // 🔄 后台同步完成后，更新最终提示信息
      let message = "";
      if (newStudents > 0 && rejoinedStudents > 0) {
        message = `成功添加 ${newStudents} 名新学员，${rejoinedStudents} 名学员重新加入班级`;
      } else if (newStudents > 0) {
        message = `成功添加 ${newStudents} 名新学员到班级`;
      } else if (rejoinedStudents > 0) {
        message = `${rejoinedStudents} 名学员重新加入班级`;
      }

      // 静默更新最终状态（获取真实的成员数据以确保数据一致性）
      await refreshClassMembers(classId);
      
      // 更新成功提示
      toast({
        title: "同步完成",
        description: message
      });

    } catch (error: any) {
      console.error("添加学员失败:", error);
      
      // ❌ 发生错误时回滚乐观更新
      // 1. 回滚成员列表
      setClassMembers(prev => ({
        ...prev,
        [classId]: (prev[classId] || []).filter(member => 
          !studentsToAdd.includes(member.student_id)
        )
      }));
      
      // 2. 回滚学员数量
      setClasses(prev => prev.map(classItem => {
        if (classItem.id === classId) {
          return {
            ...classItem,
            student_count: Math.max(0, (classItem.student_count || 0) - studentsToAdd.length)
          };
        }
        return classItem;
      }));

      // 3. 显示错误提示
      toast({
        variant: "destructive",
        title: "添加失败",
        description: error.message || "添加学员时发生错误，请重试"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 切换学员选择
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  // 过滤学员函数
  const filterStudents = (students: Student[], searchTerm: string) => {
    if (!searchTerm.trim()) return students;
    
    const searchLower = searchTerm.toLowerCase();
    return students.filter(student => {
      // 原有的搜索逻辑
      const originalMatch = (
        (student.full_name && student.full_name.toLowerCase().includes(searchLower)) ||
        student.username.toLowerCase().includes(searchLower) ||
        student.phone_number.includes(searchTerm) ||
        (student.school && student.school.toLowerCase().includes(searchLower)) ||
        (student.major && student.major.toLowerCase().includes(searchLower))
      );
      
      // 如果原有搜索已匹配，直接返回
      if (originalMatch) return true;
      
      // 拼音搜索逻辑
      try {
        // 对姓名进行拼音搜索
        if (student.full_name) {
          // 完整拼音匹配
          const fullPinyin = pinyin(student.full_name, { toneType: 'none' }).toLowerCase();
          if (fullPinyin.includes(searchLower)) return true;
          
          // 无间隔拼音匹配（如：李达 -> lida）
          const noneSpacePinyin = pinyin(student.full_name, { toneType: 'none', type: 'array' }).join('').toLowerCase();
          if (noneSpacePinyin.includes(searchLower)) return true;
          
          // 首字母拼音匹配（使用数组形式然后连接）
          const firstLetterArray = pinyin(student.full_name, { pattern: 'first', toneType: 'none', type: 'array' });
          const firstLetterJoined = firstLetterArray.join('').toLowerCase();
          if (firstLetterJoined.includes(searchLower)) return true;
          
          // 首字母间隔匹配（如：李达 -> "l d"）
          const firstLetterWithSpace = firstLetterArray.join(' ').toLowerCase();
          if (firstLetterWithSpace.includes(searchLower)) return true;
        }
        
        // 对学校进行拼音搜索
        if (student.school) {
          const schoolPinyin = pinyin(student.school, { toneType: 'none' }).toLowerCase();
          if (schoolPinyin.includes(searchLower)) return true;
          
          const schoolNoneSpacePinyin = pinyin(student.school, { toneType: 'none', type: 'array' }).join('').toLowerCase();
          if (schoolNoneSpacePinyin.includes(searchLower)) return true;
          
          const schoolFirstLetterArray = pinyin(student.school, { pattern: 'first', toneType: 'none', type: 'array' });
          const schoolFirstLetterJoined = schoolFirstLetterArray.join('').toLowerCase();
          if (schoolFirstLetterJoined.includes(searchLower)) return true;
          
          const schoolFirstLetterWithSpace = schoolFirstLetterArray.join(' ').toLowerCase();
          if (schoolFirstLetterWithSpace.includes(searchLower)) return true;
        }
        
        // 对专业进行拼音搜索
        if (student.major) {
          const majorPinyin = pinyin(student.major, { toneType: 'none' }).toLowerCase();
          if (majorPinyin.includes(searchLower)) return true;
          
          const majorNoneSpacePinyin = pinyin(student.major, { toneType: 'none', type: 'array' }).join('').toLowerCase();
          if (majorNoneSpacePinyin.includes(searchLower)) return true;
          
          const majorFirstLetterArray = pinyin(student.major, { pattern: 'first', toneType: 'none', type: 'array' });
          const majorFirstLetterJoined = majorFirstLetterArray.join('').toLowerCase();
          if (majorFirstLetterJoined.includes(searchLower)) return true;
          
          const majorFirstLetterWithSpace = majorFirstLetterArray.join(' ').toLowerCase();
          if (majorFirstLetterWithSpace.includes(searchLower)) return true;
        }
      } catch (error) {
        // 拼音转换出错时，忽略拼音搜索
        console.warn('拼音搜索出错:', error);
      }
      
      return false;
    });
  };

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
          <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">权限不足</h2>
          <p className="text-muted-foreground">只有管理员和班主任可以访问班级管理</p>
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
                <GraduationCap className="h-5 w-5" />
                班级管理
                {isHeadTeacher && (
                  <span className="text-sm text-muted-foreground font-normal">
                    (班主任视图 - 仅显示指定给您的班级)
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={clearCacheAndRefresh}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  刷新数据
                </Button>
                {/* 只有管理员可以创建班级 */}
                {isAdmin && (
              <Button onClick={() => setCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新建班级
              </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索班级名称、描述或班主任..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">暂无班级</p>
              <p className="text-sm mb-4">还没有创建任何班级</p>
              <Button onClick={() => setCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个班级
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>班级名称</TableHead>
                      <TableHead className="hidden md:table-cell">描述</TableHead>
                      <TableHead className="hidden lg:table-cell">班主任</TableHead>
                      <TableHead className="hidden lg:table-cell">正式学员</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClasses.map((classItem) => (
                      <React.Fragment key={classItem.id}>
                        <TableRow 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleClassExpansion(classItem.id)}
                        >
                          <TableCell>
                            {expandedClasses.has(classItem.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{classItem.name}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="max-w-xs">
                              {classItem.description ? (
                                <span className="line-clamp-2 text-sm">{classItem.description}</span>
                              ) : (
                                <span className="text-muted-foreground italic text-sm">无描述</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {classItem.head_teacher ? (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {classItem.head_teacher.full_name || classItem.head_teacher.username}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">未分配</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div 
                              className="flex items-center gap-2 cursor-pointer text-blue-600 hover:text-blue-700 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddStudentDialog(classItem.id);
                              }}
                              title="点击添加学员"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {classItem.student_count || 0}人
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => openAddStudentDialog(classItem.id)}
                                className="hover:bg-blue-100 text-blue-600 hover:text-blue-700"
                              >
                                <UserPlus className="h-4 w-4" />
                                <span className="hidden sm:inline ml-1">添加学员</span>
                              </Button>
                              {/* 只有管理员可以编辑班级 */}
                              {isAdmin && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => openEditDialog(classItem)}
                                className="hover:bg-orange-100 text-orange-600 hover:text-orange-700"
                              >
                                <Edit className="h-4 w-4" />
                                <span className="hidden sm:inline ml-1">编辑</span>
                              </Button>
                              )}
                              {/* 只有管理员可以删除班级 */}
                              {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="hover:bg-red-100 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="hidden sm:inline ml-1">删除</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      确定要删除班级"{classItem.name}"吗？此操作不可撤销。
                                      如果班级中还有正式学员，需要先移除所有学员。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteClass(classItem.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      确认删除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* 展开的学员列表 */}
                        {expandedClasses.has(classItem.id) && (
                          <TableRow>
                            <TableCell colSpan={6} className="p-0">
                              <div className="bg-muted/30 border-t">
                                <div className="p-4">

                                  
                                  {loadingMembers.has(classItem.id) ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">
                                      加载学员中...
                                    </div>
                                  ) : classMembers[classItem.id]?.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">
                                      暂无学员
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {classMembers[classItem.id]?.map((member, index) => (
                                        <div 
                                          key={member.member_id}
                                          className={`flex items-center justify-between py-2 px-3 rounded-md transition-colors hover:bg-gray-50 ${
                                            index !== classMembers[classItem.id].length - 1 ? 'border-b border-gray-100' : ''
                                          }`}
                                        >
                                          <div className="flex items-center gap-3 min-w-0 flex-1">
                                            {/* 学员头像或占位符 */}
                                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                              <span className="text-blue-600 text-sm font-medium">
                                                {(member.student.full_name || member.student.username)?.charAt(0)?.toUpperCase()}
                                              </span>
                                            </div>
                                            
                                            {/* 学员基本信息 */}
                                            <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm text-gray-900 truncate">
                                                {member.student.full_name || member.student.username}
                                              </span>
                                            </div>
                                              {/* 次要信息：学校和专业 */}
                                              <div className="flex items-center gap-3 mt-0.5">
                                            {member.student.school && (
                                                  <span className="text-xs text-gray-500 truncate">
                                                    {member.student.school}
                                                  </span>
                                                )}
                                                {member.student.major && (
                                                  <span className="text-xs text-gray-400 truncate">
                                                    {member.student.major}
                                                  </span>
                                                )}
                                              </div>
                                          </div>
                                          </div>
                                          
                                          {/* 操作按钮 */}
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                className="flex-shrink-0 h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                >
                                                <UserMinus className="h-3.5 w-3.5" />
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>确认移除学员</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                  确定要将学员 <span className="font-medium">"{member.student.full_name || member.student.username}"</span> 从班级中移除吗？
                                                  <br />
                                                  <span className="text-sm text-gray-500 mt-1 block">移除后该学员将无法访问班级相关内容</span>
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                                  <AlertDialogAction 
                                                    onClick={() => handleRemoveStudent(member.member_id, classItem.id)}
                                                    className="bg-red-600 hover:bg-red-700"
                                                  >
                                                    确认移除
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <EnhancedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredClasses.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
                className="mt-6"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* 创建班级对话框 */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              新建班级
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="className">班级名称 *</Label>
              <Input
                id="className"
                value={classForm.name}
                onChange={(e) => setClassForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入班级名称"
              />
            </div>
            <div>
              <Label htmlFor="classDescription">班级描述</Label>
              <Textarea
                id="classDescription"
                value={classForm.description}
                onChange={(e) => setClassForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="请输入班级描述（可选）"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="headTeacher">班主任</Label>
              <Select
                value={classForm.head_teacher_id || "none"}
                onValueChange={(value) => setClassForm(prev => ({ ...prev, head_teacher_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择班主任（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定班主任</SelectItem>
                  {teachers?.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.full_name || teacher.username}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="classStatus">班级状态</Label>
              <Select
                value={classForm.status}
                onValueChange={(value: ClassStatus) => setClassForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">已开班</SelectItem>
                  <SelectItem value="completed">已结束</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialog(false); resetForm(); }}>
              取消
            </Button>
            <Button onClick={handleCreateClass} disabled={submitting}>
              {submitting ? "创建中..." : "创建班级"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑班级对话框 */}
      <Dialog open={editDialog.open} onOpenChange={closeEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              编辑班级
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editClassName">班级名称 *</Label>
              <Input
                id="editClassName"
                value={classForm.name}
                onChange={(e) => setClassForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入班级名称"
              />
            </div>
            <div>
              <Label htmlFor="editClassDescription">班级描述</Label>
              <Textarea
                id="editClassDescription"
                value={classForm.description}
                onChange={(e) => setClassForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="请输入班级描述（可选）"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="editHeadTeacher">班主任</Label>
              <Select
                value={classForm.head_teacher_id || "none"}
                onValueChange={(value) => setClassForm(prev => ({ ...prev, head_teacher_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择班主任（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定班主任</SelectItem>
                  {teachers?.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.full_name || teacher.username}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editClassStatus">班级状态</Label>
              <Select
                value={classForm.status}
                onValueChange={(value: ClassStatus) => setClassForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">已开班</SelectItem>
                  <SelectItem value="completed">已结束</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              取消
            </Button>
            <Button onClick={handleUpdateClass} disabled={submitting}>
              {submitting ? "更新中..." : "更新班级"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加学员对话框 */}
      <Dialog open={addStudentDialog.open} onOpenChange={closeAddStudentDialog}>
        <DialogContent className="max-w-2xl h-[600px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              添加学员到班级
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col space-y-4 min-h-0">
            <div className="text-sm text-muted-foreground flex-shrink-0">
              选择要添加到班级的学员（只显示尚未加入该班级的正式学员，按注册时间排序）
              <br />
              <span className="text-blue-600">💡 支持拼音搜索：输入 "lida" 可找到 "李达"，输入 "ld" 可找到首字母匹配的姓名</span>
            </div>
            
            {/* 搜索框 */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索学员姓名、用户名、手机号或学校（支持拼音搜索，如：lida 可找到李达）..."
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* 学员列表区域 - 使用flex-1使其填充剩余空间 */}
            <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
              {(() => {
                // 显示加载状态
                if (loadingStudents) {
                  return (
                <div className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span>正在加载可添加的学员...</span>
                </div>
                    </div>
                  );
                }

                // 搜索过滤
                const filteredStudents = filterStudents(availableStudents, studentSearchTerm);

                if (availableStudents.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">暂无可添加的学员</p>
                      <p className="text-sm">当前没有可以添加到此班级的学员</p>
                    </div>
                  );
                }

                if (filteredStudents.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">未找到匹配的学员</p>
                      <p className="text-sm">请尝试其他搜索关键词</p>
                    </div>
                  );
                }

                return (
                <div className="space-y-2 p-4">
                    {filteredStudents.map((student) => (
                    <div 
                      key={student.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedStudents.includes(student.id) 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleStudentSelection(student.id)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="rounded"
                        />
                        <div>
                          <div className="font-medium text-sm">
                            {student.full_name || student.username}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {student.phone_number}
                            </span>
                            {student.school && (
                              <span className="flex items-center gap-1">
                                <School className="h-3 w-3" />
                                {student.school}
                                {student.major && ` (${student.major})`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  );
                })()}
            </div>
              
            {/* 统计信息区域 - 固定在底部 */}
            <div className="flex items-center justify-between text-sm flex-shrink-0 pt-2 border-t">
              <span className="text-muted-foreground">
                {(() => {
                  const filteredCount = filterStudents(availableStudents, studentSearchTerm).length;
                  return studentSearchTerm.trim() ? 
                    `显示 ${filteredCount} / ${availableStudents.length} 名学员` : 
                    `共 ${availableStudents.length} 名可添加学员`;
                })()}
              </span>
              
            {selectedStudents.length > 0 && (
                <span className="text-blue-600 font-medium">
                已选择 {selectedStudents.length} 名学员
                </span>
            )}
          </div>
          </div>
          
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={closeAddStudentDialog}>
              取消
            </Button>
            <Button 
              onClick={handleAddStudents} 
              disabled={submitting || selectedStudents.length === 0}
            >
              {submitting ? "添加中..." : `添加 ${selectedStudents.length} 名学员`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassManagement;
