import { create } from 'zustand';
import { OptimizedAIService, type StreamStatus } from '../services/optimizedAI';
import { useFileStore } from './fileStore';

export interface AISettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIAssistantState {
  isOpen: boolean;
  messages: AIMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  reconnectHint: string;
}

interface AIStore {
  aiSettings: AISettings;
  aiAssistant: AIAssistantState;
  aiService: OptimizedAIService | null;
  setAISettings: (settings: Partial<AISettings>) => void;
  setAIAssistant: (updates: Partial<AIAssistantState>) => void;
  sendAIMessage: (message: string) => Promise<void>;
  cancelAIRequest: () => void;
}

const DEFAULT_AI_SETTINGS: AISettings = {
  apiKey: '',
  model: 'deepseek-chat',
  maxTokens: 3000,
  temperature: 0.3
};

const getStoredAISettings = (): AISettings => {
  try {
    const stored = localStorage.getItem('react-playground-ai-settings');
    if (!stored) {
      return DEFAULT_AI_SETTINGS;
    }

    const parsed = JSON.parse(stored) as Partial<AISettings>;

    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_AI_SETTINGS.apiKey,
      model: parsed.model && !/^gpt-/.test(parsed.model) ? parsed.model : DEFAULT_AI_SETTINGS.model,
      maxTokens: typeof parsed.maxTokens === 'number' ? parsed.maxTokens : DEFAULT_AI_SETTINGS.maxTokens,
      temperature: typeof parsed.temperature === 'number' ? parsed.temperature : DEFAULT_AI_SETTINGS.temperature
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
};

const buildEditorContext = () => {
  const { files, selectedFileName } = useFileStore.getState();
  const currentFile = files[selectedFileName];

  if (!currentFile) {
    return undefined;
  }

  return `当前文件: ${currentFile.name}\n语言: ${currentFile.language}\n代码:\n${currentFile.value}`;
};

const getReconnectHint = (status: StreamStatus) => (
  status === 'recovering' ? '连接中断，正在恢复...' : ''
);

export const useAIStore = create<AIStore>((set, get) => {
  const initialSettings = getStoredAISettings();

  return {
    aiSettings: initialSettings,
    aiAssistant: {
      isOpen: false,
      messages: [],
      isLoading: false,
      isStreaming: false,
      reconnectHint: ''
    },
    aiService: new OptimizedAIService(initialSettings),

    setAISettings: (updates) => {
      const { aiSettings } = get();
      const newSettings = { ...aiSettings, ...updates };

      try {
        localStorage.setItem('react-playground-ai-settings', JSON.stringify(newSettings));
      } catch (error) {
        console.warn('Failed to save AI settings:', error);
      }

      set({
        aiSettings: newSettings,
        aiService: new OptimizedAIService(newSettings)
      });
    },

    setAIAssistant: (updates) => {
      const { aiAssistant } = get();
      set({ aiAssistant: { ...aiAssistant, ...updates } });
    },

    sendAIMessage: async (message) => {
      const { aiService, aiAssistant, aiSettings, setAIAssistant } = get();
      if (!aiService) {
        throw new Error('AI 服务未初始化');
      }

      if (!aiSettings.apiKey.trim()) {
        throw new Error('请先在 AI 设置中填写 API Key');
      }

      const previousMessages = aiAssistant.messages;
      const timestamp = Date.now();
      const userMessage: AIMessage = {
        id: `${timestamp}`,
        role: 'user',
        content: message,
        timestamp
      };
      const aiMessageId = `${timestamp + 1}`;
      const aiMessage: AIMessage = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: timestamp + 1
      };

      setAIAssistant({
        isStreaming: true,
        isLoading: false,
        reconnectHint: '',
        messages: [...previousMessages, userMessage, aiMessage]
      });

      try {
        const conversationHistory = previousMessages.slice(-10);

        await aiService.chatStreamOptimized(
          message,
          buildEditorContext(),
          conversationHistory,
          (chunk) => {
            const { aiAssistant: current } = get();
            setAIAssistant({
              messages: current.messages.map(msg => (
                msg.id === aiMessageId
                  ? { ...msg, content: `${msg.content}${chunk}` }
                  : msg
              ))
            });
          },
          (status) => {
            setAIAssistant({
              isStreaming: true,
              reconnectHint: getReconnectHint(status)
            });
          }
        );
      } catch (error) {
        const { aiAssistant: current } = get();
        const errorMessage = error instanceof Error ? error.message : '未知错误';

        setAIAssistant({
          messages: current.messages.map(msg => (
            msg.id === aiMessageId
              ? { ...msg, content: `抱歉，发生了错误：${errorMessage}` }
              : msg
          )),
          reconnectHint: ''
        });
      } finally {
        setAIAssistant({
          isStreaming: false,
          isLoading: false,
          reconnectHint: ''
        });
      }
    },

    cancelAIRequest: () => {
      const { aiService } = get();
      aiService?.cancelCurrentStream();

      set({
        aiAssistant: {
          ...get().aiAssistant,
          isStreaming: false,
          isLoading: false,
          reconnectHint: ''
        }
      });
    }
  };
});
