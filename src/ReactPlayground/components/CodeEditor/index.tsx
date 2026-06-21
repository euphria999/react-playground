import { debounce } from "lodash-es";
import Editor from "./Editor";
import FileNameList from "./FileNameList";
import { useFileStore, useThemeStore } from "../../stores";

export default function CodeEditor() {
  const { files, setFiles, selectedFileName } = useFileStore();
  const theme = useThemeStore((state) => state.theme);

  const file = files[selectedFileName];

  function onEditorChange(value?: string) {
    const newFiles = {
      ...files,
      [file.name]: { ...file, value: value! },
    };
    setFiles(newFiles);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <FileNameList />
      <Editor
        file={file}
        onChange={debounce(onEditorChange, 500)}
        theme={`vs-${theme}`}
      />
    </div>
  );
}
