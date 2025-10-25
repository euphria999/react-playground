# aiStore.ts 技术指导文档

## 1. 文件作用

`aiStore.ts` 是 AI 功能的状态管理中心，负责：
- 管理 AI 聊天的所有状态（消息、设置、加载状态）
- 处理与 AI 服务的交互逻辑
- 实现流式 AI 对话功能
- 管理 AI 设置的持久化存储

## 2. 核心思路拆解

### 为什么需要这样设计
- **复杂状态管理**：AI 功能涉及多个相关状态，需要统一管理
- **异步操作处理**：AI 请求是异步的，需要管理加载和流式状态
- **跨组件通信**：多个组件需要访问 AI 状态和功能
- **性能优化**：使用 Zustand 实现精确的状态订阅

### 关键功能实现思路

#### AI 状态结构
```typescript
interface AIStore {
  aiSettings: AISettings;           // AI 配置参数
  aiAssistant: {
    isOpen: boolean;               // 助手面板是否打开
    messages: AIMessage[];         // 消息历史
    isLoading: boolean;           // 传统加载状态
    isStreaming: boolean;         // 流式输出状态
  };
  aiService: OptimizedAIService;  // AI 服务实例
  // ... 操作方法
}
```

#### 流式消息处理
```typescript
sendAIMessage: async (message) => {
  // 1. 设置流式状态
  setAIAssistant({ isStreaming: true });
  
  // 2. 添加用户消息
  const userMessage = { /* ... */ };
  setAIAssistant({ messages: [...messages, userMessage] });
  
  // 3. 创建空 AI 消息
  const aiMessage = { id: aiMessageId, content: '', /* ... */ };
  setAIAssistant({ messages: [...messages, aiMessage] });
  
  // 4. 流式更新内容
  await aiService.chatStreamOptimized(message, context, history, (chunk) => {
    // 实时更新消息内容
    setAIAssistant({
      messages: messages.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: msg.content + chunk }
          : msg
      )
    });
  });
}
```

### 核心代码块作用

1. **接口定义**：定义 AI 相关的数据结构
2. **持久化逻辑**：AI 设置的本地存储
3. **服务实例管理**：AI 服务的创建和更新
4. **流式消息处理**：实现实时的 AI 对话

## 3. 分步实现步骤

### 第一步：定义数据结构
```typescript
// AI 设置接口
export interface AISettings {
  model: 'gpt-3.5-turbo' | 'gpt-4';
  maxTokens: number;
  temperature: number;
}

// AI 消息接口
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Store 接口
interface AIStore {
  aiSettings: AISettings;
  aiAssistant: {
    isOpen: boolean;
    messages: AIMessage[];
    isLoading: boolean;
    isStreaming: boolean;
  };
  aiService: OptimizedAIService | null;
  // ... 方法定义
}
```

### 第二步：实现持久化逻辑
```typescript
// 从 localStorage 获取 AI 设置
const getStoredAISettings = (): AISettings => {
  try {
    const stored = localStorage.getItem('react-playground-ai-settings');
    return stored ? JSON.parse(stored) : {
      model: 'gpt-3.5-turbo' as const,
      maxTokens: 1000,
      temperature: 0.3
    };
  } catch {
    return {
      model: 'gpt-3.5-turbo' as const,
      maxTokens: 1000,
      temperature: 0.3
    };
  }
};
```

### 第三步：创建 Zustand Store
```typescript
export const useAIStore = create<AIStore>((set, get) => {
  const initialSettings = getStoredAISettings();
  
  return {
    // 初始状态
    aiSettings: initialSettings,
    aiAssistant: {
      isOpen: false,
      messages: [],
      isLoading: false,
      isStreaming: false
    },
    aiService: new OptimizedAIService(initialSettings),
    
    // 设置更新方法
    setAISettings: (updates) => {
      const newSettings = { ...get().aiSettings, ...updates };
      
      // 持久化到 localStorage
      try {
        localStorage.setItem('react-playground-ai-settings', JSON.stringify(newSettings));
      } catch (error) {
        console.warn('Failed to save AI settings:', error);
      }
      
      // 更新状态和服务实例
      const aiService = new OptimizedAIService(newSettings);
      set({ aiSettings: newSettings, aiService });
    },
  };
});
```

### 第四步：实现流式消息功能
```typescript
sendAIMessage: async (message) => {
  const { aiService, aiAssistant, setAIAssistant } = get();
  if (!aiService) throw new Error('AI 服务未初始化');
  
  setAIAssistant({ isStreaming: true });
  
  // 添加用户消息
  const userMessage: AIMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: message,
    timestamp: Date.now()
  };
  
  setAIAssistant({ 
    messages: [...aiAssistant.messages, userMessage] 
  });
  
  // 添加空的 AI 消息
  const aiMessageId = (Date.now() + 1).toString();
  const aiMessage: AIMessage = {
    id: aiMessageId,
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  };
  
  setAIAssistant({ 
    messages: [...get().aiAssistant.messages, aiMessage] 
  });
  
  try {
    // 准备上下文
    const { files, selectedFileName } = useFileStore.getState();
    const currentFile = files[selectedFileName];
    const context = currentFile ? 
      `当前文件：${currentFile.name}\n语言：${currentFile.language}\n代码：\n${currentFile.value}` : 
      undefined;
    
    const conversationHistory = get().aiAssistant.messages.slice(-10);
    
    // 流式聊天
    await aiService.chatStreamOptimized(
      message,
      context,
      conversationHistory,
      (chunk) => {
        // 实时更新消息内容
        const { aiAssistant } = get();
        setAIAssistant({
          messages: aiAssistant.messages.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        });
      }
    );
    
  } catch (error: any) {
    // 错误处理
    const { aiAssistant } = get();
    setAIAssistant({
      messages: aiAssistant.messages.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: `抱歉，发生了错误：${error?.message || '未知错误'}` }
          : msg
      )
    });
  } finally {
    setAIAssistant({ isStreaming: false });
  }
},
```

### 第五步：实现取消功能
```typescript
cancelAIRequest: () => {
  const { aiService } = get();
  if (aiService) {
    aiService.cancelCurrentStream();
    set({ 
      aiAssistant: { 
        ...get().aiAssistant, 
        isStreaming: false, 
        isLoading: false 
      } 
    });
  }
},
```

## 4. 复现要点

### 关键注意事项
1. **状态同步**：确保 AI 服务实例与设置保持同步
2. **错误处理**：所有异步操作都要有完整的错误处理
3. **内存管理**：及时清理 AI 服务实例，避免内存泄漏
4. **跨 Store 访问**：使用 `useFileStore.getState()` 获取文件上下文

### 流式处理核心原理
1. **预创建消息**：先创建空的 AI 消息占位
2. **实时更新**：通过回调函数逐步更新消息内容
3. **状态管理**：使用 `isStreaming` 标识流式状态
4. **错误恢复**：流式失败时更新错误信息到消息中

### 性能优化要点
- **精确订阅**：组件只订阅需要的状态片段
- **批量更新**：减少不必要的状态更新
- **服务复用**：AI 服务实例复用，避免重复创建

### 常见问题及解决方案
1. **服务未初始化**：确保在调用前检查 `aiService` 是否存在
2. **消息更新不及时**：检查消息 ID 是否正确匹配
3. **设置不生效**：确保设置更新后重新创建服务实例
4. **内存泄漏**：组件卸载时清理 AI 服务

### 依赖要求
```json
{
  "zustand": "^4.x"
}
```

### 相关文件依赖
- `../services/optimizedAI.ts`：AI 服务实现
- `./fileStore.ts`：获取文件上下文

### 使用示例
```typescript
// 在组件中使用
function AIComponent() {
  const { aiSettings, aiAssistant, sendAIMessage } = useAIStore();
  
  // 只订阅消息列表
  const messages = useAIStore(state => state.aiAssistant.messages);
  
  // 只订阅流式状态
  const isStreaming = useAIStore(state => state.aiAssistant.isStreaming);
  
  return (
    <div>
      {/* 使用 AI 功能 */}
    </div>
  );
}
```
