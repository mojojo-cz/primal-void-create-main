import React, { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { Button } from './button';
import { Check, X, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
  editButtonClassName?: string;
  maxLength?: number;
  disabled?: boolean;
  showEditIcon?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  placeholder = "输入内容...",
  className,
  editButtonClassName,
  maxLength = 100,
  disabled = false,
  showEditIcon = true
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 当value prop改变时，同步更新editValue
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // 当进入编辑模式时，自动聚焦并选中文本
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    
    // 如果值没有变化，直接退出编辑模式
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    // 如果值为空，也不保存
    if (!trimmedValue) {
      handleCancel();
      return;
    }

    try {
      setIsSaving(true);
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      console.error('保存失败:', error);
      // 保存失败时不退出编辑模式，让用户可以继续编辑
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isSaving}
          className={cn("h-8 text-sm", className)}
        />
        <div className="flex gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "group flex items-center gap-2 min-w-0 cursor-pointer",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={handleStartEdit}
    >
      <span className="truncate flex-1 min-w-0">
        {value || placeholder}
      </span>
      {showEditIcon && !disabled && (
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
            "text-muted-foreground hover:text-foreground",
            editButtonClassName
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleStartEdit();
          }}
        >
          <Edit3 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
} 