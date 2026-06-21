import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LightAsync as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  atomOneDark,
  github,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import styles from "./index.module.scss";

SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("html", xml);
SyntaxHighlighter.registerLanguage("bash", bash);

interface MarkdownMessageProps {
  content: string;
  isDark: boolean;
}

const normalizeLanguage = (lang?: string) => {
  if (!lang) return undefined;
  if (lang === "ts") return "typescript";
  if (lang === "tsx") return "typescript";
  if (lang === "js") return "javascript";
  if (lang === "jsx") return "javascript";
  if (lang === "sh" || lang === "shell") return "bash";
  if (lang === "yml") return "yaml";
  return lang;
};

function MarkdownMessage({ content, isDark }: MarkdownMessageProps) {
  const [copiedKey, setCopiedKey] = useState("");
  let blockIndex = 0;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? "" : prev));
      }, 1200);
    } catch {
      setCopiedKey("");
    }
  };

  return (
    <div className={styles.markdownText}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = normalizeLanguage(match?.[1]);
            const value = String(children ?? "").replace(/\n$/, "");
            const isInline = !className;
            const key = `${language || "plain"}-${blockIndex++}-${value.length}`;

            if (isInline) {
              return (
                <code className={styles.inlineCode} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <div className={styles.codeBlockWrap}>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => handleCopy(value, key)}
                >
                  {copiedKey === key ? "已复制" : "复制"}
                </button>
                <SyntaxHighlighter
                  style={isDark ? atomOneDark : github}
                  language={language}
                  PreTag="div"
                  className={styles.codeBlock}
                >
                  {value}
                </SyntaxHighlighter>
              </div>
            );
          },
          p({ children }) {
            return <p>{children}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownMessage);
