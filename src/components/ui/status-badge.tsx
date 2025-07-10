import React from 'react';
import { Badge } from './badge';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  Play, 
  CheckCircle, 
  XCircle, 
  Pause,
  Calendar,
  AlertCircle
} from 'lucide-react';

export type ScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';

interface StatusBadgeProps {
  status: ScheduleStatus;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

const statusConfig = {
  scheduled: {
    label: '已安排',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    darkColor: 'dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700',
    icon: Calendar
  },
  in_progress: {
    label: '进行中',
    color: 'bg-green-100 text-green-800 border-green-200',
    darkColor: 'dark:bg-green-900/20 dark:text-green-300 dark:border-green-700',
    icon: Play
  },
  completed: {
    label: '已完成',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    darkColor: 'dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700',
    icon: CheckCircle
  },
  cancelled: {
    label: '已取消',
    color: 'bg-red-100 text-red-800 border-red-200',
    darkColor: 'dark:bg-red-900/20 dark:text-red-300 dark:border-red-700',
    icon: XCircle
  },
  postponed: {
    label: '已推迟',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    darkColor: 'dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700',
    icon: Pause
  }
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  default: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5'
};

export function StatusBadge({ 
  status, 
  className, 
  showIcon = true, 
  size = 'default' 
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  if (!config) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "inline-flex items-center gap-1.5",
          sizeClasses[size],
          "bg-gray-100 text-gray-600 border-gray-300",
          "dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600",
          className
        )}
      >
        {showIcon && <AlertCircle className="h-3 w-3" />}
        未知状态
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "inline-flex items-center gap-1.5 border",
        sizeClasses[size],
        config.color,
        config.darkColor,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

// 导出辅助函数用于获取状态配置
export function getStatusConfig(status: ScheduleStatus) {
  return statusConfig[status] || statusConfig.scheduled;
}

// 导出状态优先级函数，用于排序
export function getStatusPriority(status: ScheduleStatus): number {
  const priorities = {
    in_progress: 1,
    scheduled: 2,
    postponed: 3,
    completed: 4,
    cancelled: 5
  };
  return priorities[status] || 999;
} 