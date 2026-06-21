import {
  DownloadOutlined,
  MoonOutlined,
  ShareAltOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { App as AntdApp } from "antd";
import copy from "copy-to-clipboard";
import logoSvg from "../../../assets/logo.svg";
import { useFileStore, useThemeStore } from "../../stores";
import { downloadFiles } from "../../utils";
import styles from "./index.module.scss";

export default function Header() {
  const files = useFileStore((state) => state.files);
  const { theme, setTheme } = useThemeStore();
  const { message } = AntdApp.useApp();

  const handleShare = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(window.location.href);
        message.success("已复制链接");
        return;
      }

      const success = copy(window.location.href);
      if (success) {
        message.success("已复制链接");
      } else {
        message.error("复制失败，请手动复制链接");
      }
    } catch (error) {
      console.error("复制失败:", error);
      message.error("复制失败，请手动复制链接");
    }
  };

  const handleDownload = async () => {
    try {
      await downloadFiles(files);
      message.success("下载完成");
    } catch (error) {
      console.error("下载失败:", error);
      message.error("下载失败，请重试");
    }
  };

  return (
    <div className={styles.header}>
      <div className={styles.logo}>
        <img alt="logo" src={logoSvg} />
        <span>React Playground</span>
      </div>
      <div className={styles.links}>
        {theme === "light" ? (
          <MoonOutlined
            title="切换暗色主题"
            className={styles.theme}
            onClick={() => setTheme("dark")}
          />
        ) : (
          <SunOutlined
            title="切换亮色主题"
            className={styles.theme}
            onClick={() => setTheme("light")}
          />
        )}
        <ShareAltOutlined
          style={{ marginLeft: "10px", cursor: "pointer" }}
          onClick={handleShare}
        />
        <DownloadOutlined
          style={{ marginLeft: "10px", cursor: "pointer" }}
          onClick={handleDownload}
        />
      </div>
    </div>
  );
}
