const express = require('express');
const cors = require('cors');
const app = express();

// 安全配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
const NODE_ENV = process.env.NODE_ENV || 'development';

// 检查必需的环境变量
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY 环境变量未设置');
  process.exit(1);
}

// CORS配置
app.use(cors({
  origin: NODE_ENV === 'production' ? ALLOWED_ORIGINS : ['http://localhost:3000'],
  credentials: false,
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
}));

// 基础限流 (简化版)
const requestCounts = new Map();
const RATE_LIMIT = 10; // 每分钟10个请求
const WINDOW_MS = 60 * 1000; // 1分钟

const rateLimiter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  
  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, []);
  }
  
  const requests = requestCounts.get(clientIP).filter(time => time > windowStart);
  
  if (requests.length >= RATE_LIMIT) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
  
  requests.push(now);
  requestCounts.set(clientIP, requests);
  next();
};

// 输入验证
const validateInput = (req, res, next) => {
  const { message } = req.query;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '消息不能为空' });
  }
  
  if (message.length > 4000) {
    return res.status(400).json({ error: '消息长度不能超过4000字符' });
  }
  
  next();
};

// GET请求处理 - 用于EventSource连接
app.get('/api/chat-stream', rateLimiter, validateInput, async (req, res) => {
  const { message, context, conversationHistory, model, maxTokens, temperature } = req.query;

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });

  try {
    // 解析查询参数
    const parsedConversationHistory = conversationHistory ? JSON.parse(decodeURIComponent(conversationHistory)) : [];
    
    // 构建消息
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的编程助手，专门帮助用户解决 React/TypeScript 相关问题。请用中文回答，提供准确实用的建议。'
      },
      // 对话历史
      ...parsedConversationHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: context ? `上下文：${context}\n\n问题：${message}` : message
      }
    ];

    // 调用OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: messages,
        stream: true,
        max_tokens: maxTokens || 1000,
        temperature: temperature || 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 发送完成信号
          res.write('data: [DONE]\n\n');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                // 发送内容块
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    // 发送错误信息
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SSE API server running on port ${PORT}`);
});
