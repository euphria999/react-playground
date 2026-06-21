import { memo } from 'react';
import type { AIMessage } from '../../stores';
import styles from './index.module.scss';
import MarkdownMessage from './MarkdownMessage';

interface MessageItemProps {
  message: AIMessage;
  isDark: boolean;
  isStreaming: boolean;
  isLatest: boolean;
}

function MessageItem({
  message,
  isDark,
  isStreaming,
  isLatest
}: MessageItemProps) {
  return (
    <div className={`${styles.message} ${styles[message.role]}`}>
      <div className={styles.messageAvatar}>
        {message.role === 'user' ? '👤' : '🤖'}
      </div>
      <div className={styles.messageContent}>
        <div className={styles.messageText}>
          {message.role === 'assistant' ? (
            <MarkdownMessage content={message.content} isDark={isDark} />
          ) : (
            message.content
          )}
          {message.role === 'assistant' && isStreaming && isLatest && (
            <span className={styles.cursor}>|</span>
          )}
        </div>
        <div className={styles.messageTime}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

export default memo(MessageItem);
