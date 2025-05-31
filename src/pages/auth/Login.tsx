import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { loginSuccessToast, errorToast } from "@/utils/toast";
import { applySystemSettings } from "@/utils/systemSettings";

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
    return phoneRegex.test(val) || emailRegex.test(val);
  }, "请输入有效的手机号或邮箱地址"),
  password: z.string().min(1, "请输入密码"),
});

const Login = () => {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

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

  // 判断是手机号还是邮箱
  const isPhoneNumber = (value: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(value);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    
    try {
      let loginEmail = values.account;
      
      // 如果是手机号，转换为虚拟邮箱
      if (isPhoneNumber(values.account)) {
        loginEmail = `${values.account}@phone.auth`;
      }
      
      // 无论是邮箱还是转换后的手机号，都传给signIn
      await signIn(loginEmail, values.password);
      
      loginSuccessToast();
    } catch (error: any) {
      errorToast("账号或密码不正确，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">用户登录</CardTitle>
          <CardDescription className="text-center">
            输入您的手机号或邮箱和密码登录系统
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>账号</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入手机号或邮箱" {...field} />
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
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="请输入密码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "登录中..." : "登录"}
              </Button>
            </form>
          </Form>
          
          <div className="mt-4">
            <Alert>
              <AlertDescription>
                忘记密码？请联系管理员重置密码。
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            没有账户？{" "}
            <Link to="/auth/register" className="text-primary underline-offset-4 hover:underline">
              立即注册
            </Link>
          </div>
        </CardFooter>
      </Card>
      <div className="absolute bottom-4 text-center w-full text-xs text-gray-500">
        <p>版权所有 © {new Date().getFullYear()} 杭州劲风教育科技有限公司</p>
      </div>
    </div>
  );
};

export default Login;
