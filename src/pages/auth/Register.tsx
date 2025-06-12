import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { registerSuccessToast, errorToast } from "@/utils/toast";
import { applySystemSettings, getGlobalSettings } from "@/utils/systemSettings";
import { Shield, Eye, EyeOff, User, Phone, UserCircle, ChevronRight, CheckCircle } from "lucide-react";

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

const formSchema = z.object({
  username: z.string().min(3, "用户名至少需要3个字符").max(50, "用户名最多50个字符"),
  full_name: z.string().min(2, "姓名至少需要2个字符").max(50, "姓名最多50个字符"),
  password: z.string().min(6, "密码至少需要6个字符"),
  confirmPassword: z.string().min(6, "确认密码至少需要6个字符"),
  phone_number: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的11位手机号码"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const systemSettings = getGlobalSettings();

  // 确保页面标题正确显示
  useEffect(() => {
    applySystemSettings();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      full_name: "",
      password: "",
      confirmPassword: "",
      phone_number: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    
    try {
      // First check if username exists
      const { data: usernameExists, error: usernameCheckError } = await supabase
        .rpc('check_username_exists', { username: values.username });
        
      if (usernameCheckError) throw usernameCheckError;
      
      if (usernameExists) {
        form.setError("username", { message: "该用户名已被使用" });
        setIsLoading(false);
        return;
      }
      
      // Construct a dummy email from phone number for Supabase auth
      const dummyEmail = `${values.phone_number}@phone.auth`;

      const userDataForProfile = {
        username: values.username,
        full_name: values.full_name,
        phone_number: values.phone_number,
        user_type: "registered"
      };
      
      await signUp(dummyEmail, values.password, userDataForProfile);
      
      registerSuccessToast();
      
      navigate("/auth/login");
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.message?.includes("User already registered")) {
          errorMessage = "该手机号或用户名已被注册。";
      } else if (error.message?.includes("profiles_username_key")) {
          errorMessage = "该用户名已被使用，请尝试其他用户名。";
      } else if (error.message?.includes("valid phone number")) {
          errorMessage = "请输入一个有效的手机号码。";
      }

      errorToast(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-32 h-32 bg-success/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-32 left-16 w-40 h-40 bg-primary/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-warning/10 rounded-full blur-xl"></div>
      </div>

      {/* 主注册区域 */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-lg mx-auto shadow-xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl font-bold text-center flex items-center justify-center gap-2">
              <UserCircle className="h-5 w-5 text-success" />
              注册账户
            </CardTitle>
            <CardDescription className="text-center text-sm">
              创建新账户，加入考研学习社区
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* 基本信息区域 */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium flex items-center gap-1">
                            <User className="h-3 w-3" />
                            用户名 *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="设置登录用户名" 
                              className="h-10 border-muted-foreground/20 focus:border-success transition-colors"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            姓名 *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="请输入姓名" 
                              className="h-10 border-muted-foreground/20 focus:border-success transition-colors"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          手机号码 *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="tel" 
                            placeholder="请输入11位手机号码" 
                            className="h-10 border-muted-foreground/20 focus:border-success transition-colors"
                            {...field} 
                          />
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
                        <FormLabel className="text-sm font-medium flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          登录密码 *
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"} 
                              placeholder="设置登录密码（至少6位）" 
                              className="pr-10 h-10 border-muted-foreground/20 focus:border-success transition-colors"
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

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          确认密码 *
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showConfirmPassword ? "text" : "password"} 
                              placeholder="再次输入密码确认" 
                              className="pr-10 h-10 border-muted-foreground/20 focus:border-success transition-colors"
                              {...field} 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? (
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
                </div>
              
                <Button 
                  type="submit" 
                  className="w-full h-11 edu-gradient-success hover:shadow-lg transition-all duration-200 text-white font-medium group mt-6" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      注册中...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      立即注册
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </Button>
              </form>
            </Form>
            
            {/* 弱化的注册须知 */}
            <div className="mt-6 p-3 bg-muted/30 rounded-lg border border-muted/50">
              <p className="text-xs text-muted-foreground text-center">
                手机号用于账号安全验证，请确保两次密码输入一致
              </p>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4 pt-6">
            {/* 登录链接 */}
            <div className="text-center">
              <span className="text-sm text-muted-foreground">已有账户？</span>
              <Link 
                to="/auth/login" 
                className="text-sm text-primary font-medium hover:underline ml-1 inline-flex items-center gap-1 group"
              >
                前往登录
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
        <p className="text-xs text-muted-foreground mt-1">
          专业考研教育平台
        </p>
      </footer>
    </div>
  );
};

export default Register;
