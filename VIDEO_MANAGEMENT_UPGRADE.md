# 视频管理模块升级文档

## 🚀 升级概述

### 升级前后对比

| 特性 | 升级前 | 升级后 |
|------|--------|--------|
| 存储方案 | Supabase Storage | MinIO对象存储 |
| 上传方式 | 传统文件上传 | 预签名URL安全上传 |
| 文件大小限制 | Supabase限制 | 最大50GB |
| 安全性 | 中等 | 企业级安全 |
| 数据表 | `videos` | `minio_videos` |
| 播放方式 | 直接URL | Edge Function流式 |

## 🔧 升级内容

### 1. 核心组件更新

#### VideoManagement.tsx
- **数据源切换**：从 `videos` 表改为 `minio_videos` 表
- **上传组件替换**：使用 `VideoUploadToMinIO` 组件
- **播放功能升级**：通过Edge Function流式播放
- **删除功能增强**：同时删除数据库记录和MinIO对象
- **界面优化**：添加MinIO图标和安全标识

#### VideoUploadToMinIO.tsx (新组件)
- **预签名URL上传**：前端不暴露MinIO密钥
- **实时进度监控**：显示上传速度和ETA
- **文件验证**：自动文件类型和大小检查
- **安全特性**：文件名自动清理和唯一化

### 2. 数据库结构

#### minio_videos表结构
```sql
CREATE TABLE minio_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  minio_object_name TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 主要字段说明
- `minio_object_name`：MinIO对象名称，用于播放和删除
- `file_size`：文件大小（字节），用于显示和统计
- `content_type`：MIME类型，用于正确播放

### 3. Edge Functions集成

#### minio-presigned-upload
- **功能**：生成预签名上传URL
- **安全**：使用环境变量存储MinIO配置
- **验证**：文件名清理和权限控制
- **返回**：上传URL和下载URL

#### minio-video-stream
- **功能**：生成视频流播放URL
- **性能**：优化的流式传输
- **兼容性**：支持多种视频格式

#### minio-video-delete
- **功能**：删除MinIO对象
- **安全**：权限验证和错误处理
- **清理**：彻底删除存储对象

### 4. 用户界面升级

#### 视觉标识
- 🗄️ **MinIO图标**：列表和网格视图中的Database图标
- 🛡️ **安全标签**：预签名URL安全上传标识
- 📊 **文件大小显示**：新增文件大小列
- 🏷️ **大文件标识**：>50MB文件的特殊标记

#### 功能增强
- **进度监控**：实时上传进度和速度显示
- **拖拽上传**：支持拖拽选择文件
- **错误处理**：详细的错误信息和重试机制
- **响应式设计**：移动端友好界面

## 🔒 安全特性

### 预签名URL优势
1. **前端安全**：不暴露MinIO访问密钥
2. **临时权限**：URL有效期限制（默认1小时）
3. **文件验证**：自动文件类型和大小检查
4. **路径安全**：文件名自动清理和唯一化

### 环境变量配置
```bash
MINIO_ENDPOINT=115.159.33.45
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=***
MINIO_SECRET_KEY=***
MINIO_BUCKET_NAME=videos
```

## 📊 性能提升

### 上传性能
- **大文件支持**：最大50GB
- **断点续传**：网络中断自动恢复
- **并发上传**：多文件同时上传
- **进度监控**：实时速度和ETA

### 播放性能
- **流式传输**：Edge Function优化
- **CDN加速**：MinIO分布式存储
- **格式兼容**：支持多种视频格式
- **自适应码率**：根据网络状况调整

## 🚀 部署指南

### 1. 环境变量配置
在Supabase控制台的Edge Functions设置中添加MinIO环境变量。

### 2. 数据库迁移
运行迁移脚本创建`minio_videos`表。

### 3. Edge Functions部署
部署三个MinIO相关的Edge Functions。

### 4. 前端更新
更新视频管理组件和相关页面。

## 📈 监控和维护

### 健康检查
- MinIO连接状态
- Edge Function响应时间
- 上传成功率统计
- 存储空间使用情况

### 日志记录
- 上传操作日志
- 播放访问日志
- 错误详情记录
- 性能指标收集

## 🔄 回滚计划

### 紧急回滚
1. 切换数据源回`videos`表
2. 恢复原始上传组件
3. 暂停MinIO Edge Functions
4. 启用Supabase Storage

### 数据同步
- 保持两套数据并行运行
- 定期同步新上传的视频
- 验证数据完整性

## 📋 测试清单

### 功能测试
- [ ] 视频上传功能
- [ ] 文件大小验证
- [ ] 进度显示正确
- [ ] 视频播放正常
- [ ] 删除功能完整
- [ ] 搜索和筛选
- [ ] 分页导航

### 性能测试
- [ ] 大文件上传(>1GB)
- [ ] 并发上传测试
- [ ] 网络中断恢复
- [ ] 播放流畅度
- [ ] 响应时间<2秒

### 安全测试
- [ ] 无效文件拒绝
- [ ] 超大文件限制
- [ ] 权限验证正确
- [ ] 敏感信息保护

## 📞 技术支持

### 故障排除
1. **上传失败**：检查MinIO连接和权限
2. **播放异常**：验证Edge Function状态
3. **性能问题**：监控网络和存储负载
4. **权限错误**：检查环境变量配置

### 联系信息
- 技术负责人：系统管理员
- 文档维护：开发团队
- 更新时间：2024年1月

---

## 🎉 升级完成

✅ 视频管理模块已成功升级到MinIO预签名URL架构  
✅ 实现企业级安全和性能  
✅ 支持大文件上传和流式播放  
✅ 完整的用户界面和体验优化 