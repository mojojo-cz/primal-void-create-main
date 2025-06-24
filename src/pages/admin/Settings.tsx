import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { 
  Upload, 
  Image as ImageIcon, 
  Save, 
  RotateCcw,
  Shield,
  Globe,
  Eye,
  Settings as SettingsIcon,
  List,
  Grid3X3,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database
} from "lucide-react";
import { 
  SystemSettings,
  defaultSettings,
  loadSystemSettings,
  saveSystemSettings,
  applySystemSettings,
  setGlobalSettings
} from "@/utils/systemSettings";
import { 
  loadSystemSettingsFromDB,
  saveSystemSettingsToDB,
  checkDatabaseAccess
} from "@/services/systemSettingsService";
import {
  UserPreferences,
  loadUserPreferences,
  saveUserPreferences,
  getAvailablePageSizes,
  resetToDefaultPreferences
} from "@/utils/userPreferences";
import { supabase } from "@/lib/supabase";

// URL刷新结果类型
interface RefreshResult {
  success: boolean;
  action: string;
  duration: number;
  timestamp: string;
  result: {
    total: number;
    expired: number;
    refreshed: number;
    failed: number;
    errors: string[];
    details: Array<{
      id: string;
      title: string;
      status: 'valid' | 'expired' | 'expiring_soon' | 'refreshed' | 'failed';
      error?: string;
      oldExpiry?: string;
      newExpiry?: string;
    }>;
  };
}

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(loadUserPreferences());
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLogo, setPreviewLogo] = useState(false);
  const [previewFavicon, setPreviewFavicon] = useState(false);

  // URL刷新相关状态
  const [urlRefreshLoading, setUrlRefreshLoading] = useState(false);
  const [lastRefreshResult, setLastRefreshResult] = useState<RefreshResult | null>(null);
  const [showRefreshDetails, setShowRefreshDetails] = useState(false);

  // 加载设置
  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // 检查数据库访问能力
      const canAccessDB = await checkDatabaseAccess();
      
      let currentSettings: SystemSettings;
      
      if (canAccessDB) {
        // 优先从数据库加载
        currentSettings = await loadSystemSettingsFromDB();
        console.log('从数据库加载系统设置');
      } else {
        // 降级到本地存储
        currentSettings = loadSystemSettings();
        console.log('从本地存储加载系统设置');
      }
      
      setSettings(currentSettings);
      setGlobalSettings(currentSettings);
    } catch (error: any) {
      console.error('加载设置失败:', error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载系统设置"
      });
    } finally {
      setLoading(false);
    }
  };

  // 保存设置
  const saveSettingsHandler = async () => {
    try {
      setSaving(true);
      
      // 检查数据库访问能力
      const canAccessDB = await checkDatabaseAccess();
      
      let saveSuccess = false;
      
      if (canAccessDB) {
        // 优先保存到数据库
        saveSuccess = await saveSystemSettingsToDB(settings);
        if (saveSuccess) {
          console.log('设置已保存到数据库');
        } else {
          console.error('保存到数据库失败，降级到本地存储');
        }
      }
      
      if (!saveSuccess) {
        // 保存到本地存储（作为备份或降级方案）
        saveSystemSettings(settings);
        saveSuccess = true;
        console.log('设置已保存到本地存储');
      }
      
      if (saveSuccess) {
        // 设置全局设置并应用到页面
        setGlobalSettings(settings);
        applySystemSettings(settings);

        toast({
          title: "保存成功",
          description: canAccessDB ? "系统设置已同步到数据库" : "系统设置已保存到本地"
        });
      } else {
        throw new Error("保存失败");
      }
    } catch (error: any) {
      console.error('保存设置失败:', error);
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "保存系统设置失败"
      });
    } finally {
      setSaving(false);
    }
  };

  // 重置为默认值
  const resetToDefaults = () => {
    setSettings(defaultSettings);
    toast({
      title: "已重置",
      description: "设置已重置为默认值"
    });
  };

  // 处理输入变化
  const handleInputChange = (field: keyof SystemSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 处理用户偏好变化
  const handlePreferenceChange = <T extends keyof UserPreferences>(
    category: T,
    field: keyof UserPreferences[T],
    value: any
  ) => {
    setUserPrefs(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  // 保存用户偏好
  const saveUserPrefs = () => {
    try {
      saveUserPreferences(userPrefs);
      toast({
        title: "保存成功",
        description: "用户偏好设置已保存"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: "无法保存用户偏好设置"
      });
    }
  };

  // 重置用户偏好
  const resetUserPreferences = () => {
    const defaultPrefs = resetToDefaultPreferences();
    setUserPrefs(defaultPrefs);
    toast({
      title: "已重置",
      description: "用户偏好已重置为默认值"
    });
  };

  // URL刷新功能
  const handleUrlRefresh = async (action: 'check' | 'refresh') => {
    try {
      setUrlRefreshLoading(true);

      toast({
        title: action === 'check' ? "🔍 正在检查URL状态" : "🔄 正在刷新过期URL",
        description: "请稍候，正在处理中...",
        duration: 3000
      });

      const { data, error } = await supabase.functions.invoke('minio-url-refresh', {
        body: {
          action,
          onlyExpired: action === 'refresh', // 刷新时只处理过期的
          batchSize: 100
        }
      });

      if (error) {
        throw new Error(error.message || '请求失败');
      }

      // Edge Function直接返回结果，不需要检查success字段
      if (data.error) {
        throw new Error(data.error || '操作失败');
      }

      // 构造兼容的结果格式
      const refreshResult = {
        success: true,
        action,
        duration: 0, // Edge Function没有返回执行时间
        timestamp: new Date().toISOString(),
        result: data // data就是RefreshResult
      };

      setLastRefreshResult(refreshResult);
      
      const result = data;
      
      if (action === 'check') {
        // 根据详细结果统计真实的状态分布
        const expiredVideos = result.details?.filter(d => d.status === 'expired').length || 0;
        const expiringSoonVideos = result.details?.filter(d => d.status === 'expiring_soon').length || 0;
        
        let description = `检查了 ${result.total} 个视频`;
        if (expiredVideos > 0 && expiringSoonVideos > 0) {
          description += `，发现 ${expiredVideos} 个已过期，${expiringSoonVideos} 个即将过期`;
        } else if (expiredVideos > 0) {
          description += `，发现 ${expiredVideos} 个已过期`;
        } else if (expiringSoonVideos > 0) {
          description += `，发现 ${expiringSoonVideos} 个即将过期`;
        } else {
          description += `，所有URL状态良好`;
        }
        
        toast({
          title: "✅ 检查完成",
          description,
          duration: 5000
        });
      } else {
        const successMsg = result.refreshed > 0 
          ? `成功刷新 ${result.refreshed} 个过期URL` 
          : '所有URL都在有效期内';
        const failMsg = result.failed > 0 ? `，${result.failed} 个失败` : '';
        
        toast({
          title: result.failed > 0 ? "⚠️ 刷新完成（部分失败）" : "🎉 刷新完成",
          description: successMsg + failMsg,
          duration: 5000,
          variant: result.failed > 0 ? "destructive" : "default"
        });
      }

    } catch (error: any) {
      console.error(`URL ${action} 失败:`, error);
      toast({
        variant: "destructive",
        title: `${action === 'check' ? '检查' : '刷新'}失败`,
        description: error.message || `URL ${action === 'check' ? '检查' : '刷新'}操作失败`
      });
    } finally {
      setUrlRefreshLoading(false);
    }
  };

  // 获取状态图标和颜色
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'expiring_soon':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'refreshed':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid':
        return '有效';
      case 'expired':
        return '已过期';
      case 'expiring_soon':
        return '即将过期';
      case 'refreshed':
        return '已刷新';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="admin-page-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SettingsIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">加载设置中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <SettingsIcon className="h-6 w-6 text-primary" />
              系统设置
            </h1>
            <p className="text-muted-foreground mt-1">
              管理系统LOGO、标签栏图标和基本信息
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={resetToDefaults}>
              <RotateCcw className="h-4 w-4 mr-2" />
              重置默认
            </Button>
            <Button onClick={saveSettingsHandler} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </div>

        {/* 系统LOGO设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              系统LOGO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="system_logo">LOGO图片URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="system_logo"
                    value={settings.system_logo}
                    onChange={(e) => handleInputChange('system_logo', e.target.value)}
                    placeholder="请输入LOGO图片链接（可选）"
                    className="flex-1"
                  />
                  {settings.system_logo && (
                    <Button 
                      variant="outline" 
                      onClick={() => setPreviewLogo(!previewLogo)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      预览
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  系统LOGO将显示在侧边栏和系统各个位置，建议尺寸：64x64px
                </p>
              </div>
              
              {settings.system_logo && previewLogo && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border rounded-lg overflow-hidden bg-white flex items-center justify-center">
                      <img 
                        src={settings.system_logo} 
                        alt="系统LOGO预览" 
                        className="max-w-full max-h-full object-contain"
                        onError={() => {
                          toast({
                            variant: "destructive",
                            title: "图片加载失败",
                            description: "无法加载LOGO图片，请检查URL是否正确"
                          });
                        }}
                      />
                    </div>
                    <div>
                      <p className="font-medium">系统LOGO预览</p>
                      <p className="text-sm text-muted-foreground">
                        这是LOGO在系统中的显示效果
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 标签栏设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              标签栏设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="favicon_url">标签栏图标URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="favicon_url"
                    value={settings.favicon_url}
                    onChange={(e) => handleInputChange('favicon_url', e.target.value)}
                    placeholder="请输入favicon图标链接"
                    className="flex-1"
                  />
                  {settings.favicon_url && (
                    <Button 
                      variant="outline" 
                      onClick={() => setPreviewFavicon(!previewFavicon)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      预览
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  浏览器标签栏显示的小图标，建议格式：PNG/ICO，尺寸：32x32px
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="system_title">页面标题</Label>
                <Input
                  id="system_title"
                  value={settings.system_title}
                  onChange={(e) => handleInputChange('system_title', e.target.value)}
                  placeholder="请输入页面标题"
                />
                <p className="text-sm text-muted-foreground">
                  浏览器标签栏显示的页面标题
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_name">网站名称</Label>
                <Input
                  id="site_name"
                  value={settings.site_name}
                  onChange={(e) => handleInputChange('site_name', e.target.value)}
                  placeholder="请输入网站名称"
                />
                <p className="text-sm text-muted-foreground">
                  网站的显示名称，用于各种标题和描述
                </p>
              </div>
              
              {settings.favicon_url && previewFavicon && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 border rounded overflow-hidden bg-white flex items-center justify-center">
                      <img 
                        src={settings.favicon_url} 
                        alt="Favicon预览" 
                        className="max-w-full max-h-full object-contain"
                        onError={() => {
                          toast({
                            variant: "destructive",
                            title: "图片加载失败",
                            description: "无法加载favicon图片，请检查URL是否正确"
                          });
                        }}
                      />
                    </div>
                    <div>
                      <p className="font-medium">标签栏图标预览</p>
                      <p className="text-sm text-muted-foreground">
                        标题：{settings.system_title}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 视频URL管理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              视频URL管理
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">URL状态管理</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  定期检查和刷新视频播放URL，确保用户能够正常播放视频。系统会自动检测即将过期的URL（24小时内）并重新生成。
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleUrlRefresh('check')}
                    disabled={urlRefreshLoading}
                    className="flex-1 sm:flex-none"
                  >
                    {urlRefreshLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    检查URL状态
                  </Button>
                  
                  <Button
                    onClick={() => handleUrlRefresh('refresh')}
                    disabled={urlRefreshLoading}
                    className="flex-1 sm:flex-none"
                  >
                    {urlRefreshLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    刷新过期URL
                  </Button>
                </div>
              </div>

              {/* 上次刷新结果 */}
              {lastRefreshResult && (
                <div className="space-y-3">
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium">
                        上次{lastRefreshResult.action === 'check' ? '检查' : '刷新'}结果
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRefreshDetails(!showRefreshDetails)}
                      >
                        {showRefreshDetails ? '隐藏详情' : '查看详情'}
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="font-medium text-blue-600">{lastRefreshResult.result.total}</div>
                        <div className="text-xs text-blue-500">总数</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <div className="font-medium text-yellow-600">{lastRefreshResult.result.expired}</div>
                        <div className="text-xs text-yellow-500">需刷新</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-600">{lastRefreshResult.result.refreshed}</div>
                        <div className="text-xs text-green-500">已刷新</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="font-medium text-red-600">{lastRefreshResult.result.failed}</div>
                        <div className="text-xs text-red-500">失败</div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground mb-3">
                      执行时间: {new Date(lastRefreshResult.timestamp).toLocaleString()} 
                      • 耗时: {lastRefreshResult.duration}ms
                    </div>

                    {/* 详细结果 */}
                    {showRefreshDetails && lastRefreshResult.result.details.length > 0 && (
                      <div className="border rounded-lg p-3 bg-muted/30 max-h-60 overflow-y-auto">
                        <div className="space-y-2">
                          {lastRefreshResult.result.details.slice(0, 10).map((detail, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {getStatusIcon(detail.status)}
                                <span className="truncate">{detail.title}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{getStatusText(detail.status)}</span>
                                {detail.error && (
                                  <span className="text-red-500" title={detail.error}>⚠️</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {lastRefreshResult.result.details.length > 10 && (
                            <div className="text-xs text-muted-foreground text-center pt-2">
                              还有 {lastRefreshResult.result.details.length - 10} 个项目未显示
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 错误信息 */}
                    {lastRefreshResult.result.errors.length > 0 && (
                      <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                        <div className="text-sm font-medium text-red-600 mb-2">错误信息:</div>
                        <div className="space-y-1">
                          {lastRefreshResult.result.errors.slice(0, 3).map((error, index) => (
                            <div key={index} className="text-xs text-red-500">{error}</div>
                          ))}
                          {lastRefreshResult.result.errors.length > 3 && (
                            <div className="text-xs text-red-400">
                              还有 {lastRefreshResult.result.errors.length - 3} 个错误未显示
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• URL有效期为7天，系统会在URL到期前24小时标记为"即将过期"</p>
                <p>• 建议定期检查URL状态，特别是在重要的学习活动前</p>
                <p>• 刷新操作只会处理过期或即将过期的URL，不会影响有效的URL</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用户偏好设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5 text-primary" />
              用户偏好设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 分页设置 */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">分页设置</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pageSize">每页显示数量</Label>
                    <Select
                      value={userPrefs.pagination.itemsPerPage.toString()}
                      onValueChange={(value) => 
                        handlePreferenceChange('pagination', 'itemsPerPage', parseInt(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailablePageSizes().map(size => (
                          <SelectItem key={size} value={size.toString()}>
                            {size} 项/页
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      设置列表页面每页显示的项目数量
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="defaultPageSize">默认页面大小</Label>
                    <Select
                      value={userPrefs.pagination.defaultPageSize.toString()}
                      onValueChange={(value) => 
                        handlePreferenceChange('pagination', 'defaultPageSize', parseInt(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailablePageSizes().map(size => (
                          <SelectItem key={size} value={size.toString()}>
                            {size} 项/页
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      新页面的默认每页显示数量
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 显示设置 */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-3">显示设置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="defaultVideoView">默认视频视图</Label>
                      <Select
                        value={userPrefs.admin.defaultVideoView}
                        onValueChange={(value: 'list' | 'grid') => 
                          handlePreferenceChange('admin', 'defaultVideoView', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="list">
                            <div className="flex items-center gap-2">
                              <List className="h-4 w-4" />
                              列表视图
                            </div>
                          </SelectItem>
                          <SelectItem value="grid">
                            <div className="flex items-center gap-2">
                              <Grid3X3 className="h-4 w-4" />
                              网格视图
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        视频管理页面的默认显示方式
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 pt-4">
                <Button variant="outline" onClick={resetUserPreferences}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  重置偏好
                </Button>
                <Button onClick={saveUserPrefs}>
                  <Save className="h-4 w-4 mr-2" />
                  保存偏好
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              使用说明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium">分页设置</p>
                  <p className="text-muted-foreground">
                    调整列表页面的每页显示数量，适用于账号管理、视频管理、课程管理等页面
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium">系统LOGO</p>
                  <p className="text-muted-foreground">
                    显示在侧边栏头部，建议使用正方形图片，尺寸64x64px，支持PNG、JPG格式
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium">标签栏图标</p>
                  <p className="text-muted-foreground">
                    浏览器标签栏的小图标，建议使用ICO或PNG格式，尺寸32x32px或16x16px
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium">图片链接</p>
                  <p className="text-muted-foreground">
                    可以使用在线图片链接，或上传到服务器后使用相对路径
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>


      </div>
    </div>
  );
};

export default Settings; 