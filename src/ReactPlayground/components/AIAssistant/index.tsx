import React, { useState, useRef, useEffect, memo, useCallback, lazy, Suspense } from 'react';
import { useThemeStore, useAIStore } from '../../stores';
import styles from './index.module.scss';

// 懒加载AISettings组件
const AISettings = lazy(() => import('../AISettings'));

function AIAssistant() {
  const theme = useThemeStore(state => state.theme);
  const { 
    aiSettings,
    aiAssistant, 
    setAIAssistant, 
    sendAIMessage,
    cancelAIRequest
  } = useAIStore();
  
  const [inputValue, setInputValue] = useState('');//输入值
  const [showSettings, setShowSettings] = useState(false);//是否显示设置
  const messagesEndRef = useRef<HTMLDivElement>(null);//消息列表底部引用
  
  // 使用useCallback优化滚动函数
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  // 监听消息列表变化
  useEffect(scrollToBottom, [aiAssistant.messages, scrollToBottom]);
  // 提交消息
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();//阻止默认行为
    if (!inputValue.trim() || aiAssistant.isLoading || aiAssistant.isStreaming) return;//如果输入值为空或正在加载或正在流式传输，则返回
    // API Key由后端管理，无需检查
    // 获取消息
    const message = inputValue.trim();
    setInputValue('');//清空输入值
    // 发送消息
    try {
      // 统一使用流式
      await sendAIMessage(message);
    } catch (error) {
      console.error('AI 消息发送失败:', error);
    }
  };
  // 切换打开状态
  const toggleOpen = () => {
    setAIAssistant({ isOpen: !aiAssistant.isOpen });
  }; 
  // 清空消息
  const clearMessages = () => {
    setAIAssistant({ messages: [] });
  };
  // 切换设置状态
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  }; 
  // 如果未打开，则返回
  if (!aiAssistant.isOpen) {
    return (
      <div className={styles.aiToggle} onClick={toggleOpen}>
        <span>🤖</span>
        <span>AI 助手</span>
      </div>
    );
  }

  return (
    <div className={`${styles.aiAssistant} ${theme}`}>
      {/* 头部 */}
      <div className={styles.header}>
        <h3>🤖 AI 编程助手</h3>
        <div className={styles.controls}>
          <button 
            onClick={toggleSettings}
            className={styles.settingsBtn}
            title="设置"
          >
            ⚙️
          </button>
          <button 
            onClick={clearMessages} 
            disabled={aiAssistant.messages.length === 0}
            title="清空消息"
          >
            🗑️
          </button>
          {aiAssistant.isStreaming && (
            <button 
              onClick={cancelAIRequest}
              title="取消请求"
              className={styles.cancelBtn}
            >
              ⏹️
            </button>
          )}
          <button onClick={toggleOpen} title="关闭">
            ✕
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className={styles.settingsPanel}>
          <Suspense fallback={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              正在加载设置...
            </div>
          }>
            <AISettings />
          </Suspense>
          <div className={styles.settingsOverlay} onClick={() => setShowSettings(false)} />
        </div>
      )}

      {/* 消息列表 */}
      <div className={styles.messages}>
        {aiAssistant.messages.length === 0 ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>🤖</div>
            <h4>你好！我是你的 AI 编程助手</h4>
            <p>我可以帮助你：</p>
            <ul>
              <li>🔧 生成代码和组件</li>
              <li>⚡ 优化和重构代码</li>
              <li>🐛 修复错误和 Bug</li>
              <li>📝 解释代码和添加注释</li>
              <li>💡 回答编程相关问题</li>
            </ul>
            
          </div>
        ) : (
          aiAssistant.messages.map((message) => (
            <div key={message.id} className={`${styles.message} ${styles[message.role]}`}>
              <div className={styles.messageAvatar}>
                {message.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className={styles.messageContent}>
                <div className={styles.messageText}>
                  {message.content}
                  {/* 流式输出光标 */}
                  {message.role === 'assistant' && 
                   aiAssistant.isStreaming && 
                   message.id === aiAssistant.messages[aiAssistant.messages.length - 1]?.id && (
                    <span className={styles.cursor}>|</span>
                  )}
                </div>
                <div className={styles.messageTime}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* 加载指示器 */}
        {aiAssistant.isLoading && !aiAssistant.isStreaming && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.messageAvatar}>🤖</div>
            <div className={styles.messageContent}>
              <div className={styles.typing}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            aiAssistant.isStreaming 
              ? "AI 正在思考中..." 
              : "问我任何编程问题..."
          }
          disabled={aiAssistant.isLoading || aiAssistant.isStreaming}
          className={styles.input}
        />
        <button 
          type="submit" 
          disabled={!inputValue.trim() || aiAssistant.isLoading || aiAssistant.isStreaming}
          className={styles.sendBtn}
        >
          {aiAssistant.isLoading || aiAssistant.isStreaming ? '发送中...' : '发送'}
        </button>
      </form>

      {/* 状态栏 */}
      <div className={styles.statusBar}>
        <div className={styles.statusItem}>
          <span className={`${styles.statusDot} ${styles.online}`}></span>
          <span>已连接</span>
        </div>
        <div className={styles.statusItem}>
          <span>{aiSettings.model}</span>
        </div>

      </div>
    </div>
  );
}

// 使用memo优化重渲染
export default memo(AIAssistant)
