import { createContext, useEffect, useState, useRef, useCallback, useMemo, type PropsWithChildren } from 'react';
import { fileName2Language } from './ReactPlayground/utils';
import { initFiles } from './ReactPlayground/files';
import { compress ,uncompress} from './ReactPlayground/utils';
import { OptimizedAIService } from './ReactPlayground/services/optimizedAI';
// 文件接口
export interface File {
  name: string;
  value: string;
  language: string
}
// 文件集合接口
export interface Files {
  [key: string]: File
}
// AI 设置接口 (移除API Key，后端统一管理)
export interface AISettings {
  apiKey: string
  model: 'deepseek-chat' | 'deepseek-reasoner'
  maxTokens: number
  temperature: number // 创新程度
}
// AI 消息接口
export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
// 全局上下文接口
export interface PlaygroundContext {
  files: Files // 文件集合
  selectedFileName: string // 当前选中的文件名
  theme: Theme // 主题
  aiSettings: AISettings // AI 设置
  aiAssistant: {
    isOpen: boolean // 是否打开
    messages: AIMessage[] // 消息
    isLoading: boolean // 是否加载中
    isStreaming: boolean // 是否流式
  }
  setTheme: (theme: Theme) => void // 设置主题
  setSelectedFileName: (fileName: string) => void // 设置当前选中的文件名
  setFiles: (files: Files) => void // 设置文件集合
  addFile: (fileName: string) => void // 添加文件
  removeFile: (fileName: string) => void // 删除文件
  updateFileName: (oldFieldName: string, newFieldName: string) => void // 更新文件名
  setAISettings: (settings: Partial<AISettings>) => void // 设置 AI 设置
  setAIAssistant: (updates: Partial<PlaygroundContext['aiAssistant']>) => void // 设置 AI 助手
  sendAIMessage: (message: string) => Promise<void> // 发送 AI 消息
  cancelAIRequest: () => void // 取消 AI 请求
}

export type Theme = 'light' | 'dark'

export const PlaygroundContext = createContext<PlaygroundContext>({
  selectedFileName: 'App.tsx',
} as PlaygroundContext)

// 从 url 中获取文件信息（用于支持分享）
const getFilesFromUrl = () => {
    let files: Files | undefined
    try {
        const hash = window.location.hash.slice(1)
        if (hash) {
            const decompressed = uncompress(hash)
            files = JSON.parse(decompressed)
        }
    } catch (error) {
      console.warn('Failed to load files from URL:', error)
      // 返回undefined，使用默认文件
    }
    return files
  }

// 从 localStorage 获取主题设置
const getStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem('react-playground-theme')
    return (stored as Theme) || 'light'
  } catch {
    return 'light'
  }
}

// 从 localStorage 获取 AI 设置 (持久化AI设置)
const getStoredAISettings = (): AISettings => {
  try {
    const stored = localStorage.getItem('react-playground-ai-settings')
    if (!stored) {
      return {
        apiKey: '',
        model: 'deepseek-chat' as const,
        maxTokens: 1000,
        temperature: 0.3
      }
    }
    const parsed = JSON.parse(stored) as Partial<AISettings> & { model?: string }
    const model = parsed.model && /^gpt-/.test(parsed.model) ? 'deepseek-chat' : (parsed.model || 'deepseek-chat')
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: model as AISettings['model'],
      maxTokens: typeof parsed.maxTokens === 'number' ? parsed.maxTokens : 1000,
      temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.3
    }
  } catch {
    return {
        apiKey: '',
        model: 'deepseek-chat' as const,
        maxTokens: 1000,
        temperature: 0.3
      }
  }
}

export const PlaygroundProvider = (props: PropsWithChildren) => {
    const { children } = props
    const [files, setFiles] = useState<Files>(getFilesFromUrl() || initFiles)//文件内容自动同步到URL，支持分享
    const [selectedFileName, setSelectedFileName] = useState('App.tsx');
    const [theme, setTheme] = useState<Theme>(getStoredTheme)
    
     // AI设置 - 从localStorage恢复
    const [aiSettings, setAISettingsState] = useState<AISettings>(getStoredAISettings)
    // AI助手状态 - 实时状态
    const [aiAssistant, setAIAssistantState] = useState({
      isOpen: false,
      messages: [] as AIMessage[],
      isLoading: false,
      isStreaming: false
    })

    // AI 服务实例
    const aiServiceRef = useRef<OptimizedAIService | null>(null)
    // 添加文件
    const addFile = (name: string) => {
      files[name] = {
        name,
        language: fileName2Language(name),
        value: '',
      }
      setFiles({ ...files })
    }
    // 删除文件
    const removeFile = (name: string) => {
      delete files[name]
      setFiles({ ...files })
    }
    // 更新文件名
    const updateFileName = (oldFieldName: string, newFieldName: string) => {
      if (!files[oldFieldName] || newFieldName === undefined || newFieldName === null) return//检查旧文件名存在且新文件名有效
      const { [oldFieldName]: value, ...rest } = files//使用解构赋值提取要重命名的文件
      //创建新文件对象，更新语言类型和文件名
      const newFile = {
        [newFieldName]: {
          ...value,
          language: fileName2Language(newFieldName),
          name: newFieldName,
        },
      }
      setFiles({//使用展开运算符合并旧文件和新的文件对象
        ...rest,
        ...newFile,
      })
    }

    // 主题切换处理函数
    const handleThemeChange = (newTheme: Theme) => {
      setTheme(newTheme)
      // 保存到 localStorage
      try {
        localStorage.setItem('react-playground-theme', newTheme)
      } catch (error) {
        console.warn('Failed to save theme to localStorage:', error)
      }
    }

    // 更新 AI 服务实例 (API Key由后端管理，始终创建服务实例)
    useEffect(() => {
      aiServiceRef.current = new OptimizedAIService(aiSettings)
    }, [aiSettings])

    // 使用useCallback优化AI设置处理函数
    const setAISettings = useCallback((updates: Partial<AISettings>) => {
      const newSettings = { ...aiSettings, ...updates }
      setAISettingsState(newSettings)
      
      // 持久化到 localStorage
      try {
        localStorage.setItem('react-playground-ai-settings', JSON.stringify(newSettings))
      } catch (error) {
        console.warn('Failed to save AI settings:', error)
      }

      // 更新 AI 服务设置
      if (aiServiceRef.current) {
        aiServiceRef.current.updateSettings(newSettings)
      }
    }, [aiSettings])

    const setAIAssistant = useCallback((updates: Partial<typeof aiAssistant>) => {
      setAIAssistantState(prev => ({ ...prev, ...updates }))
    }, [])

    // AI 消息发送 - 统一使用流式
    const sendAIMessage = async (message: string) => {
      return sendAIMessageStreamOptimized(message);
    }

    // 流式消息发送
    const sendAIMessageStreamOptimized = async (message: string) => {
      if (!aiServiceRef.current) {
        throw new Error('AI 服务未初始化')
      }

      setAIAssistant({ isStreaming: true })
      
      // 添加用户消息
      const userMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,//用户消息
        timestamp: Date.now()//时间戳
      }
      // 更新消息
      setAIAssistantState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage]
      }))

      // 添加空的 AI 消息用于流式更新
      const aiMessageId = (Date.now() + 1).toString()
      const aiMessage: AIMessage = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }
       // 更新消息
      setAIAssistantState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMessage]
      }))

      try {
        // 准备上下文
        const currentFile = files[selectedFileName]
        const context = currentFile ? 
          `当前文件：${currentFile.name}\n语言：${currentFile.language}\n代码：\n${currentFile.value}` : 
          undefined
        // 获取对话历史
        const conversationHistory = aiAssistant.messages.slice(-10)
        // 调用流式聊天 ,传入上下文和对话历史
        await aiServiceRef.current.chatStreamOptimized(
          message,
          context,//上下文
          conversationHistory,//对话历史
          (chunk) => {
            // 更新消息内容
            setAIAssistantState(prev => ({
              ...prev,
              messages: prev.messages.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            }))
          }
        )

      } catch (error: any) {
        // 更新错误消息
        setAIAssistantState(prev => ({
          ...prev,
          messages: prev.messages.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: `抱歉，发生了错误：${error?.message || '未知错误'}` }
              : msg
          )
        }))
      } finally {
        setAIAssistant({ isStreaming: false })
      }
    }

    // 取消 AI 请求
    const cancelAIRequest = () => {
      if (aiServiceRef.current) {
        aiServiceRef.current.cancelCurrentStream()
        setAIAssistant({ isStreaming: false, isLoading: false })
      }
    }
    // 同步文件信息到URL，支持分享
    useEffect(() => {
        try {
            const hash = compress(JSON.stringify(files))
            window.location.hash = encodeURIComponent(hash)
        } catch (error) {
            console.warn('Failed to sync files to URL:', error)
        }
    }, [files])
  
    // 使用useMemo优化Context value
    const contextValue = useMemo(() => ({
      theme,
      setTheme: handleThemeChange,
      files,
      selectedFileName,
      setSelectedFileName,
      setFiles,
      addFile,
      removeFile,
      updateFileName,
      aiSettings,
      setAISettings,
      aiAssistant,
      setAIAssistant,
      sendAIMessage,
      cancelAIRequest,
    }), [
      theme,
      handleThemeChange,
      files,
      selectedFileName,
      setSelectedFileName,
      setFiles,
      addFile,
      removeFile,
      updateFileName,
      aiSettings,
      setAISettings,
      aiAssistant,
      setAIAssistant,
      sendAIMessage,
      cancelAIRequest
    ])

    return (
      <PlaygroundContext.Provider value={contextValue}>
        {children}
      </PlaygroundContext.Provider>
    )
}


