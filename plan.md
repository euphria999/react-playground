# 代码高亮展示功能实现计划

## 目标
- 让 AI 助手返回内容中的代码片段按语法高亮展示
- 保持现有流式输出体验，不影响普通文本消息显示
- 确保展示安全，不引入 XSS 风险

## 现状分析
- AI 消息渲染入口在 `src/ReactPlayground/components/AIAssistant/index.tsx`
- 当前消息体直接渲染纯文本 `message.content`，未进行 markdown/code 解析
- 样式集中在 `src/ReactPlayground/components/AIAssistant/index.module.scss`
- 项目尚未引入 markdown 与代码高亮依赖

## 实施方案
1. 引入渲染依赖
   - 新增 `react-markdown`、`remark-gfm`、`react-syntax-highlighter`
   - 仅在展示层使用，不改动 store 的消息结构

2. 抽离消息渲染组件
   - 新建 `MarkdownMessage` 组件（放在 AIAssistant 组件目录下）
   - 规则：
     - 普通段落按 markdown 渲染
     - 行内代码使用 `<code>`
     - 代码块根据 fenced code language（如 ```ts）选择高亮语言
     - 无 language 时使用纯文本代码块样式

3. 接入 AIAssistant 消息列表
   - 在消息渲染位置替换 `message.content` 的直出逻辑
   - `assistant` 消息使用 `MarkdownMessage`
   - `user` 消息保持当前纯文本展示（避免输入文本被过度格式化）

4. 样式与主题适配
   - 扩展 `index.module.scss`：
     - 代码块背景、边距、圆角、横向滚动
     - 行内代码强调样式
     - 与现有浅色/深色主题兼容

5. 流式输出体验优化
   - 确认流式拼接过程中 markdown 渲染不导致明显闪烁
   - 对未闭合代码块场景保持可读性（容错渲染）

6. 验证与回归
   - 构建验证（TypeScript + Vite build）
   - 功能验证用例：
     - 单段代码块（js/ts/css/json）
     - 多代码块混合普通文本
     - 行内代码
     - 无语言标记代码块
     - 长代码块滚动

## 验收标准
- AI 消息中的 fenced code block 均可高亮展示
- 普通文本和用户消息显示不回归
- 不引入新的类型错误与构建错误
- 大段响应时页面交互保持可用

## 风险与规避
- 风险：流式更新导致频繁重渲染
  - 规避：保持现有缓冲策略，必要时对渲染组件做 memo
- 风险：代码高亮库体积增大
  - 规避：按需引入主题与渲染器，优先使用轻量方案
