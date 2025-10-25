import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate"
import type { Files } from './stores'
import JSZip from 'jszip'
import saveAs from 'file-saver'
// 根据文件名返回编程语言
export const fileName2Language = (name: string
) => {
    const suffix = name.split('.').pop() || ''
    if (['js', 'jsx'].includes(suffix)) return 'javascript'
    if (['ts', 'tsx'].includes(suffix)) return 'typescript'
    if (['json'].includes(suffix)) return 'json'
    if (['css'].includes(suffix)) return 'css'
    return 'javascript'
}
// 压缩数据
export function compress(data: string): string {
    const buffer = strToU8(data)
    const zipped = zlibSync(buffer, { level: 9 })
    const str = strFromU8(zipped, true)
    return btoa(str)
}
// 解压缩数据
export function uncompress(base64: string): string {
    try {
        // 检查base64字符串是否有效
        if (!base64 || typeof base64 !== 'string') {
            throw new Error('Invalid base64 string')
        }
        
        // 验证base64格式
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
        if (!base64Regex.test(base64)) {
            throw new Error('Invalid base64 format')
        }
        
        const binary = atob(base64)
        const buffer = strToU8(binary, true)
        const unzipped = unzlibSync(buffer)
        return strFromU8(unzipped)
    } catch (error) {
        console.warn('Failed to uncompress data:', error)
        throw new Error('Failed to uncompress data')
    }
}

// 下载文件
export async function downloadFiles(files: Files) {
    const zip = new JSZip()

    Object.keys(files).forEach((name) => {
        zip.file(name, files[name].value)
    })

    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, `code${Math.random().toString().slice(2, 8)}.zip`)
}