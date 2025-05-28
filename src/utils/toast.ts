import { toast } from "@/components/ui/use-toast";

// 检测是否为移动端
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// 移动端优化的toast配置
interface MobileToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

// 移动端优化的toast函数
export const mobileToast = ({ title, description, variant = "default", duration }: MobileToastOptions) => {
  const mobile = isMobile();
  
  // 自动计算合适的显示时间
  let autoDuration = duration;
  if (!autoDuration) {
    if (mobile) {
      autoDuration = variant === "destructive" ? 2500 : 1500; // 移动端更短
    } else {
      autoDuration = variant === "destructive" ? 4000 : 3000; // 桌面端适中
    }
  }
  
  return toast({
    title,
    description,
    variant,
    duration: autoDuration,
  });
};

// 预设的常用toast函数
export const successToast = (title: string, description?: string, duration?: number) => {
  return mobileToast({ title, description, variant: "default", duration });
};

export const errorToast = (title: string, description?: string, duration?: number) => {
  return mobileToast({ title, description, variant: "destructive", duration });
};

// 专门的登录成功toast
export const loginSuccessToast = () => {
  return mobileToast({
    title: "登录成功",
    description: "正在跳转到系统首页...",
    duration: isMobile() ? 1200 : 2000, // 登录时间更短，因为会立即跳转
  });
};

// 专门的注册成功toast
export const registerSuccessToast = () => {
  return mobileToast({
    title: "注册成功",
    description: "您可以使用新账号登录了",
    duration: isMobile() ? 1500 : 2500,
  });
};

// 专门的操作成功toast (如保存、创建、更新等)
export const operationSuccessToast = (operation: string, target?: string) => {
  return mobileToast({
    title: `${operation}成功`,
    description: target ? `${target}已${operation}` : undefined,
    duration: isMobile() ? 1200 : 2000,
  });
};

// 专门的操作失败toast
export const operationErrorToast = (operation: string, error?: string) => {
  return mobileToast({
    title: `${operation}失败`,
    description: error || `${operation}时发生错误，请重试`,
    variant: "destructive",
    duration: isMobile() ? 2500 : 4000,
  });
};

// 权限限制toast
export const permissionDeniedToast = (message?: string) => {
  return mobileToast({
    title: "权限不足",
    description: message || "您没有权限执行此操作",
    variant: "destructive",
    duration: isMobile() ? 2000 : 3000,
  });
}; 