# 视频URL定时刷新系统实现报告

## 功能概述

为解决视频播放URL过期导致用户无法正常播放视频的问题，实现了一套完整的URL定时检查和刷新系统。该系统能够自动检测即将过期的URL并重新生成，确保用户始终能够正常播放视频。

## 系统架构

### 1. 核心组件

#### 1.1 Supabase Edge Function: `minio-url-refresh`
- **位置**: `supabase/functions/minio-url-refresh/index.ts`
- **功能**: 执行URL检查和刷新的核心逻辑
- **支持操作**:
  - `check`: 仅检查URL状态，不进行刷新
  - `refresh`: 刷新过期或即将过期的URL
  - `status`: 获取系统状态（可扩展）

#### 1.2 管理员控制台界面
- **位置**: `src/pages/admin/Settings.tsx` 
- **功能**: 提供手动触发和结果查看界面
- **特性**:
  - 一键检查所有视频URL状态
  - 一键刷新过期URL
  - 详细的执行结果展示
  - 错误信息汇总

### 2. 技术实现细节

#### 2.1 URL有效期检查算法
```typescript
const isUrlExpiringSoon = (expiresAt: string, hoursThreshold = 24): boolean => {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const timeUntilExpiry = expiry.getTime() - now.getTime();
  return timeUntilExpiry < (hoursThreshold * 60 * 60 * 1000);
};
```

- **检查阈值**: 24小时
- **逻辑**: URL在24小时内过期则标记为"即将过期"
- **新URL有效期**: 7天

#### 2.2 批量处理机制
- **并发控制**: 每批处理10个视频，避免系统过载
- **批次延迟**: 批次之间延迟1秒，保护服务器性能
- **错误隔离**: 单个失败不影响其他视频的处理
- **进度跟踪**: 实时统计处理进度和结果

#### 2.3 数据库更新策略
```sql
UPDATE minio_videos 
SET 
  play_url = $1,
  play_url_expires_at = $2,
  updated_at = NOW()
WHERE id = $3
```

- **原子操作**: 确保URL和过期时间同步更新
- **时间戳记录**: 记录最后更新时间
- **事务安全**: 避免数据不一致

## 功能特性

### 3.1 智能检查策略
1. **全量检查**: 检查所有视频的URL状态
2. **过期优先**: 刷新时优先处理即将过期的URL
3. **状态分类**: 
   - `valid`: URL有效（有效期>24小时）
   - `expired`: URL即将过期（有效期<24小时）
   - `refreshed`: URL已成功刷新
   - `failed`: 刷新失败

### 3.2 错误处理机制
1. **MinIO对象检查**: 验证视频文件是否存在
2. **网络错误重试**: 自动处理临时网络问题
3. **详细错误日志**: 记录具体的失败原因
4. **部分失败容忍**: 不因单个失败停止整个流程

### 3.3 结果展示系统
1. **统计概览**: 
   - 总处理数量
   - 即将过期数量  
   - 成功刷新数量
   - 失败数量

2. **详细信息**:
   - 每个视频的具体状态
   - 过期时间信息
   - 错误详情

3. **执行监控**:
   - 执行时间记录
   - 性能统计
   - 历史记录保存

## 部署和使用

### 4.1 Edge Function部署
```bash
# 部署URL刷新功能
supabase functions deploy minio-url-refresh
```

### 4.2 使用方式

#### 4.2.1 手动触发（推荐）
1. 进入管理员设置页面
2. 找到"视频URL管理"模块
3. 点击"检查URL状态"查看当前状态
4. 点击"刷新过期URL"执行刷新操作

#### 4.2.2 API调用（自动化）
```typescript
// 检查URL状态
const { data } = await supabase.functions.invoke('minio-url-refresh', {
  body: {
    action: 'check',
    batchSize: 100
  }
});

// 刷新过期URL
const { data } = await supabase.functions.invoke('minio-url-refresh', {
  body: {
    action: 'refresh', 
    onlyExpired: true,
    batchSize: 100
  }
});
```

### 4.3 定时任务建议

可以通过以下方式实现自动化：

1. **GitHub Actions** (推荐)
```yaml
name: Refresh Video URLs
on:
  schedule:
    - cron: '0 */6 * * *'  # 每6小时执行一次
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Refresh URLs
        run: |
          curl -X POST "$SUPABASE_URL/functions/v1/minio-url-refresh" \
            -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            -d '{"action":"refresh","onlyExpired":true}'
```

2. **外部Cron服务**
   - Vercel Cron
   - Netlify Functions
   - 云服务商的定时任务

3. **服务器端Cron**
```bash
# 每6小时执行一次
0 */6 * * * curl -X POST "https://your-project.supabase.co/functions/v1/minio-url-refresh" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"refresh","onlyExpired":true}'
```

## 安全和性能

### 5.1 安全措施
1. **权限控制**: 使用Service Role Key确保权限充足
2. **参数验证**: 严格验证输入参数
3. **环境变量**: MinIO凭据通过环境变量安全存储
4. **CORS配置**: 限制跨域访问

### 5.2 性能优化
1. **批量处理**: 减少数据库连接开销
2. **并发控制**: 避免系统过载
3. **缓存机制**: 复用MinIO客户端连接
4. **延迟控制**: 批次间延迟保护服务器

### 5.3 监控指标
1. **执行时间**: 跟踪处理性能
2. **成功率**: 监控系统健康度
3. **错误统计**: 识别常见问题
4. **资源使用**: 监控系统负载

## 维护和扩展

### 6.1 常见问题排查
1. **MinIO连接失败**: 检查环境变量配置
2. **URL生成失败**: 验证对象是否存在
3. **数据库更新失败**: 检查权限和网络
4. **批量处理超时**: 调整批次大小

### 6.2 可扩展功能
1. **通知系统**: 刷新完成后发送通知
2. **统计报表**: 生成URL健康度报告
3. **智能调度**: 根据系统负载调整执行频率
4. **多租户支持**: 支持按组织分别处理

## 预期效果

### 7.1 用户体验提升
- **零中断播放**: 用户不会遇到URL过期问题
- **透明维护**: 后台静默执行，不影响用户使用
- **快速恢复**: 出现问题时能快速修复

### 7.2 运维效率提升
- **自动化管理**: 减少手动运维工作
- **问题预防**: 主动发现和解决问题
- **监控可视化**: 清晰的状态展示和历史记录

### 7.3 系统稳定性提升
- **URL生命周期管理**: 完整的URL有效期管理
- **故障恢复能力**: 自动修复过期URL问题
- **性能监控**: 实时掌握系统健康状态

## 技术优势

1. **微服务架构**: Edge Function独立部署，不影响主系统
2. **弹性扩展**: 支持大规模视频库的URL管理
3. **容错设计**: 部分失败不影响整体功能
4. **实时监控**: 详细的执行状态和结果展示
5. **易于维护**: 清晰的代码结构和错误处理

## 总结

视频URL定时刷新系统成功解决了视频播放URL过期的问题，通过智能的检查策略、可靠的刷新机制和完善的监控体系，确保用户能够持续稳定地访问视频内容。

该系统具有高度的可扩展性和可维护性，支持手动触发和自动化执行，能够适应不同规模的部署需求。通过合理的批量处理和错误隔离机制，在保证性能的同时确保了系统的稳定性。

建议定期（每6-12小时）执行URL检查和刷新操作，以确保最佳的用户体验和系统稳定性。 