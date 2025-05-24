# 🚀 Vercel部署指南

## 📋 部署前准备

### 1. 提交代码到GitHub

```bash
# 添加所有文件到Git
git add .

# 提交代码
git commit -m "feat: 完成安全配置，准备部署到Vercel"

# 推送到GitHub
git push origin main
```

## 🌟 Vercel部署步骤

### 第一步：连接GitHub

1. 访问 [https://vercel.com](https://vercel.com)
2. 使用GitHub账号登录
3. 点击 **"New Project"**
4. 选择您的GitHub仓库

### 第二步：配置项目设置

在Vercel的项目配置页面：

**Framework Preset:** `Vite`
**Root Directory:** `./` (默认)
**Build Command:** `npm run build`
**Output Directory:** `dist`
**Install Command:** `npm install`

### 第三步：配置环境变量 ⚠️ 重要！

在 **Environment Variables** 部分添加以下变量：

| 变量名 | 值 | 环境 |
|--------|----|----|
| `VITE_SUPABASE_URL` | `https://sxsyprzckdnfyhadodhj.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs` | Production, Preview, Development |

#### 💡 如何添加环境变量：

1. 在项目设置页面，找到 **Environment Variables** 部分
2. 点击 **Add New**
3. 输入变量名（如 `VITE_SUPABASE_URL`）
4. 输入变量值
5. 选择环境（建议选择所有：Production, Preview, Development）
6. 点击 **Add**
7. 重复步骤添加 `VITE_SUPABASE_ANON_KEY`

### 第四步：部署

1. 确认所有配置无误后，点击 **Deploy**
2. 等待构建完成（通常2-5分钟）
3. 部署成功后，您将获得一个Vercel域名

## 🔧 部署后配置

### 更新Supabase设置

1. 登录 [Supabase控制台](https://supabase.com/dashboard)
2. 进入您的项目设置
3. 在 **Authentication > URL Configuration** 中添加：
   - **Site URL:** `https://your-app.vercel.app`
   - **Redirect URLs:** `https://your-app.vercel.app/**`

### 测试部署

访问您的Vercel域名，确认：
- ✅ 应用正常加载
- ✅ 登录功能正常
- ✅ 数据库连接正常
- ✅ 所有功能可用

## 🔄 自动部署

现在每当您向GitHub推送代码时，Vercel会自动：
1. 检测代码变更
2. 触发新的构建
3. 自动部署到生产环境

## 🌐 自定义域名（可选）

如果您有自己的域名：

1. 在Vercel项目设置中点击 **Domains**
2. 添加您的域名
3. 按照提示配置DNS记录
4. 等待DNS生效

## 📊 监控和分析

Vercel提供以下监控功能：
- **Real-time logs** - 实时日志
- **Analytics** - 访问分析
- **Performance insights** - 性能洞察
- **Error tracking** - 错误追踪

## 🛠️ 故障排除

### 常见问题

**1. 构建失败**
- 检查环境变量是否正确配置
- 查看构建日志中的错误信息
- 确保所有依赖都在package.json中

**2. 运行时错误**
- 检查浏览器控制台错误
- 确认Supabase连接正常
- 检查API密钥权限

**3. 路由问题**
- 确认vercel.json配置正确
- SPA路由重写规则已配置

### 重新部署

如果需要重新部署：
1. 在Vercel控制台找到您的项目
2. 点击 **Deployments** 页面
3. 点击最新部署右侧的 **⋯** 菜单
4. 选择 **Redeploy**

## 📞 获取帮助

- [Vercel文档](https://vercel.com/docs)
- [Supabase文档](https://supabase.com/docs)
- [项目GitHub Issues](https://github.com/your-repo/issues)

---

🎉 **恭喜！您的应用现已成功部署到Vercel！** 