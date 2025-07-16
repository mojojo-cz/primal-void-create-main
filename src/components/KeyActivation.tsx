import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Key, Sparkles, Gift } from "lucide-react";
import { formatDateForDisplay } from '@/utils/timezone';

interface KeyActivationProps {
  onActivationSuccess?: () => void;
}

const KeyActivation = ({ onActivationSuccess }: KeyActivationProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const [activationKey, setActivationKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  // 只对注册用户和体验用户显示
  const shouldShow = profile?.user_type === 'registered' || profile?.user_type === 'trial_user';

  // 激活密钥
  const handleActivate = async () => {
    if (!activationKey.trim()) {
      toast({
        variant: "destructive",
        title: "请输入激活密钥",
        description: "激活密钥不能为空"
      });
      return;
    }

    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "用户未登录",
        description: "请先登录再激活密钥"
      });
      return;
    }

    setIsActivating(true);
    try {
      console.log('开始激活密钥:', activationKey.trim());
      console.log('当前用户:', user?.id);

      // 检查当前session状态
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('当前session:', sessionData, sessionError);

      // 检查用户状态
      const { data: userData, error: userError } = await supabase.auth.getUser();
      console.log('当前用户验证:', userData, userError);

      const { data, error } = await supabase.functions.invoke('activate-key', {
        body: { 
          activation_key: activationKey.trim()
        }
      });

      console.log('激活结果:', { data, error });

      if (error) {
        console.error('云函数调用错误:', error);
        throw error;
      }

      if (data.success) {
        // 激活成功
        toast({
          title: "激活成功！",
          description: data.message
        });

        // 清空输入框
        setActivationKey("");

        // 刷新用户资料以获取最新的权限和有效期
        await refreshProfile();

        // 根据新用户类型给出提示
        let upgradeMessage = "";
        if (data.new_user_type === 'trial_user') {
          upgradeMessage = "您已成功升级为体验用户！";
        } else if (data.new_user_type === 'student') {
          upgradeMessage = "您已成功升级为正式学员！";
        }

        if (upgradeMessage) {
          setTimeout(() => {
            toast({
              title: upgradeMessage,
              description: `有效期至：${formatDateForDisplay(data.expires_at)}`
            });
          }, 1000);
        }

        if (onActivationSuccess) {
          onActivationSuccess();
        }

      } else {
        // 激活失败
        toast({
          variant: "destructive",
          title: "激活失败",
          description: data.error || "激活密钥失败"
        });
      }
    } catch (error: any) {
      console.error('激活密钥失败:', error);
      toast({
        variant: "destructive",
        title: "激活失败",
        description: error.message || "激活密钥时发生错误"
      });
    } finally {
      setIsActivating(false);
    }
  };

  // 测试身份验证
  const testAuth = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('test-auth', {
        body: {}
      });
      
      console.log('测试身份验证结果:', { data, error });
      
      if (data) {
        toast({
          title: "身份验证测试结果",
          description: `User: ${data.user ? data.user.email : 'null'}, Auth: ${data.authHeader}`
        });
      }
    } catch (error) {
      console.error('测试身份验证失败:', error);
    }
  };

  // 处理回车键激活
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleActivate();
    }
  };

  // 如果不应该显示此组件，返回null
  if (!shouldShow) {
    return null;
  }

  return (
    <Card className="border border-purple-200 shadow-lg bg-gradient-to-r from-purple-50 to-pink-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-800">
          <Gift className="h-5 w-5" />
          密钥激活
          <Sparkles className="h-4 w-4 text-purple-600" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-purple-700">
          输入激活密钥，升级您的账户权限并延长有效期
        </p>
        
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="请输入激活密钥"
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isActivating}
              className="font-mono"
            />
          </div>
          <Button
            onClick={handleActivate}
            disabled={isActivating || !activationKey.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isActivating ? (
              <>
                <Key className="h-4 w-4 mr-2 animate-spin" />
                激活中...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                激活
              </>
            )}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={testAuth}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            测试身份验证
          </Button>
        </div>

        <div className="text-xs text-purple-600 bg-purple-100/50 p-2 rounded">
          💡 提示：激活密钥可以将您的账户升级为体验用户或正式学员
        </div>
      </CardContent>
    </Card>
  );
};

export default KeyActivation; 