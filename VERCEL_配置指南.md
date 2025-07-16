# 🚀 Vercel环境变量配置指南

## ⚠️ 重要提醒
由于我们刚刚将硬编码的API密钥改为环境变量，您的Vercel部署现在需要配置环境变量才能正常工作。

## 📋 需要配置的环境变量

您需要在Vercel中配置以下两个环境变量：

| 变量名 | 值 | 说明 |
|-------|----|----|
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_ID.supabase.co` | Supabase项目URL |
| `VITE_SUPABASE_ANON_KEY` | `YOUR_SUPABASE_ANON_KEY` | Supabase匿名密钥 |

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
3. **Value**: 输入您的Supabase项目URL（格式：`https://YOUR_PROJECT_ID.supabase.co`）
4. **Environments**: 选中所有环境 ✅ Production ✅ Preview ✅ Development
5. 点击 **"Save"** 保存

### 步骤4：添加第二个环境变量
1. 再次点击 **"Add New"** 按钮
2. **Name**: 输入 `VITE_SUPABASE_ANON_KEY`
3. **Value**: 输入您的Supabase匿名密钥
4. **Environments**: 选中所有环境 ✅ Production ✅ Preview ✅ Development
5. 点击 **"Save"** 保存

### 步骤5：触发重新部署
配置完环境变量后，Vercel会自动触发新的部署。如果没有自动部署，您可以：

#### 选项A：等待自动部署（推荐）
- Vercel通常会在环境变量更改后自动部署
- 等待2-3分钟查看部署状态

#### 选项B：手动触发部署
1. 在项目页面点击 **"Deployments"** 标签
2. 点击最新部署旁边的 **"..."** 菜单
3. 选择 **"Redeploy"**
4. 确认重新部署

## 📋 如何获取Supabase配置信息

### 获取项目URL和密钥：
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 **Settings** → **API**
4. 复制以下信息：
   - **Project URL**：形如 `https://YOUR_PROJECT_ID.supabase.co`
   - **Project API keys** → **anon** **public**：这是匿名密钥

## ✅ 验证配置

### 1. 检查部署状态
- 在Vercel Dashboard查看最新部署是否成功
- 状态应显示为 **"Ready"** 或 **"Live"**

### 2. 测试应用功能
- 访问您的Vercel部署URL
- 尝试登录功能
- 检查是否有API连接错误

### 3. 查看日志（如有错误）
- 在 **Functions** 标签查看Serverless Function日志
- 在浏览器开发者工具检查网络请求错误

## 🐛 故障排除

### 问题1：部署失败
**可能原因**：
- 环境变量名称错误
- 环境变量值格式不正确

**解决方案**：
- 检查变量名是否为 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
- 确认URL格式正确（包含 `https://`）
- 验证API密钥是否有效

### 问题2：应用无法连接Supabase
**症状**：
- 登录失败
- 数据加载错误
- 控制台显示网络错误

**解决方案**：
- 检查Supabase项目是否暂停
- 验证API密钥权限
- 确认项目URL正确

### 问题3：环境变量未生效
**解决方案**：
- 确认环境变量已保存
- 手动触发重新部署
- 清除浏览器缓存

## 🔒 安全最佳实践

### 1. 密钥管理
- ✅ 定期轮换Supabase API密钥
- ✅ 监控API使用情况
- ✅ 仅使用必需的权限

### 2. 环境变量安全
- ✅ 不在代码中硬编码敏感信息
- ✅ 定期审查环境变量配置
- ✅ 使用不同环境的不同密钥（如适用）

### 3. 部署安全
- ✅ 启用Vercel的安全头配置
- ✅ 配置适当的CORS策略
- ✅ 监控部署日志

## 🎉 完成

配置完成后，您的应用应该能正常部署和运行。如果遇到问题，请：

1. 检查Vercel部署日志
2. 验证Supabase项目状态
3. 确认环境变量配置正确
4. 联系技术支持（如需要）

---

**注意**：本指南假设您已经有一个正在运行的Supabase项目。如果您需要创建新项目，请先完成Supabase项目设置。 