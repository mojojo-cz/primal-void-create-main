# 🛡️ 安全配置指南

## ⚠️ 重要提醒

**绝对不要将真实的API密钥提交到Git仓库中！**

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