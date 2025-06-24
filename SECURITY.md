# 🛡️ 安全配置指南

## 🔐 环境变量配置

### 本地开发环境

在项目根目录创建 `.env` 文件：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### GitHub Actions Secrets

在GitHub仓库中配置以下Secrets：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TEST_ACCOUNT` (登录健康检查用)
- `TEST_PASSWORD` (登录健康检查用)

## 🔧 环境配置

### 1. 本地开发环境设置

1. 复制环境变量模板：
```bash
cp .env.example .env.local
```

2. 编辑 `.env.local` 文件，填入您的真实Supabase配置：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 2. 生产环境部署

在您的部署平台（如Vercel、Netlify等）中设置以下环境变量：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Supabase CLI配置

编辑 `supabase/config.toml`，替换为您的真实项目ID：
```toml
project_id = "your_real_project_id"
```

## 🔒 安全最佳实践

1. **永远不要提交 `.env.local` 文件**
2. **确保 `.gitignore` 包含所有环境变量文件**
3. **定期轮换API密钥**
4. **使用行级安全策略（RLS）保护数据库**
5. **在生产环境中启用两因素认证**

## 📋 检查清单

在公开代码库之前，请确认：

- [ ] 所有硬编码的API密钥已移除
- [ ] `.env.local` 文件已添加到 `.gitignore`
- [ ] 环境变量正确配置
- [ ] 应用能正常运行
- [ ] 没有其他敏感信息泄露

## 🆘 如果密钥已泄露

1. 立即到Supabase控制台重新生成API密钥
2. 更新所有环境配置
3. 检查访问日志是否有异常活动
4. 考虑重置数据库凭证

## ⚠️ 安全要求

1. **禁止硬编码密钥**：任何密钥都不得直接写在代码中
2. **使用环境变量**：通过 `import.meta.env` 访问环境变量
3. **定期轮换密钥**：建议每3-6个月更换一次
4. **最小权限原则**：只使用必要的权限

## 🚨 紧急处理

如果密钥泄露：

1. 立即在Supabase控制台重新生成密钥
2. 更新所有环境变量配置
3. 检查Git历史，确保没有敏感信息
4. 通知团队成员更新本地配置

## ✅ 安全检查清单

- [ ] 所有密钥都通过环境变量管理
- [ ] `.env` 文件已加入 `.gitignore`
- [ ] GitHub Secrets配置正确
- [ ] 代码中无硬编码密钥
- [ ] 定期检查密钥有效性 