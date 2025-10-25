import ReactPlayground from './ReactPlayground';
import './App.scss'
import { useEffect } from 'react';

function App() {
  // 预加载关键资源
  useEffect(() => {
    // 预加载Monaco编辑器
    import('./ReactPlayground/components/CodeEditor').catch(() => {
      // 静默处理错误
    });
    
    // 预加载AI助手
    import('./ReactPlayground/components/AIAssistant').catch(() => {
      // 静默处理错误
    });
    
    // 预加载预览组件
    import('./ReactPlayground/components/Preview').catch(() => {
      // 静默处理错误
    });
  }, []);

  return <ReactPlayground/>
}

export default App

