# Repository Guidelines

## Project Structure & Module Organization

本仓库是 Vite + React + TypeScript 在线代码编辑器。主要源码位于 `src/ReactPlayground/`：`components/` 放 UI 组件，`stores/` 放 Zustand 状态，`services/` 放 AI/SSE 客户端逻辑，`template/` 放运行示例模板。`api/chat.cjs` 是本地 Express AI 流式接口。静态资源在 `public/` 和 `src/assets/`，技术说明和面试资料在 `docs/`。测试文件采用就近放置，例如 `src/ReactPlayground/services/optimizedAI.test.ts`、`api/chat.session.test.ts`。

## Build, Test, and Development Commands

- `npm run dev`：启动 Vite 前端开发服务。
- `npm run server`：启动本地 AI SSE/流式接口服务。
- `npm run dev:full`：同时启动前端和后端，适合完整联调。
- `npm run build`：执行 TypeScript 构建并打包生产资源，已配置较高 Node 内存。
- `npm run lint`：运行 ESLint 检查 TypeScript/React 代码。
- `npm test`：运行 Vitest 测试。
- `npm run preview`：预览生产构建结果。

## Coding Style & Naming Conventions

使用 TypeScript、React 函数组件和 Hooks。组件目录使用 PascalCase，例如 `AIAssistant/`；状态文件使用 `xxxStore.ts`；服务类放在 `services/`。保持 2 空格缩进，优先使用清晰命名而不是缩写。样式使用 SCSS Modules，组件样式与组件同目录放置，例如 `index.module.scss`。提交前运行 `npm run lint`。

## Testing Guidelines

测试框架为 Vitest。新增业务逻辑应优先补测试，测试文件命名为 `*.test.ts` 或 `*.test.tsx`，尽量与被测模块放在同目录。测试应覆盖真实行为，例如流式重连、去重、请求 payload 生成等。运行全部测试用 `npm test`，单文件可用 `npx vitest run path/to/file.test.ts`。

## Commit & Pull Request Guidelines

近期提交使用类似 `feat: 中文描述` 的格式，例如 `feat: 优化项目面试难点准备文档...`。建议继续使用 Conventional Commits：`feat:`、`fix:`、`docs:`、`refactor:`。PR 应包含变更摘要、验证命令结果、相关问题链接；涉及 UI 的改动应附截图或录屏；涉及 AI/SSE 的改动需说明异常处理和重连行为。

## Security & Configuration Tips

不要提交真实 `.env` 或 API Key。参考 `env.example` 配置本地变量。AI Key 由后端读取，前端不应直接暴露密钥。修改 `api/chat.cjs` 时注意 CORS、限流、输入长度和流式连接释放。

## Agent-Specific Instructions

生成或更新 Markdown 文档时默认使用中文，除非用户明确要求英文。修改代码前先阅读相关文件和现有测试，避免覆盖用户未提交的改动。
