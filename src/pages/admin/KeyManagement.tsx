import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Key, Plus, RefreshCw, Clock, User } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnhancedPagination } from "@/components/ui/enhanced-pagination";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";
import { copyKeyToClipboard } from "@/utils/clipboard";
import "@/styles/clipboard.css";

// 激活密钥类型
interface ActivationKey {
  id: string;
  key: string;
  key_type: 'upgrade_to_trial' | 'upgrade_to_student';
  is_used: boolean;
  created_by_user_id: string;
  activated_by_user_id: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
  // 关联查询的字段
  creator?: {
    username: string;
    full_name: string | null;
  };
  activator?: {
    username: string;
    full_name: string | null;
  };
}

const KeyManagement = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(getCurrentPageSize());

  // 权限检查
  const isAdmin = profile?.user_type === "admin";
  const isHeadTeacher = profile?.user_type === "head_teacher";
  const isBusinessTeacher = profile?.user_type === "business_teacher";
  const hasAccess = isAdmin || isHeadTeacher || isBusinessTeacher;

  // 获取密钥列表
  const fetchKeys = async () => {
    if (!user?.id || !hasAccess) return;

    setLoading(true);
    try {
      // 构建查询，包含创建者和激活者信息
      let query = (supabase as any)
        .from('activation_keys')
        .select(`
          *,
          creator:profiles!activation_keys_created_by_user_id_fkey(username, full_name),
          activator:profiles!activation_keys_activated_by_user_id_fkey(username, full_name)
        `)
        .order('created_at', { ascending: false });

      // 根据用户类型筛选数据（RLS策略会自动处理权限，但我们也可以在前端做筛选）
      if (!isAdmin) {
        query = query.eq('created_by_user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setKeys(data || []);
    } catch (error: any) {
      console.error('获取密钥列表失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载密钥列表"
      });
    } finally {
      setLoading(false);
    }
  };

  // 生成密钥
  const generateKey = async (keyType: 'upgrade_to_trial' | 'upgrade_to_student') => {
    if (!user?.id) return;

    setGeneratingKey(keyType);
    try {
      console.log('开始生成密钥，类型:', keyType);
      console.log('当前用户:', user.id);

      const { data, error } = await supabase.functions.invoke('generate-activation-key', {
        body: { 
          key_type: keyType,
          user_id: user.id
        }
      });

      console.log('云函数调用结果:', { data, error });

      if (error) {
        console.error('云函数调用错误:', error);
        throw error;
      }

      if (data?.success) {
        toast({
          title: "密钥生成成功",
          description: `密钥：${data.key}`
        });
        
        // 刷新密钥列表
        await fetchKeys();
      } else {
        console.error('密钥生成失败:', data);
        throw new Error(data?.error || '生成密钥失败');
      }
    } catch (error: any) {
      console.error('生成密钥失败:', error);
      toast({
        variant: "destructive",
        title: "生成失败",
        description: error.message || "无法生成密钥"
      });
    } finally {
      setGeneratingKey(null);
    }
  };

  // 复制密钥到剪贴板
  const copyToClipboard = async (key: string) => {
    await copyKeyToClipboard(key);
  };

  // 获取密钥类型显示名称
  const getKeyTypeLabel = (keyType: string) => {
    switch (keyType) {
      case 'upgrade_to_trial':
        return '升级体验用户';
      case 'upgrade_to_student':
        return '升级正式学员';
      default:
        return keyType;
    }
  };

  // 获取密钥类型颜色
  const getKeyTypeColor = (keyType: string) => {
    switch (keyType) {
      case 'upgrade_to_trial':
        return 'bg-orange-100 text-orange-800';
      case 'upgrade_to_student':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 格式化日期时间
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 获取激活者显示名称
  const getActivatorName = (activator: any) => {
    if (!activator) return '-';
    return activator.full_name || activator.username || '-';
  };

  // 获取生成者显示名称
  const getCreatorName = (creator: any) => {
    if (!creator) return '-';
    return creator.full_name || creator.username || '-';
  };

  // 分页逻辑
  const totalPages = Math.ceil(keys.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedKeys = keys.slice(startIndex, startIndex + pageSize);

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 处理每页显示数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize);
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  useEffect(() => {
    if (user && hasAccess) {
      fetchKeys();
    }
  }, [user, hasAccess]);

  // 权限检查
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Key className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">权限不足</h2>
          <p className="text-muted-foreground">只有管理员、班主任和业务老师可以访问密钥管理</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 lg:p-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Key className="h-6 w-6" />
          密钥管理
        </h1>
        <p className="text-muted-foreground mt-1">
          生成和管理激活密钥
        </p>
      </div>

      {/* 生成密钥区域 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            生成激活密钥
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* 业务老师：只能生成体验用户密钥 */}
            {(isBusinessTeacher || isAdmin) && (
              <Button
                onClick={() => generateKey('upgrade_to_trial')}
                disabled={generatingKey !== null}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {generatingKey === 'upgrade_to_trial' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    生成体验用户密钥
                  </>
                )}
              </Button>
            )}

            {/* 班主任和管理员：可以生成正式学员密钥 */}
            {(isHeadTeacher || isAdmin) && (
              <Button
                onClick={() => generateKey('upgrade_to_student')}
                disabled={generatingKey !== null}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {generatingKey === 'upgrade_to_student' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    生成正式学员密钥
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 密钥列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            密钥列表
            {keys.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                共 {keys.length} 个密钥
                {totalPages > 1 && ` • 第 ${currentPage} / ${totalPages} 页`}
              </span>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchKeys}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">加载中...</p>
              </div>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无密钥</h3>
              <p className="text-muted-foreground">点击上方按钮生成激活密钥</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>密钥</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>生成者</TableHead>
                    <TableHead>激活者</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>激活时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-mono text-sm">
                        <span 
                          className="selectable-text key-text copy-hint"
                          title="点击选中全部内容，长按可复制"
                        >
                          {key.key}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getKeyTypeColor(key.key_type)}>
                          {getKeyTypeLabel(key.key_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.is_used ? "secondary" : "default"}>
                          {key.is_used ? "已使用" : "未使用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {getCreatorName(key.creator)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {key.is_used && (
                            <User className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-sm">
                            {getActivatorName(key.activator)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDateTime(key.created_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDateTime(key.activated_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(key.key)}
                          title="复制密钥（移动端可长按密钥内容手动复制）"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <EnhancedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={keys.length}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                className="mt-6"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KeyManagement; 