#!/bin/bash

echo "🔒 安全检查脚本"
echo "=================="

# 检查敏感文件是否被Git忽略
echo "📋 检查.gitignore配置..."
if grep -q ".env" .gitignore; then
    echo "✅ .env文件已被忽略"
else
    echo "❌ 警告：.env文件未被忽略！"
    exit 1
fi

# 检查是否存在硬编码的API密钥
echo "🔍 检查硬编码的API密钥..."
if grep -r "eyJ" src/ --exclude-dir=node_modules 2>/dev/null; then
    echo "❌ 警告：发现可能的硬编码JWT密钥！"
    exit 1
else
    echo "✅ 未发现硬编码的JWT密钥"
fi

# 检查是否存在硬编码的URL
echo "🌐 检查硬编码的Supabase URL..."
if grep -r "https://.*\.supabase\.co" src/ --exclude-dir=node_modules 2>/dev/null; then
    echo "❌ 警告：发现硬编码的Supabase URL！"
    exit 1
else
    echo "✅ 未发现硬编码的Supabase URL"
fi

# 检查环境变量配置
echo "🔧 检查环境变量配置..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local文件存在"
else
    echo "⚠️  提醒：.env.local文件不存在，请创建并配置"
fi

if [ -f ".env.example" ]; then
    echo "✅ .env.example模板文件存在"
else
    echo "❌ 警告：.env.example模板文件不存在！"
    exit 1
fi

echo "=================="
echo "🎉 安全检查完成！代码库现在可以安全地公开到GitHub。" 