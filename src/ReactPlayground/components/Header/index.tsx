import styles from './index.module.scss'
import logoSvg from '../../../assets/logo.svg';
import { useFileStore, useThemeStore } from '../../stores';
import { DownloadOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { ShareAltOutlined } from '@ant-design/icons';
import { message } from 'antd';
import copy from 'copy-to-clipboard';
import { downloadFiles } from '../../utils';

export default function Header() {
  const files = useFileStore(state => state.files);
  const { theme, setTheme } = useThemeStore();

  return (
    <div className={styles.header}>
      <div className={styles.logo}>
        <img alt='logo' src={logoSvg}/>
        <span>React Playground</span>
      </div>
      <div className={styles.links}>
        {theme === 'light' && (
          <MoonOutlined
            title='切换暗色主题'
            className={styles.theme}
            onClick={() => setTheme('dark')}
          />
        )}
        {theme === 'dark' && (
          <SunOutlined
            title='切换亮色主题'
            className={styles.theme}
            onClick={() => setTheme('light')}
          />
        )}
        <ShareAltOutlined 
          style={{marginLeft: '10px', cursor: 'pointer'}}
          onClick={async () => {
            console.log('分享按钮被点击');
            try {
              // 尝试使用现代的 Clipboard API
              if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(window.location.href);
                message.success('分享链接已复制到剪贴板');
              } else {
                // 回退到 copy-to-clipboard 库
                const success = copy(window.location.href);
                console.log('复制结果:', success);
                if (success) {
                  message.success('分享链接已复制到剪贴板');
                } else {
                  message.error('复制失败，请手动复制链接');
                }
              }
            } catch (error) {
              console.error('复制失败:', error);
              message.error('复制失败，请手动复制链接');
            }
          }}
        />
        <DownloadOutlined 
          style={{marginLeft: '10px', cursor: 'pointer'}}
          onClick={async () => {
            console.log('下载按钮被点击');
            try {
              await downloadFiles(files);
              message.success('下载完成');
            } catch (error) {
              console.error('下载失败:', error);
              message.error('下载失败，请重试');
            }
          }}
        />
      </div>
    </div>
  )
}

