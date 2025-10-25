import { create } from 'zustand';
import { OptimizedAIService } from '../services/optimizedAI';
import { useFileStore } from './fileStore';

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

interface AIStore {
  aiSettings: AISettings;
  aiAssistant: {
    isOpen: boolean;
    messages: AIMessage[];
    isLoading: boolean;
    isStreaming: boolean;
  };
  aiService: OptimizedAIService | null;
  setAISettings: (settings: Partial<AISettings>) => void;
  setAIAssistant: (updates: Partial<AIStore['aiAssistant']>) => void;
  sendAIMessage: (message: string) => Promise<void>;
  cancelAIRequest: () => void;
}

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

export const useAIStore = create<AIStore>((set, get) => {
  const initialSettings = getStoredAISettings();
  
  return {
    aiSettings: initialSettings,
    aiAssistant: {
      isOpen: false,
      messages: [],
      isLoading: false,
      isStreaming: false
    },
    aiService: new OptimizedAIService(initialSettings),
    
    setAISettings: (updates) => {
      const { aiSettings } = get();
      const newSettings = { ...aiSettings, ...updates };
      
      // 保存到 localStorage
      try {
        localStorage.setItem('react-playground-ai-settings', JSON.stringify(newSettings));
      } catch (error) {
        console.warn('Failed to save AI settings:', error);
      }
      
      // 更新 AI 服务
      const aiService = new OptimizedAIService(newSettings);
      set({ aiSettings: newSettings, aiService });
    },
    // 设置 AI 助手
    setAIAssistant: (updates) => {
      const { aiAssistant } = get();
      set({ aiAssistant: { ...aiAssistant, ...updates } });
    },
    // 发送 AI 消息
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
        
        await aiService.chatStreamOptimized(
          message,
          context,
          conversationHistory,
          (chunk) => {
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
    // 取消 AI 请求
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
  };
});
