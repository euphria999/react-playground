import type { AISettings, AIMessage } from '../stores';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const CHAT_STREAM_ENDPOINT = `${API_BASE_URL}/api/chat-stream`;

export type StreamStatus = 'streaming' | 'recovering';

export type StreamRequestPayload = {
  sessionId: string;
  lastEventIndex?: number;
  apiKey: string;
  message: string;
  context?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  model: string;
  maxTokens: number;
  temperature: number;
};

export type StreamChunk = {
  index: number;
  content: string;
};

type StreamResponseHandlers = {
  onChunk?: (chunk: string) => void;
  onStatusChange?: (status: StreamStatus) => void;
};

const STREAM_TIMEOUT_MS = 120000;
const RECOVERABLE_ERROR_MESSAGES = ['Failed to fetch', 'NetworkError', 'network'];
const STREAM_INTERRUPTED_MESSAGE = '流式连接中断';
const HISTORY_MESSAGE_LIMIT = 4000;
const CONTEXT_LIMIT = 4000;
const CONTINUATION_PATTERN = /^(继续|接着|接着说|继续说|继续输出|继续生成|往下写|接着写|go on|continue)$/i;

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const delay = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export const buildStreamRequestPayload = (payload: StreamRequestPayload) => payload;

export const createChunkAccumulator = () => {
  const seenIndexes = new Set<number>();
  let lastEventIndex = -1;

  return {
    get lastEventIndex() {
      return lastEventIndex;
    },
    apply(chunk: StreamChunk) {
      if (seenIndexes.has(chunk.index)) {
        return '';
      }

      seenIndexes.add(chunk.index);
      lastEventIndex = Math.max(lastEventIndex, chunk.index);
      return chunk.content;
    }
  };
};

export const createReconnectPolicy = () => ({
  shouldRetry(attempt: number) {
    return attempt < 3;
  },
  nextDelay(attempt: number) {
    return [500, 1000, 2000][attempt] ?? 2000;
  }
});

export const getNextAssistantStatus = (status: StreamStatus) => ({
  isStreaming: true,
  reconnectHint: status === 'recovering' ? '连接中断，正在恢复...' : ''
});

export const isContinuationRequest = (message: string) => CONTINUATION_PATTERN.test(message.trim());

export const buildModelMessage = (
  message: string,
  conversationHistory: Array<{ role: string; content: string }>
) => {
  const lastAssistantMessage = [...conversationHistory].reverse().find(msg => (
    msg.role === 'assistant' && msg.content.trim()
  ));

  if (!isContinuationRequest(message) || !lastAssistantMessage) {
    return message;
  }

  return [
    '请从上一条 assistant 回答被截断的位置继续输出。',
    '要求：不要重复已经输出过的内容；保持原来的格式、代码块和上下文；如果上一条是在代码块中中断，请从中断处继续补全。',
    `用户原始输入：${message}`
  ].join('\n');
};

const isRecoverableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message === STREAM_INTERRUPTED_MESSAGE
    || RECOVERABLE_ERROR_MESSAGES.some(keyword => message.includes(keyword));
};

const parseSseEvent = (line: string): StreamChunk | null => {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const data = line.slice(6).trim();
  if (!data || data === '[DONE]') {
    return null;
  }

  const parsed = JSON.parse(data) as Partial<StreamChunk> & { error?: string };
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  if (typeof parsed.index === 'number' && typeof parsed.content === 'string') {
    return {
      index: parsed.index,
      content: parsed.content
    };
  }

  return null;
};

const isDoneEvent = (line: string) => line === 'data: [DONE]' || line === 'event: done';

export class OptimizedAIService {
  private settings: AISettings;
  private currentAbortController: AbortController | null = null;
  private userCancelled = false;
  private buffer: string[] = [];
  private lastFlushTime = 0;
  private readonly flushInterval = 200;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  async chatStreamOptimized(
    message: string,
    context?: string,
    conversationHistory: AIMessage[] = [],
    onChunk?: (chunk: string) => void,
    onStatusChange?: (status: StreamStatus) => void
  ): Promise<string> {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.userCancelled = false;

    const compactHistory = conversationHistory
      .slice(-10)
      .filter(msg => msg.content.trim())
      .map(msg => ({
        role: msg.role,
        content: msg.content.slice(-HISTORY_MESSAGE_LIMIT)
      }));

    const sessionId = createSessionId();
    const accumulator = createChunkAccumulator();
    const reconnectPolicy = createReconnectPolicy();
    const safeContext = (context || '').slice(0, CONTEXT_LIMIT);
    const modelMessage = buildModelMessage(message, compactHistory);

    let fullResponse = '';
    let finished = false;
    let attempt = 0;
    let timeoutId: number | null = null;
    let requestTimedOut = false;

    const flushBuffer = () => {
      if (this.buffer.length === 0) {
        return;
      }

      const content = this.buffer.join('');
      this.buffer = [];
      this.lastFlushTime = Date.now();
      onChunk?.(content);
    };

    const clearTimeoutIfNeeded = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const resetTimeout = () => {
      clearTimeoutIfNeeded();
      requestTimedOut = false;
      timeoutId = window.setTimeout(() => {
        if (!this.currentAbortController) {
          return;
        }
        requestTimedOut = true;
        this.currentAbortController.abort();
      }, STREAM_TIMEOUT_MS);
    };

    const basePayload = {
      apiKey: this.settings.apiKey,
      message: modelMessage,
      context: safeContext,
      conversationHistory: compactHistory,
      model: this.settings.model,
      maxTokens: this.settings.maxTokens,
      temperature: this.settings.temperature
    };

    const handlers: StreamResponseHandlers = {
      onChunk: (chunk) => {
        fullResponse += chunk;
        this.buffer.push(chunk);
        const now = Date.now();
        if (now - this.lastFlushTime >= this.flushInterval) {
          flushBuffer();
        }
      },
      onStatusChange
    };

    const sendStreamRequest = async (payload: StreamRequestPayload) => {
      this.currentAbortController = new AbortController();
      requestTimedOut = false;
      resetTimeout();

      const response = await fetch(CHAT_STREAM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: this.currentAbortController.signal
      });

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
      }

      if (!response.body) {
        throw new Error('流式响应不可用');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';
      let doneReceived = false;

      try {
        readLoop:
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          resetTimeout();
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) {
              continue;
            }

            if (isDoneEvent(line)) {
              doneReceived = true;
              break readLoop;
            }

            const chunk = parseSseEvent(line);
            if (!chunk) {
              continue;
            }

            const applied = accumulator.apply(chunk);
            if (!applied) {
              continue;
            }

            handlers.onChunk?.(applied);
          }
        }

        if (streamBuffer.trim()) {
          const trailingLine = streamBuffer.trim();
          if (!isDoneEvent(trailingLine)) {
            const chunk = parseSseEvent(trailingLine);
            if (chunk) {
              const applied = accumulator.apply(chunk);
              if (applied) {
                handlers.onChunk?.(applied);
              }
            }
          } else {
            doneReceived = true;
          }
        }

        if (!doneReceived) {
          throw new Error(STREAM_INTERRUPTED_MESSAGE);
        }
      } finally {
        reader.releaseLock();
      }
    };

    try {
      while (!finished) {
        const payload = buildStreamRequestPayload({
          sessionId,
          lastEventIndex: attempt === 0 ? undefined : accumulator.lastEventIndex,
          ...basePayload
        });

        handlers.onStatusChange?.(attempt === 0 ? 'streaming' : 'recovering');

        try {
          await sendStreamRequest(payload);
          finished = true;
        } catch (error) {
          clearTimeoutIfNeeded();

          if (error instanceof DOMException && error.name === 'AbortError') {
            if (this.userCancelled) {
              finished = true;
              break;
            }

            if (!reconnectPolicy.shouldRetry(attempt)) {
              throw new Error(requestTimedOut ? '请求超时，请稍后重试' : '请求已中断');
            }
          } else if (!isRecoverableError(error)) {
            throw error;
          } else if (!reconnectPolicy.shouldRetry(attempt)) {
            throw error;
          }

          attempt += 1;
          await delay(createReconnectPolicy().nextDelay(attempt - 1));
          continue;
        } finally {
          this.currentAbortController = null;
          clearTimeoutIfNeeded();
        }
      }

      flushBuffer();
      return fullResponse;
    } catch (error) {
      flushBuffer();
      throw error instanceof Error ? error : new Error('流式请求失败');
    } finally {
      this.currentAbortController = null;
      clearTimeoutIfNeeded();
    }
  }

  cancelCurrentStream(): void {
    if (this.currentAbortController) {
      this.userCancelled = true;
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  updateSettings(newSettings: Partial<AISettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }
}
