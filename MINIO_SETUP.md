# MinIO视频管理模块设置指南

## 概述

本系统现在支持通过MinIO对象存储服务器来管理视频文件。MinIO视频管理模块提供了与传统视频管理相同的功能，但视频文件存储在您自己的MinIO服务器上。

## 🎯 您的MinIO配置信息

**已配置的MinIO连接信息：**
- **服务器地址**: 115.159.33.45:9000
- **访问密钥**: WRJDY2MYP6RF0Y5EO4M2  
- **秘密密钥**: jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7
- **存储桶名称**: videos
- **SSL**: 否（HTTP连接）

## ✅ 部署状态

### 已完成的配置：
- ✅ 数据库迁移已应用（minio_videos表已创建）
- ✅ Edge Functions已部署：
  - `minio-video-upload` - 处理视频上传
  - `minio-video-stream` - 处理视频播放
  - `minio-video-delete` - 处理视频删除
- ✅ TypeScript类型定义已更新
- ✅ 前端MinIO视频管理界面已集成

### 需要您完成的步骤：

1. **测试MinIO连接**  
   打开项目根目录下的 `test_minio_connection.html` 文件来测试连接

2. **创建videos存储桶**  
   访问MinIO控制台创建存储桶：
   - 访问: http://115.159.33.45:9001
   - 登录用户名: WRJDY2MYP6RF0Y5EO4M2
   - 登录密码: jXYfuK+xv+u7wQRuk9GbHt+iuOCKWSlOHzrhirH7
   - 创建名为 `videos` 的存储桶

3. **配置存储桶策略（可选）**  
   如需要公共访问，请设置适当的存储桶策略

## 🚀 使用MinIO视频管理

### 访问方式
1. 登录系统后，点击左侧菜单的 "MinIO视频管理"
2. 该模块具有与常规视频管理相同的功能：
   - 上传视频到MinIO服务器
   - 列表/网格视图浏览
   - 在线播放
   - 搜索和分页
   - 删除管理

### 权限控制
- **管理员账号**: 完全访问权限
- **教师账号**: 受限访问（与设置中的限制相同）
- **学生账号**: 无管理权限

## 🔧 技术实现

### Edge Functions配置
所有MinIO操作都通过Supabase Edge Functions处理，确保：
- MinIO凭据不暴露给前端
- 安全的文件上传和访问
- 统一的错误处理

### 数据存储
- **文件存储**: MinIO对象存储服务器
- **元数据**: Supabase PostgreSQL数据库
- **访问URL**: 通过Edge Functions动态生成

## 🛡️ 安全特性

1. **访问控制**
   - 所有MinIO操作通过Edge Functions代理
   - 不直接暴露MinIO凭据
   - 基于Supabase认证的权限控制

2. **文件验证**
   - 严格的视频文件类型检查
   - 文件大小限制
   - 自动生成唯一文件名

3. **URL安全**
   - 动态生成访问URL
   - 支持预签名URL（如需要）

## 🔍 故障排除

### 测试连接
使用提供的测试页面 `test_minio_connection.html` 验证：
- MinIO服务器连接状态
- 存储桶是否存在
- 访问权限是否正确

### 常见问题

1. **上传失败**
   - 检查videos存储桶是否存在
   - 验证MinIO服务器是否运行
   - 查看Edge Function日志

2. **视频无法播放**
   - 确认文件已成功上传到MinIO
   - 检查网络连接
   - 验证存储桶读取权限

3. **连接超时**
   - 检查MinIO服务器状态
   - 验证网络连接和端口开放
   - 确认防火墙设置

### 查看日志
```bash
# 查看Edge Function日志（如有Supabase CLI）
supabase functions logs minio-video-upload
supabase functions logs minio-video-stream  
supabase functions logs minio-video-delete
```

## 📈 性能优化建议

1. **网络优化**
   - 考虑配置CDN加速视频访问
   - 优化MinIO服务器网络带宽

2. **存储优化**
   - 定期清理未使用的视频文件
   - 考虑压缩大视频文件

3. **缓存策略**
   - 配置适当的HTTP缓存头
   - 使用预签名URL缓存

## 🎉 恭喜！

您的MinIO视频管理模块已经成功配置完成！现在可以：

1. 打开 `test_minio_connection.html` 测试连接
2. 访问MinIO控制台创建videos存储桶
3. 在系统中使用MinIO视频管理功能

如有任何问题，请检查MinIO服务器状态和网络连接。 