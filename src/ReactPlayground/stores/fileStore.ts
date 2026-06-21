import { create } from 'zustand';
import { fileName2Language } from '../utils';
import { initFiles } from '../files';
import { compress, uncompress } from '../utils';
import { syncImportMapFile } from '../importMap';

// 文件接口
export interface File {
  name: string;
  value: string;
  language: string;
}

export interface Files {
  [key: string]: File;
}

interface FileStore {
  files: Files;
  autoImportEntries: string[];
  selectedFileName: string;
  setSelectedFileName: (fileName: string) => void;
  setFiles: (files: Files) => void;
  addFile: (fileName: string) => void;
  removeFile: (fileName: string) => void;
  updateFileName: (oldFieldName: string, newFieldName: string) => void;
}

type PersistedFileState = {
  files: Files;
  autoImportEntries?: string[];
};

const isFileRecord = (value: unknown): value is File => (
  typeof value === 'object'
  && value !== null
  && 'name' in value
  && 'value' in value
  && 'language' in value
);

const isPersistedFileState = (value: Files | PersistedFileState): value is PersistedFileState => {
  if (typeof value !== 'object' || value === null || !('files' in value)) {
    return false;
  }

  const candidate = value.files;
  return typeof candidate === 'object' && candidate !== null && !isFileRecord(candidate);
};

const normalizeFilesState = (
  files: Files,
  autoImportEntries: string[] = []
) => syncImportMapFile(files, autoImportEntries);

// 从 URL 获取文件
const getFilesFromUrl = (): PersistedFileState | undefined => {
  try {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const decompressed = uncompress(hash);
      const parsed = JSON.parse(decompressed) as Files | PersistedFileState;

      if (isPersistedFileState(parsed)) {
        return {
          files: parsed.files,
          autoImportEntries: parsed.autoImportEntries ?? [],
        };
      }

      return {
        files: parsed,
        autoImportEntries: [],
      };
    }
  } catch (error) {
    console.warn('Failed to load files from URL:', error);
  }
  return undefined;
};

// 同步文件到 URL
const syncFilesToUrl = (files: Files, autoImportEntries: string[]) => {
  try {
    const hash = compress(JSON.stringify({
      files,
      autoImportEntries,
    }));
    window.location.hash = encodeURIComponent(hash);
  } catch (error) {
    console.warn('Failed to sync files to URL:', error);
  }
};

const initialState = (() => {
  const persistedState = getFilesFromUrl();
  return normalizeFilesState(
    persistedState?.files || initFiles,
    persistedState?.autoImportEntries || []
  );
})();

export const useFileStore = create<FileStore>((set, get) => ({
  files: initialState.files,
  autoImportEntries: initialState.autoImportEntries,
  selectedFileName: 'App.tsx',
  
  setSelectedFileName: (fileName) => set({ selectedFileName: fileName }),
  
  setFiles: (files) => {
    const { autoImportEntries } = get();
    const nextState = normalizeFilesState(files, autoImportEntries);
    set(nextState);
    syncFilesToUrl(nextState.files, nextState.autoImportEntries);
  },
  
  addFile: (name) => {
    const { files, autoImportEntries } = get();
    const nextState = normalizeFilesState({
      ...files,
      [name]: {
        name,
        language: fileName2Language(name),
        value: '',
      }
    }, autoImportEntries);
    set(nextState);
    syncFilesToUrl(nextState.files, nextState.autoImportEntries);
  },
  
  removeFile: (name) => {
    const { files, autoImportEntries } = get();
    const newFiles = { ...files };
    delete newFiles[name];
    const nextState = normalizeFilesState(newFiles, autoImportEntries);
    set(nextState);
    syncFilesToUrl(nextState.files, nextState.autoImportEntries);
  },
  
  updateFileName: (oldFieldName, newFieldName) => {
    const { files, autoImportEntries } = get();
    if (!files[oldFieldName] || !newFieldName) return;
    
    const { [oldFieldName]: value, ...rest } = files;
    const nextState = normalizeFilesState({
      ...rest,
      [newFieldName]: {
        ...value,
        language: fileName2Language(newFieldName),
        name: newFieldName,
      },
    }, autoImportEntries);
    set(nextState);
    syncFilesToUrl(nextState.files, nextState.autoImportEntries);
  },
}));
