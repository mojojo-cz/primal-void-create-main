# Supabase环境变量配置指南

## 🚨 问题诊断

您遇到的问题是因为`minio-url-refresh` Edge Function缺少必要的MinIO环境变量配置。这些变量需要在Supabase项目中设置。

## 📋 必需的环境变量

以下是需要配置的环境变量：

| 变量名 | 值 | 说明 |
|-------|----|----|
| `MINIO_ENDPOINT` | `your-minio-server.example.com` | MinIO服务器地址 |
| `MINIO_PORT` | `9000` | MinIO服务器端口 |
| `MINIO_USE_SSL` | `true` | 是否使用SSL |
| `MINIO_ACCESS_KEY` | `YOUR_MINIO_ACCESS_KEY` | MinIO访问密钥 |
| `MINIO_SECRET_KEY` | `YOUR_MINIO_SECRET_KEY` | MinIO秘密密钥 |
| `MINIO_BUCKET_NAME` | `videos` | 默认存储桶名称 |

## 🛠 配置步骤

### 方法1：通过Supabase控制台（推荐）

1. **登录Supabase控制台**
   - 访问：https://supabase.com/dashboard
   - 选择您的项目

2. **进入Edge Functions设置**
   - 点击左侧菜单：`Settings`
   - 选择：`Edge Functions`
   - 找到：`Environment Variables` 部分

3. **添加环境变量**
   ```
   点击 "Add new variable" 按钮，逐一添加：
   
   变量名: MINIO_ENDPOINT
   值: your-minio-server.example.com
   
   变量名: MINIO_PORT  
   值: 9000
   
   变量名: MINIO_USE_SSL
   值: true
   
   变量名: MINIO_ACCESS_KEY
   值: YOUR_MINIO_ACCESS_KEY
   
   变量名: MINIO_SECRET_KEY
   值: YOUR_MINIO_SECRET_KEY
   
   变量名: MINIO_BUCKET_NAME
   值: videos
   ```

4. **保存并等待生效**
   - 每添加一个变量后点击 `Save`
   - 等待1-2分钟让配置生效
   - Edge Functions会自动重新部署

### 方法2：通过Supabase CLI

如果您安装了Supabase CLI，可以使用以下命令：

```bash
# 确保已登录并链接到正确项目
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# 设置环境变量
supabase secrets set MINIO_ENDPOINT=your-minio-server.example.com
supabase secrets set MINIO_PORT=9000
supabase secrets set MINIO_USE_SSL=true
supabase secrets set MINIO_ACCESS_KEY=YOUR_MINIO_ACCESS_KEY
supabase secrets set MINIO_SECRET_KEY='YOUR_MINIO_SECRET_KEY'
supabase secrets set MINIO_BUCKET_NAME=videos
```

## ✅ 验证配置

### 1. 检查Edge Function列表
确认`minio-url-refresh`已正确部署：
- 在Supabase控制台 → Edge Functions 查看函数列表
- 状态应显示为 `ACTIVE`

### 2. 测试Edge Function
```bash
# 基础连通性测试
curl -X POST \
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/minio-url-refresh" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "check", "batchSize": 1}'
```

### 3. 在管理员界面测试
- 登录系统管理员控制台
- 进入 `设置` → `视频URL管理`
- 点击 `检查URL状态` 按钮
- 查看是否还有错误信息

## 🔍 故障排除

### 错误：缺少必需的MinIO环境变量

**症状**：
```
Failed to send a request to the Edge Function
缺少必需的MinIO环境变量
```

**解决方案**：
1. 检查所有6个环境变量是否都已设置
2. 确认变量名拼写完全正确（区分大小写）
3. 等待1-2分钟让配置生效
4. 刷新管理员页面重试

### 错误：MinIO连接失败

**症状**：
```
MinIO服务器不可用
网络连接失败
```

**解决方案**：
1. 检查`MINIO_ENDPOINT`和`MINIO_PORT`配置
2. 验证MinIO服务器是否正常运行
3. 检查网络连接和防火墙设置

### 错误：认证失败

**症状**：
```
认证错误
访问被拒绝
```

**解决方案**：
1. 验证`MINIO_ACCESS_KEY`和`MINIO_SECRET_KEY`
2. 确认密钥有足够权限访问`videos`存储桶
3. 检查密钥是否已过期

## 📊 监控和日志

### 查看Edge Function日志
```bash
# 安装Supabase CLI后
supabase functions logs minio-url-refresh --follow
```

### 在Supabase控制台查看日志
1. 进入 `Edge Functions`
2. 点击 `minio-url-refresh`
3. 查看 `Logs` 选项卡

## 🔒 安全注意事项

⚠️ **重要提醒**：
- 永远不要在代码或文档中硬编码真实的API密钥
- 定期轮换MinIO访问凭证
- 监控异常访问活动
- 使用最小权限原则 