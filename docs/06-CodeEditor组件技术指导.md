# CodeEditor 组件技术指导文档

## 1. 文件作用

`CodeEditor/index.tsx` 是代码编辑器的主容器组件，负责：
- 整合 Monaco 编辑器和文件标签列表
- 处理文件内容的编辑和保存
- 管理编辑器的主题和配置
- 提供防抖优化的编辑体验

## 2. 核心思路拆解

### 为什么需要这样设计
- **组件组合**：将编辑器和文件列表组合成完整的编辑体验
- **状态同步**：编辑内容实时同步到全局状态
- **性能优化**：使用防抖避免频繁的状态更新
- **主题适配**：根据全局主题切换编辑器样式

### 关键功能实现思路

#### 组件结构
```typescript
function CodeEditor() {
  // 1. 获取状态
  const { files, setFiles, selectedFileName } = useFileStore();
  const theme = useThemeStore(state => state.theme);
  
  // 2. 获取当前文件
  const file = files[selectedFileName];
  
  // 3. 处理编辑变化
  function onEditorChange(value?: string) {
    const newFiles = {
      ...files,
      [file.name]: { ...file, value: value! }
    };
    setFiles(newFiles);
  }
  
  // 4. 渲染组件
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FileNameList />
      <Editor 
        file={file} 
        onChange={debounce(onEditorChange, 500)} 
        options={{theme: `vs-${theme}`}}
      />
    </div>
  );
}
```

### 核心代码块作用

1. **状态管理**：从 Zustand stores 获取文件和主题状态
2. **文件获取**：根据选中文件名获取当前编辑文件
3. **编辑处理**：处理编辑器内容变化并更新状态
4. **防抖优化**：使用 lodash debounce 优化性能
5. **布局渲染**：垂直布局包含文件列表和编辑器

## 3. 分步实现步骤

### 第一步：搭建基础结构
```typescript
import Editor from "./Editor";
import FileNameList from "./FileNameList";
import { useFileStore, useThemeStore } from "../../stores";
import { debounce } from "lodash-es";

export default function CodeEditor() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 文件标签列表 */}
      <FileNameList />
      {/* 代码编辑器 */}
      <Editor />
    </div>
  );
}
```

### 第二步：集成状态管理
```typescript
export default function CodeEditor() {
  // 获取文件状态
  const { files, setFiles, selectedFileName } = useFileStore();
  // 获取主题状态
  const theme = useThemeStore(state => state.theme);
  
  // 获取当前编辑的文件
  const file = files[selectedFileName];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FileNameList />
      <Editor 
        file={file} 
        options={{theme: `vs-${theme}`}}
      />
    </div>
  );
}
```

### 第三步：实现编辑处理逻辑
```typescript
export default function CodeEditor() {
  const { files, setFiles, selectedFileName } = useFileStore();
  const theme = useThemeStore(state => state.theme);
  
  const file = files[selectedFileName];
  
  // 编辑器变化时，更新文件内容
  function onEditorChange(value?: string) {
    const newFiles = {
      ...files,
      [file.name]: { ...file, value: value! }
    };
    setFiles(newFiles);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FileNameList />
      <Editor 
        file={file} 
        onChange={onEditorChange}
        options={{theme: `vs-${theme}`}}
      />
    </div>
  );
}
```

### 第四步：添加性能优化
```typescript
export default function CodeEditor() {
  const { files, setFiles, selectedFileName } = useFileStore();
  const theme = useThemeStore(state => state.theme);
  
  const file = files[selectedFileName];
  
  // 编辑器变化时，更新文件内容
  function onEditorChange(value?: string) {
    const newFiles = {
      ...files,
      [file.name]: { ...file, value: value! }
    };
    setFiles(newFiles);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FileNameList />
      <Editor 
        file={file} 
        onChange={debounce(onEditorChange, 500)} // 防抖优化
        options={{theme: `vs-${theme}`}}
      />
    </div>
  );
}
```

### 第五步：验证功能
- 测试文件切换是否正常
- 验证编辑内容是否实时保存
- 检查主题切换是否生效
- 确认防抖优化是否工作

## 4. 复现要点

### 关键注意事项
1. **状态不可变性**：使用展开运算符创建新的文件对象
2. **防抖配置**：500ms 的防抖时间平衡了性能和用户体验
3. **主题映射**：`vs-${theme}` 格式对应 Monaco 编辑器主题
4. **布局样式**：使用 flexbox 确保编辑器占满剩余空间

### 性能优化原理
```typescript
// 问题：用户快速输入时频繁更新状态
onChange: (value) => setFiles(newFiles) // 每次输入都触发

// 解决：使用防抖延迟更新
onChange: debounce((value) => setFiles(newFiles), 500) // 500ms 后更新
```

### 状态更新最佳实践
```typescript
// ✅ 正确：创建新对象
const newFiles = {
  ...files,
  [file.name]: { ...file, value: value! }
};
setFiles(newFiles);

// ❌ 错误：直接修改原对象
files[file.name].value = value!;
setFiles(files);
```

### 常见问题及解决方案
1. **编辑器不更新**：检查 file 对象是否正确传递
2. **主题不生效**：确认主题名称格式正确
3. **性能问题**：调整防抖时间或检查状态更新逻辑
4. **文件切换异常**：验证 selectedFileName 状态是否正确

### 依赖要求
```json
{
  "lodash-es": "^4.17.21",
  "@types/lodash-es": "^4.17.12"
}
```

### 子组件依赖
- `./Editor/index.tsx` - Monaco 编辑器封装
- `./FileNameList/index.tsx` - 文件标签列表
- `../../stores` - 状态管理

### 使用示例
```typescript
// 在父组件中使用
function ReactPlayground() {
  return (
    <Allotment defaultSizes={[100, 100]}>
      <Allotment.Pane minSize={0}>
        <CodeEditor />
      </Allotment.Pane>
      <Allotment.Pane minSize={0}>
        <Preview />
      </Allotment.Pane>
    </Allotment>
  );
}
```

### 扩展功能建议
1. **自动保存**：定期保存编辑内容
2. **撤销重做**：集成编辑器的撤销功能
3. **代码格式化**：添加代码美化功能
4. **快捷键支持**：自定义编辑器快捷键

### 调试技巧
1. **状态监控**：使用 React DevTools 监控状态变化
2. **性能分析**：检查防抖是否有效减少更新频率
3. **编辑器调试**：使用 Monaco 编辑器的调试工具
4. **主题测试**：切换主题验证样式是否正确应用
