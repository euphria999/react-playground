# fileStore.ts 技术指导文档

## 1. 文件作用

`fileStore.ts` 是文件管理的状态管理中心，负责：
- 管理代码编辑器中的所有文件
- 处理文件的增删改查操作
- 实现文件状态与 URL 的同步（支持分享功能）
- 提供文件选择和切换功能

## 2. 核心思路拆解

### 为什么需要这样设计
- **集中管理**：所有文件相关状态统一管理，避免状态分散
- **URL 同步**：通过 URL hash 实现代码分享功能
- **类型安全**：使用 TypeScript 接口确保数据结构正确
- **性能优化**：使用 Zustand 实现精确的状态订阅

### 关键功能实现思路

#### 文件数据结构
```typescript
interface File {
  name: string;      // 文件名
  value: string;     // 文件内容
  language: string;  // 编程语言类型
}

interface Files {
  [key: string]: File;  // 以文件名为键的文件集合
}
```

#### URL 同步机制
```typescript
// 压缩文件数据到 URL
const syncFilesToUrl = (files: Files) => {
  const hash = compress(JSON.stringify(files));
  window.location.hash = encodeURIComponent(hash);
};

// 从 URL 恢复文件数据
const getFilesFromUrl = (): Files | undefined => {
  const hash = window.location.hash.slice(1);
  if (hash) {
    const decompressed = uncompress(hash);
    return JSON.parse(decompressed);
  }
};
```

### 核心代码块作用

1. **状态定义**：定义文件存储的数据结构
2. **URL 同步**：实现文件状态与 URL 的双向同步
3. **CRUD 操作**：提供完整的文件操作方法
4. **语言识别**：根据文件扩展名自动识别编程语言

## 3. 分步实现步骤

### 第一步：定义数据结构和接口
```typescript
// 定义文件接口
export interface File {
  name: string;
  value: string;
  language: string;
}

export interface Files {
  [key: string]: File;
}

// 定义 Store 接口
interface FileStore {
  files: Files;
  selectedFileName: string;
  setSelectedFileName: (fileName: string) => void;
  setFiles: (files: Files) => void;
  addFile: (fileName: string) => void;
  removeFile: (fileName: string) => void;
  updateFileName: (oldFieldName: string, newFieldName: string) => void;
}
```

### 第二步：实现 URL 同步功能
```typescript
// 从 URL 获取文件数据
const getFilesFromUrl = (): Files | undefined => {
  try {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const decompressed = uncompress(hash);
      return JSON.parse(decompressed);
    }
  } catch (error) {
    console.warn('Failed to load files from URL:', error);
  }
  return undefined;
};

// 同步文件到 URL
const syncFilesToUrl = (files: Files) => {
  try {
    const hash = compress(JSON.stringify(files));
    window.location.hash = encodeURIComponent(hash);
  } catch (error) {
    console.warn('Failed to sync files to URL:', error);
  }
};
```

### 第三步：创建 Zustand Store
```typescript
export const useFileStore = create<FileStore>((set, get) => ({
  // 初始状态
  files: getFilesFromUrl() || initFiles,
  selectedFileName: 'App.tsx',
  
  // 基础操作
  setSelectedFileName: (fileName) => set({ selectedFileName: fileName }),
  
  setFiles: (files) => {
    set({ files });
    syncFilesToUrl(files);  // 同步到 URL
  },
}));
```

### 第四步：实现文件 CRUD 操作
```typescript
// 添加文件
addFile: (name) => {
  const { files } = get();
  const newFiles = {
    ...files,
    [name]: {
      name,
      language: fileName2Language(name),  // 自动识别语言
      value: '',
    }
  };
  set({ files: newFiles });
  syncFilesToUrl(newFiles);
},

// 删除文件
removeFile: (name) => {
  const { files } = get();
  const { [name]: removed, ...newFiles } = files;  // 解构删除
  set({ files: newFiles });
  syncFilesToUrl(newFiles);
},

// 重命名文件
updateFileName: (oldFieldName, newFieldName) => {
  const { files } = get();
  if (!files[oldFieldName] || !newFieldName) return;
  
  const { [oldFieldName]: value, ...rest } = files;
  const newFiles = {
    ...rest,
    [newFieldName]: {
      ...value,
      language: fileName2Language(newFieldName),
      name: newFieldName,
    },
  };
  set({ files: newFiles });
  syncFilesToUrl(newFiles);
},
```

### 第五步：验证功能
- 测试文件的增删改查操作
- 验证 URL 同步功能
- 检查语言识别是否正确
- 测试错误处理机制

## 4. 复现要点

### 关键注意事项
1. **数据压缩**：使用 fflate 库压缩 URL 数据，避免 URL 过长
2. **错误处理**：所有 JSON 解析和压缩操作都要有 try-catch
3. **状态不可变**：使用展开运算符确保状态不可变性
4. **语言识别**：依赖 `fileName2Language` 工具函数

### 性能优化要点
- **精确订阅**：组件只订阅需要的状态片段
- **批量更新**：文件操作后统一同步到 URL
- **错误隔离**：URL 同步失败不影响文件操作

### 常见问题及解决方案
1. **URL 过长**：使用压缩算法减少 URL 长度
2. **JSON 解析失败**：添加错误处理，回退到默认文件
3. **状态更新不及时**：确保使用 Zustand 的 set 方法
4. **文件名冲突**：在添加文件前检查文件是否已存在

### 依赖要求
```json
{
  "zustand": "^4.x",
  "fflate": "^0.8.2"
}
```

### 相关文件依赖
- `../utils.ts`：提供 compress、uncompress、fileName2Language 函数
- `../files.ts`：提供 initFiles 默认文件配置

### 使用示例
```typescript
// 在组件中使用
function MyComponent() {
  const { files, selectedFileName, addFile, removeFile } = useFileStore();
  
  // 只订阅特定状态
  const currentFile = useFileStore(state => state.files[state.selectedFileName]);
  
  return (
    <div>
      {/* 使用文件数据 */}
    </div>
  );
}
```
