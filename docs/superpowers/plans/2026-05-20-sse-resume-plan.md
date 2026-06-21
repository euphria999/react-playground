# SSE 重连与断点续传 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI 助手的流式响应增加自动重连、按事件序号精确续传、5 分钟短时缓存与完成态补尾能力。

**Architecture:** 保持现有 `POST /api/chat-stream + fetch + ReadableStream` 架构不变，在服务端增加基于 `sessionId` 的内存会话缓存和 chunk 索引广播能力，在前端增加 `sessionId`、`lastEventIndex`、断线重连与去重拼接逻辑。服务端负责缓存与补发，前端负责断点状态与用户提示。

**Tech Stack:** React 19, TypeScript, Zustand, Express, SSE (`text/event-stream`), Vite

---

## 文件结构与职责

- 修改 `C:/Users/25854/Desktop/前端/react-playground/api/chat.cjs`
  - 增加流式 session 内存缓存
  - 增加 chunk 编号、重连补发、完成态补尾、失败态返回
  - 增加 session 过期清理
- 修改 `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/services/optimizedAI.ts`
  - 增加 `sessionId / lastEventIndex` 传参与解析
  - 增加自动重连、指数退避、按 index 去重
  - 增加恢复中状态回调
- 修改 `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/stores/aiStore.ts`
  - 接入恢复中状态
  - 在 UI 消息层展示恢复提示和最终错误
- 修改 `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/components/AIAssistant/index.tsx`
  - 渲染恢复中的轻提示
- 修改 `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/components/AIAssistant/index.module.scss`
  - 增加恢复提示样式
- 新增 `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/services/optimizedAI.test.ts`
  - 覆盖前端流解析、去重、重连与停止重连行为
- 新增 `C:/Users/25854/Desktop/前端/react-playground/api/chat.session.test.cjs`
  - 覆盖服务端 session 行为和补发逻辑

## 实施约束

- 保持现有接口地址不变，继续使用 `POST /api/chat-stream`
- 不引入 Redis 或数据库，session 缓存仅保存在内存中
- session 过期时间固定为 5 分钟
- 同一个 `sessionId` 同时只保留一个活跃连接
- 继续保留现有缓冲刷新机制，避免高频 UI 更新

## Task 1: 为服务端 session 管理提炼可测试结构

**Files:**
- Modify: `C:/Users/25854/Desktop/前端/react-playground/api/chat.cjs`
- Test: `C:/Users/25854/Desktop/前端/react-playground/api/chat.session.test.cjs`

- [ ] **Step 1: 写服务端 session 管理的失败测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSessionStore
} = require('./chat.cjs');

test('createSessionStore creates a streaming session with empty chunks', () => {
  const store = createSessionStore({ now: () => 1000, ttlMs: 300000 });
  const session = store.createSession('s1', {
    message: 'hello',
    context: 'ctx',
    conversationHistory: [],
    model: 'deepseek-chat',
    maxTokens: 1000,
    temperature: 0.3
  });

  assert.equal(session.sessionId, 's1');
  assert.equal(session.status, 'streaming');
  assert.deepEqual(session.chunks, []);
  assert.equal(session.error, null);
  assert.equal(session.activeResponse, null);
  assert.equal(session.lastAccessAt, 1000);
});
```

- [ ] **Step 2: 运行单测确认它先失败**

Run: `node --test api/chat.session.test.cjs`
Expected: FAIL，提示 `createSessionStore is not a function` 或未导出

- [ ] **Step 3: 在服务端实现最小 session store 导出**

```js
const createSessionStore = ({ now = () => Date.now(), ttlMs = 5 * 60 * 1000 } = {}) => {
  const sessions = new Map();

  return {
    sessions,
    createSession(sessionId, requestPayload) {
      const session = {
        sessionId,
        requestPayload,
        chunks: [],
        status: 'streaming',
        error: null,
        activeResponse: null,
        lastAccessAt: now()
      };
      sessions.set(sessionId, session);
      return session;
    }
  };
};

module.exports.createSessionStore = createSessionStore;
```

- [ ] **Step 4: 运行单测确认通过**

Run: `node --test api/chat.session.test.cjs`
Expected: PASS，1 个测试通过

- [ ] **Step 5: 提交这一小步**

```bash
git add api/chat.cjs api/chat.session.test.cjs
git commit -m "test: scaffold stream session store"
```

## Task 2: 为服务端补发、完成态和清理补测试并实现

**Files:**
- Modify: `C:/Users/25854/Desktop/前端/react-playground/api/chat.cjs`
- Test: `C:/Users/25854/Desktop/前端/react-playground/api/chat.session.test.cjs`

- [ ] **Step 1: 写补发与清理的失败测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { createSessionStore } = require('./chat.cjs');

test('replayFrom returns chunks after lastEventIndex', () => {
  const store = createSessionStore({ now: () => 1000, ttlMs: 300000 });
  const session = store.createSession('s1', { message: 'hello' });
  store.appendChunk(session, 'A');
  store.appendChunk(session, 'B');
  store.appendChunk(session, 'C');

  assert.deepEqual(store.replayFrom(session, 0), [
    { index: 1, content: 'B' },
    { index: 2, content: 'C' }
  ]);
});

test('markCompleted updates session status', () => {
  const store = createSessionStore({ now: () => 1000, ttlMs: 300000 });
  const session = store.createSession('s1', { message: 'hello' });
  store.markCompleted(session);

  assert.equal(session.status, 'completed');
  assert.equal(session.error, null);
});

test('cleanupExpired removes expired sessions', () => {
  let current = 1000;
  const store = createSessionStore({ now: () => current, ttlMs: 100 });
  store.createSession('s1', { message: 'hello' });

  current = 1201;
  store.cleanupExpired();

  assert.equal(store.sessions.has('s1'), false);
});
```

- [ ] **Step 2: 运行单测确认它们失败**

Run: `node --test api/chat.session.test.cjs`
Expected: FAIL，提示 `appendChunk` / `replayFrom` / `markCompleted` / `cleanupExpired` 缺失

- [ ] **Step 3: 实现 chunk 追加、补发、完成态和清理逻辑**

```js
appendChunk(session, content) {
  const chunk = {
    index: session.chunks.length,
    content
  };
  session.chunks.push(chunk);
  session.lastAccessAt = now();
  return chunk;
},
replayFrom(session, lastEventIndex = -1) {
  session.lastAccessAt = now();
  return session.chunks.filter(chunk => chunk.index > lastEventIndex);
},
markCompleted(session) {
  session.status = 'completed';
  session.error = null;
  session.lastAccessAt = now();
},
markFailed(session, error) {
  session.status = 'failed';
  session.error = error;
  session.lastAccessAt = now();
},
cleanupExpired() {
  const expireBefore = now() - ttlMs;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.lastAccessAt < expireBefore) {
      sessions.delete(sessionId);
    }
  }
}
```

- [ ] **Step 4: 运行单测确认通过**

Run: `node --test api/chat.session.test.cjs`
Expected: PASS，新增的 3 个测试全部通过

- [ ] **Step 5: 提交这一小步**

```bash
git add api/chat.cjs api/chat.session.test.cjs
git commit -m "test: cover stream replay and cleanup"
```

## Task 3: 将服务端流处理接入 session 与重连协议

**Files:**
- Modify: `C:/Users/25854/Desktop/前端/react-playground/api/chat.cjs`
- Test: `C:/Users/25854/Desktop/前端/react-playground/api/chat.session.test.cjs`

- [ ] **Step 1: 写协议层失败测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSessionStore,
  normalizeStreamRequest
} = require('./chat.cjs');

test('normalizeStreamRequest parses sessionId and lastEventIndex', () => {
  const request = normalizeStreamRequest({
    sessionId: 's1',
    lastEventIndex: '4',
    message: 'hello'
  });

  assert.equal(request.sessionId, 's1');
  assert.equal(request.lastEventIndex, 4);
  assert.equal(request.message, 'hello');
});

test('normalizeStreamRequest defaults lastEventIndex to -1', () => {
  const request = normalizeStreamRequest({
    sessionId: 's1',
    message: 'hello'
  });

  assert.equal(request.lastEventIndex, -1);
});
```

- [ ] **Step 2: 运行单测确认它先失败**

Run: `node --test api/chat.session.test.cjs`
Expected: FAIL，提示 `normalizeStreamRequest` 未导出

- [ ] **Step 3: 实现请求标准化与 session 接管骨架**

```js
const normalizeStreamRequest = (payload = {}) => ({
  sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : '',
  lastEventIndex: Number.isFinite(Number(payload.lastEventIndex))
    ? Number(payload.lastEventIndex)
    : -1,
  message: payload.message,
  context: payload.context,
  conversationHistory: payload.conversationHistory,
  model: payload.model,
  maxTokens: payload.maxTokens,
  temperature: payload.temperature
});

module.exports.normalizeStreamRequest = normalizeStreamRequest;
```

在 `streamChat` 中接入以下规则：

```js
const request = normalizeStreamRequest(payload);
const { sessionId, lastEventIndex } = request;

if (!sessionId) {
  res.write(`data: ${JSON.stringify({ error: 'sessionId 缺失' })}\n\n`);
  return res.end();
}

let session = sessionStore.sessions.get(sessionId);
if (!session) {
  session = sessionStore.createSession(sessionId, request);
  startUpstream = true;
} else {
  const samePayload = isSameRequestPayload(session.requestPayload, request);
  if (!samePayload) {
    res.write(`data: ${JSON.stringify({ error: 'session 参数不一致，无法恢复' })}\n\n`);
    return res.end();
  }
}
```

- [ ] **Step 4: 运行单测确认通过**

Run: `node --test api/chat.session.test.cjs`
Expected: PASS，`normalizeStreamRequest` 用例通过

- [ ] **Step 5: 提交这一小步**

```bash
git add api/chat.cjs api/chat.session.test.cjs
git commit -m "feat: normalize stream resume protocol"
```

## Task 4: 为前端流解析与重连提炼可测试单元

**Files:**
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/services/optimizedAI.ts`
- Test: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/services/optimizedAI.test.ts`

- [ ] **Step 1: 写前端协议解析失败测试**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildStreamRequestPayload,
  createChunkAccumulator
} from './optimizedAI';

describe('buildStreamRequestPayload', () => {
  it('includes sessionId and lastEventIndex when reconnecting', () => {
    const payload = buildStreamRequestPayload({
      sessionId: 's1',
      lastEventIndex: 3,
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
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `npx vitest run src/ReactPlayground/services/optimizedAI.test.ts`
Expected: FAIL，提示 `buildStreamRequestPayload` 或 `createChunkAccumulator` 未导出

- [ ] **Step 3: 在前端实现最小可测试辅助函数**

```ts
export type StreamRequestPayload = {
  sessionId: string;
  lastEventIndex?: number;
  message: string;
  context?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  model: string;
  maxTokens: number;
  temperature: number;
};

export const buildStreamRequestPayload = (payload: StreamRequestPayload) => payload;

export const createChunkAccumulator = () => {
  const seenIndexes = new Set<number>();
  let lastEventIndex = -1;

  return {
    get lastEventIndex() {
      return lastEventIndex;
    },
    apply(chunk: { index: number; content: string }) {
      if (seenIndexes.has(chunk.index)) {
        return '';
      }
      seenIndexes.add(chunk.index);
      lastEventIndex = Math.max(lastEventIndex, chunk.index);
      return chunk.content;
    }
  };
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/ReactPlayground/services/optimizedAI.test.ts`
Expected: PASS，2 个测试通过

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ReactPlayground/services/optimizedAI.ts src/ReactPlayground/services/optimizedAI.test.ts
git commit -m "test: scaffold client stream resume helpers"
```

## Task 5: 实现前端自动重连与断点去重

**Files:**
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/services/optimizedAI.ts`
- Test: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/services/optimizedAI.test.ts`

- [ ] **Step 1: 写重连行为失败测试**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createReconnectPolicy } from './optimizedAI';

describe('createReconnectPolicy', () => {
  it('retries three times with incremental delays', () => {
    const policy = createReconnectPolicy();

    expect(policy.nextDelay(0)).toBe(500);
    expect(policy.nextDelay(1)).toBe(1000);
    expect(policy.nextDelay(2)).toBe(2000);
    expect(policy.shouldRetry(3)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `npx vitest run src/ReactPlayground/services/optimizedAI.test.ts`
Expected: FAIL，提示 `createReconnectPolicy` 未导出

- [ ] **Step 3: 实现重连策略并接入主流处理函数**

```ts
export const createReconnectPolicy = () => ({
  shouldRetry(attempt: number) {
    return attempt < 3;
  },
  nextDelay(attempt: number) {
    return [500, 1000, 2000][attempt] ?? 2000;
  }
});
```

在 `chatStreamOptimized` 中实现以下行为：

```ts
- 首次请求生成 `sessionId`
- 维护 `attempt`、`isCancelled`、`isRecovering`
- 每次请求都带 `sessionId`
- 断线错误且未完成时，根据 `createReconnectPolicy()` 决定是否重试
- 重试请求携带 `lastEventIndex`
- 收到 chunk 后通过 `createChunkAccumulator().apply(...)` 去重
- 恢复开始时触发 `onStatusChange?.('recovering')`
- 恢复成功后触发 `onStatusChange?.('streaming')`
- 超过重试次数或 session 过期时抛出最终错误
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/ReactPlayground/services/optimizedAI.test.ts`
Expected: PASS，包含重连策略的测试全部通过

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ReactPlayground/services/optimizedAI.ts src/ReactPlayground/services/optimizedAI.test.ts
git commit -m "feat: add client reconnect and dedupe"
```

## Task 6: 将恢复状态接入 Zustand 与 AI 助手界面

**Files:**
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/stores/aiStore.ts`
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/components/AIAssistant/index.tsx`
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/components/AIAssistant/index.module.scss`

- [ ] **Step 1: 写界面状态失败测试或最小行为断言**

```ts
// 如果仓库当前没有组件测试基建，先在 store 层写纯逻辑断言：
import { describe, expect, it } from 'vitest';
import { getNextAssistantStatus } from '../services/optimizedAI';

describe('getNextAssistantStatus', () => {
  it('maps recovering status to reconnect hint', () => {
    expect(getNextAssistantStatus('recovering')).toEqual({
      isStreaming: true,
      reconnectHint: '连接中断，正在恢复...'
    });
  });
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `npx vitest run src/ReactPlayground/services/optimizedAI.test.ts`
Expected: FAIL，提示 `getNextAssistantStatus` 未导出

- [ ] **Step 3: 实现 store 状态与 UI 提示**

在 `aiStore.ts` 中补：

```ts
aiAssistant: {
  isOpen: false,
  messages: [],
  isLoading: false,
  isStreaming: false,
  reconnectHint: ''
}
```

并在调用 `chatStreamOptimized` 时传入状态回调：

```ts
(status) => {
  if (status === 'recovering') {
    setAIAssistant({ isStreaming: true, reconnectHint: '连接中断，正在恢复...' });
    return;
  }

  setAIAssistant({ isStreaming: true, reconnectHint: '' });
}
```

在 `AIAssistant/index.tsx` 中渲染：

```tsx
{aiAssistant.reconnectHint ? (
  <div className={styles.reconnectHint}>{aiAssistant.reconnectHint}</div>
) : null}
```

在 `index.module.scss` 中增加：

```scss
.reconnectHint {
  margin: 8px 0;
  color: #b26a00;
  font-size: 12px;
  line-height: 1.4;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/ReactPlayground/services/optimizedAI.test.ts`
Expected: PASS，状态映射测试通过

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ReactPlayground/stores/aiStore.ts src/ReactPlayground/components/AIAssistant/index.tsx src/ReactPlayground/components/AIAssistant/index.module.scss src/ReactPlayground/services/optimizedAI.ts src/ReactPlayground/services/optimizedAI.test.ts
git commit -m "feat: show reconnect hint in ai assistant"
```

## Task 7: 全量验证与回归

**Files:**
- Modify: `C:/Users/25854/Desktop/前端/react-playground/api/chat.cjs`
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/services/optimizedAI.ts`
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/stores/aiStore.ts`
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/components/AIAssistant/index.tsx`
- Modify: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/components/AIAssistant/index.module.scss`
- Test: `C:/Users/25854/Desktop/前端/react-playground/api/chat.session.test.cjs`
- Test: `C:/Users/25854/Desktop/前端/react-playground/src/ReactPlayground/services/optimizedAI.test.ts`

- [ ] **Step 1: 运行服务端测试**

Run: `node --test api/chat.session.test.cjs`
Expected: PASS，所有 session 行为测试通过

- [ ] **Step 2: 运行前端测试**

Run: `npx vitest run src/ReactPlayground/services/optimizedAI.test.ts`
Expected: PASS，所有重连与去重测试通过

- [ ] **Step 3: 运行类型构建验证**

Run: `npm run build`
Expected: PASS，TypeScript 与 Vite 构建成功

- [ ] **Step 4: 手动联调验证**

Run: `npm run dev:full`
Expected:
- 发送 AI 消息后正常流式输出
- 人为断开后出现“连接中断，正在恢复...”
- 恢复后从断点继续，不重复拼接
- 完成后提示消失

- [ ] **Step 5: 提交最终结果**

```bash
git add api/chat.cjs api/chat.session.test.cjs src/ReactPlayground/services/optimizedAI.ts src/ReactPlayground/services/optimizedAI.test.ts src/ReactPlayground/stores/aiStore.ts src/ReactPlayground/components/AIAssistant/index.tsx src/ReactPlayground/components/AIAssistant/index.module.scss
git commit -m "feat: add sse reconnect and resume support"
```

## 计划自检

- 规格覆盖：
  - `sessionId / lastEventIndex` 协议：Task 3、Task 4、Task 5
  - 服务端 chunk 缓存与精确补发：Task 1、Task 2、Task 3
  - 单连接接管：Task 3
  - 5 分钟过期清理：Task 2、Task 3
  - 前端自动重连与轻提示：Task 5、Task 6
  - 去重与最终一致性：Task 4、Task 5
  - 测试与联调：Task 7
- 占位符检查：
  - 没有 `TODO`、`TBD`、`类似 Task N`
  - 每个任务都给了明确文件、命令和代码骨架
- 类型一致性：
  - 使用统一命名：`sessionId`、`lastEventIndex`、`activeResponse`、`reconnectHint`

