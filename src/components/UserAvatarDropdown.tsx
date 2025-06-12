import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  User, 
  LogOut, 
  Settings, 
  ChevronDown 
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface UserAvatarDropdownProps {
  variant?: "default" | "admin";
  className?: string;
}

const UserAvatarDropdown: React.FC<UserAvatarDropdownProps> = ({ 
  variant = "default", 
  className = "" 
}) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      // 清理 Supabase 本地缓存
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      // 强制刷新页面，彻底重置所有状态
      window.location.replace("/auth/login");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "退出失败",
        description: "退出登录时发生错误，请重试"
      });
    }
  };

  const getUserDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.username) return profile.username;
    return user?.email?.split('@')[0] || '用户';
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name.slice(0, 2).toUpperCase();
  };

  const getUserTypeLabel = () => {
    switch (profile?.user_type) {
      case 'admin':
        return '管理员';
      case 'head_teacher':
        return '班主任';
      case 'business_teacher':
        return '业务老师';
      case 'student':
        return '正式学员';
      case 'trial_user':
        return '体验用户';
      default:
        return '用户';
    }
  };

  if (variant === "admin") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className={`flex items-center gap-3 px-3 py-3 hover:bg-gray-100 text-gray-700 justify-start text-left ${className}`}
            style={{ 
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage src="" alt={getUserDisplayName()} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-sm font-medium truncate w-full">{getUserDisplayName()}</span>
              <span className="text-xs text-gray-500 truncate w-full">{getUserTypeLabel()}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-70 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-56" 
          align="end" 
          forceMount
          side="top"
          sideOffset={8}
          style={{ zIndex: 1001 }}
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {getUserTypeLabel()}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleSignOut}
            className="text-red-600 focus:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`flex items-center gap-2 px-3 py-2 hover:bg-muted ${className}`}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt={getUserDisplayName()} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-medium">{getUserDisplayName()}</span>
            <span className="text-xs text-muted-foreground">{getUserTypeLabel()}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {getUserTypeLabel()}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserAvatarDropdown; 