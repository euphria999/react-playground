# AI 设置页 API Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 设置页增加用户自配 API Key，并让前后端聊天链路使用该配置。

**Architecture:** 扩展前端 `aiSettings` 状态结构，设置页负责读写和掩码展示；`optimizedAI` 在请求体中透传 `apiKey`；后端优先使用请求中的 key，缺省时回退环境变量。

**Tech Stack:** React、TypeScript、Zustand、Express、Vite

---

### Task 1: 扩展前端设置状态与界面

**Files:**
- Modify: `src/ReactPlayground/stores/aiStore.ts`
- Modify: `src/ReactPlayground/components/AISettings/index.tsx`
- Modify: `src/ReactPlayground/components/AISettings/index.module.scss`

- [ ] 增加 `apiKey` 字段并支持本地持久化。
- [ ] 设置页新增输入框与显示/隐藏按钮。
- [ ] 当前配置区域改为只显示 `API Key` 是否已配置。

### Task 2: 扩展请求链路

**Files:**
- Modify: `src/ReactPlayground/services/optimizedAI.ts`
- Modify: `api/chat.cjs`

- [ ] 前端请求体新增 `apiKey` 字段。
- [ ] 后端优先使用请求传入的 `apiKey`，否则回退到环境变量。

### Task 3: 基础验证

**Files:**
- Modify: `src/ReactPlayground/services/optimizedAI.test.ts`

- [ ] 补齐受类型影响的测试数据。
- [ ] 运行 `npm run build` 验证改动可编译。
