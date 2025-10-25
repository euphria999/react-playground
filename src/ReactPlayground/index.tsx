import { Allotment } from "allotment"
import 'allotment/dist/style.css'
import Header from "./components/Header"
import { useThemeStore } from "./stores"
import { Suspense, lazy } from "react"
import './index.scss'

// 懒加载大组件
const CodeEditor = lazy(() => import("./components/CodeEditor"))
const Preview = lazy(() => import("./components/Preview"))
const AIAssistant = lazy(() => import("./components/AIAssistant"))

// 加载中组件
const LoadingSpinner = ({ message }: { message: string }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        flexDirection: 'column',
        gap: '12px'
    }}>
        <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #0066cc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ fontSize: '14px', color: '#666' }}>{message}</span>
    </div>
)

export default function ReactPlayground() {
    const theme = useThemeStore(state => state.theme)
    
    return <div className={theme} style={{height: '100vh', display: 'flex'}}>
        {/* AI 助手 */}
        <Suspense fallback={<div style={{width: '320px'}}><LoadingSpinner message="正在加载AI助手..." /></div>}>
            <AIAssistant />
        </Suspense>
        
        {/* 主要内容区域 */}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
            <Header/>
            <Allotment defaultSizes={[100, 100]}>
                <Allotment.Pane minSize={0}>
                    <Suspense fallback={<LoadingSpinner message="正在加载代码编辑器..." />}>
                        <CodeEditor />
                    </Suspense>
                </Allotment.Pane>
                <Allotment.Pane minSize={0}>
                    <Suspense fallback={<LoadingSpinner message="正在加载预览窗口..." />}>
                        <Preview />
                    </Suspense>
                </Allotment.Pane>
            </Allotment>
        </div>
    </div>
}

