import { useState } from "react";
import { useThemeStore, useAIStore } from "../../stores";
import styles from "./index.module.scss";

export default function AISettings() {
  const theme = useThemeStore((state) => state.theme);
  const { aiSettings, setAISettings } = useAIStore();
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className={`${styles.settings} ${theme}`}>
      <div className={styles.header}>
        <h3>🔑 AI 助手设置</h3>
      </div>

      <div className={styles.content}>
        <div className={styles.settingItem}>
          <label htmlFor="api-key">API Key</label>
          <div className={styles.keyInput}>
            <input
              id="api-key"
              type={showApiKey ? "text" : "password"}
              value={aiSettings.apiKey}
              onChange={(e) => setAISettings({ apiKey: e.target.value })}
              placeholder="请输入你的 DeepSeek API Key"
              className={styles.input}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowApiKey((value) => !value)}
              className={styles.toggleBtn}
            >
              {showApiKey ? "隐藏" : "显示"}
            </button>
          </div>
          <p className={styles.hint}>
            API Key 仅保存在当前浏览器的本地存储中。当前项目不会读取本地 .env
            中的 Key，必须由用户在前端填写后才可使用。
          </p>
        </div>

        <div className={styles.settingItem}>
          <label htmlFor="model-select">模型选择</label>
          <select
            id="model-select"
            value={aiSettings.model}
            onChange={(e) => setAISettings({ model: e.target.value })}
            className={styles.select}
          >
            <option value="deepseek-chat">DeepSeek Chat</option>
            <option value="deepseek-reasoner">DeepSeek Reasoner</option>
          </select>
        </div>

        <div className={styles.settingItem}>
          <label htmlFor="max-tokens">最大 Token 数</label>
          <input
            id="max-tokens"
            type="range"
            min="100"
            max="8000"
            step="100"
            value={aiSettings.maxTokens}
            onChange={(e) => setAISettings({ maxTokens: Number(e.target.value) })}
            className={styles.range}
          />
          <span className={styles.rangeValue}>{aiSettings.maxTokens}</span>
        </div>

        <div className={styles.settingItem}>
          <label htmlFor="temperature">创造性程度</label>
          <input
            id="temperature"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={aiSettings.temperature}
            onChange={(e) =>
              setAISettings({ temperature: Number(e.target.value) })
            }
            className={styles.range}
          />
          <span className={styles.rangeValue}>{aiSettings.temperature}</span>
        </div>

        <div className={styles.status}>
          <h4>当前配置</h4>
          <div className={styles.statusItem}>
            <span>API Key:</span>
            <span>{aiSettings.apiKey.trim() ? "已配置" : "未配置"}</span>
          </div>
          <div className={styles.statusItem}>
            <span>模型:</span>
            <span>{aiSettings.model}</span>
          </div>
          <div className={styles.statusItem}>
            <span>最大 Token:</span>
            <span>{aiSettings.maxTokens}</span>
          </div>
          <div className={styles.statusItem}>
            <span>创造性:</span>
            <span>{aiSettings.temperature}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
