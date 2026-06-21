import React, {
  lazy,
  memo,
  Suspense,
  useMemo,
  useRef,
  useState,
} from "react";
import { message } from "antd";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useThemeStore, useAIStore } from "../../stores";
import MessageItem from "./MessageItem";
import styles from "./index.module.scss";

const AISettings = lazy(() => import("../AISettings"));

function AIAssistant() {
  const theme = useThemeStore((state) => state.theme);
  const {
    aiSettings,
    aiAssistant,
    setAIAssistant,
    sendAIMessage,
    cancelAIRequest,
  } = useAIStore();

  const hasApiKey = aiSettings.apiKey.trim().length > 0;
  const [inputValue, setInputValue] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const hasNewMessagesWhileDetached =
    !isAtBottom &&
    (aiAssistant.messages.length > 0 ||
      aiAssistant.isStreaming ||
      aiAssistant.isLoading);

  const followOutput = useMemo(
    () => (atBottom: boolean) => (atBottom ? "smooth" : false),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || aiAssistant.isLoading || aiAssistant.isStreaming) {
      return;
    }

    if (!hasApiKey) {
      message.warning("请先在 AI 设置中填写 API Key");
      setShowSettings(true);
      return;
    }

    const nextMessage = inputValue.trim();
    setInputValue("");

    try {
      await sendAIMessage(nextMessage);
    } catch (error) {
      console.error("AI 消息发送失败", error);
    }
  };

  const handleScrollToBottom = () => {
    const lastIndex = aiAssistant.messages.length - 1;
    if (lastIndex < 0) {
      return;
    }

    virtuosoRef.current?.scrollToIndex({
      index: lastIndex,
      align: "end",
      behavior: "smooth",
    });
  };

  const toggleOpen = () => {
    setAIAssistant({ isOpen: !aiAssistant.isOpen });
  };

  const clearMessages = () => {
    setAIAssistant({
      messages: [],
      reconnectHint: "",
    });
  };

  const toggleSettings = () => {
    setShowSettings((value) => !value);
  };

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
      <div className={styles.header}>
        <h3>🤖 AI 编程助手</h3>
        <div className={styles.controls}>
          <button
            onClick={toggleSettings}
            className={styles.settingsBtn}
            title="设置"
          >
            ⚙
          </button>
          <button
            onClick={clearMessages}
            disabled={aiAssistant.messages.length === 0}
            title="清空消息"
          >
            🗑
          </button>
          {aiAssistant.isStreaming && (
            <button
              onClick={cancelAIRequest}
              title="取消请求"
              className={styles.cancelBtn}
            >
              ⏹
            </button>
          )}
          <button onClick={toggleOpen} title="关闭">
            ×
          </button>
        </div>
      </div>

      {showSettings && (
        <div className={styles.settingsPanel}>
          <Suspense
            fallback={
              <div style={{ padding: "20px", textAlign: "center" }}>
                正在加载设置...
              </div>
            }
          >
            <AISettings />
          </Suspense>
          <div
            className={styles.settingsOverlay}
            onClick={() => setShowSettings(false)}
          />
        </div>
      )}

      <div className={styles.messagesWrap}>
        {aiAssistant.messages.length === 0 ? (
          <div className={styles.messages}>
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>🤖</div>
              <h4>你好，我是你的 AI 编程助手</h4>
              <p>我可以帮助你：</p>
              <ul>
                <li>生成代码和组件</li>
                <li>优化和重构代码</li>
                <li>修复错误和 Bug</li>
                <li>解释代码和添加注释</li>
                <li>回答编程相关问题</li>
              </ul>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            className={styles.messages}
            data={aiAssistant.messages}
            computeItemKey={(_, item) => item.id}
            atBottomStateChange={setIsAtBottom}
            atBottomThreshold={24}
            followOutput={followOutput}
            itemContent={(index, currentMessage) => (
              <MessageItem
                message={currentMessage}
                isDark={theme === "dark"}
                isStreaming={aiAssistant.isStreaming}
                isLatest={index === aiAssistant.messages.length - 1}
              />
            )}
          />
        )}

        {aiAssistant.isLoading && !aiAssistant.isStreaming && (
          <div className={styles.loadingRow}>
            <div className={`${styles.message} ${styles.assistant}`}>
              <div className={styles.messageAvatar}>🤖</div>
              <div className={styles.messageContent}>
                <div className={styles.typing}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        )}

        {hasNewMessagesWhileDetached && (
          <button className={styles.backToBottom} onClick={handleScrollToBottom}>
            回到底部
          </button>
        )}
      </div>

      {aiAssistant.reconnectHint ? (
        <div className={styles.reconnectHint}>{aiAssistant.reconnectHint}</div>
      ) : null}

      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            aiAssistant.isStreaming
              ? "AI 正在思考中..."
              : hasApiKey
                ? "问我任何编程问题..."
                : "请先在设置中填写 API Key"
          }
          disabled={aiAssistant.isLoading || aiAssistant.isStreaming}
          className={styles.input}
        />
        <button
          type="submit"
          disabled={
            !inputValue.trim() ||
            !hasApiKey ||
            aiAssistant.isLoading ||
            aiAssistant.isStreaming
          }
          className={styles.sendBtn}
        >
          {aiAssistant.isLoading || aiAssistant.isStreaming ? "发送中..." : "发送"}
        </button>
      </form>

      <div className={styles.statusBar}>
        <div className={styles.statusItem}>
          <span
            className={`${styles.statusDot} ${
              hasApiKey ? styles.online : styles.offline
            }`}
          />
          <span>{hasApiKey ? "已配置 API Key" : "未配置 API Key"}</span>
        </div>
        <div className={styles.statusItem}>
          <span>{aiSettings.model}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(AIAssistant);
