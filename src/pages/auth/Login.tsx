import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { loginSuccessToast, errorToast } from "@/utils/toast";
import { applySystemSettings, getGlobalSettings } from "@/utils/systemSettings";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Eye, EyeOff, Smartphone, Mail, User, ChevronRight } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  account: z.string().refine((val) => {
    // 验证手机号 (11位数字，以1开头，第二位是3-9)
    const phoneRegex = /^1[3-9]\d{9}$/;
    // 验证邮箱
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // 验证用户名 (3-50个字符，可包含字母、数字、下划线)
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
    return phoneRegex.test(val) || emailRegex.test(val) || usernameRegex.test(val);
  }, "请输入有效的用户名、手机号或邮箱地址"),
  password: z.string().min(1, "请输入密码"),
});

const Login = () => {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const systemSettings = getGlobalSettings();

  // 确保页面标题正确显示
  useEffect(() => {
    applySystemSettings();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      account: "",
      password: "",
    },
  });

  // 判断输入类型
  const getAccountType = (value: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
    
    if (phoneRegex.test(value)) return 'phone';
    if (emailRegex.test(value)) return 'email';
    if (usernameRegex.test(value)) return 'username';
    return 'unknown';
  };

  // 获取账号类型图标
  const getAccountIcon = (accountValue: string) => {
    const type = getAccountType(accountValue);
    switch (type) {
      case 'phone': return <Smartphone className="h-4 w-4 text-primary" />;
      case 'email': return <Mail className="h-4 w-4 text-primary" />;
      case 'username': return <User className="h-4 w-4 text-primary" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    
    try {
      let loginEmail = values.account;
      const accountType = getAccountType(values.account);
      
      console.log("🔍 登录调试信息:");
      console.log("输入账号:", values.account);
      console.log("账号类型:", accountType);
      
      // 根据不同类型处理账号
      if (accountType === 'phone') {
      // 如果是手机号，转换为虚拟邮箱
        loginEmail = `${values.account}@phone.auth`;
        console.log("手机号转换后的邮箱:", loginEmail);
      } else if (accountType === 'username') {
        // 如果是用户名，使用安全的数据库函数查找对应的登录邮箱
        console.log("正在查找用户名对应的登录邮箱...");
        
        const { data: loginEmailData, error: emailError } = await supabase
          .rpc('get_login_email_by_username' as any, { username_input: values.account });
        
        console.log("数据库函数查询结果:", { loginEmailData, emailError });
        
        if (emailError) {
          console.error("查找用户名失败:", emailError);
          errorToast("账号或密码不正确，请重试。");
          return;
        }
        
        if (!loginEmailData) {
          console.error("未找到用户名对应的记录");
          errorToast("账号或密码不正确，请重试。");
          return;
        }
        
        // 使用数据库函数返回的登录邮箱
        loginEmail = loginEmailData as string;
        console.log("用户名转换后的邮箱:", loginEmail);
      } else if (accountType === 'email') {
        console.log("直接使用邮箱登录:", loginEmail);
      } else {
        console.error("未知的账号类型:", accountType);
        errorToast("账号格式不正确，请重试。");
        return;
      }
      
      console.log("最终登录邮箱:", loginEmail);
      
      // 使用最终确定的邮箱进行登录
      await signIn(loginEmail, values.password);
      
      loginSuccessToast();
    } catch (error: any) {
      console.error("登录错误:", error);
      errorToast("账号或密码不正确，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-primary/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-32 right-16 w-40 h-40 bg-success/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-warning/10 rounded-full blur-xl"></div>
      </div>

      {/* 顶部品牌区域 */}
      <div className="relative z-10 pt-16 pb-12 px-4 text-center">
        {/* 系统名称 */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-wide bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            显然考研·学员平台
          </h1>
        </div>
      </div>

      {/* 主登录区域 */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl font-bold text-center flex items-center justify-center gap-2">
              {systemSettings.system_logo ? (
                <img 
                  src={systemSettings.system_logo} 
                  alt="系统Logo" 
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.setAttribute('style', 'display: inline-block');
                  }}
                />
              ) : null}
              <GraduationCap className={`h-5 w-5 text-primary ${systemSettings.system_logo ? 'hidden' : 'inline-block'}`} />
              用户登录
            </CardTitle>
            <CardDescription className="text-center text-sm">
              输入您的账号信息登录系统
          </CardDescription>
        </CardHeader>
          
          <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="account"
                render={({ field }) => (
                  <FormItem>
                      <FormLabel className="text-sm font-medium">账号</FormLabel>
                    <FormControl>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                            {getAccountIcon(field.value)}
                          </div>
                          <Input 
                            placeholder="用户名 / 手机号 / 邮箱" 
                            className="pl-10 h-11 border-muted-foreground/20 focus:border-primary transition-colors"
                            {...field} 
                          />
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                      <FormLabel className="text-sm font-medium">密码</FormLabel>
                    <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="请输入密码" 
                            className="pr-10 h-11 border-muted-foreground/20 focus:border-primary transition-colors"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
                <Button 
                  type="submit" 
                  className="w-full h-11 edu-gradient-primary hover:shadow-lg transition-all duration-200 text-white font-medium group" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      登录中...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      登录
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
              </Button>
            </form>
          </Form>
          
            {/* 弱化的忘记密码提示 */}
            <div className="mt-6 p-3 bg-muted/30 rounded-lg border border-muted/50">
              <p className="text-xs text-muted-foreground text-center">
                忘记密码？请联系管理员重置密码
              </p>
          </div>
        </CardContent>
          
          <CardFooter className="flex flex-col space-y-4 pt-6">
            {/* 注册链接 */}
            <div className="text-center">
              <span className="text-sm text-muted-foreground">还没有账户？</span>
              <Link 
                to="/auth/register" 
                className="text-sm text-primary font-medium hover:underline ml-1 inline-flex items-center gap-1 group"
              >
                立即注册
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </CardFooter>
      </Card>
      </div>

      {/* 底部版权信息 */}
      <footer className="relative z-10 text-center py-6 px-4">
        <p className="text-xs text-muted-foreground">
          版权所有 © {new Date().getFullYear()} 杭州劲风教育科技有限公司
        </p>
      </footer>
    </div>
  );
};

export default Login;
