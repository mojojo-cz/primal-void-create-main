# 预览微调快速删除状态竞争bug修复报告

## 问题描述

在智能排课工作台的预览微调页面中，当用户快速连续点击删除按钮删除多个课程时，下方的"课表编辑 - X 节课"统计数值会出现回滚现象，导致显示的数值不准确。

## 问题原因分析

### 根本原因：状态竞争（Race Condition）

在 `removeFromPreview` 函数中，删除操作的处理流程存在以下问题：

1. **基于过期状态**：多个删除操作可能基于相同的旧 `previewSchedules` 状态进行计算
2. **异步操作竞争**：每次删除后都会触发异步的冲突检测 `runConflictChecks`
3. **状态覆盖**：后执行的异步操作可能会覆盖先执行操作的结果

### 问题代码示例

```typescript
// 修改前的代码（存在bug）
const removeFromPreview = (id: string) => {
  // 基于当前的 previewSchedules 状态（可能已过期）
  const scheduleToRemove = previewSchedules.find(item => item.id === id);
  const updatedPreview = previewSchedules.filter(item => item.id !== id);
  
  // 立即设置新状态
  setPreviewSchedules(updatedPreview);
  
  // 异步操作可能基于过期状态
  setTimeout(async () => {
    const checkedPreview = await runConflictChecks(updatedPreview);
    setPreviewSchedules(checkedPreview); // 可能覆盖其他删除操作的结果
  }, 0);
};
```

### 问题场景

当用户快速点击删除按钮时：

1. **时刻T1**：删除课程A，基于状态[A,B,C,D] → 新状态[B,C,D]
2. **时刻T2**：删除课程B，仍基于旧状态[A,B,C,D] → 新状态[A,C,D]
3. **异步检测1**：基于[B,C,D]进行冲突检测，结果覆盖当前状态
4. **异步检测2**：基于[A,C,D]进行冲突检测，结果再次覆盖

最终导致状态不一致和统计数值回滚。

## 解决方案

### 第一次修复：函数式更新模式

最初采用 React 的函数式状态更新，但仍存在异步冲突检测竞争问题。

### 第二次修复：防抖机制 + 状态长度验证

采用更彻底的解决方案，结合防抖机制和状态验证：

```typescript
// 最终修复后的代码
const removeFromPreview = (id: string) => {
  // 使用函数式更新，确保基于最新状态进行删除操作
  setPreviewSchedules(currentSchedules => {
    // 基于最新的 currentSchedules 进行操作
    const scheduleToRemove = currentSchedules.find(item => item.id === id);
    
    if (scheduleToRemove && scheduleToRemove.isNew === false) {
      setDeletedScheduleIds(prev => [...prev, id]);
    }
    
    const updatedPreview = currentSchedules.filter(item => item.id !== id);
    
    // 清除之前的定时器，防止重复的冲突检测
    if (conflictCheckTimeoutRef.current) {
      clearTimeout(conflictCheckTimeoutRef.current);
    }
    
    // 删除后重新检测冲突（使用防抖机制）
    if (updatedPreview.length > 0) {
      conflictCheckTimeoutRef.current = setTimeout(async () => {
        try {
          const checkedPreview = await runConflictChecks(updatedPreview);
          // 使用函数式更新确保基于最新状态
          setPreviewSchedules(currentPreview => {
            // 只有当前预览列表长度与检测时的长度一致时才更新
            // 这样可以避免在连续删除过程中的状态不一致
            if (currentPreview.length === checkedPreview.length) {
              return checkedPreview;
            }
            return currentPreview;
          });
        } catch (error) {
          console.error('删除后冲突检测失败:', error);
        }
      }, 300); // 300ms 防抖延迟
    }
    
    return updatedPreview;
  });
};
```

### 关键改进点

1. **函数式更新**：使用 `setPreviewSchedules(currentSchedules => {...})` 确保操作基于最新状态
2. **防抖机制**：使用 `setTimeout` + `clearTimeout` 防抖，避免频繁的冲突检测
3. **状态长度验证**：在应用冲突检测结果前验证状态长度是否一致
4. **定时器管理**：使用 `useRef` 管理定时器，确保在组件卸载时清理
5. **原子操作**：每次删除操作都是原子性的，避免中间状态的竞争

## 修复效果

### 修复前 ❌
- 快速删除时统计数值出现回滚
- 多个异步操作相互覆盖
- 状态更新不可预测

### 修复后 ✅
- 快速删除时统计数值准确更新
- 每次删除操作基于最新状态
- 状态更新可预测且一致

## 技术要点

### React 函数式更新的优势

```typescript
// 错误的方式：基于闭包中的旧状态
setCount(count + 1);

// 正确的方式：基于最新状态进行更新
setCount(prevCount => prevCount + 1);
```

### 异步操作的正确处理

```typescript
// 使用微任务确保状态更新完成后执行
Promise.resolve().then(() => {
  // 这里的操作会在状态更新后执行
});
```

## 验证结果

- ✅ 快速连续删除操作不再出现统计数值回滚
- ✅ 状态更新保持一致性和可预测性
- ✅ 冲突检测功能正常工作
- ✅ 用户体验得到改善

## 总结

这次修复解决了一个典型的 React 状态竞争问题。经过两轮迭代修复，最终采用了防抖机制 + 状态验证的组合方案，确保了状态更新的原子性和一致性，提升了用户在快速操作时的体验。

### 修复历程

1. **第一次尝试**：仅使用函数式更新，但异步冲突检测仍会竞争
2. **第二次修复**：添加防抖机制和状态长度验证，彻底解决问题

### 技术经验

这个案例提醒我们在处理频繁的状态更新时，应该：

1. 优先使用函数式状态更新
2. 避免基于闭包中的过期状态进行操作
3. 对于高频操作使用防抖/节流机制
4. 在异步操作前验证状态的一致性
5. 合理管理定时器和异步操作的生命周期
6. 在高频操作场景下进行充分测试

### 适用场景

这种修复方案特别适用于：
- 高频用户交互操作
- 涉及异步状态更新的场景
- 需要保持UI状态一致性的应用
- 有复杂状态依赖的组件 