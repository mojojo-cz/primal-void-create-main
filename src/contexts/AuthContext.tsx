import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

interface AuthContextProps {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const isRedirecting = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      console.log("正在获取用户资料:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("获取用户资料失败:", error);
        throw error;
      }
      
      console.log("成功获取用户资料:", data);
      setProfile(data);
      
      // 只有在获取到资料后才进行重定向
      if (data && !isRedirecting.current) {
        isRedirecting.current = true;
        
        const isAuthPage = location.pathname.includes("/auth/");
        console.log("当前页面是否为登录页:", isAuthPage, "路径:", location.pathname);
        
        if (isAuthPage) {
          console.log("准备重定向，用户类型:", data.user_type);
          if (data.user_type === "admin") {
            console.log("重定向到管理页面");
            navigate("/admin");
          } else if (data.user_type === "teacher") {
            console.log("重定向到教师页面");
            navigate("/teacher");
          } else if (data.user_type === "student") {
            console.log("重定向到学员页面");
            navigate("/student");
          } else {
            console.log("重定向到用户页面");
            navigate("/dashboard");
          }
        }
        
        // 设置延迟重置重定向标志
        setTimeout(() => {
          isRedirecting.current = false;
        }, 500);
      } else {
        console.log("跳过重定向:", "数据是否存在:", !!data, "是否正在重定向:", isRedirecting.current);
      }
    } catch (error) {
      console.error("获取资料时发生错误:", error);
    }
  };

  useEffect(() => {
    // 设置身份验证状态监听器
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("身份验证状态变更:", event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log("用户已登录，获取资料");
            fetchProfile(session.user.id);
        } else {
          console.log("用户未登录或已登出");
          setProfile(null);
          // 只有在非验证页面上且未重定向时才重定向到登录页
          if (!location.pathname.startsWith("/auth/") && !isRedirecting.current) {
            isRedirecting.current = true;
            navigate("/auth/login");
            setTimeout(() => {
              isRedirecting.current = false;
            }, 500);
          }
        }
      }
    );

    // 检查现有会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("检查现有会话:", !!session);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      console.log("注册新用户:", email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      });

      if (error) throw error;
      console.log("注册成功");
      return data;
    } catch (error: any) {
      console.error("注册失败:", error.message);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log("用户登录:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      console.log("登录成功，等待获取资料并重定向");
      
      // 主动获取用户资料以触发重定向
      if (data.user) {
        fetchProfile(data.user.id);
      }
      
      return data;
    } catch (error: any) {
      console.error("登录失败:", error.message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log("用户登出");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/auth/login");
    } catch (error: any) {
      console.error("登出失败:", error.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
