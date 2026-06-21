import MonacoEditor from "@monaco-editor/react";
import type { EditorProps, OnMount } from "@monaco-editor/react";
import { memo, useCallback, useMemo } from "react";
import type { editor } from "monaco-editor";
import { createATA } from "./ata";

export interface EditorFile {
  name: string;
  value: string;
  language: string;
}

interface Props {
  file: EditorFile;
  onChange?: EditorProps["onChange"];
  theme?: EditorProps["theme"];
  options?: editor.IStandaloneEditorConstructionOptions;
}

function Editor(props: Props) {
  const { file, onChange, theme, options } = props;

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
      editor.getAction("editor.action.formatDocument")?.run();
    });

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      [
        "declare module 'react-dom/client' {",
        "  import * as React from 'react';",
        "  export interface Root {",
        "    render(children: React.ReactNode): void;",
        "    unmount(): void;",
        "  }",
        "  export interface RootOptions {",
        "    identifierPrefix?: string;",
        "  }",
        "  export interface HydrationOptions extends RootOptions {}",
        "  export function createRoot(container: Element | DocumentFragment, options?: RootOptions): Root;",
        "  export function hydrateRoot(",
        "    container: Element | Document,",
        "    initialChildren: React.ReactNode,",
        "    options?: HydrationOptions",
        "  ): Root;",
        "}",
      ].join("\n"),
      "file:///node_modules/@types/react-dom/client-shim.d.ts"
    );

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.Preserve,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    });

    const ata = createATA((code, path) => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        code,
        `file://${path}`
      );
    });

    editor.onDidChangeModelContent(() => {
      ata(editor.getValue());
    });

    ata(editor.getValue());
  }, []);

  const editorOptions = useMemo(
    () => ({
      fontSize: 14,
      scrollBeyondLastLine: false,
      minimap: {
        enabled: false,
      },
      scrollbar: {
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
      },
      automaticLayout: true,
      wordWrap: "on" as const,
      renderLineHighlight: "line" as const,
      selectionHighlight: false,
      occurrencesHighlight: "off" as const,
      renderWhitespace: "selection" as const,
      ...options,
    }),
    [options]
  );

  return (
    <MonacoEditor
      height={"100%"}
      path={file.name}
      language={file.language}
      theme={theme}
      onMount={handleEditorMount}
      onChange={onChange}
      value={file.value}
      options={editorOptions}
      loading={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#666",
          }}
        >
          正在加载编辑器...
        </div>
      }
    />
  );
}

export default memo(Editor, (prevProps, nextProps) => {
  return (
    prevProps.file.name === nextProps.file.name &&
    prevProps.file.value === nextProps.file.value &&
    prevProps.file.language === nextProps.file.language &&
    prevProps.theme === nextProps.theme
  );
});
