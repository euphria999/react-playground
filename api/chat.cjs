const express = require('express');
const cors = require('cors');

const SESSION_TTL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const sanitizeRequestPayload = (payload = {}) => ({
  apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
  message: payload.message,
  context: payload.context,
  conversationHistory: Array.isArray(payload.conversationHistory) ? payload.conversationHistory : payload.conversationHistory,
  model: payload.model,
  maxTokens: payload.maxTokens,
  temperature: payload.temperature
});

const normalizeStreamRequest = (payload = {}) => ({
  sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : '',
  lastEventIndex: Number.isFinite(Number(payload.lastEventIndex))
    ? Number(payload.lastEventIndex)
    : -1,
  ...sanitizeRequestPayload(payload)
});

const stableStringify = (value) => JSON.stringify(value ?? null);

const isSameRequestPayload = (a, b) => stableStringify(sanitizeRequestPayload(a)) === stableStringify(sanitizeRequestPayload(b));

const createSessionStore = ({ now = () => Date.now(), ttlMs = SESSION_TTL_MS } = {}) => {
  const sessions = new Map();

  const touch = (session) => {
    session.lastAccessAt = now();
  };

  return {
    sessions,
    createSession(sessionId, requestPayload) {
      const session = {
        sessionId,
        requestPayload: sanitizeRequestPayload(requestPayload),
        chunks: [],
        status: 'streaming',
        error: null,
        activeResponse: null,
        lastAccessAt: now(),
        completionSent: false,
        completionResolvers: [],
        streamStarted: false
      };
      sessions.set(sessionId, session);
      return session;
    },
    getSession(sessionId) {
      return sessions.get(sessionId) || null;
    },
    appendChunk(session, content) {
      const chunk = {
        index: session.chunks.length,
        content
      };
      session.chunks.push(chunk);
      touch(session);
      return chunk;
    },
    replayFrom(session, lastEventIndex = -1) {
      touch(session);
      return session.chunks.filter(chunk => chunk.index > lastEventIndex);
    },
    setActiveResponse(session, response) {
      session.activeResponse = response;
      touch(session);
    },
    clearActiveResponse(session, response) {
      if (!response || session.activeResponse === response) {
        session.activeResponse = null;
      }
      touch(session);
    },
    markCompleted(session) {
      session.status = 'completed';
      session.error = null;
      touch(session);
      const resolvers = [...session.completionResolvers];
      session.completionResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    },
    markFailed(session, error) {
      session.status = 'failed';
      session.error = error;
      touch(session);
      const resolvers = [...session.completionResolvers];
      session.completionResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    },
    onSettled(session) {
      if (session.status !== 'streaming') {
        return Promise.resolve();
      }
      return new Promise(resolve => {
        session.completionResolvers.push(resolve);
      });
    },
    cleanupExpired() {
      const expireBefore = now() - ttlMs;
      for (const [sessionId, session] of sessions.entries()) {
        if (session.lastAccessAt < expireBefore) {
          if (session.activeResponse && !session.activeResponse.writableEnded) {
            session.activeResponse.end();
          }
          sessions.delete(sessionId);
        }
      }
    }
  };
};

const writeSseChunk = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const writeSseDone = (res) => {
  res.write('event: done\ndata: [DONE]\n\n');
};

const writeSseError = (res, error) => {
  writeSseChunk(res, { error });
};

const attachSseHeaders = (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
};

const parseConversationHistory = (conversationHistory) => {
  if (!conversationHistory) {
    return [];
  }

  if (Array.isArray(conversationHistory)) {
    return conversationHistory;
  }

  try {
    return JSON.parse(conversationHistory);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(conversationHistory));
    } catch {
      return [];
    }
  }
};

const createApp = () => {
  const app = express();

  require('dotenv').config();
  app.use(express.json({ limit: '2mb' }));

  const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  const NODE_ENV = process.env.NODE_ENV || 'development';

  app.use(cors({
    origin: NODE_ENV === 'production' ? ALLOWED_ORIGINS : true,
    credentials: false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }));

  const requestCounts = new Map();
  const RATE_LIMIT = 30;
  const WINDOW_MS = 60 * 1000;
  const sessionStore = createSessionStore();

  const cleanupTimer = setInterval(() => {
    sessionStore.cleanupExpired();
  }, CLEANUP_INTERVAL_MS);

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  const getRateLimitError = (req) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    if (!requestCounts.has(clientIP)) {
      requestCounts.set(clientIP, []);
    }

    const requests = requestCounts.get(clientIP).filter(time => time > windowStart);

    if (requests.length >= RATE_LIMIT) {
      return '请求过于频繁，请稍后再试';
    }

    requests.push(now);
    requestCounts.set(clientIP, requests);
    return null;
  };

  const getInputError = (message) => {
    if (!message || typeof message !== 'string') {
      return '消息不能为空';
    }

    if (message.length > 4000) {
      return '消息长度不能超过4000字符';
    }

    return null;
  };

  const buildMessages = (payload) => {
    const parsedConversationHistory = parseConversationHistory(payload.conversationHistory);

    return [
      {
        role: 'system',
        content: '你是一个专业的编程助手，专门帮助用户解决 React/TypeScript 相关问题。请用中文回答，提供准确实用的建议。'
      },
      ...parsedConversationHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: payload.context ? `上下文：${payload.context}\n\n问题：${payload.message}` : payload.message
      }
    ];
  };

  const endResponse = (session, res) => {
    if (!res.writableEnded) {
      res.end();
    }
    sessionStore.clearActiveResponse(session, res);
  };

  const connectResponse = (session, res) => {
    if (session.activeResponse && session.activeResponse !== res && !session.activeResponse.writableEnded) {
      session.activeResponse.end();
    }

    sessionStore.setActiveResponse(session, res);

    res.on('close', () => {
      sessionStore.clearActiveResponse(session, res);
    });
  };

  const flushReplayChunks = (session, res, lastEventIndex) => {
    const replayChunks = sessionStore.replayFrom(session, lastEventIndex);
    for (const chunk of replayChunks) {
      writeSseChunk(res, chunk);
    }
  };

  const streamUpstream = async (session) => {
    const requestApiKey = typeof session.requestPayload.apiKey === 'string'
      ? session.requestPayload.apiKey.trim()
      : '';
    if (!requestApiKey) {
      throw new Error('apiKey is required');
    }

    if (session.streamStarted) {
      return;
    }

    session.streamStarted = true;

    try {
      const messages = buildMessages(session.requestPayload);
      const requestedModel = session.requestPayload.model || DEFAULT_MODEL;
      const finalModel = /^gpt-/.test(requestedModel) ? DEFAULT_MODEL : requestedModel;
      const chatCompletionsUrl = `${DEEPSEEK_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`;

      const response = await fetch(chatCompletionsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${requestApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: finalModel,
          messages,
          stream: true,
          max_tokens: Number(session.requestPayload.maxTokens) || 1000,
          temperature: Number(session.requestPayload.temperature) || 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data: ')) {
              continue;
            }

            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              sessionStore.markCompleted(session);
              const activeResponse = session.activeResponse;
              if (activeResponse && !activeResponse.writableEnded) {
                writeSseDone(activeResponse);
                session.completionSent = true;
                endResponse(session, activeResponse);
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (!content) {
                continue;
              }

              const chunk = sessionStore.appendChunk(session, content);
              if (session.activeResponse && !session.activeResponse.writableEnded) {
                writeSseChunk(session.activeResponse, chunk);
              }
            } catch {
              // ignore malformed upstream line
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      sessionStore.markCompleted(session);
      const activeResponse = session.activeResponse;
      if (activeResponse && !activeResponse.writableEnded) {
        writeSseDone(activeResponse);
        session.completionSent = true;
        endResponse(session, activeResponse);
      }
    } catch (error) {
      const causeMessage = error?.cause?.message;
      const causeCode = error?.cause?.code;
      const details = causeMessage ? `${causeMessage}${causeCode ? ` (${causeCode})` : ''}` : (causeCode ? `(${causeCode})` : '');
      const message = details ? `${error?.message || '请求失败'}: ${details}` : (error?.message || '请求失败');
      sessionStore.markFailed(session, message);
      const activeResponse = session.activeResponse;
      if (activeResponse && !activeResponse.writableEnded) {
        writeSseError(activeResponse, message);
        endResponse(session, activeResponse);
      }
    }
  };

  const streamChat = async (req, res, payload) => {
    attachSseHeaders(res);

    const request = normalizeStreamRequest(payload);

    if (!request.sessionId) {
      writeSseError(res, 'sessionId 缺失');
      return res.end();
    }

    let session = sessionStore.getSession(request.sessionId);
    const isReconnect = session !== null;

    if (isReconnect && !isSameRequestPayload(session.requestPayload, request)) {
      writeSseError(res, 'session 参数不一致，无法恢复');
      return res.end();
    }

    const rateLimitError = getRateLimitError(req);
    if (rateLimitError) {
      writeSseError(res, rateLimitError);
      writeSseDone(res);
      return res.end();
    }

    const inputError = getInputError(request.message);
    if (inputError) {
      writeSseError(res, inputError);
      writeSseDone(res);
      return res.end();
    }

    if (!session) {
      session = sessionStore.createSession(request.sessionId, request);
    }

    connectResponse(session, res);
    flushReplayChunks(session, res, request.lastEventIndex);

    if (session.status === 'completed') {
      writeSseDone(res);
      return endResponse(session, res);
    }

    if (session.status === 'failed') {
      writeSseError(res, session.error || '请求失败');
      return endResponse(session, res);
    }

    if (!isReconnect) {
      void streamUpstream(session);
      return;
    }

    await sessionStore.onSettled(session);

    if (!res.writableEnded) {
      flushReplayChunks(session, res, request.lastEventIndex);
      if (session.status === 'completed') {
        writeSseDone(res);
      } else if (session.status === 'failed') {
        writeSseError(res, session.error || '请求失败');
      }
      endResponse(session, res);
    }
  };

  app.get('/api/chat-stream', async (req, res) => {
    return streamChat(req, res, req.query);
  });

  app.post('/api/chat-stream', async (req, res) => {
    return streamChat(req, res, req.body || {});
  });

  return {
    app,
    sessionStore
  };
};

const { app } = createApp();
const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SSE API server running on port ${PORT}`);
  });
}

module.exports = {
  createApp,
  createSessionStore,
  normalizeStreamRequest,
  isSameRequestPayload
};
