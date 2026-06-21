import { describe, expect, it } from 'vitest';

import {
  createSessionStore,
  normalizeStreamRequest,
  isSameRequestPayload
} from './chat.cjs';

describe('createSessionStore', () => {
  it('creates a streaming session with empty chunks', () => {
    const store = createSessionStore({ now: () => 1000, ttlMs: 300000 });
    const session = store.createSession('s1', {
      message: 'hello',
      context: 'ctx',
      conversationHistory: [],
      model: 'deepseek-chat',
      maxTokens: 1000,
      temperature: 0.3
    });

    expect(session.sessionId).toBe('s1');
    expect(session.status).toBe('streaming');
    expect(session.chunks).toEqual([]);
    expect(session.error).toBe(null);
    expect(session.activeResponse).toBe(null);
    expect(session.lastAccessAt).toBe(1000);
  });

  it('replayFrom returns chunks after lastEventIndex', () => {
    const store = createSessionStore({ now: () => 1000, ttlMs: 300000 });
    const session = store.createSession('s1', { message: 'hello' });
    store.appendChunk(session, 'A');
    store.appendChunk(session, 'B');
    store.appendChunk(session, 'C');

    expect(store.replayFrom(session, 0)).toEqual([
      { index: 1, content: 'B' },
      { index: 2, content: 'C' }
    ]);
  });

  it('markCompleted updates session status', () => {
    const store = createSessionStore({ now: () => 1000, ttlMs: 300000 });
    const session = store.createSession('s1', { message: 'hello' });
    store.markCompleted(session);

    expect(session.status).toBe('completed');
    expect(session.error).toBe(null);
  });

  it('cleanupExpired removes expired sessions', () => {
    let current = 1000;
    const store = createSessionStore({ now: () => current, ttlMs: 100 });
    store.createSession('s1', { message: 'hello' });

    current = 1201;
    store.cleanupExpired();

    expect(store.sessions.has('s1')).toBe(false);
  });
});

describe('normalizeStreamRequest', () => {
  it('parses sessionId and lastEventIndex', () => {
    const request = normalizeStreamRequest({
      sessionId: 's1',
      lastEventIndex: '4',
      message: 'hello'
    });

    expect(request.sessionId).toBe('s1');
    expect(request.lastEventIndex).toBe(4);
    expect(request.message).toBe('hello');
  });

  it('defaults lastEventIndex to -1', () => {
    const request = normalizeStreamRequest({
      sessionId: 's1',
      message: 'hello'
    });

    expect(request.lastEventIndex).toBe(-1);
  });
});

describe('isSameRequestPayload', () => {
  it('ignores resume metadata and compares core payload', () => {
    const first = {
      sessionId: 's1',
      lastEventIndex: 2,
      message: 'hello',
      context: 'ctx',
      conversationHistory: [],
      model: 'deepseek-chat',
      maxTokens: 1000,
      temperature: 0.3
    };

    const second = {
      sessionId: 's1',
      lastEventIndex: 5,
      message: 'hello',
      context: 'ctx',
      conversationHistory: [],
      model: 'deepseek-chat',
      maxTokens: 1000,
      temperature: 0.3
    };

    expect(isSameRequestPayload(first, second)).toBe(true);
  });
});
