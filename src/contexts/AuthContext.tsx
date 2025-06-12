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
  refreshProfile: () => Promise<void>;
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
      case "head_teacher":
      case "business_teacher":
        return "/admin/accounts";
      case "student":
        return "/student";
      case "trial_user":
        return "/student"; // 体验用户也进入学习页面
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
    
    // 确保页面滚动到顶部
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  // 检查账号是否过期
  const isAccountExpired = (profile: any): boolean => {
    if (!profile?.access_expires_at) {
      return false; // 没有设置过期时间则认为未过期
    }
    
    const expiresAt = new Date(profile.access_expires_at);
    const now = new Date();
    return now > expiresAt;
  };

  // 处理过期账号
  const handleExpiredAccount = async (profile: any) => {
    console.log("[AUTH] 账号已过期，强制登出");
    
    // 强制登出
    await supabase.auth.signOut();
    
    // 清理本地状态
    setSession(null);
    setUser(null);
    setProfile(null);
    
    // 清理 Supabase 本地缓存
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // 显示过期提示并跳转到登录页
    setTimeout(() => {
      // 使用原生alert确保用户看到提示
      alert(`账号已过期！\n\n您的账号有效期至：${new Date(profile.access_expires_at).toLocaleDateString('zh-CN')}\n请联系管理员续费或重新开通权限。`);
      window.location.replace("/auth/login");
    }, 100);
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
      
      // 检查账号是否过期
      if (data && isAccountExpired(data)) {
        await handleExpiredAccount(data);
        return;
      }
      
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

  // 定时检查已登录用户账号是否过期，并检查profile更新
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (profile && session && user?.id) {
      console.log("[AUTH] 启动账号过期检查和profile更新检查定时器");
      // 每2分钟检查一次账号是否过期和profile是否有更新
      intervalId = setInterval(async () => {
        console.log("[AUTH] 执行定时检查");
        
        // 检查账号是否过期
        if (profile && isAccountExpired(profile)) {
          console.log("[AUTH] 定时检查发现账号已过期");
          handleExpiredAccount(profile);
          return;
        }
        
        // 检查profile是否有更新
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("updated_at, user_type")
            .eq("id", user.id)
            .maybeSingle();
            
          if (!error && data) {
            const currentUpdatedAt = profile?.updated_at;
            const latestUpdatedAt = data.updated_at;
            
            // 如果数据库中的更新时间晚于当前profile的更新时间，说明有更新
            if (currentUpdatedAt && latestUpdatedAt && 
                new Date(latestUpdatedAt) > new Date(currentUpdatedAt)) {
              console.log("[AUTH] 检测到profile数据更新，刷新profile");
              await fetchProfile(user.id);
            }
          }
        } catch (error) {
          console.error("[AUTH] 检查profile更新失败:", error);
        }
      }, 2 * 60 * 1000); // 2分钟
    }
    
    return () => {
      if (intervalId) {
        console.log("[AUTH] 清除定时检查器");
        clearInterval(intervalId);
      }
    };
  }, [profile, session, user?.id]);

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
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: userData.username,
            full_name: userData.full_name,
            phone_number: userData.phone_number,
            user_type: userData.user_type || "registered",
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
      
      // 立即登出防止自动登录状态导致页面跳转
      console.log("[AUTH] 注册成功，立即登出防止自动跳转");
      await supabase.auth.signOut();
      
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
          
          // 检查账号是否过期
          if (profileData && isAccountExpired(profileData)) {
            console.log("[AUTH] 登录时发现账号已过期");
            // 强制登出过期账号
            await supabase.auth.signOut();
            throw new Error(`账号已过期！有效期至：${new Date(profileData.access_expires_at).toLocaleDateString('zh-CN')}，请联系管理员续费。`);
          }
          
          setProfile(profileData);
          
          // 立即执行重定向
          if (profileData) {
            performRedirect(profileData.user_type);
          }
        } catch (profileError) {
          console.error("[AUTH] 获取资料出错:", profileError);
          // 如果是过期错误，重新抛出，否则正常处理
          throw profileError;
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

  // 手动刷新用户资料
  const refreshProfile = async () => {
    if (user?.id) {
      console.log("[AUTH] 手动刷新用户资料");
      await fetchProfile(user.id);
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
        refreshProfile,
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
