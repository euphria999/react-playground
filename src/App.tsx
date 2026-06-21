import { useEffect } from 'react';
import { App as AntdApp } from 'antd';
import ReactPlayground from './ReactPlayground';
import './App.scss';

function App() {
  useEffect(() => {
    import('./ReactPlayground/components/CodeEditor').catch(() => {});
    import('./ReactPlayground/components/AIAssistant').catch(() => {});
    import('./ReactPlayground/components/Preview').catch(() => {});
  }, []);

  return (
    <AntdApp>
      <ReactPlayground />
    </AntdApp>
  );
}

export default App;
