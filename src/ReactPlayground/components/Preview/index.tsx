import { useEffect, useRef, useState, memo } from "react"
import { useFileStore } from "../../stores"

import iframeRaw from './iframe.html?raw'
import { IMPORT_MAP_FILE_NAME } from "../../files";
import { Message } from "../Message";
import CompilerWorker from './compiler.worker?worker'
import { debounce } from "lodash-es";

interface MessageData {
    data: {
      type: string
      message: string
    }
}

function Preview() {

    const files = useFileStore(state => state.files)
    const [compiledCode, setCompiledCode] = useState('')
    const [error, setError] = useState('')
    // 编译器 worker 引用
    const compilerWorkerRef = useRef<Worker | null>(null);
    useEffect(() => {
        // 初始化编译器 worker
        if(!compilerWorkerRef.current) {
            compilerWorkerRef.current = new CompilerWorker();
            compilerWorkerRef.current.addEventListener('message', ({data}) => {
                console.log('worker', data);
                if(data.type === 'COMPILED_CODE') {
                    setCompiledCode(data.data);// 设置编译后的代码
                } else {
                    // console.log('error', data);
                }
            })
        }
    }, []);

    useEffect(debounce(() => {
        compilerWorkerRef.current?.postMessage(files)
    }, 500), [files]);
    // 获取 iframe 的 url，用于链接分享。
    const getIframeUrl = () => {
        const res = iframeRaw.replace(
            '<script type="importmap"></script>', 
            `<script type="importmap">${
                files[IMPORT_MAP_FILE_NAME].value
            }</script>`
        ).replace(
            '<script type="module" id="appSrc"></script>',
            `<script type="module" id="appSrc">${compiledCode}</script>`,
        )
        return URL.createObjectURL(new Blob([res], { type: 'text/html' }))
    }

    useEffect(() => {
        setIframeUrl(getIframeUrl())
    }, [files[IMPORT_MAP_FILE_NAME].value, compiledCode]);

    const [iframeUrl, setIframeUrl] = useState(getIframeUrl());
    // 处理 iframe 消息
    const handleMessage = (msg: MessageData) => {
        const { type, message } = msg.data
        if (type === 'ERROR') {
          setError(message)
        }
    }
    // 监听 iframe 消息
    useEffect(() => {
        window.addEventListener('message', handleMessage)
        return () => {
          window.removeEventListener('message', handleMessage)
        }
    }, [])

    return <div style={{height: '100%'}}>
        <iframe
            src={iframeUrl}
            style={{
                width: '100%',
                height: '100%',
                padding: 0,
                border: 'none',
            }}
        />
        <Message type='error' content={error} />
    </div>
}

// 使用memo优化重渲染，只有files变化时才重新渲染
export default memo(Preview)