# 🚀 Vercel环境变量配置指南

## ⚠️ 重要提醒
由于我们刚刚将硬编码的API密钥改为环境变量，您的Vercel部署现在需要配置环境变量才能正常工作。

## 📋 需要配置的环境变量

您需要在Vercel中配置以下两个环境变量：

| 变量名 | 值 | 说明 |
|-------|----|----|
| `VITE_SUPABASE_URL` | `https://sxsyprzckdnfyhadodhj.supabase.co` | Supabase项目URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs` | Supabase匿名密钥 |

## 🔧 详细配置步骤

### 步骤1：访问Vercel Dashboard
1. 打开 [Vercel Dashboard](https://vercel.com/dashboard)
2. 登录您的账号
3. 找到您的项目并点击进入

### 步骤2：进入环境变量设置
1. 在项目页面，点击顶部的 **"Settings"** 标签
2. 在左侧菜单中找到并点击 **"Environment Variables"**

### 步骤3：添加第一个环境变量
1. 点击 **"Add New"** 按钮
2. **Name**: 输入 `VITE_SUPABASE_URL`
3. **Value**: 输入 `https://sxsyprzckdnfyhadodhj.supabase.co`
4. **Environments**: 选中所有环境 ✅ Production ✅ Preview ✅ Development
5. 点击 **"Save"** 保存

### 步骤4：添加第二个环境变量
1. 再次点击 **"Add New"** 按钮
2. **Name**: 输入 `VITE_SUPABASE_ANON_KEY`
3. **Value**: 输入 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs`
4. **Environments**: 选中所有环境 ✅ Production ✅ Preview ✅ Development
5. 点击 **"Save"** 保存

### 步骤5：触发重新部署
配置完环境变量后，Vercel会自动触发新的部署。如果没有自动部署，您可以：

#### 选项A：等待自动部署（推荐）
由于我们刚刚推送了代码到GitHub，Vercel应该会自动开始新的部署。

#### 选项B：手动触发重新部署
1. 切换到 **"Deployments"** 标签
2. 找到最新的部署
3. 点击部署右侧的三个点 **"..."**
4. 选择 **"Redeploy"**
5. 确认重新部署

## ✅ 验证部署状态

1. 在 **"Deployments"** 页面监控部署进度
2. 等待部署状态变为 **"Ready"**
3. 点击部署URL访问您的应用
4. 检查应用是否能正常登录和使用

## ⚡ 自动部署已触发

✅ 我们刚刚已经推送了代码更改到GitHub
✅ Vercel应该已经开始自动部署
✅ 您只需要配置环境变量即可

## 🎯 预期结果

配置完成后，您的应用将能够：
- ✅ 正常连接到Supabase数据库
- ✅ 用户登录功能正常工作
- ✅ 系统设置功能正常
- ✅ 视频播放功能正常

## 🆘 如果遇到问题

1. **部署失败**：检查Vercel的部署日志，通常是环境变量配置错误
2. **应用无法访问数据库**：确认环境变量名称和值完全正确
3. **页面显示错误**：可能是环境变量尚未生效，等待几分钟后刷新

## 📱 移动端提醒

请确保在所有环境（Production、Preview、Development）中都配置了环境变量，这样预览部署和开发环境也能正常工作。 