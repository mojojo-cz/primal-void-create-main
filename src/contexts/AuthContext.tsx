import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { loadSystemSettingsFromDB, checkDatabaseAccess } from "@/services/systemSettingsService";
import { setGlobalSettings, loadSystemSettings, applySystemSettings } from "@/utils/systemSettings";

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

  // 根据用户类型确定重定向路径
  const getRedirectPath = (userType: string) => {
    switch (userType) {
      case "admin":
        return "/admin/courses";
      case "teacher":
        return "/admin/accounts";
      case "student":
        return "/student";
      case "registered":
      default:
        return "/dashboard";
    }
  };

  // 执行重定向
  const performRedirect = (userType: string) => {
    const path = getRedirectPath(userType);
    console.log(`[AUTH] 重定向用户(${userType})到:`, path);
    navigate(path, { replace: true });
  };

  // 初始化系统设置
  const initializeSystemSettings = async () => {
    try {
      console.log("[AUTH] 初始化系统设置");
      const canAccessDB = await checkDatabaseAccess();
      
      if (canAccessDB) {
        const settings = await loadSystemSettingsFromDB();
        setGlobalSettings(settings);
        applySystemSettings(settings);
        console.log("[AUTH] 系统设置已从数据库加载");
      } else {
        const settings = loadSystemSettings();
        setGlobalSettings(settings);
        applySystemSettings(settings);
        console.log("[AUTH] 系统设置已从本地存储加载");
      }
    } catch (error) {
      console.error("[AUTH] 初始化系统设置失败:", error);
      // 降级到默认设置
      const settings = loadSystemSettings();
      setGlobalSettings(settings);
      applySystemSettings(settings);
    }
  };

  // 获取用户资料
  const fetchProfile = async (userId: string) => {
    try {
      console.log("[AUTH] 获取用户资料:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AUTH] 获取用户资料失败:", error);
        throw error;
      }
      
      console.log("[AUTH] 获取到用户资料:", data);
      setProfile(data);
      
      // 如果在认证页面，执行重定向
      const isAuthPage = location.pathname.startsWith("/auth/");
      const isHomePage = location.pathname === "/";
      
      if (data && (isAuthPage || isHomePage)) {
        console.log("[AUTH] 位于登录页或首页，准备重定向");
        performRedirect(data.user_type);
      }
    } catch (error) {
      console.error("[AUTH] 获取资料出错:", error);
    }
  };

  useEffect(() => {
    // 设置身份验证状态监听器
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[AUTH] 身份验证状态变更:", event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log("[AUTH] 用户已登录，获取资料");
            fetchProfile(session.user.id);
        } else {
          console.log("[AUTH] 用户未登录或已登出");
          setProfile(null);
          // 只有在非验证页面上时才重定向到登录页
          if (!location.pathname.startsWith("/auth/")) {
            console.log("[AUTH] 非登录页且未认证，重定向到登录页");
            navigate("/auth/login", { replace: true });
          }
        }
      }
    );

    // 初始化系统设置
    initializeSystemSettings();
    
    // 检查现有会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[AUTH] 检查现有会话:", !!session);
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
      console.log("[AUTH] 注册新用户，邮箱(虚拟):", email, "附加数据:", userData);
      // The userData here is what we pass to options.data, which Supabase uses 
      // to populate the public.profiles table via a trigger or function.
      // Ensure userData includes all necessary fields for the profiles table, including full_name.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: userData.username,
            full_name: userData.full_name, // Ensure full_name is passed
            phone_number: userData.phone_number,
            user_type: userData.user_type || "registered", // Default to registered
            // Include other optional fields if they are part of userData
            school: userData.school,
            department: userData.department,
            major: userData.major,
            grade: userData.grade,
          },
        },
      });

      if (error) {
        console.error("[AUTH] Supabase signUp 错误:", error);
        throw error;
      }
      console.log("[AUTH] Supabase signUp 成功:", data);
      
      // Note: Supabase typically creates the profile entry via a trigger (`on_auth_user_created`).
      // If that trigger isn't set up to handle all fields from options.data (like full_name),
      // you might need to manually insert/update the profile here after successful signUp,
      // or ensure the trigger handles all fields correctly.
      // For now, assuming the trigger handles it or it's a new setup.

      return data;
    } catch (error: any) {
      console.error("[AUTH] 注册流程最终错误:", error.message);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log("[AUTH] 用户登录:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      console.log("[AUTH] 登录成功，获取用户资料");
      
      // 获取用户资料
      if (data.user) {
        try {
          console.log("[AUTH] 获取登录用户资料:", data.user.id);
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .maybeSingle();
            
          if (profileError) throw profileError;
          
          console.log("[AUTH] 获取到用户资料:", profileData);
          setProfile(profileData);
          
          // 立即执行重定向
          if (profileData) {
            performRedirect(profileData.user_type);
          }
        } catch (profileError) {
          console.error("[AUTH] 获取资料出错:", profileError);
        }
      }
      
      return data;
    } catch (error: any) {
      console.error("[AUTH] 登录失败:", error.message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log("[AUTH] 用户登出");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/auth/login");
    } catch (error: any) {
      console.error("[AUTH] 登出失败:", error.message);
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
