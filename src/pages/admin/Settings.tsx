import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Settings as SettingsIcon
} from "lucide-react";
import { 
  SystemSettings,
  defaultSettings,
  loadSystemSettings,
  saveSystemSettings,
  applySystemSettings
} from "@/utils/systemSettings";

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLogo, setPreviewLogo] = useState(false);
  const [previewFavicon, setPreviewFavicon] = useState(false);

  // 加载设置
  const loadSettings = async () => {
    try {
      setLoading(true);
      const currentSettings = loadSystemSettings();
      setSettings(currentSettings);
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
      
      // 保存设置
      saveSystemSettings(settings);
      
      // 应用设置到页面
      applySystemSettings(settings);

      toast({
        title: "保存成功",
        description: "系统设置已更新"
      });
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