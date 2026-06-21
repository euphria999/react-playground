# SSE 重连与断点续传设计

## 1. 目标

为当前 AI 助手的流式输出补齐以下能力：

- 前端在连接异常中断时自动重连
- 服务端支持按事件序号精确续传
- 已完成的流在短时间内允许重新连接并补齐尾部数据
- 会话缓存保留 5 分钟，超时后自动清理

本次设计基于当前项目已有的 `fetch + ReadableStream + POST /api/chat-stream` 架构，不切回 `EventSource + GET`。

## 2. 方案选择

本次可选方案有三类：

1. 保持 `fetch + POST`，前端自定义重连，服务端维护事件缓存
2. 切回 `EventSource + GET`，依赖标准 SSE 的 `Last-Event-ID`
3. 拆成“创建任务 + 订阅流”的两段式协议

最终选择方案 1。

选择原因：

- 与当前前后端实现最接近，改动集中
- 避开 GET URL 过长问题
- 能满足“精确续传”的要求
- 不需要额外引入更重的后端会话管理模型

## 3. 核心概念

### 3.1 `sessionId`

标识一条正在生成或已生成完成的 AI 回复。前端首次请求生成 `sessionId`，后续重连复用同一个值。

### 3.2 `lastEventIndex`

表示前端已经成功收到的最后一个事件序号。服务端收到重连请求后，从 `lastEventIndex + 1` 开始补发。

### 3.3 `activeResponse`

表示当前这条 `sessionId` 正在往哪个 HTTP 流连接继续写数据。每个 `sessionId` 同时只保留一个活跃连接；新连接重连时接管旧连接。

## 4. 协议设计

### 4.1 首次请求

前端调用 `POST /api/chat-stream`，请求体包含：

- `sessionId`
- `message`
- `context`
- `conversationHistory`
- `model`
- `maxTokens`
- `temperature`

首次请求不传 `lastEventIndex`。

### 4.2 重连请求

前端再次调用 `POST /api/chat-stream`，请求体包含：

- `sessionId`
- `lastEventIndex`
- 同一份原始聊天参数

服务端对重连请求中的聊天参数只做校验，不以它覆盖首次请求缓存。若参数不一致，直接拒绝，避免同一个 `sessionId` 被误用于另一条消息。

### 4.3 服务端返回事件

每个 SSE 数据事件统一返回：

```json
{
  "index": 0,
  "content": "..."
}
```

完成事件仍使用：

```text
event: done
data: [DONE]
```

错误事件使用：

```json
{
  "error": "..."
}
```

## 5. 服务端设计

### 5.1 Session 结构

每个 `sessionId` 在内存中维护一份记录：

```ts
type StreamChunk = {
  index: number;
  content: string;
};

type StreamSession = {
  sessionId: string;
  requestPayload: {
    message: string;
    context?: string;
    conversationHistory?: unknown;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  chunks: StreamChunk[];
  status: 'streaming' | 'completed' | 'failed';
  error: string | null;
  activeResponse: Response | null;
  lastAccessAt: number;
};
```

### 5.2 状态流转

1. 首次请求：
   - `sessionId` 不存在时创建 session
   - 状态设为 `streaming`
   - 启动一次真实的上游 AI 流
2. 流式进行中：
   - 每收到一个新 chunk，生成递增 `index`
   - 先写入 `chunks`
   - 再写入 `activeResponse`
3. 重连请求：
   - 先校验 `sessionId` 是否存在
   - 再校验请求参数是否与首次请求一致
   - 关闭旧的 `activeResponse`
   - 用新连接接管 `activeResponse`
   - 从 `lastEventIndex + 1` 开始补发历史缺口
   - 若状态仍为 `streaming`，继续推送后续实时 chunk
   - 若状态为 `completed`，补齐后立即发送 done
   - 若状态为 `failed`，直接返回错误
4. 完成：
   - 上游流结束后将状态设为 `completed`
   - 保留缓存 5 分钟
5. 清理：
   - 定时删除超过 5 分钟未访问的 session

### 5.3 单连接接管策略

同一个 `sessionId` 同时只保留一个 `activeResponse`。新连接进来时：

- 若旧连接还存在，立即结束旧连接
- 将 `activeResponse` 替换为当前连接
- 后续新 chunk 仅写入当前连接

该策略更符合当前聊天场景，也能避免重复推送和多连接状态同步问题。

## 6. 前端设计

### 6.1 首次发送

- 发送消息时生成新的 `sessionId`
- 本地初始化：
  - `lastEventIndex = -1`
  - 当前消息的已接收内容
  - 重连次数
  - 重连状态提示

### 6.2 接收流

- 每收到一个 `{ index, content }`
  - 若 `index` 已处理过，则忽略，避免重复拼接
  - 否则更新 `lastEventIndex`
  - 追加 `content`

为避免补发边界导致的重复追加，前端需维护去重能力。最小实现可以基于“是否已处理过该 `index`”判断。

### 6.3 自动重连策略

- 连接异常中断且未完成时自动重连
- 最多重试 3 次
- 间隔依次为 500ms、1000ms、2000ms
- 用户主动取消时不重连
- 服务端明确返回 session 过期或不存在时不重连

### 6.4 用户提示

采用轻提示策略：

- 断线后显示“连接中断，正在恢复…”
- 恢复成功后自动清除提示
- 连续重试失败后显示最终错误

## 7. 异常边界

### 7.1 用户主动取消

- 前端立即终止当前请求
- 不再继续重连
- 服务端保留 session 直到过期清理

### 7.2 Session 过期

- 服务端返回明确错误
- 前端停止重连
- UI 提示用户当前回复已过期，需要重新提问

### 7.3 参数漂移

同一个 `sessionId` 如果携带了不同的 `message/context/conversationHistory`，服务端直接拒绝，防止错误续传。

### 7.4 上游失败

- 服务端将 session 标记为 `failed`
- 记录错误信息
- 前端若重连到失败 session，直接收到错误并停止重试

### 7.5 断线前最后一个 chunk 的重复补发

如果前端已收到 chunk 但尚未来得及更新 `lastEventIndex` 就断线，重连后可能重复收到最后一个 chunk。前端基于 `index` 去重即可解决。

### 7.6 已完成但前端未收到 done

若服务端 session 已是 `completed`，则在重连时补齐缺失 chunk，并立即补发 done，保证最终一致性。

## 8. 测试设计

### 8.1 服务端测试

- 首次请求能创建 session 并缓存 chunk
- 重连请求能按 `lastEventIndex` 正确补发缺口
- `completed` session 重连后能补齐并返回 done
- `failed` session 重连后直接返回错误
- 过期 session 能被定时清理

### 8.2 前端测试

- 正常流式输出时正确更新 `lastEventIndex`
- 中途断线后能自动重连
- 补发历史 chunk 时不会重复拼接
- 用户取消后不会继续重连
- session 过期时能显示最终错误提示

### 8.3 联调验证

- 人为中断网络，确认回答可从断点继续
- 在服务端已完成但前端未结束时重连，确认能补齐尾部并收到 done
- 连续失败超过 3 次后停止重试并提示用户

## 9. 实施建议

建议按以下顺序实现：

1. 先补服务端 session 缓存、chunk 编号、重连补发
2. 再补前端 `sessionId / lastEventIndex / 重连状态` 管理
3. 最后补测试和联调

这样可以先把协议闭环打通，再处理前端体验细节，风险更低。
