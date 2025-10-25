import { useThemeStore, useAIStore } from '../../stores';
import styles from './index.module.scss';

export default function AISettings() {
  const theme = useThemeStore(state => state.theme);
  const { aiSettings, setAISettings } = useAIStore();

  return (
    <div className={`${styles.settings} ${theme}`}>
      <div className={styles.header}>
        <h3>🔧 AI 助手设置</h3>
      </div>
      
      <div className={styles.content}>

        <div className={styles.settingItem}>
          <label>模型选择</label>
          <select
            value={aiSettings.model}
            onChange={(e) => setAISettings({ model: e.target.value as any })}
            className={styles.select}
          >
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo (推荐)</option>
            <option value="gpt-4">GPT-4 (更强大)</option>
          </select>
        </div>

        <div className={styles.settingItem}>
          <label>最大 Token 数</label>
          <input
            type="range"
            min="100"
            max="2000"
            step="100"
            value={aiSettings.maxTokens}
            onChange={(e) => setAISettings({ maxTokens: Number(e.target.value) })}
            className={styles.range}
          />
          <span className={styles.rangeValue}>{aiSettings.maxTokens}</span>
        </div>

        <div className={styles.settingItem}>
          <label>创造性程度</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={aiSettings.temperature}
            onChange={(e) => setAISettings({ temperature: Number(e.target.value) })}
            className={styles.range}
          />
          <span className={styles.rangeValue}>{aiSettings.temperature}</span>
        </div>



        <div className={styles.status}>

          <h4>当前配置</h4>
          <div className={styles.statusItem}>
            <span>模型:</span>
            <span>{aiSettings.model}</span>
          </div>
          <div className={styles.statusItem}>
            <span>最大Token:</span>
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
