# optimizedAI.ts 技术指导文档

## 1. 文件作用

`optimizedAI.ts` 是 AI 服务的核心实现，负责：
- 与后端 AI API 的通信
- 实现流式数据接收和处理
- 提供缓冲机制优化用户体验
- 管理 AI 请求的生命周期（创建、取消、错误处理）

## 2. 核心思路拆解

### 为什么需要这样设计
- **流式体验**：实现类似 ChatGPT 的实时打字效果
- **性能优化**：使用缓冲机制减少频繁的 UI 更新
- **请求管理**：支持请求取消，避免资源浪费
- **错误处理**：完整的错误处理和超时机制

### 关键功能实现思路

#### SSE 流式通信
```typescript
// 使用 EventSource 接收服务器推送的数据
this.currentEventSource = new EventSource(`http://localhost:3001/api/chat-stream?${params}`);

// 监听消息事件
this.currentEventSource.onmessage = (event: MessageEvent) => {
  const data = JSON.parse(event.data);
  if (data.content) {
    this.buffer.push(data.content);  // 添加到缓冲区
    // 定时刷新缓冲区
  }
};
```

#### 缓冲优化机制
```typescript
private buffer: string[] = [];
private readonly flushInterval = 200; // 200ms 批量刷新

const flushBuffer = () => {
  if (this.buffer.length > 0) {
    const content = this.buffer.join('');
    this.buffer = [];
    onChunk?.(content);  // 批量更新 UI
  }
};
```

### 核心代码块作用

1. **EventSource 管理**：处理 SSE 连接的创建和销毁
2. **缓冲机制**：优化 UI 更新频率
3. **参数构建**：将前端参数转换为后端 API 格式
4. **错误处理**：处理网络错误、解析错误、超时等

## 3. 分步实现步骤

### 第一步：定义服务类结构
```typescript
export class OptimizedAIService {
  private settings: AISettings;
  private currentEventSource: EventSource | null = null;
  private buffer: string[] = [];
  private lastFlushTime = 0;
  private readonly flushInterval = 200; // 200ms 批量刷新

  constructor(settings: AISettings) {
    this.settings = settings;
  }
}
```

### 第二步：实现缓冲机制
```typescript
// 缓冲处理函数
const flushBuffer = () => {
  if (this.buffer.length > 0) {
    const content = this.buffer.join('');
    this.buffer = [];
    this.lastFlushTime = Date.now();
    onChunk?.(content);  // 调用回调函数更新 UI
  }
};
```

### 第三步：构建 API 请求参数
```typescript
// 构建查询参数
const params = new URLSearchParams({
  message,
  context: context || '',
  conversationHistory: encodeURIComponent(JSON.stringify(
    conversationHistory.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  )),
  model: this.settings.model,
  maxTokens: this.settings.maxTokens.toString(),
  temperature: this.settings.temperature.toString()
});
```

### 第四步：创建 EventSource 连接
```typescript
// 创建 EventSource 连接
this.currentEventSource = new EventSource(
  `http://localhost:3001/api/chat-stream?${params.toString()}`
);

// 监听消息
this.currentEventSource.onmessage = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data);
    
    if (data.error) {
      reject(new Error(data.error));
      return;
    }

    if (data.content) {
      fullResponse += data.content;
      this.buffer.push(data.content);

      // 检查是否需要刷新缓冲区
      const now = Date.now();
      if (now - this.lastFlushTime >= this.flushInterval) {
        flushBuffer();
      }
    }
  } catch (e) {
    // 忽略解析错误
  }
};
```

### 第五步：实现错误处理和完成逻辑
```typescript
// 监听错误
this.currentEventSource.onerror = (_error: Event) => {
  this.currentEventSource?.close();
  this.currentEventSource = null;
  reject(new Error('SSE连接错误'));
};

// 监听完成事件
this.currentEventSource.addEventListener('done', () => {
  flushBuffer(); // 最后刷新缓冲区
  const endTime = Date.now();
  console.log(`✅ 响应完成，耗时: ${endTime - startTime}ms`);
  this.currentEventSource?.close();
  this.currentEventSource = null;
  resolve(fullResponse);
});

// 设置超时
setTimeout(() => {
  if (this.currentEventSource) {
    this.currentEventSource.close();
    this.currentEventSource = null;
    reject(new Error('请求超时'));
  }
}, 30000); // 30秒超时
```

### 第六步：实现取消和设置更新功能
```typescript
// 取消当前流式请求
cancelCurrentStream(): void {
  if (this.currentEventSource) {
    this.currentEventSource.close();
    this.currentEventSource = null;
  }
}

// 更新设置
updateSettings(newSettings: Partial<AISettings>): void {
  this.settings = { ...this.settings, ...newSettings };
}
```

## 4. 复现要点

### 关键注意事项
1. **EventSource 兼容性**：确保浏览器支持 EventSource API
2. **URL 编码**：对话历史需要正确编码避免 URL 解析错误
3. **内存管理**：及时关闭 EventSource 连接避免内存泄漏
4. **错误边界**：所有 JSON 解析都要有 try-catch

### SSE 通信原理
- **服务器推送**：服务器主动向客户端推送数据
- **长连接**：保持连接直到数据传输完成
- **格式标准**：遵循 SSE 数据格式 `data: {JSON}\n\n`
- **事件驱动**：基于事件监听机制处理数据

### 缓冲机制优化原理
```typescript
// 问题：频繁更新 UI 导致性能问题
onChunk("你");  // 触发重渲染
onChunk("好");  // 触发重渲染
onChunk("！");  // 触发重渲染

// 解决：批量更新减少重渲染
buffer.push("你", "好", "！");
setTimeout(() => {
  onChunk("你好！");  // 一次性更新
}, 200);
```

### 性能优化要点
- **批量处理**：200ms 间隔批量刷新缓冲区
- **连接复用**：取消旧连接再创建新连接
- **内存清理**：及时清空缓冲区和关闭连接
- **错误恢复**：网络错误后能正确重试

### 常见问题及解决方案
1. **连接失败**：检查后端服务是否启动
2. **数据解析错误**：添加 try-catch 忽略无效数据
3. **内存泄漏**：确保在组件卸载时调用 `cancelCurrentStream`
4. **超时处理**：设置合理的超时时间（30秒）

### 依赖要求
```json
{
  "typescript": "^5.x"
}
```

### 后端 API 要求
- **端点**：`GET /api/chat-stream`
- **格式**：SSE 格式数据流
- **参数**：message, context, conversationHistory, model, maxTokens, temperature
- **响应**：`data: {"content": "..."}\n\n` 格式

### 使用示例
```typescript
// 创建服务实例
const aiService = new OptimizedAIService({
  model: 'gpt-3.5-turbo',
  maxTokens: 1000,
  temperature: 0.7
});

// 发送流式消息
await aiService.chatStreamOptimized(
  "你好",
  "当前文件：App.tsx",
  [],
  (chunk) => {
    console.log("收到数据块：", chunk);
    // 更新 UI
  }
);

// 取消请求
aiService.cancelCurrentStream();
```

### 调试技巧
1. **网络面板**：查看 EventSource 连接状态
2. **控制台日志**：监控数据接收和处理过程
3. **性能面板**：检查缓冲机制的效果
4. **错误捕获**：完整的错误日志记录
