# MinIO视频管理模块 - 完整设置指南

## 🎯 项目概述

本项目现已成功集成MinIO视频管理模块，提供与现有视频管理功能相同的用户体验，但视频文件存储在您自己的MinIO对象存储服务器上。

## 📁 新增文件和功能

### 1. 前端组件
- `src/pages/admin/MinIOVideoManagement.tsx` - MinIO视频管理主页面
- 在 `src/pages/admin/AdminLayout.tsx` 中添加了新的导航菜单项
- 在 `src/App.tsx` 中添加了路由配置

### 2. 数据库迁移
- `supabase/migrations/20240101000000_create_minio_videos_table.sql` - 创建MinIO视频元数据表

### 3. Supabase Edge Functions
- `supabase/functions/minio-video-upload/index.ts` - 处理视频上传到MinIO
- `supabase/functions/minio-video-stream/index.ts` - 处理视频流式访问
- `supabase/functions/minio-video-delete/index.ts` - 处理视频删除

### 4. 文档
- `MINIO_SETUP.md` - 详细的MinIO配置指南
- `README_MINIO_SETUP.md` - 本文件，完整设置说明

## 🚀 快速开始

### 步骤1: 安装Supabase CLI（如果尚未安装）

```bash
# 使用npm安装
npm install -g @supabase/cli

# 或使用yarn
yarn global add @supabase/cli

# 或使用homebrew (macOS)
brew install supabase/tap/supabase
```

### 步骤2: 应用数据库迁移

```bash
# 在项目根目录运行
supabase db push
```

这将创建 `minio_videos` 表来存储视频元数据。

### 步骤3: 部署Edge Functions

```bash
# 登录Supabase（如果尚未登录）
supabase login

# 部署所有MinIO相关的Edge Functions
supabase functions deploy minio-video-upload
supabase functions deploy minio-video-stream
supabase functions deploy minio-video-delete
```

### 步骤4: 配置环境变量

在Supabase项目的设置中添加以下环境变量：

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 Settings > Edge Functions
4. 添加以下环境变量：

```env
MINIO_ENDPOINT=your-minio-server:9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=videos
MINIO_USE_SSL=false
```

### 步骤5: 设置MinIO服务器

#### 使用Docker（推荐）

```bash
# 创建数据目录
mkdir -p ~/minio/data

# 运行MinIO容器
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -v ~/minio/data:/data \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin123" \
  quay.io/minio/minio server /data --console-address ":9001"
```

#### 创建存储桶

1. 访问 http://localhost:9001
2. 使用用户名 `minioadmin` 和密码 `minioadmin123` 登录
3. 点击 "Create Bucket"
4. 输入名称 `videos`
5. 点击 "Create Bucket"

## 🔧 功能特性

### MinIO视频管理界面包含：

1. **视频上传**
   - 支持多种视频格式
   - 自动元数据提取
   - 进度显示

2. **视频浏览**
   - 列表视图和网格视图
   - 搜索功能
   - 分页支持

3. **视频播放**
   - 安全的预签名URL访问
   - 内置视频播放器
   - 全屏支持

4. **视频管理**
   - 删除功能（同时删除MinIO文件和数据库记录）
   - 视频信息编辑
   - 批量操作

## 🔐 权限控制

MinIO视频管理模块继承了现有的权限系统：

- **管理员账号**: 完全访问权限
- **教师账号**: 受限访问（与常规视频管理相同）
- **学生账号**: 无法访问管理功能

## 🛡️ 安全考虑

1. **访问控制**
   - 所有操作通过Supabase Edge Functions进行
   - MinIO凭据不暴露给前端
   - 预签名URL有时间限制

2. **文件验证**
   - 严格的文件类型检查
   - 文件大小限制
   - 恶意文件检测

3. **网络安全**
   - CORS配置
   - HTTPS支持（生产环境）

## 📊 监控和日志

### 查看Edge Function日志

```bash
# 查看上传功能日志
supabase functions logs minio-video-upload

# 查看流式传输日志
supabase functions logs minio-video-stream

# 查看删除功能日志
supabase functions logs minio-video-delete
```

### MinIO监控

访问 MinIO控制台的监控页面查看：
- 存储使用情况
- API请求统计
- 性能指标

## 🐛 故障排除

### 常见问题及解决方案

1. **"无法连接到MinIO服务器"**
   - 检查MinIO服务器是否运行：`docker ps`
   - 验证端口是否正确开放
   - 检查防火墙设置

2. **"上传失败"**
   - 检查存储桶是否存在
   - 验证MinIO凭据
   - 查看Edge Function日志

3. **"视频无法播放"**
   - 检查预签名URL是否过期
   - 验证文件是否存在于MinIO中
   - 检查网络连接

### 获取帮助

如果遇到问题：
1. 查看浏览器开发者工具的控制台
2. 检查Supabase Edge Functions日志
3. 查看MinIO服务器日志：`docker logs minio`

## 🚀 生产环境部署

### MinIO生产配置

1. **高可用性**
   ```bash
   # 分布式MinIO部署示例
   docker-compose up -d
   ```

2. **SSL配置**
   - 配置HTTPS证书
   - 更新 `MINIO_USE_SSL=true`

3. **备份策略**
   - 配置定期备份
   - 实施跨区域复制

### 性能优化

1. **CDN配置**
   - 配置CloudFlare或AWS CloudFront
   - 缓存静态视频内容

2. **存储优化**
   - 使用SSD存储
   - 配置适当的磁盘阵列

## 📝 更新日志

- **v1.0.0** - 初始版本
  - MinIO视频上传功能
  - 视频流式播放
  - 基础管理界面
  - 权限控制集成

## 🤝 贡献

欢迎提交问题和改进建议！

## �� 许可证

本项目遵循原项目的许可证。 