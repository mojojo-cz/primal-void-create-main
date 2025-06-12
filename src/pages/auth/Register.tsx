import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { registerSuccessToast, errorToast } from "@/utils/toast";
import { applySystemSettings } from "@/utils/systemSettings";
import { Shield, Eye, EyeOff, User, Phone, UserCircle, ChevronRight } from "lucide-react";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const { data: usernameExists, error: usernameCheckError } = await supabase
        .rpc('check_username_exists', { username: values.username });
        
      if (usernameCheckError) throw usernameCheckError;
      
      if (usernameExists) {
        form.setError("username", { message: "该用户名已被使用" });
        setIsLoading(false);
        return;
      }
      
      const dummyEmail = `${values.phone_number}@phone.auth`;

      const userDataForProfile = {
        username: values.username,
        full_name: values.full_name,
        phone_number: values.phone_number,
        user_type: "registered"
      };
      
      await signUp(dummyEmail, values.password, userDataForProfile, false);
      
      registerSuccessToast();
      
      // 由于没有自动登出，用户已经处于登录状态
      // AuthContext会自动处理重定向，无需手动操作
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
                注册新账户
            </h2>
        </div>
        <Card className="bg-white dark:bg-gray-800/50 shadow-sm rounded-2xl">
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">用户名*</FormLabel>
                        <FormControl>
                          <Input className="h-11" placeholder="设置登录用户名" {...field} />
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
                        <FormLabel className="text-sm">姓名*</FormLabel>
                        <FormControl>
                          <Input className="h-11" placeholder="请输入姓名" {...field} />
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
                      <FormLabel className="text-sm">手机号码*</FormLabel>
                      <FormControl>
                        <Input className="h-11" type="tel" placeholder="请输入11位手机号码" {...field} />
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
                      <FormLabel className="text-sm">登录密码*</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="设置登录密码（至少6位）" 
                            className="pr-10 h-11"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                      <FormLabel className="text-sm">确认密码*</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showConfirmPassword ? "text" : "password"} 
                            placeholder="再次输入密码确认" 
                            className="pr-10 h-11"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium group edu-gradient-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin mr-2"></div>
                      注册中...
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <ChevronRight className="h-5 w-5 order-last group-hover:translate-x-1 transition-transform" />
                      立即注册
                    </div>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <div className="text-center">
          <Link 
            to="/auth/login" 
            className="text-sm text-primary font-medium hover:underline"
          >
            已有账户？前往登录
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
