
import type { AISettings, AIMessage } from '../stores';



export class OptimizedAIService {
  private settings: AISettings;//设置
  private currentEventSource: EventSource | null = null;//当前SSE连接
  private buffer: string[] = [];//缓冲区
  private lastFlushTime = 0;//上次刷新时间
  private readonly flushInterval = 200; // 200ms 批量刷新

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  // 流式聊天 - 使用EventSourcePolyfill
  async chatStreamOptimized(
    message: string,
    context?: string,//上下文
    conversationHistory: AIMessage[] = [],//对话历史
    onChunk?: (chunk: string) => void//回调函数
  ): Promise<string> {
    // 取消之前的请求
    if (this.currentEventSource) {
      this.currentEventSource.close();
    }

    let fullResponse = '';//完整响应
    let startTime = Date.now();//记录开始时间用于性能监控

    // 缓冲处理函数
    const flushBuffer = () => {
      if (this.buffer.length > 0) {
        const content = this.buffer.join('');//将缓冲区中的内容拼接成一个字符串合并
        this.buffer = [];//清空缓冲区
        this.lastFlushTime = Date.now();//更新上次刷新时间
        onChunk?.(content);//调用回调函数
      }
    };

    return new Promise((resolve, reject) => {
      try {
        // 构建查询参数 (移除API Key，后端统一管理)
        const params = new URLSearchParams({
          message,
          context: context || '',
          conversationHistory: encodeURIComponent(JSON.stringify(conversationHistory.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
          })))),
          model: this.settings.model,
          maxTokens: this.settings.maxTokens.toString(),
          temperature: this.settings.temperature.toString()
        });

        // 创建EventSource连接
        this.currentEventSource = new EventSource(`http://localhost:3001/api/chat-stream?${params.toString()}`);

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
              this.buffer.push(data.content);//将内容添加到缓冲区

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

        // 监听错误
        this.currentEventSource.onerror = (_error: Event) => {
          this.currentEventSource?.close();
          this.currentEventSource = null;
          reject(new Error('SSE连接错误'));
        };

        // 监听done事件
        this.currentEventSource.addEventListener('done', () => {
          flushBuffer(); // 最后刷新缓冲区
          const endTime = Date.now();//记录结束时间
          console.log(`✅ 响应完成，耗时: ${endTime - startTime}ms`);//打印响应时间
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

      } catch (error: any) {
        reject(new Error(error?.message || '未知错误'));
      }
    });
  }


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
}
