# SSE连接错误问题记录（AI对话“继续”场景）

## 1. 问题现象
- 在 AI 助手多轮对话中，用户连续发送“继续”后，偶发出现：`抱歉，发生了错误：SSE连接错误，请稍后重试`。
- 典型表现是：上一轮已经返回部分内容，但下一轮或后续轮次直接中断。

## 2. 根因分析
- 当前流式通道使用 `EventSource + GET`，请求参数通过 URL 传递。
- 随着对话轮次增加，`conversationHistory` 和 `context` 不断膨胀，导致 URL 过长。
- URL 过长后，浏览器/代理层可能直接拒绝请求或中断连接，前端只收到 `onerror`，因此表现为统一的 SSE 连接错误。
- 另外历史参数存在双重编码，进一步放大了 URL 长度问题。

## 3. 解决方案

### 3.1 前端参数瘦身
- 历史消息裁剪为最近 3 条。
- 每条历史消息只保留尾部 200 字符。
- 上下文裁剪为最多 600 字符。
- 去掉历史参数的重复编码，避免不必要膨胀。

对应文件：
- [optimizedAI.ts](file:///c:/Users/25854/Desktop/%E5%89%8D%E7%AB%AF/react-playground/src/ReactPlayground/services/optimizedAI.ts)

### 3.2 后端解析兼容
- 后端优先按未编码 JSON 解析 `conversationHistory`。
- 若解析失败，再回退到 `decodeURIComponent` 兼容旧请求格式。

对应文件：
- [chat.cjs](file:///c:/Users/25854/Desktop/%E5%89%8D%E7%AB%AF/react-playground/api/chat.cjs)

## 4. 效果验证
- 极端长上下文场景下，请求 URL 长度从高风险区降到约 1500 左右。
- 构建验证通过，服务可正常启动。
- 连续追问场景稳定性明显提升，SSE 连接错误出现频率下降。

## 5. 仍需注意
- 该方案是“参数控制”层面的修复，适用于当前 `EventSource + GET` 架构。
- 若后续有更长上下文需求，建议升级为 `POST + ReadableStream`，从架构上彻底消除 URL 长度上限问题。

## 6. 使用建议
- 部署后请用户执行一次硬刷新（`Ctrl + F5`），确保前端加载到最新脚本。
- 若仍有异常，优先采集失败时的具体错误文案与时间点，便于定位网络、限流或模型侧问题。
