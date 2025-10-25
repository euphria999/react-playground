import { useEffect, useState } from "react"
import { useFileStore } from "../../../stores"

import { FileNameItem } from "./FileNameItem"
import styles from './index.module.scss'
import { APP_COMPONENT_FILE_NAME, ENTRY_FILE_NAME, IMPORT_MAP_FILE_NAME } from "../../../files"

export default function FileNameList() {
    const { 
        files, 
        removeFile, 
        addFile, 
        updateFileName, 
        selectedFileName,
        setSelectedFileName
    } = useFileStore()

    const [tabs, setTabs] = useState([''])
    
    // 监听文件变化，将文件对象的键名转换为标签页数组
    useEffect(() => {
        setTabs(Object.keys(files))
    }, [files])
    
    // (重命名)处理编辑完成（更新文件名，选中新文件，设置创建状态为false）
    const handleEditComplete = (name: string, prevName: string) => {
        updateFileName(prevName, name);
        setSelectedFileName(name);
        // 设置创建状态为false
        setCreating(false);
    }

    const [creating, setCreating] = useState(false); // 创建状态


    // 添加文件
    const addTab = () => {
        const newFileName = 'Comp' + Math.random().toString().slice(2,6) + '.tsx';
        addFile(newFileName);
        setSelectedFileName(newFileName);
        setCreating(true)
    }
    // 删除文件
    const handleRemove = (name: string) => {
        removeFile(name);
        setSelectedFileName(ENTRY_FILE_NAME);
    }
    // 只读文件名
    const readonlyFileNames = [ENTRY_FILE_NAME, IMPORT_MAP_FILE_NAME, APP_COMPONENT_FILE_NAME];

    return <div className={styles.tabs}>
        {
            tabs.map((item, index, arr) => (
                <FileNameItem 
                    key={item + index}
                    value={item}
                    readonly={readonlyFileNames.includes(item)}
                    creating={creating && index === arr.length - 1}
                    actived={selectedFileName === item}
                    onClick={() => setSelectedFileName(item)}
                    onEditComplete={(name: string) => handleEditComplete(name, item)}
                    onRemove={() => handleRemove(item)}
                >
                </FileNameItem>
            ))
        }
        <div className={styles.add} onClick={addTab}>
            +
        </div>
    </div>
}

