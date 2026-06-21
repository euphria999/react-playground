# Vercel + Railway 部署说明

本文档适用于当前仓库的前后端分离部署：

- 前端部署到 Vercel
- 后端 `api/chat.cjs` 部署到 Railway
- DeepSeek API Key 由最终用户在前端自行填写

## 一、当前实现说明

当前项目已经调整为：

- 前端通过 `VITE_API_BASE_URL` 决定请求地址
- 本地开发时 `VITE_API_BASE_URL` 留空，继续请求相对路径 `/api/chat-stream`
- 生产环境时 `VITE_API_BASE_URL` 指向 Railway 后端域名
- 后端不再读取本地 `.env` 中的 `DEEPSEEK_API_KEY`
- 用户必须在前端设置面板中填写自己的 API Key，才可以发起 AI 请求

这意味着 Railway 只负责转发请求和保存服务配置，不保存用户的 API Key。

## 二、Railway 部署后端

### 1. 创建项目

1. 登录 Railway
2. 选择 `New Project`
3. 从 GitHub 导入当前仓库
4. 等待 Railway 自动安装依赖

### 2. 配置启动命令

启动命令使用：

```bash
npm run server
```

### 3. 配置环境变量

Railway 至少需要这些变量：

```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
NODE_ENV=production
ALLOWED_ORIGINS=https://你的-vercel-域名.vercel.app
```

说明：

- 不需要在 Railway 配置 `DEEPSEEK_API_KEY`
- `PORT` 一般由 Railway 自动注入
- 如果你绑定了前端自定义域名，也要一起写进 `ALLOWED_ORIGINS`
- 多个域名用逗号分隔

例如：

```bash
ALLOWED_ORIGINS=https://a.vercel.app,https://www.example.com
```

### 4. 获取后端域名

Railway 部署成功后会给你一个公网域名，例如：

```text
https://your-app.up.railway.app
```

后面要把它填到 Vercel 的 `VITE_API_BASE_URL`。

## 三、Vercel 部署前端

### 1. 导入仓库

1. 登录 Vercel
2. 选择 `Add New...` -> `Project`
3. 导入当前 GitHub 仓库

### 2. 构建配置

推荐配置：

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

### 3. 配置环境变量

在 Vercel 中配置：

```bash
VITE_API_BASE_URL=https://your-app.up.railway.app
```

说明：

- 不要在 Vercel 中配置 `DEEPSEEK_API_KEY`
- 用户访问页面后，会在前端设置面板里填写自己的 Key

### 4. 触发部署

部署成功后，Vercel 会给你一个前端域名，例如：

```text
https://your-frontend.vercel.app
```

## 四、回填 CORS 白名单

拿到正式前端域名后，回到 Railway，把：

```bash
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

如果有自定义域名，也一并加入。

## 五、本地开发方式

本地仍然可以这样启动：

```bash
npm run dev:full
```

本地建议配置：

```bash
VITE_API_BASE_URL=
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

注意：

- 本地 `.env` 不再需要 `DEEPSEEK_API_KEY`
- 只有当前端用户填写了 API Key，AI 功能才可用

## 六、上线检查清单

上线后重点检查：

1. 前端页面是否能正常打开
2. AI 设置中未填写 API Key 时，发送按钮是否不可用
3. 填写 API Key 后，是否能正常请求 Railway 的 `/api/chat-stream`
4. Railway 日志中是否能看到请求进入
5. 如果出现跨域错误，先检查 `ALLOWED_ORIGINS`
6. 如果出现 500 错误，先检查用户传入的 API Key 是否有效，以及 `DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 是否正确

## 七、常见问题

### 1. 前端能打开，但无法发送消息

先检查：

- 是否已经在前端设置里填写 API Key
- 发送按钮是否因为没有配置 API Key 被禁用

### 2. 填了 API Key 还是请求失败

先检查：

- `VITE_API_BASE_URL` 是否正确
- Railway 服务是否正常启动
- `ALLOWED_ORIGINS` 是否已放行前端域名
- 用户填写的 API Key 是否有效

### 3. 本地正常，线上不正常

通常优先排查：

- Vercel 是否配置了 `VITE_API_BASE_URL`
- Railway 是否更新了 `ALLOWED_ORIGINS`
- Railway 修改环境变量后是否已重新部署
