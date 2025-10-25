import MonacoEditor from '@monaco-editor/react'
import type { OnMount, EditorProps } from '@monaco-editor/react'
import { createATA } from './ata';
import type { editor } from 'monaco-editor'
import { memo, useCallback, useMemo } from 'react'

export interface EditorFile {
    name: string // 文件名
    value: string // 文件内容
    language: string // 编程语言
}

interface Props {
    file: EditorFile
    onChange?: EditorProps['onChange'],
    options?: editor.IStandaloneEditorConstructionOptions//编辑器选项
}

function Editor(props: Props) {
    const {
        file,
        onChange,
        options
    } = props;
    
    // 使用useCallback避免不必要的重新渲染
    const handleEditorMount: OnMount = useCallback((editor, monaco) => {
        // 添加快捷键，Ctrl+J 格式化代码
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
            editor.getAction('editor.action.formatDocument')?.run()
        });

        // 设置TypeScript编译选项
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            jsx: monaco.languages.typescript.JsxEmit.Preserve,//JSX语法保持原样，不转换为函数调用
            esModuleInterop: true,//允许默认导入CommonJS模块
        })
        //设置自动下载依赖包
        const ata = createATA((code, path) => {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(code, `file://${path}`)
        })
        editor.onDidChangeModelContent(() => {
            ata(editor.getValue());
        });

        ata(editor.getValue());
    }, []);
    
    // 使用useMemo缓存编辑器选项
    const editorOptions = useMemo(() => ({
        fontSize: 14,
        scrollBeyondLastLine: false,//是到了最后一行之后依然可以滚动一屏，关闭后就不会了
        minimap: {
            enabled: false, // 禁用小地图
        },
        //设置横向纵向滚动条宽度
        scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
        },
        // 性能优化选项
        automaticLayout: true, // 自动布局
        wordWrap: 'on' as const, // 自动换行
        renderLineHighlight: 'line' as const, // 行高亮
        selectionHighlight: false, // 禁用选择高亮以提高性能
        occurrencesHighlight: 'off' as const, // 禁用出现次数高亮
        renderWhitespace: 'selection' as const, // 只在选择时渲染空白字符
        ...options
    }), [options])

    return <MonacoEditor
        height={'100%'}
        path={file.name}
        language={file.language}
        onMount={handleEditorMount}
        onChange={onChange}
        value={file.value}
        options={editorOptions}
        // 性能优化：延迟加载
        loading={
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666'
            }}>
                正在加载编辑器...
            </div>
        }
    />
}

// 使用memo优化重渲染
export default memo(Editor, (prevProps, nextProps) => {
    return (
        prevProps.file.name === nextProps.file.name &&
        prevProps.file.value === nextProps.file.value &&
        prevProps.file.language === nextProps.file.language
    );
})
