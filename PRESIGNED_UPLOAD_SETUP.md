# 🔐 MinIO预签名URL上传方案

基于MinIO官方文档的安全上传解决方案，使用Supabase Edge Function生成预签名URL。

## 📋 方案优势

- **🔒 安全性高**：前端不暴露MinIO访问密钥
- **⏰ 临时权限**：预签名URL有时间限制（最大24小时）
- **📝 文件名清理**：自动处理特殊字符和重复文件名
- **📊 进度监控**：实时上传进度和速度显示
- **🚀 大文件支持**：支持最大50GB文件上传
- **🛡️ 权限控制**：通过Edge Function进行权限验证

## 🏗️ 架构说明

```
前端应用 → Supabase Edge Function → MinIO服务器
    ↓              ↓                    ↓
   文件         预签名URL             实际存储
```

### 上传流程

1. **前端**：选择文件，发送文件名和类型到Edge Function
2. **Edge Function**：
   - 验证权限和参数
   - 生成唯一安全的文件名
   - 调用MinIO SDK生成预签名URL
   - 返回上传URL和下载URL
3. **前端**：使用预签名URL直接上传到MinIO
4. **完成**：显示上传结果和下载链接

## 📦 技术组件

### 后端 - Supabase Edge Function

- **位置**：`supabase/functions/minio-presigned-upload/index.ts`
- **功能**：生成MinIO预签名URL
- **依赖**：Deno + MinIO SDK v8.0.5

### 前端 - React组件

- **组件**：`src/components/PresignedUpload.tsx`
- **功能**：拖拽上传界面 + 进度监控
- **依赖**：React + XMLHttpRequest

### 测试页面

- **页面**：`test_presigned_upload.html`
- **功能**：独立测试预签名URL功能

## 🚀 部署步骤

### 1. 部署Edge Function

```bash
# 进入项目目录
cd /path/to/your/project

# 确保Supabase CLI已安装和登录
supabase login

# 部署Edge Function
supabase functions deploy minio-presigned-upload

# 验证部署
curl https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-presigned-upload
```

### 2. 验证MinIO配置

确认以下配置正确：

```typescript
const MINIO_CONFIG = {
  endPoint: '115.159.33.45',
  port: 9000,
  useSSL: false,
  accessKey: 'WRJDY2MYP6RF0Y5EO4M2',
  secretKey: 'jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7',
  bucketName: 'videos'
};
```

### 3. 集成到主应用

在主管理页面 `src/pages/admin/MinIOVideoManagement.tsx` 中已集成预签名上传选项卡。

### 4. 测试功能

1. **打开测试页面**：`test_presigned_upload.html`
2. **选择文件**：拖拽或点击选择
3. **验证流程**：观察日志和上传进度
4. **确认结果**：检查MinIO中的文件

## 🔧 API接口

### POST 请求 - 生成预签名URL

```typescript
// 请求
POST /functions/v1/minio-presigned-upload
{
  "fileName": "video.mp4",
  "contentType": "video/mp4",
  "expires": 3600  // 可选，默认1小时
}

// 响应
{
  "success": true,
  "uploadUrl": "http://115.159.33.45:9000/videos/...",
  "downloadUrl": "http://115.159.33.45:9000/videos/...",
  "fileName": "1737384567_abc123_video.mp4",
  "originalFileName": "video.mp4",
  "contentType": "video/mp4",
  "expiresIn": 3600,
  "bucket": "videos",
  "metadata": {
    "uploadedAt": "2024-01-20T10:00:00.000Z",
    "size": null,
    "etag": null
  }
}
```

### GET 请求 - 服务信息

```typescript
// 请求
GET /functions/v1/minio-presigned-upload

// 响应
{
  "service": "MinIO预签名URL服务",
  "version": "1.0.0",
  "endpoints": {
    "POST": "生成预签名上传URL",
    "GET": "获取服务信息"
  },
  "config": {
    "maxFileSize": "50GB",
    "maxExpires": "24小时",
    "bucket": "videos",
    "server": "115.159.33.45:9000"
  }
}
```

## 🛡️ 安全特性

### 文件名安全处理

```typescript
// 原始文件名：test (1).mp4 中文.mov
// 清理后：test_1_.mp4___.mov
// 最终文件名：1737384567_abc123_test_1_.mp4___.mov
```

- 替换特殊字符为下划线
- 合并连续下划线
- 添加时间戳和随机字符
- 限制文件名长度

### 权限控制

- **临时访问**：预签名URL有有效期限制
- **单次使用**：每次上传生成新的URL
- **桶隔离**：只能访问指定的存储桶
- **操作限制**：URL只允许PUT操作

### 输入验证

- **文件名检查**：不能为空
- **过期时间限制**：最大24小时
- **内容类型验证**：支持任意MIME类型
- **请求方法限制**：只允许GET/POST/OPTIONS

## 🔍 故障排除

### 常见问题

1. **预签名URL获取失败**
   - 检查MinIO服务器连接
   - 验证访问密钥是否正确
   - 确认存储桶是否存在

2. **上传失败**
   - 检查预签名URL是否过期
   - 验证文件大小是否超限
   - 确认网络连接稳定

3. **Edge Function错误**
   - 查看Supabase函数日志
   - 验证MinIO SDK版本兼容性
   - 检查CORS配置

### 调试方法

```bash
# 查看Edge Function日志
supabase functions logs minio-presigned-upload

# 测试MinIO连接
curl -X GET https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-presigned-upload

# 测试预签名URL生成
curl -X POST https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-presigned-upload \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.txt","contentType":"text/plain"}'
```

## 📈 性能优化

### 建议设置

- **预签名URL有效期**：根据文件大小调整（大文件可设置更长时间）
- **并发上传**：前端可并行处理多个文件
- **分片上传**：对于超大文件，考虑使用MultiPart Upload
- **重试机制**：网络失败时自动重试

### 监控指标

- **上传成功率**：监控失败率和原因
- **上传速度**：监控网络性能
- **存储使用量**：监控MinIO存储空间
- **请求频率**：监控Edge Function调用量

## 🔗 相关文档

- [MinIO JavaScript SDK文档](https://min.io/docs/minio/linux/developers/javascript/minio-javascript.html)
- [Supabase Edge Functions文档](https://supabase.com/docs/guides/functions)
- [预签名URL最佳实践](https://min.io/docs/minio/linux/developers/javascript/API.html#presignedPutObject)

---

**✅ 部署完成后，您将拥有一个安全、高效的大文件上传解决方案！** 