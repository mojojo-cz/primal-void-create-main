# MinIO环境变量安全配置指南

## 🔒 安全问题说明

**问题**：之前的Edge Function代码中硬编码了MinIO的访问密钥和秘密密钥，存在严重安全风险：

- ✗ 密钥暴露在代码中
- ✗ 代码版本控制会记录敏感信息
- ✗ 难以更换密钥
- ✗ 违反安全最佳实践

**解决方案**：使用Supabase环境变量安全存储MinIO配置信息。

## 🛠 环境变量配置步骤

### 1. 在Supabase控制台设置环境变量

1. 登录 [Supabase控制台](https://supabase.com/dashboard)
2. 选择项目：`XRKY` (sxsyprzckdnfyhadodhj)
3. 进入 **Settings** → **Edge Functions**
4. 找到 **Environment Variables** 部分
5. 添加以下环境变量：

### 2. 必需的环境变量

| 变量名 | 值 | 说明 |
|-------|----|----|
| `MINIO_ENDPOINT` | `minio.xianrankaoyan.vip` | MinIO服务器地址 |
| `MINIO_PORT` | `9000` | MinIO服务器端口 |
| `MINIO_USE_SSL` | `true` | 是否使用SSL |
| `MINIO_ACCESS_KEY` | `WRJDY2MYP6RF0Y5EO4M2` | MinIO访问密钥 |
| `MINIO_SECRET_KEY` | `jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7` | MinIO秘密密钥 |
| `MINIO_BUCKET_NAME` | `videos` | 默认存储桶名称 |

### 3. 配置步骤详细说明

#### 方式1：通过Supabase控制台UI
1. 点击 **Add new variable**
2. 输入变量名称（如：`MINIO_ENDPOINT`）
3. 输入对应的值
4. 点击 **Save**
5. 重复以上步骤添加所有变量

#### 方式2：通过Supabase CLI（推荐）
```bash
# 设置MinIO端点
supabase secrets set MINIO_ENDPOINT=minio.xianrankaoyan.vip

# 设置MinIO端口
supabase secrets set MINIO_PORT=9000

# 设置SSL配置
supabase secrets set MINIO_USE_SSL=true

# 设置访问密钥
supabase secrets set MINIO_ACCESS_KEY=WRJDY2MYP6RF0Y5EO4M2

# 设置秘密密钥
supabase secrets set MINIO_SECRET_KEY='jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7'

# 设置存储桶名称
supabase secrets set MINIO_BUCKET_NAME=videos
```

## ✅ 验证配置

### 1. 检查Edge Function状态
配置完环境变量后，Edge Function会自动重新部署。

### 2. 测试API调用
```bash
# GET请求 - 测试服务信息
curl -X GET \
  https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-presigned-upload \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs"

# POST请求 - 测试预签名URL生成
curl -X POST \
  https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-presigned-upload \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs" \
  -d '{"fileName": "test.mp4", "contentType": "video/mp4"}'
```

## 🔧 故障排除

### 1. 环境变量未生效
**症状**：收到错误 "缺少必需的MinIO环境变量"

**解决方案**：
- 确认所有必需变量都已设置
- 检查变量名拼写是否正确
- 等待1-2分钟让配置生效
- 重新部署Edge Function

### 2. MinIO连接失败
**症状**：收到连接超时或认证错误

**解决方案**：
- 检查 `MINIO_ENDPOINT` 和 `MINIO_PORT` 是否正确
- 验证 `MINIO_ACCESS_KEY` 和 `MINIO_SECRET_KEY` 是否有效
- 确认MinIO服务器是否可访问

### 3. 存储桶访问错误
**症状**：收到存储桶不存在或权限错误

**解决方案**：
- 检查 `MINIO_BUCKET_NAME` 是否正确
- 确认访问密钥有创建存储桶的权限
- 手动创建存储桶

## 📋 安全最佳实践

### 1. 密钥管理
- ✅ 定期轮换访问密钥
- ✅ 使用最小权限原则
- ✅ 不在日志中记录敏感信息
- ✅ 监控异常访问活动

### 2. 环境变量安全
- ✅ 仅在必要的环境中设置敏感变量
- ✅ 定期审查环境变量配置
- ✅ 使用强密码和复杂密钥
- ✅ 备份密钥信息到安全位置

### 3. 网络安全
- ✅ 配置防火墙规则限制访问
- ✅ 使用SSL/TLS加密连接
- ✅ 监控网络流量
- ✅ 定期安全审计

## 📊 监控和日志

### 1. Edge Function日志
```bash
# 查看Edge Function执行日志
supabase functions logs minio-presigned-upload
```

### 2. 关键指标
- 请求成功率
- 响应时间
- 错误率
- 存储桶访问频率

## 🔄 更新流程

当需要更新MinIO配置时：

1. 在Supabase控制台更新环境变量
2. 等待配置生效（1-2分钟）
3. 测试API功能
4. 监控错误日志
5. 必要时回滚配置

## 📞 支持联系

如果遇到配置问题：
1. 检查本文档的故障排除部分
2. 查看Supabase和MinIO官方文档
3. 检查相关错误日志
4. 联系系统管理员

---

**重要提醒**：完成环境变量配置后，请删除代码中的任何硬编码敏感信息，确保系统安全！ 