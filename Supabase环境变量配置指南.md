# Supabase环境变量配置指南

## 🚨 问题诊断

您遇到的问题是因为`minio-url-refresh` Edge Function缺少必要的MinIO环境变量配置。这些变量需要在Supabase项目中设置。

## 📋 必需的环境变量

以下是需要配置的环境变量：

| 变量名 | 值 | 说明 |
|-------|----|----|
| `MINIO_ENDPOINT` | `minio.xianrankaoyan.vip` | MinIO服务器地址 |
| `MINIO_PORT` | `9000` | MinIO服务器端口 |
| `MINIO_USE_SSL` | `true` | 是否使用SSL |
| `MINIO_ACCESS_KEY` | `WRJDY2MYP6RF0Y5EO4M2` | MinIO访问密钥 |
| `MINIO_SECRET_KEY` | `jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7` | MinIO秘密密钥 |
| `MINIO_BUCKET_NAME` | `videos` | 默认存储桶名称 |

## 🛠 配置步骤

### 方法1：通过Supabase控制台（推荐）

1. **登录Supabase控制台**
   - 访问：https://supabase.com/dashboard
   - 选择项目：`XRKY` (ID: sxsyprzckdnfyhadodhj)

2. **进入Edge Functions设置**
   - 点击左侧菜单：`Settings`
   - 选择：`Edge Functions`
   - 找到：`Environment Variables` 部分

3. **添加环境变量**
   ```
   点击 "Add new variable" 按钮，逐一添加：
   
   变量名: MINIO_ENDPOINT
   值: minio.xianrankaoyan.vip
   
   变量名: MINIO_PORT  
   值: 9000
   
   变量名: MINIO_USE_SSL
   值: true
   
   变量名: MINIO_ACCESS_KEY
   值: WRJDY2MYP6RF0Y5EO4M2
   
   变量名: MINIO_SECRET_KEY
   值: jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7
   
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
supabase link --project-ref sxsyprzckdnfyhadodhj

# 设置环境变量
supabase secrets set MINIO_ENDPOINT=minio.xianrankaoyan.vip
supabase secrets set MINIO_PORT=9000
supabase secrets set MINIO_USE_SSL=true
supabase secrets set MINIO_ACCESS_KEY=WRJDY2MYP6RF0Y5EO4M2
supabase secrets set MINIO_SECRET_KEY='jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7'
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
  "https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-url-refresh" \
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

## 🔄 配置更新后的操作

1. **等待生效**：环境变量更新后需要1-2分钟生效时间
2. **验证部署**：确认Edge Function重新部署成功
3. **测试功能**：在管理员界面测试URL检查和刷新功能
4. **监控日志**：观察是否还有错误信息

## 📞 技术支持

如果按照以上步骤操作后仍有问题：

1. **检查项目权限**：确认您有Supabase项目的管理员权限
2. **联系管理员**：如果是团队项目，联系项目所有者
3. **查看文档**：参考Supabase官方环境变量配置文档
4. **获取帮助**：在Supabase社区或支持渠道寻求帮助

---

**重要提醒**：
- 环境变量包含敏感信息，请妥善保管
- 配置完成后务必测试功能是否正常
- 定期检查和更新访问密钥以确保安全性 