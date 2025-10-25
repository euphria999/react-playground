import Editor from "./Editor";
import FileNameList from "./FileNameList";
import { useFileStore, useThemeStore } from "../../stores";
import { debounce } from "lodash-es";

export default function CodeEditor() {
    const { files, setFiles, selectedFileName } = useFileStore();
    const theme = useThemeStore(state => state.theme);
    
    const file = files[selectedFileName];
    
    // 编辑器变化时，更新文件内容
    function onEditorChange(value?: string) {
        const newFiles = {
            ...files,
            [file.name]: { ...file, value: value! }
        };
        setFiles(newFiles);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <FileNameList />
            <Editor 
                file={file} 
                onChange={debounce(onEditorChange, 500)} // 使用debounce防止用户输入代码时频繁更新
                options={{theme: `vs-${theme}`}}
            />
        </div>
    );
}

