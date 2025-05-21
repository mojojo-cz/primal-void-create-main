import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";

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
  phone_number: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的11位手机号码"),
  school: z.string().optional(),
  department: z.string().optional(),
  major: z.string().optional(),
  grade: z.string().optional(),
});

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      full_name: "",
      password: "",
      phone_number: "",
      school: "",
      department: "",
      major: "",
      grade: "",
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
        school: values.school,
        department: values.department,
        major: values.major,
        grade: values.grade,
        user_type: "registered"
      };
      
      await signUp(dummyEmail, values.password, userDataForProfile);
      
      toast({
        title: "注册成功",
        description: "您已成功注册，现在可以登录了。",
      });
      
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

      toast({
        variant: "destructive",
        title: "注册失败",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">注册账户</CardTitle>
          <CardDescription className="text-center">
            创建一个新账户来访问系统
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="设置您的登录用户名" {...field} />
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
                    <FormLabel>姓名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入您的真实姓名" {...field} />
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
                    <FormLabel>密码 *</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="设置您的登录密码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>手机号码 *</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="请输入11位手机号码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>学校</FormLabel>
                      <FormControl>
                        <Input placeholder="选填，请输入学校" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>学院</FormLabel>
                      <FormControl>
                        <Input placeholder="选填，请输入学院" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="major"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>专业</FormLabel>
                      <FormControl>
                        <Input placeholder="选填，请输入专业" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>年级/届</FormLabel>
                      <FormControl>
                        <Input placeholder="选填，请输入年级/届" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "注册中..." : "立即注册"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            已有账户？{" "}
            <Link to="/auth/login" className="text-primary underline-offset-4 hover:underline">
              前往登录
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Register;
