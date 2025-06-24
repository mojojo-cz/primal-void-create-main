#!/usr/bin/env node
/**
 * 视频URL刷新功能测试脚本（状态分类优化版）
 * 用于验证Edge Function和环境变量配置是否正确
 * 新增对 expired、expiring_soon、valid 三种状态的测试
 */

const SUPABASE_URL = 'https://sxsyprzckdnfyhadodhj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c3lwcnpja2RuZnloYWRvZGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTUyMDQsImV4cCI6MjA2MzEzMTIwNH0.7_hXOZTGPx29KGCYCgTYNLi8Ys-eHOAb0o8htiJd_Rs';

// 状态图标和颜色映射
const STATUS_DISPLAY = {
  valid: { icon: '✅', color: '\x1b[32m', text: '有效' },
  expired: { icon: '❌', color: '\x1b[31m', text: '已过期' },
  expiring_soon: { icon: '⚠️', color: '\x1b[33m', text: '即将过期' },
  refreshed: { icon: '🔄', color: '\x1b[34m', text: '已刷新' },
  failed: { icon: '💥', color: '\x1b[31m', text: '失败' }
};

const RESET_COLOR = '\x1b[0m';

async function testUrlRefresh(action = 'check') {
  console.log(`🧪 开始测试URL刷新功能 (${action})...`);
  console.log(`⏰ 测试时间: ${new Date().toISOString()}`);
  console.log('─'.repeat(60));

  try {
    const startTime = Date.now();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/minio-url-refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action,
        batchSize: 50,
        onlyExpired: false
      })
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('🎉 测试成功！');
    console.log(`⚡ 响应时间: ${duration}ms`);
    console.log('');
    
    // 显示统计信息
    console.log('📊 统计概览:');
    console.log(`   📹 总视频数: ${result.total}`);
    console.log(`   ⚠️ 需刷新数: ${result.expired}`);
    console.log(`   🔄 已刷新数: ${result.refreshed || 0}`);
    console.log(`   💥 失败数: ${result.failed || 0}`);
    console.log('');
    
    // 按状态分组显示
    if (result.details && result.details.length > 0) {
      console.log('📋 详细状态分析:');
      
      const statusGroups = {
        valid: [],
        expired: [],
        expiring_soon: [],
        refreshed: [],
        failed: []
      };
      
      // 分组统计
      result.details.forEach(video => {
        if (statusGroups[video.status]) {
          statusGroups[video.status].push(video);
        }
      });
      
      // 显示各状态的视频
      Object.entries(statusGroups).forEach(([status, videos]) => {
        if (videos.length > 0) {
          const display = STATUS_DISPLAY[status] || { icon: '❓', color: '', text: status };
          console.log(`\n${display.icon} ${display.color}${display.text} (${videos.length}个)${RESET_COLOR}:`);
          
          videos.forEach((video, index) => {
            const prefix = index === videos.length - 1 ? '   └─' : '   ├─';
            console.log(`${prefix} ${video.title}`);
            
            if (video.oldExpiry) {
              const expiryDate = new Date(video.oldExpiry);
              const now = new Date();
              const timeUntilExpiry = expiryDate.getTime() - now.getTime();
              const hoursLeft = Math.round(timeUntilExpiry / (1000 * 60 * 60));
              
              if (timeUntilExpiry <= 0) {
                console.log(`${prefix.replace(/[├└]/, ' ')}   过期时间: ${expiryDate.toLocaleString()} (已过期 ${Math.abs(hoursLeft)} 小时)`);
              } else {
                console.log(`${prefix.replace(/[├└]/, ' ')}   过期时间: ${expiryDate.toLocaleString()} (剩余 ${hoursLeft} 小时)`);
              }
            }
            
            if (video.error) {
              console.log(`${prefix.replace(/[├└]/, ' ')}   ❌ 错误: ${video.error}`);
            }
            
            if (video.newExpiry) {
              const newExpiryDate = new Date(video.newExpiry);
              console.log(`${prefix.replace(/[├└]/, ' ')}   🆕 新过期时间: ${newExpiryDate.toLocaleString()}`);
            }
          });
        }
      });
    }
    
    // 显示错误信息
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('');
    console.log('✅ 测试完成');
    
    // 提供下一步建议
    if (action === 'check') {
      const needRefresh = result.expired || 0;
      if (needRefresh > 0) {
        console.log(`💡 建议: 发现 ${needRefresh} 个视频需要刷新URL，可以运行 'node test-url-refresh.js refresh' 来刷新它们`);
      } else {
        console.log('😊 所有视频URL状态良好，无需刷新');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('');
    console.error('🔧 排查建议:');
    console.error('   1. 检查Supabase Edge Function是否正常部署');
    console.error('   2. 检查环境变量配置是否完整');
    console.error('   3. 检查MinIO服务是否可访问');
    console.error('   4. 检查网络连接状态');
    
    return false;
  }
}

// 解析命令行参数
const action = process.argv[2] || 'check';

if (!['check', 'refresh'].includes(action)) {
  console.error('❌ 无效的操作类型');
  console.error('用法: node test-url-refresh.js [check|refresh]');
  console.error('   check   - 检查视频URL状态（默认）');
  console.error('   refresh - 刷新过期的视频URL');
  process.exit(1);
}

console.log('🚀 视频URL状态分类优化测试工具');
console.log('━'.repeat(60));

testUrlRefresh(action).then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试运行异常:', error);
  process.exit(1);
}); 