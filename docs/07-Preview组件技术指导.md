# Preview 组件技术指导文档

## 1. 文件作用

`Preview/index.tsx` 是代码预览组件，负责：
- 实时编译用户编写的 React/TypeScript 代码
- 在 iframe 中安全地渲染编译后的代码
- 显示编译错误和运行时错误
- 使用 Web Worker 进行后台编译，避免阻塞主线程

## 2. 核心思路拆解

### 为什么需要这样设计
- **实时预览**：用户编辑代码时能立即看到效果
- **安全隔离**：使用 iframe 避免用户代码影响主应用
- **性能优化**：Web Worker 编译不阻塞 UI 线程
- **错误处理**：完整的编译和运行时错误展示

### 关键功能实现思路

#### 整体架构
```
用户代码 → Web Worker 编译 → 编译结果 → iframe 渲染 → 预览显示
    ↓
错误处理 → 错误信息显示
```

#### 核心流程
```typescript
function Preview() {
  const files = useFileStore(state => state.files);
  const [compiledCode, setCompiledCode] = useState('');
  const [error, setError] = useState('');
  
  // 1. 监听文件变化，触发编译
  useEffect(debounce(() => {
    compilerWorkerRef.current?.postMessage(files);
  }, 500), [files]);
  
  // 2. 接收编译结果
  compilerWorkerRef.current.addEventListener('message', ({data}) => {
    if(data.type === 'COMPILED_CODE') {
      setCompiledCode(data.data);
    }
  });
  
  // 3. 生成 iframe URL
  const getIframeUrl = () => {
    const res = iframeRaw
      .replace('<script type="importmap"></script>', 
        `<script type="importmap">${files[IMPORT_MAP_FILE_NAME].value}</script>`)
      .replace('<script type="module" id="appSrc"></script>',
        `<script type="module" id="appSrc">${compiledCode}</script>`);
    return URL.createObjectURL(new Blob([res], { type: 'text/html' }));
  };
}
```

### 核心代码块作用

1. **Web Worker 管理**：创建和管理编译器 Worker
2. **文件监听**：监听文件变化并触发编译
3. **编译结果处理**：接收并处理编译后的代码
4. **iframe 生成**：动态生成包含编译代码的 HTML
5. **错误处理**：捕获和显示各种错误信息

## 3. 分步实现步骤

### 第一步：搭建基础结构
```typescript
import { useEffect, useRef, useState, memo } from "react"
import { useFileStore } from "../../stores"
import iframeRaw from './iframe.html?raw'
import { IMPORT_MAP_FILE_NAME } from "../../files";
import { Message } from "../Message";
import CompilerWorker from './compiler.worker?worker'
import { debounce } from "lodash-es";

function Preview() {
  const files = useFileStore(state => state.files);
  const [compiledCode, setCompiledCode] = useState('');
  const [error, setError] = useState('');

  return (
    <div style={{height: '100%'}}>
      {/* 预览内容将在这里 */}
    </div>
  );
}

export default memo(Preview);
```

### 第二步：初始化 Web Worker
```typescript
function Preview() {
  const files = useFileStore(state => state.files);
  const [compiledCode, setCompiledCode] = useState('');
  const [error, setError] = useState('');
  
  // Web Worker 引用
  const compilerWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if(!compilerWorkerRef.current) {
      // 创建编译器 Worker
      compilerWorkerRef.current = new CompilerWorker();
      
      // 监听编译结果
      compilerWorkerRef.current.addEventListener('message', ({data}) => {
        console.log('worker', data);
        if(data.type === 'COMPILED_CODE') {
          setCompiledCode(data.data);
        } else {
          // 处理编译错误
        }
      });
    }
  }, []);

  return (
    <div style={{height: '100%'}}>
      {/* 预览内容 */}
    </div>
  );
}
```

### 第三步：实现文件监听和编译触发
```typescript
function Preview() {
  const files = useFileStore(state => state.files);
  const [compiledCode, setCompiledCode] = useState('');
  const [error, setError] = useState('');
  
  const compilerWorkerRef = useRef<Worker | null>(null);

  // 初始化 Worker
  useEffect(() => {
    if(!compilerWorkerRef.current) {
      compilerWorkerRef.current = new CompilerWorker();
      compilerWorkerRef.current.addEventListener('message', ({data}) => {
        if(data.type === 'COMPILED_CODE') {
          setCompiledCode(data.data);
        }
      });
    }
  }, []);

  // 监听文件变化，触发编译
  useEffect(debounce(() => {
    compilerWorkerRef.current?.postMessage(files);
  }, 500), [files]);

  return (
    <div style={{height: '100%'}}>
      {/* 预览内容 */}
    </div>
  );
}
```

### 第四步：实现 iframe 动态生成
```typescript
function Preview() {
  const files = useFileStore(state => state.files);
  const [compiledCode, setCompiledCode] = useState('');
  const [error, setError] = useState('');
  const [iframeUrl, setIframeUrl] = useState('');
  
  const compilerWorkerRef = useRef<Worker | null>(null);

  // 生成 iframe URL
  const getIframeUrl = () => {
    const res = iframeRaw
      .replace(
        '<script type="importmap"></script>', 
        `<script type="importmap">${files[IMPORT_MAP_FILE_NAME].value}</script>`
      )
      .replace(
        '<script type="module" id="appSrc"></script>',
        `<script type="module" id="appSrc">${compiledCode}</script>`
      );
    return URL.createObjectURL(new Blob([res], { type: 'text/html' }));
  };

  // 当编译代码或 import-map 变化时，更新 iframe
  useEffect(() => {
    setIframeUrl(getIframeUrl());
  }, [files[IMPORT_MAP_FILE_NAME].value, compiledCode]);

  // ... Worker 初始化和文件监听代码

  return (
    <div style={{height: '100%'}}>
      <iframe
        src={iframeUrl}
        style={{
          width: '100%',
          height: '100%',
          padding: 0,
          border: 'none',
        }}
      />
    </div>
  );
}
```

### 第五步：添加错误处理
```typescript
function Preview() {
  const files = useFileStore(state => state.files);
  const [compiledCode, setCompiledCode] = useState('');
  const [error, setError] = useState('');
  const [iframeUrl, setIframeUrl] = useState('');
  
  const compilerWorkerRef = useRef<Worker | null>(null);

  // 处理来自 iframe 的消息（运行时错误）
  const handleMessage = (msg: MessageData) => {
    const { type, message } = msg.data;
    if (type === 'ERROR') {
      setError(message);
    }
  };

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // ... 其他代码

  return (
    <div style={{height: '100%'}}>
      <iframe
        src={iframeUrl}
        style={{
          width: '100%',
          height: '100%',
          padding: 0,
          border: 'none',
        }}
      />
      {/* 显示错误信息 */}
      <Message type='error' content={error} />
    </div>
  );
}
```

### 第六步：性能优化和内存管理
```typescript
function Preview() {
  // ... 状态定义

  // 使用 memo 避免不必要的重渲染
  const memoizedIframeUrl = useMemo(() => {
    return getIframeUrl();
  }, [files[IMPORT_MAP_FILE_NAME].value, compiledCode]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (compilerWorkerRef.current) {
        compilerWorkerRef.current.terminate();
      }
      // 清理 Blob URL
      if (iframeUrl) {
        URL.revokeObjectURL(iframeUrl);
      }
    };
  }, []);

  // ... 其他代码
}

export default memo(Preview);
```

## 4. 复现要点

### 关键注意事项
1. **Web Worker 路径**：确保 `compiler.worker.ts` 文件路径正确
2. **iframe 安全**：使用 Blob URL 创建安全的 iframe 内容
3. **内存管理**：及时清理 Worker 和 Blob URL
4. **错误边界**：完整的编译和运行时错误处理

### Web Worker 通信原理
```typescript
// 主线程 → Worker
compilerWorkerRef.current.postMessage(files);

// Worker → 主线程
self.addEventListener('message', (event) => {
  const files = event.data;
  const compiledCode = compile(files);
  self.postMessage({
    type: 'COMPILED_CODE',
    data: compiledCode
  });
});
```

### iframe 动态内容生成
```typescript
// 模板 HTML
const iframeRaw = `
<!DOCTYPE html>
<html>
<head>
  <script type="importmap"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" id="appSrc"></script>
</body>
</html>
`;

// 动态替换内容
const finalHTML = iframeRaw
  .replace('<script type="importmap"></script>', 
    `<script type="importmap">${importMapContent}</script>`)
  .replace('<script type="module" id="appSrc"></script>',
    `<script type="module" id="appSrc">${compiledCode}</script>`);
```

### 性能优化要点
- **防抖编译**：500ms 防抖避免频繁编译
- **memo 优化**：使用 React.memo 避免不必要重渲染
- **Worker 复用**：复用 Worker 实例，避免重复创建
- **资源清理**：及时清理 Blob URL 和 Worker

### 常见问题及解决方案
1. **编译失败**：检查 Babel 配置和 Worker 实现
2. **iframe 不显示**：验证 Blob URL 生成是否正确
3. **错误不显示**：检查 postMessage 通信是否正常
4. **内存泄漏**：确保组件卸载时清理资源

### 依赖要求
```json
{
  "lodash-es": "^4.17.21",
  "@babel/standalone": "^7.28.3"
}
```

### 相关文件依赖
- `./compiler.worker.ts` - Web Worker 编译器实现
- `./iframe.html` - iframe 模板文件
- `../Message/index.tsx` - 错误信息显示组件
- `../../files.ts` - 文件常量定义

### 调试技巧
1. **Worker 调试**：在浏览器开发者工具中查看 Worker 线程
2. **iframe 调试**：右键 iframe 选择"检查元素"
3. **编译日志**：在 Worker 中添加 console.log 调试编译过程
4. **错误捕获**：使用 try-catch 包装关键操作

### 扩展功能建议
1. **编译缓存**：缓存编译结果，避免重复编译
2. **热重载**：实现更精细的热重载机制
3. **源码映射**：支持 source map 调试
4. **性能监控**：监控编译时间和内存使用
