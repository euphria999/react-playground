

# React Playground - AI编程助手

## 概述

本项目是一个集成AI助手的React在线代码编辑器，支持实时预览和流式AI对话。使用真正的SSE (Server-Sent Events) 实现，提供类似ChatGPT的打字机效果。

## 🌟 核心特性

- 🎯 **实时代码编辑**: Monaco编辑器，支持TypeScript/JavaScript
- 👀 **即时预览**: Vite热更新，实时查看运行效果  
- 🤖 **AI编程助手**: 集成OpenAI，流式回复，智能代码建议
- 🔒 **安全架构**: API Key后端管理，CORS限制
- 📱 **响应式设计**: 支持桌面和移动设备

## 技术架构

```
前端React组件 → AI服务类 → 后端Express API → OpenAI API → SSE流 → 前端UI更新
```

## 设置步骤

### 1. 环境配置

复制环境变量模板：
```bash
cp env.example .env
```

编辑 `.env` 文件，设置你的OpenAI API Key：
```
OPENAI_API_KEY=sk-your-actual-api-key-here
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动完整开发环境

```bash
npm run dev:full
```

这将同时启动：
- 后端服务器 (http://localhost:3001)
- 前端开发服务器 (http://localhost:3000)

或者分别启动：
```bash
# 终端1：启动后端
npm run server

# 终端2：启动前端
npm run dev
```

## 代码结构

### 后端API (`api/chat.js`)
- 处理GET请求（EventSource连接）
- 调用OpenAI API
- 返回SSE格式的流式数据

### 前端AI服务 (`src/ReactPlayground/services/optimizedAI.ts`)
- 使用EventSourcePolyfill连接SSE流
- 解析SSE格式数据
- 实现智能缓冲机制

## 核心特性

1. **真正的SSE实现**：使用标准的Server-Sent Events协议
2. **智能缓冲**：200ms批量更新，减少React重渲染
3. **错误处理**：完善的异常捕获和用户提示
4. **请求取消**：支持中断正在进行的AI响应

## 数据流

```
用户输入 → 前端EventSource连接 → 后端GET请求 → OpenAI流式API → SSE格式数据 → 前端解析 → UI更新
```

## 安全特性

1. **API Key保护**：API Key只在后端环境变量中配置，前端无法访问
2. **CORS限制**：只允许指定域名访问，生产环境自动限制
3. **请求限流**：每个IP每分钟最多10个请求，防止滥用
4. **输入验证**：消息长度限制4000字符，防止恶意输入
5. **环境隔离**：开发和生产环境完全分离配置

## 生产环境部署

在生产环境中，你需要：
1. 将后端API部署到生产服务器
2. 更新前端代码中的API端点
3. 配置HTTPS和适当的安全措施
4. 考虑使用负载均衡器处理高并发

## 故障排除

### 常见问题

1. **后端服务器无法启动**
   - 检查端口3001是否被占用
   - 确认已安装express和cors依赖

2. **前端无法连接后端**
   - 确认后端服务器正在运行
   - 检查CORS配置
   - 验证API端点URL

3. **SSE连接失败**
   - 检查网络连接
   - 验证后端API响应格式
   - 查看浏览器控制台错误信息

## 性能优化

- **缓冲策略**：200ms批量更新优化性能
- **连接复用**：保持HTTP连接开放
- **错误重试**：自动重连机制
- **资源清理**：及时释放连接和缓冲区

这个SSE实现提供了真正的流式体验，比传统的轮询或长轮询方案更加高效和实时。
