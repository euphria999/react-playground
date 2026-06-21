# Pico Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 React AI 助手升级为由 `pico` 驱动的仓库代理，支持结构化事件流、聊天流内审批卡片、持续会话与受限写入执行。

**Architecture:** 保留现有 `React + Node` 结构，在后端新增 pico agent gateway，负责启动/恢复 pico 运行、读取 `.pico` 工件并转译为统一 SSE 事件流。前端把原先的纯文本流服务升级为 agent 事件流服务，并在 store 和聊天 UI 中渲染工具步骤、审批状态和运行总结。

**Tech Stack:** React 19、TypeScript、Zustand、Vite、Vitest、Node.js、Express、SSE、Python pico CLI

---

## 文件结构

### 新增文件

- `api/agent/agentSessions.cjs`
  - 管理前端 session 与 pico session/run 的映射。
- `api/agent/agentRunner.cjs`
  - 启动 pico 子进程，管理 run 生命周期。
- `api/agent/eventTranslator.cjs`
  - 将 `.pico` 工件和运行状态转为统一前端事件。
- `api/agent/approvalStore.cjs`
  - 管理 pending approval、允许/拒绝和恢复执行。
- `api/agent/routes.cjs`
  - 暴露 `/api/agent/run`、`/stream`、`/approval`、`/cancel`、`/session`。
- `api/agent/agent.test.cjs`
  - 覆盖 session、事件流、审批流集成测试。
- `src/ReactPlayground/services/agentStream.ts`
  - 前端 agent 事件流客户端，替代纯文本流能力。
- `src/ReactPlayground/services/agentStream.test.ts`
  - 覆盖事件解析、审批提交流程。
- `src/ReactPlayground/components/AIAssistant/ToolStepCard.tsx`
  - 渲染工具步骤卡片。
- `src/ReactPlayground/components/AIAssistant/ApprovalCard.tsx`
  - 渲染审批卡片。
- `src/ReactPlayground/components/AIAssistant/RunSummaryCard.tsx`
  - 渲染运行总结。

### 修改文件

- `api/chat.cjs`
  - 从 DeepSeek 直连入口调整为挂载 agent 路由，并保留兼容能力或替换旧入口。
- `src/ReactPlayground/stores/aiStore.ts`
  - 扩展消息模型、运行状态、审批状态、会话状态。
- `src/ReactPlayground/components/AIAssistant/index.tsx`
  - 接入 agent 事件流与新卡片。
- `src/ReactPlayground/components/AIAssistant/MessageItem.tsx`
  - 允许渲染非纯文本消息项。
- `src/ReactPlayground/components/AIAssistant/index.module.scss`
  - 增加工具步骤、审批卡片、运行状态样式。
- `src/ReactPlayground/stores/index.ts`
  - 导出新增状态类型或 service 依赖。

### 参考文件

- `C:/Users/25854/pico/pico/cli.py`
- `C:/Users/25854/pico/pico/runtime.py`
- `C:/Users/25854/pico/pico/run_store.py`
- `C:/Users/25854/pico/README.md`
- `docs/superpowers/specs/2026-06-03-pico-agent-integration-design.md`

## 事件与状态约定

### 后端 SSE 事件类型

```ts
type AgentSseEvent =
  | { type: 'message_start'; runId: string; messageId: string }
  | { type: 'message_delta'; runId: string; messageId: string; content: string }
  | { type: 'message_end'; runId: string; messageId: string }
  | { type: 'tool_call'; runId: string; toolCallId: string; toolName: string; summary: string; status: 'running' }
  | { type: 'tool_result'; runId: string; toolCallId: string; summary: string; status: 'completed' | 'failed' }
  | { type: 'approval_required'; runId: string; approvalId: string; actionType: string; title: string; target: string; summary: string; riskLevel: 'low' | 'medium' | 'high'; argumentsPreview: string }
  | { type: 'approval_resolved'; runId: string; approvalId: string; decision: 'approved' | 'rejected'; reason: string }
  | { type: 'run_status'; runId: string; status: 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'; detail?: string }
  | { type: 'run_summary'; runId: string; summary: string; changedFiles: string[]; executedCommands: string[] };
```

### 前端消息模型

```ts
type AgentTimelineItem =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; content: string; status?: 'streaming' | 'done' }
  | { id: string; kind: 'tool'; toolName: string; summary: string; status: 'running' | 'completed' | 'failed' }
  | { id: string; kind: 'approval'; approvalId: string; title: string; target: string; summary: string; riskLevel: 'low' | 'medium' | 'high'; status: 'pending' | 'approved' | 'rejected' }
  | { id: string; kind: 'summary'; summary: string; changedFiles: string[]; executedCommands: string[] };
```

### 审批判定基线

首版将以下动作统一视为需要审批：

```txt
write_file
patch_file
delete_file
run_shell
```

---

### Task 1: 固化后端事件协议与测试基线

**Files:**
- Create: `api/agent/eventTranslator.cjs`
- Create: `api/agent/agent.test.cjs`
- Modify: `api/chat.cjs`

- [ ] **Step 1: 先写事件转译器的失败测试**

```js
const { describe, it, expect } = require('vitest');
const { translateTraceEvent, buildRunStatusEvent } = require('./eventTranslator.cjs');

describe('eventTranslator', () => {
  it('maps tool events into frontend tool_call payload', () => {
    const event = translateTraceEvent({
      event: 'tool_started',
      tool_name: 'read_file',
      args: { path: 'src/App.tsx' },
      step_id: 'step-1'
    }, 'run-1');

    expect(event).toEqual({
      type: 'tool_call',
      runId: 'run-1',
      toolCallId: 'step-1',
      toolName: 'read_file',
      summary: '读取 src/App.tsx',
      status: 'running'
    });
  });

  it('builds waiting approval status event', () => {
    expect(buildRunStatusEvent('run-1', 'waiting_approval', '等待用户审批')).toEqual({
      type: 'run_status',
      runId: 'run-1',
      status: 'waiting_approval',
      detail: '等待用户审批'
    });
  });
});
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: FAIL，提示 `Cannot find module './eventTranslator.cjs'` 或缺少导出函数。

- [ ] **Step 3: 实现最小事件转译器**

```js
const TOOL_SUMMARY = {
  read_file: (args = {}) => `读取 ${args.path || '文件'}`,
  search: (args = {}) => `搜索 ${args.pattern || '内容'}`,
  patch_file: (args = {}) => `修改 ${args.path || '文件'}`,
  write_file: (args = {}) => `写入 ${args.path || '文件'}`,
  run_shell: (args = {}) => `执行命令 ${args.command || ''}`.trim()
};

function buildRunStatusEvent(runId, status, detail) {
  return { type: 'run_status', runId, status, detail };
}

function translateTraceEvent(traceEvent, runId) {
  if (traceEvent.event === 'tool_started') {
    return {
      type: 'tool_call',
      runId,
      toolCallId: traceEvent.step_id || `${traceEvent.tool_name}-step`,
      toolName: traceEvent.tool_name,
      summary: (TOOL_SUMMARY[traceEvent.tool_name] || (() => traceEvent.tool_name))(traceEvent.args),
      status: 'running'
    };
  }

  if (traceEvent.event === 'tool_finished') {
    return {
      type: 'tool_result',
      runId,
      toolCallId: traceEvent.step_id || `${traceEvent.tool_name}-step`,
      summary: String(traceEvent.result || '工具执行完成').slice(0, 160),
      status: traceEvent.error ? 'failed' : 'completed'
    };
  }

  return null;
}

module.exports = {
  buildRunStatusEvent,
  translateTraceEvent
};
```

- [ ] **Step 4: 再次运行测试确认通过**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: PASS，`eventTranslator` 用例全部通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add api/agent/eventTranslator.cjs api/agent/agent.test.cjs
git commit -m "test: define pico agent event translator"
```

### Task 2: 搭建后端 session 与 run 管理骨架

**Files:**
- Create: `api/agent/agentSessions.cjs`
- Create: `api/agent/agentRunner.cjs`
- Modify: `api/agent/agent.test.cjs`

- [ ] **Step 1: 写 session manager 的失败测试**

```js
const { describe, it, expect } = require('vitest');
const { createAgentSessionStore } = require('./agentSessions.cjs');

describe('agentSessions', () => {
  it('creates frontend session records with pico session metadata', () => {
    const store = createAgentSessionStore();
    const session = store.createSession({ cwd: 'C:/repo', provider: 'deepseek' });

    expect(session.frontendSessionId).toBeTruthy();
    expect(session.cwd).toBe('C:/repo');
    expect(session.provider).toBe('deepseek');
    expect(session.currentRunId).toBe(null);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: FAIL，提示缺少 `createAgentSessionStore`。

- [ ] **Step 3: 实现 session store 和 runner 骨架**

```js
const crypto = require('crypto');

function createAgentSessionStore() {
  const sessions = new Map();

  return {
    createSession({ cwd, provider }) {
      const frontendSessionId = crypto.randomUUID();
      const session = {
        frontendSessionId,
        picoSessionId: null,
        currentRunId: null,
        cwd,
        provider,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      sessions.set(frontendSessionId, session);
      return session;
    },
    getSession(frontendSessionId) {
      return sessions.get(frontendSessionId) || null;
    },
    updateSession(frontendSessionId, updates) {
      const current = sessions.get(frontendSessionId);
      if (!current) return null;
      const next = { ...current, ...updates, updatedAt: Date.now() };
      sessions.set(frontendSessionId, next);
      return next;
    }
  };
}

module.exports = { createAgentSessionStore };
```

```js
function createAgentRunner(deps) {
  return {
    async startRun({ session, userMessage }) {
      return {
        runId: `run-${Date.now()}`,
        sessionId: session.frontendSessionId,
        userMessage
      };
    }
  };
}

module.exports = { createAgentRunner };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: PASS，session manager 用例通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add api/agent/agentSessions.cjs api/agent/agentRunner.cjs api/agent/agent.test.cjs
git commit -m "feat: add pico agent session and run scaffolding"
```

### Task 3: 接入 pico 子进程启动与运行目录定位

**Files:**
- Modify: `api/agent/agentRunner.cjs`
- Modify: `api/agent/agent.test.cjs`

- [ ] **Step 1: 写 runner 的失败测试，校验启动参数**

```js
const { describe, it, expect, vi } = require('vitest');
const { createAgentRunner } = require('./agentRunner.cjs');

describe('agentRunner', () => {
  it('spawns pico with repo cwd and approval ask policy', async () => {
    const spawn = vi.fn(() => ({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    }));

    const runner = createAgentRunner({ spawn, picoRoot: 'C:/Users/25854/pico' });
    await runner.startRun({
      session: { frontendSessionId: 'session-1', cwd: 'C:/repo', provider: 'deepseek' },
      userMessage: '分析这个项目'
    });

    expect(spawn).toHaveBeenCalledWith(
      'python',
      expect.arrayContaining([
        '-m',
        'pico',
        '--cwd',
        'C:/repo',
        '--provider',
        'deepseek',
        '--approval',
        'ask',
        '分析这个项目'
      ]),
      expect.objectContaining({
        cwd: 'C:/Users/25854/pico'
      })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: FAIL，`spawn` 未被正确调用。

- [ ] **Step 3: 实现 pico 启动逻辑**

```js
const path = require('path');
const { spawn: nodeSpawn } = require('child_process');

function createAgentRunner({ spawn = nodeSpawn, picoRoot }) {
  return {
    async startRun({ session, userMessage }) {
      const args = [
        '-m',
        'pico',
        '--cwd',
        session.cwd,
        '--provider',
        session.provider || 'deepseek',
        '--approval',
        'ask',
        userMessage
      ];

      const child = spawn('python', args, {
        cwd: picoRoot,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const runId = `run-${Date.now()}`;
      const runsRoot = path.join(session.cwd, '.pico', 'runs');

      return {
        runId,
        runsRoot,
        child
      };
    }
  };
}

module.exports = { createAgentRunner };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: PASS，runner 启动参数断言通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add api/agent/agentRunner.cjs api/agent/agent.test.cjs
git commit -m "feat: wire pico process runner"
```

### Task 4: 建立审批存储与后端挂起状态

**Files:**
- Create: `api/agent/approvalStore.cjs`
- Modify: `api/agent/eventTranslator.cjs`
- Modify: `api/agent/agent.test.cjs`

- [ ] **Step 1: 先写审批状态的失败测试**

```js
const { describe, it, expect } = require('vitest');
const { createApprovalStore } = require('./approvalStore.cjs');

describe('approvalStore', () => {
  it('creates and resolves pending approvals', () => {
    const store = createApprovalStore();
    const approval = store.create({
      runId: 'run-1',
      actionType: 'patch_file',
      title: '修改文件',
      target: 'src/App.tsx',
      summary: '准备修改 src/App.tsx'
    });

    expect(approval.status).toBe('pending');

    const resolved = store.resolve(approval.approvalId, 'approved', '用户允许');
    expect(resolved.status).toBe('approved');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: FAIL，找不到 `createApprovalStore`。

- [ ] **Step 3: 实现 approval store 和审批事件构造函数**

```js
const crypto = require('crypto');

function createApprovalStore() {
  const approvals = new Map();

  return {
    create(payload) {
      const approval = {
        approvalId: crypto.randomUUID(),
        status: 'pending',
        riskLevel: 'high',
        argumentsPreview: '',
        ...payload
      };
      approvals.set(approval.approvalId, approval);
      return approval;
    },
    get(approvalId) {
      return approvals.get(approvalId) || null;
    },
    resolve(approvalId, decision, reason) {
      const current = approvals.get(approvalId);
      if (!current) return null;
      const next = {
        ...current,
        status: decision === 'approved' ? 'approved' : 'rejected',
        reason
      };
      approvals.set(approvalId, next);
      return next;
    }
  };
}

module.exports = { createApprovalStore };
```

```js
function buildApprovalRequiredEvent(approval) {
  return {
    type: 'approval_required',
    runId: approval.runId,
    approvalId: approval.approvalId,
    actionType: approval.actionType,
    title: approval.title,
    target: approval.target,
    summary: approval.summary,
    riskLevel: approval.riskLevel,
    argumentsPreview: approval.argumentsPreview
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: PASS，审批 store 用例通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add api/agent/approvalStore.cjs api/agent/eventTranslator.cjs api/agent/agent.test.cjs
git commit -m "feat: add pico approval state handling"
```

### Task 5: 暴露后端 agent 路由与 SSE 流

**Files:**
- Create: `api/agent/routes.cjs`
- Modify: `api/chat.cjs`
- Modify: `api/agent/agent.test.cjs`

- [ ] **Step 1: 写路由层失败测试**

```js
const request = require('supertest');
const express = require('express');
const { describe, it, expect } = require('vitest');
const { createAgentRoutes } = require('./routes.cjs');

describe('agent routes', () => {
  it('returns session payload from GET /api/agent/session', async () => {
    const app = express();
    app.use(createAgentRoutes({
      sessionStore: {
        createSession: () => ({ frontendSessionId: 'session-1', cwd: 'C:/repo', provider: 'deepseek', currentRunId: null })
      }
    }));

    const response = await request(app).get('/api/agent/session');
    expect(response.status).toBe(200);
    expect(response.body.frontendSessionId).toBe('session-1');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: FAIL，找不到 `createAgentRoutes`。

- [ ] **Step 3: 实现最小路由层并在 chat.cjs 挂载**

```js
const express = require('express');

function createAgentRoutes({ sessionStore, runner, approvalStore }) {
  const router = express.Router();

  router.get('/api/agent/session', (req, res) => {
    const session = sessionStore.createSession({
      cwd: process.cwd(),
      provider: 'deepseek'
    });
    res.json(session);
  });

  router.post('/api/agent/run', express.json(), async (req, res) => {
    const session = sessionStore.getSession(req.body.frontendSessionId);
    const run = await runner.startRun({
      session,
      userMessage: req.body.message
    });
    res.status(202).json(run);
  });

  router.post('/api/agent/approval', express.json(), (req, res) => {
    const result = approvalStore.resolve(req.body.approvalId, req.body.decision, req.body.reason || '');
    if (!result) {
      return res.status(404).json({ error: 'approval not found' });
    }
    return res.json(result);
  });

  return router;
}

module.exports = { createAgentRoutes };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- api/agent/agent.test.cjs`
Expected: PASS，session 和 approval 路由用例通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add api/agent/routes.cjs api/chat.cjs api/agent/agent.test.cjs
git commit -m "feat: expose pico agent http routes"
```

### Task 6: 前端建立 agent 事件流服务

**Files:**
- Create: `src/ReactPlayground/services/agentStream.ts`
- Create: `src/ReactPlayground/services/agentStream.test.ts`
- Modify: `src/ReactPlayground/services/optimizedAI.ts`

- [ ] **Step 1: 写前端事件流服务的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { applyAgentEvent } from './agentStream';

describe('applyAgentEvent', () => {
  it('appends message delta into assistant timeline item', () => {
    const state = {
      items: [{ id: 'm1', kind: 'message', role: 'assistant', content: '', status: 'streaming' as const }]
    };

    const next = applyAgentEvent(state, {
      type: 'message_delta',
      runId: 'run-1',
      messageId: 'm1',
      content: '你好'
    });

    expect(next.items[0].content).toBe('你好');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/ReactPlayground/services/agentStream.test.ts`
Expected: FAIL，缺少 `agentStream.ts`。

- [ ] **Step 3: 实现最小前端事件应用器**

```ts
export type AgentEvent =
  | { type: 'message_delta'; runId: string; messageId: string; content: string }
  | { type: 'tool_call'; runId: string; toolCallId: string; toolName: string; summary: string; status: 'running' }
  | { type: 'approval_required'; runId: string; approvalId: string; title: string; target: string; summary: string; riskLevel: 'low' | 'medium' | 'high'; argumentsPreview: string };

export type AgentStreamState = {
  items: Array<Record<string, unknown>>;
};

export function applyAgentEvent(state: AgentStreamState, event: AgentEvent): AgentStreamState {
  if (event.type === 'message_delta') {
    return {
      ...state,
      items: state.items.map(item => (
        item.id === event.messageId
          ? { ...item, content: `${item.content || ''}${event.content}` }
          : item
      ))
    };
  }

  if (event.type === 'tool_call') {
    return {
      ...state,
      items: [
        ...state.items,
        {
          id: event.toolCallId,
          kind: 'tool',
          toolName: event.toolName,
          summary: event.summary,
          status: event.status
        }
      ]
    };
  }

  return {
    ...state,
    items: [
      ...state.items,
      {
        id: event.approvalId,
        kind: 'approval',
        approvalId: event.approvalId,
        title: event.title,
        target: event.target,
        summary: event.summary,
        riskLevel: event.riskLevel,
        status: 'pending'
      }
    ]
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/ReactPlayground/services/agentStream.test.ts`
Expected: PASS，事件应用器用例通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ReactPlayground/services/agentStream.ts src/ReactPlayground/services/agentStream.test.ts
git commit -m "feat: add agent stream client primitives"
```

### Task 7: 扩展 Zustand store 支持 run、approval、timeline

**Files:**
- Modify: `src/ReactPlayground/stores/aiStore.ts`
- Modify: `src/ReactPlayground/stores/index.ts`
- Modify: `src/ReactPlayground/services/agentStream.ts`
- Test: `src/ReactPlayground/services/agentStream.test.ts`

- [ ] **Step 1: 先写 store 行为测试**

```ts
import { describe, expect, it } from 'vitest';
import { applyAgentEvent } from '../services/agentStream';

describe('agent timeline state', () => {
  it('adds pending approval card to timeline', () => {
    const next = applyAgentEvent({ items: [] }, {
      type: 'approval_required',
      runId: 'run-1',
      approvalId: 'approval-1',
      title: '修改文件',
      target: 'src/App.tsx',
      summary: '准备修改 src/App.tsx',
      riskLevel: 'high',
      argumentsPreview: 'patch_file src/App.tsx'
    });

    expect(next.items[0]).toMatchObject({
      kind: 'approval',
      approvalId: 'approval-1',
      status: 'pending'
    });
  });
});
```

- [ ] **Step 2: 运行测试确认当前失败或能力不足**

Run: `npm test -- src/ReactPlayground/services/agentStream.test.ts`
Expected: FAIL，或因缺少 approval 分支细节导致断言不通过。

- [ ] **Step 3: 修改 aiStore，引入 agent timeline 状态**

```ts
export interface AgentRunState {
  sessionId: string;
  runId: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
}

export interface AgentApprovalState {
  approvalId: string;
  title: string;
  target: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
}

interface AIAssistantState {
  isOpen: boolean;
  messages: AIMessage[];
  timeline: AgentTimelineItem[];
  currentRun: AgentRunState | null;
  pendingApproval: AgentApprovalState | null;
  isLoading: boolean;
  isStreaming: boolean;
  reconnectHint: string;
}
```

- [ ] **Step 4: 运行相关测试确认通过**

Run: `npm test -- src/ReactPlayground/services/agentStream.test.ts`
Expected: PASS，approval timeline 用例通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ReactPlayground/stores/aiStore.ts src/ReactPlayground/stores/index.ts src/ReactPlayground/services/agentStream.ts src/ReactPlayground/services/agentStream.test.ts
git commit -m "feat: extend ai store for pico agent timeline"
```

### Task 8: 在聊天 UI 中渲染工具步骤与审批卡片

**Files:**
- Create: `src/ReactPlayground/components/AIAssistant/ToolStepCard.tsx`
- Create: `src/ReactPlayground/components/AIAssistant/ApprovalCard.tsx`
- Create: `src/ReactPlayground/components/AIAssistant/RunSummaryCard.tsx`
- Modify: `src/ReactPlayground/components/AIAssistant/index.tsx`
- Modify: `src/ReactPlayground/components/AIAssistant/MessageItem.tsx`
- Modify: `src/ReactPlayground/components/AIAssistant/index.module.scss`

- [ ] **Step 1: 先写可渲染分支的失败测试或最小渲染样例**

```tsx
const approvalItem = {
  id: 'approval-1',
  kind: 'approval' as const,
  approvalId: 'approval-1',
  title: '修改文件',
  target: 'src/App.tsx',
  summary: '准备修改 src/App.tsx',
  riskLevel: 'high' as const,
  status: 'pending' as const
};
```

Render expectation:

```txt
页面出现“修改文件”
页面出现“src/App.tsx”
页面出现“允许”和“拒绝”按钮
```

- [ ] **Step 2: 运行现有前端测试或构建确认当前没有这些 UI**

Run: `npm test -- src/ReactPlayground/services/agentStream.test.ts`
Expected: 当前测试不覆盖 UI，后续实现后至少需要构建通过。

- [ ] **Step 3: 实现三种卡片组件与列表分支**

```tsx
export default function ApprovalCard(props: {
  title: string;
  target: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className={styles.approvalCard}>
      <div className={styles.approvalHeader}>{props.title}</div>
      <div className={styles.approvalTarget}>{props.target}</div>
      <p>{props.summary}</p>
      <div className={styles.approvalActions}>
        <button onClick={props.onApprove}>允许</button>
        <button onClick={props.onReject}>拒绝</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行构建确认 UI 分支可通过**

Run: `npm run build`
Expected: PASS，无 TypeScript 和样式引用错误。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ReactPlayground/components/AIAssistant/ToolStepCard.tsx src/ReactPlayground/components/AIAssistant/ApprovalCard.tsx src/ReactPlayground/components/AIAssistant/RunSummaryCard.tsx src/ReactPlayground/components/AIAssistant/index.tsx src/ReactPlayground/components/AIAssistant/MessageItem.tsx src/ReactPlayground/components/AIAssistant/index.module.scss
git commit -m "feat: render pico agent tool and approval cards"
```

### Task 9: 打通审批提交、恢复执行与取消运行

**Files:**
- Modify: `src/ReactPlayground/services/agentStream.ts`
- Modify: `src/ReactPlayground/stores/aiStore.ts`
- Modify: `api/agent/routes.cjs`
- Modify: `api/agent/approvalStore.cjs`
- Modify: `api/agent/agent.test.cjs`

- [ ] **Step 1: 写审批接口和取消接口的失败测试**

```js
it('returns 404 when approval id is invalid', async () => {
  const response = await request(app)
    .post('/api/agent/approval')
    .send({ approvalId: 'missing', decision: 'approved' });

  expect(response.status).toBe(404);
});
```

```ts
it('marks approval item as approved after resolve event', () => {
  const next = applyAgentEvent({
    items: [{
      id: 'approval-1',
      kind: 'approval',
      approvalId: 'approval-1',
      title: '修改文件',
      target: 'src/App.tsx',
      summary: '准备修改 src/App.tsx',
      riskLevel: 'high',
      status: 'pending'
    }]
  }, {
    type: 'approval_resolved',
    runId: 'run-1',
    approvalId: 'approval-1',
    decision: 'approved',
    reason: '用户允许'
  });

  expect(next.items[0]).toMatchObject({ status: 'approved' });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- api/agent/agent.test.cjs && npm test -- src/ReactPlayground/services/agentStream.test.ts`
Expected: FAIL，缺少 `approval_resolved` 分支或取消接口。

- [ ] **Step 3: 实现审批提交与状态回写**

```ts
export async function submitApproval(input: {
  approvalId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
}) {
  const response = await fetch('/api/agent/approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error('审批提交失败');
  }

  return response.json();
}
```

```js
router.post('/api/agent/cancel', express.json(), (req, res) => {
  return res.status(202).json({
    runId: req.body.runId,
    status: 'cancelled'
  });
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- api/agent/agent.test.cjs && npm test -- src/ReactPlayground/services/agentStream.test.ts`
Expected: PASS，审批和取消相关断言通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ReactPlayground/services/agentStream.ts src/ReactPlayground/stores/aiStore.ts api/agent/routes.cjs api/agent/approvalStore.cjs api/agent/agent.test.cjs src/ReactPlayground/services/agentStream.test.ts
git commit -m "feat: connect pico approval and cancel flows"
```

### Task 10: 端到端验证与文档更新

**Files:**
- Modify: `docs/superpowers/specs/2026-06-03-pico-agent-integration-design.md`
- Modify: `docs/README.md`
- Test: `api/agent/agent.test.cjs`
- Test: `src/ReactPlayground/services/agentStream.test.ts`

- [ ] **Step 1: 跑完整测试集确认没有回归**

Run: `npm test`
Expected: PASS，现有测试和新测试全部通过。

- [ ] **Step 2: 跑一次生产构建**

Run: `npm run build`
Expected: PASS，前端 TypeScript 和 Vite 构建通过。

- [ ] **Step 3: 手工验证 6 个关键场景**

Run:

```txt
1. 发送“读取 src/App.tsx 并解释结构”
2. 发送“搜索 aiStore 的发送逻辑”
3. 发送“修改某个组件文案”并在卡片里点击允许
4. 再次触发修改，但在卡片里点击拒绝
5. 发送“运行测试并总结失败原因”
6. 刷新页面，确认最近 session 可恢复
```

Expected:

```txt
每个场景都能在聊天流里看到状态变化
需要审批的动作会出现卡片
允许后继续执行，拒绝后返回说明
最终出现 run_summary 卡片
```

- [ ] **Step 4: 更新使用文档**

```md
## Pico Agent 模式

- AI 助手已支持仓库代理模式
- 危险动作需要在聊天流中审批
- 运行状态、工具步骤和总结会直接显示在聊天面板
```

- [ ] **Step 5: 提交收尾**

```bash
git add docs/README.md docs/superpowers/specs/2026-06-03-pico-agent-integration-design.md api/agent/agent.test.cjs src/ReactPlayground/services/agentStream.test.ts
git commit -m "docs: document pico agent integration flow"
```

## 自检结果

- 已覆盖 spec 中的方案边界、事件协议、审批流、后端模块、前端改造、接口和测试要求。
- 计划中没有使用 `TODO`、`TBD`、`后续补充` 这类占位语。
- 关键类型命名已在前后任务中保持一致：`approval_required`、`approval_resolved`、`run_status`、`run_summary`、`AgentTimelineItem`。
