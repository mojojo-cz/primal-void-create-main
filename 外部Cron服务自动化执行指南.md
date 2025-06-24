# 外部Cron服务自动化执行指南

## 🎯 目标

实现视频URL定时刷新的自动化执行，确保所有视频URL都在有效期内，无需手动干预。

## 🔄 自动化方案概览

| 方案 | 优势 | 劣势 | 推荐度 |
|------|------|------|--------|
| GitHub Actions | 免费、集成度高、版本控制 | 依赖GitHub | ⭐⭐⭐⭐⭐ |
| Vercel Cron | 简单易用、与前端部署集成 | 免费版限制 | ⭐⭐⭐⭐ |
| Netlify Functions | 部署简单、性能好 | 有使用限制 | ⭐⭐⭐ |
| UptimeRobot | 专业监控、可靠性高 | 功能相对基础 | ⭐⭐⭐ |
| EasyCron | 专业Cron服务 | 付费服务 | ⭐⭐ |

## 🚀 方案1：GitHub Actions（推荐）

### 优势
- ✅ 完全免费
- ✅ 与代码仓库集成
- ✅ 支持复杂的调度逻辑
- ✅ 提供详细的执行日志
- ✅ 支持多种触发条件

### 实施步骤

#### 1. 创建GitHub Actions工作流

在项目根目录创建`.github/workflows/url-refresh.yml`：

```yaml
name: 视频URL定时刷新

on:
  schedule:
    # 每6小时执行一次 (北京时间: 2:00, 8:00, 14:00, 20:00)
    - cron: '0 18,0,6,12 * * *'  # UTC时间
  workflow_dispatch:  # 允许手动触发

jobs:
  refresh-video-urls:
    runs-on: ubuntu-latest
    name: 刷新视频URL
    
    steps:
      - name: 检查和刷新过期URL
        run: |
          echo "开始执行视频URL刷新任务..."
          
          # 调用Supabase Edge Function
          RESPONSE=$(curl -s -X POST \
            "https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-url-refresh" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "action": "refresh",
              "onlyExpired": true,
              "batchSize": 50
            }')
          
          echo "API响应: $RESPONSE"
          
          # 检查响应是否成功
          SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
          
          if [ "$SUCCESS" = "true" ]; then
            REFRESHED=$(echo "$RESPONSE" | jq -r '.result.refreshed // 0')
            FAILED=$(echo "$RESPONSE" | jq -r '.result.failed // 0')
            TOTAL=$(echo "$RESPONSE" | jq -r '.result.total // 0')
            
            echo "✅ URL刷新任务完成"
            echo "📊 处理统计: 总计${TOTAL}个，刷新${REFRESHED}个，失败${FAILED}个"
            
            if [ "$FAILED" -gt 0 ]; then
              echo "⚠️  有${FAILED}个URL刷新失败，请检查日志"
              exit 1
            fi
          else
            ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "未知错误"')
            echo "❌ URL刷新任务失败: $ERROR_MSG"
            exit 1
          fi

      - name: 发送通知（可选）
        if: failure()
        run: |
          echo "URL刷新任务失败，需要人工检查"
          # 这里可以添加邮件、Slack、微信等通知逻辑
```

#### 2. 配置GitHub Secrets

在GitHub仓库中设置以下Secrets：

1. 进入GitHub仓库 → Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加以下密钥：

```
名称: SUPABASE_ANON_KEY
值: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs
```

#### 3. 测试和监控

- **手动测试**：在Actions页面点击"Run workflow"
- **查看日志**：每次执行后检查日志输出
- **设置通知**：配置GitHub通知或邮件提醒

## 🌐 方案2：Vercel Cron Jobs

### 优势
- ✅ 与Vercel部署集成
- ✅ 配置简单
- ✅ 免费配额充足

### 实施步骤

#### 1. 创建Vercel Function

在项目中创建`api/cron/refresh-urls.js`：

```javascript
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 验证Cron请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('开始执行视频URL刷新任务...');

    const response = await fetch(
      'https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-url-refresh',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refresh',
          onlyExpired: true,
          batchSize: 50
        })
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log(`✅ 刷新完成: 处理${result.result.total}个，刷新${result.result.refreshed}个`);
      return res.status(200).json({
        success: true,
        message: 'URL刷新任务完成',
        stats: result.result
      });
    } else {
      console.error('❌ 刷新失败:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Cron任务执行失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

#### 2. 配置vercel.json

```json
{
  "functions": {
    "api/cron/refresh-urls.js": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/cron/refresh-urls",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

#### 3. 设置环境变量

在Vercel控制台中添加环境变量：
```
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs
```

## 🔗 方案3：UptimeRobot监控触发

### 优势
- ✅ 专业监控服务
- ✅ 高可靠性
- ✅ 支持多种通知方式

### 实施步骤

#### 1. 创建触发端点

创建一个简单的API端点`api/trigger-refresh.js`：

```javascript
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      'https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-url-refresh',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refresh',
          onlyExpired: true,
          batchSize: 30
        })
      }
    );

    const result = await response.json();
    
    if (result.success) {
      return res.status(200).json({
        status: 'success',
        message: 'URL refresh completed',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        status: 'error',
        error: result.error
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
}
```

#### 2. 配置UptimeRobot

1. 注册UptimeRobot账号：https://uptimerobot.com
2. 创建新的监控：
   - **Type**: HTTP(s)
   - **URL**: `https://your-domain.vercel.app/api/trigger-refresh`
   - **Monitoring Interval**: 6小时
   - **HTTP Method**: GET

## 🛠 方案4：EasyCron专业服务

### 优势
- ✅ 专业Cron服务
- ✅ 高精度调度
- ✅ 详细日志记录

### 实施步骤

1. **注册EasyCron**：https://www.easycron.com
2. **创建Cron Job**：
   ```
   URL: https://sxsyprzckdnfyhadodhj.supabase.co/functions/v1/minio-url-refresh
   Method: POST
   Headers: 
     Authorization: Bearer YOUR_SUPABASE_ANON_KEY
     Content-Type: application/json
   Body: {"action":"refresh","onlyExpired":true,"batchSize":50}
   Schedule: 0 */6 * * *
   ```

## 📊 监控和维护

### 1. 执行日志监控

```bash
# GitHub Actions日志
# 访问: https://github.com/your-repo/actions

# Vercel Function日志  
# 访问: https://vercel.com/dashboard → Functions → Logs

# Supabase Edge Function日志
supabase functions logs minio-url-refresh --follow
```

### 2. 关键指标

- **执行成功率**：≥ 95%
- **平均执行时间**：< 30秒
- **刷新成功率**：≥ 98%
- **失败处理**：自动重试机制

### 3. 告警设置

```yaml
# GitHub Actions失败通知
- name: 发送失败通知
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: '视频URL刷新任务失败，需要人工检查'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## 🔧 故障排除

### 常见问题

1. **执行超时**
   - 增加`batchSize`参数
   - 分批处理大量视频

2. **认证失败**
   - 检查SUPABASE_ANON_KEY是否正确
   - 确认密钥未过期

3. **网络连接问题**
   - 添加重试机制
   - 设置合理的超时时间

### 紧急处理

如果自动化服务失效：

1. **手动触发**：在管理员界面手动执行
2. **临时脚本**：使用curl命令临时执行
3. **监控告警**：及时发现和处理问题

## 📈 性能优化建议

### 1. 调度频率优化

```
高频场景（大量用户）: 每2小时执行一次
中频场景（中等用户）: 每6小时执行一次  
低频场景（少量用户）: 每12小时执行一次
```

### 2. 批处理优化

```json
{
  "action": "refresh",
  "onlyExpired": true,
  "batchSize": 50,  // 根据系统负载调整
  "hoursThreshold": 24  // 提前刷新时间
}
```

### 3. 错误恢复

```javascript
// 指数退避重试
const maxRetries = 3;
let retryCount = 0;

while (retryCount < maxRetries) {
  try {
    const result = await callRefreshAPI();
    break;
  } catch (error) {
    retryCount++;
    await sleep(Math.pow(2, retryCount) * 1000);
  }
}
```

## 🎉 总结

推荐使用**GitHub Actions**方案，因为它：

1. ✅ **完全免费**且可靠
2. ✅ **与代码版本控制集成**
3. ✅ **支持复杂调度逻辑**
4. ✅ **提供详细执行日志**
5. ✅ **易于维护和扩展**

配置完成后，系统将自动：
- 每6小时检查所有视频URL状态
- 自动刷新即将过期的URL
- 记录详细的执行日志
- 在失败时发送通知

这样确保用户永远不会遇到URL过期的问题！ 