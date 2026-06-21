import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildStreamRequestPayload,
  createChunkAccumulator,
  createReconnectPolicy,
  getNextAssistantStatus,
  buildModelMessage,
  OptimizedAIService
} from './optimizedAI';

const encoder = new TextEncoder();

const createSseResponse = (events: string[], signal?: AbortSignal, keepOpen = false) => new Response(
  new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }

      if (keepOpen) {
        signal?.addEventListener('abort', () => {
          controller.error(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
        return;
      }

      controller.close();
    }
  })
);

const settings = {
  apiKey: '',
  model: 'deepseek-chat',
  maxTokens: 1000,
  temperature: 0.3
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildStreamRequestPayload', () => {
  it('includes sessionId and lastEventIndex when reconnecting', () => {
    const payload = buildStreamRequestPayload({
      sessionId: 's1',
      lastEventIndex: 3,
      apiKey: '',
      message: 'hello',
      context: 'ctx',
      conversationHistory: [],
      model: 'deepseek-chat',
      maxTokens: 1000,
      temperature: 0.3
    });

    expect(payload.sessionId).toBe('s1');
    expect(payload.lastEventIndex).toBe(3);
  });
});

describe('createChunkAccumulator', () => {
  it('ignores duplicate chunk indexes', () => {
    const accumulator = createChunkAccumulator();

    expect(accumulator.apply({ index: 0, content: 'A' })).toBe('A');
    expect(accumulator.apply({ index: 0, content: 'A' })).toBe('');
    expect(accumulator.apply({ index: 1, content: 'B' })).toBe('B');
    expect(accumulator.lastEventIndex).toBe(1);
  });
});

describe('createReconnectPolicy', () => {
  it('retries three times with incremental delays', () => {
    const policy = createReconnectPolicy();

    expect(policy.nextDelay(0)).toBe(500);
    expect(policy.nextDelay(1)).toBe(1000);
    expect(policy.nextDelay(2)).toBe(2000);
    expect(policy.shouldRetry(0)).toBe(true);
    expect(policy.shouldRetry(2)).toBe(true);
    expect(policy.shouldRetry(3)).toBe(false);
  });
});

describe('getNextAssistantStatus', () => {
  it('maps recovering status to reconnect hint', () => {
    expect(getNextAssistantStatus('recovering')).toEqual({
      isStreaming: true,
      reconnectHint: '连接中断，正在恢复...'
    });
  });

  it('clears reconnect hint while streaming normally', () => {
    expect(getNextAssistantStatus('streaming')).toEqual({
      isStreaming: true,
      reconnectHint: ''
    });
  });
});

describe('buildModelMessage', () => {
  it('turns continuation requests into explicit resume instructions', () => {
    const message = buildModelMessage('继续', [
      { role: 'user', content: '写一个 CSS 示例' },
      { role: 'assistant', content: '```css\n.button {\n  color: red;' }
    ]);

    expect(message).toContain('从上一条 assistant 回答被截断的位置继续输出');
    expect(message).toContain('不要重复已经输出过的内容');
  });

  it('keeps normal messages unchanged', () => {
    expect(buildModelMessage('解释这段代码', [])).toBe('解释这段代码');
  });
});

describe('OptimizedAIService resume behavior', () => {
  it('reconnects when the stream closes before done and dedupes replayed chunks', async () => {
    const chunks: string[] = [];
    const statuses: string[] = [];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createSseResponse([
        'data: {"index":0,"content":"A"}\n\n'
      ]))
      .mockResolvedValueOnce(createSseResponse([
        'data: {"index":0,"content":"A"}\n\n',
        'data: {"index":1,"content":"B"}\n\n',
        'event: done\n',
        'data: [DONE]\n\n'
      ]));

    const service = new OptimizedAIService(settings);
    const response = await service.chatStreamOptimized(
      'hello',
      '',
      [],
      chunk => chunks.push(chunk),
      status => statuses.push(status)
    );

    expect(response).toBe('AB');
    expect(chunks.join('')).toBe('AB');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(statuses).toEqual(['streaming', 'recovering']);

    const reconnectBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(reconnectBody.lastEventIndex).toBe(0);
  });

  it('does not reconnect after user cancellation', async () => {
    const chunks: string[] = [];
    const service = new OptimizedAIService(settings);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_input, init) => Promise.resolve(createSseResponse([
        'data: {"index":0,"content":"A"}\n\n'
      ], init?.signal as AbortSignal, true)));

    const response = await service.chatStreamOptimized(
      'hello',
      '',
      [],
      (chunk) => {
        chunks.push(chunk);
        service.cancelCurrentStream();
      }
    );

    expect(response).toBe('A');
    expect(chunks).toEqual(['A']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('finishes as soon as done is received even if the connection stays open', async () => {
    const chunks: string[] = [];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_input, init) => Promise.resolve(createSseResponse([
        'data: {"index":0,"content":"A"}\n\n',
        'event: done\n',
        'data: [DONE]\n\n'
      ], init?.signal as AbortSignal, true)));

    const service = new OptimizedAIService(settings);
    const response = await service.chatStreamOptimized(
      'hello',
      '',
      [],
      chunk => chunks.push(chunk)
    );

    expect(response).toBe('A');
    expect(chunks).toEqual(['A']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends continuation instructions with previous assistant history', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createSseResponse([
        'data: {"index":0,"content":"B"}\n\n',
        'event: done\n',
        'data: [DONE]\n\n'
      ]));

    const service = new OptimizedAIService(settings);
    await service.chatStreamOptimized('继续', '', [
      {
        id: '1',
        role: 'assistant',
        content: 'A'.repeat(500),
        timestamp: 1
      }
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.message).toContain('从上一条 assistant 回答被截断的位置继续输出');
    expect(body.conversationHistory[0].content.length).toBe(500);
  });
});
