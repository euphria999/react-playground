import { create } from 'zustand';
import { fileName2Language } from '../utils';
import { initFiles } from '../files';
import { compress, uncompress } from '../utils';

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
  selectedFileName: string;
  setSelectedFileName: (fileName: string) => void;
  setFiles: (files: Files) => void;
  addFile: (fileName: string) => void;
  removeFile: (fileName: string) => void;
  updateFileName: (oldFieldName: string, newFieldName: string) => void;
}

// 从 URL 获取文件
const getFilesFromUrl = (): Files | undefined => {
  try {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const decompressed = uncompress(hash);
      return JSON.parse(decompressed);
    }
  } catch (error) {
    console.warn('Failed to load files from URL:', error);
  }
  return undefined;
};

// 同步文件到 URL
const syncFilesToUrl = (files: Files) => {
  try {
    const hash = compress(JSON.stringify(files));
    window.location.hash = encodeURIComponent(hash);
  } catch (error) {
    console.warn('Failed to sync files to URL:', error);
  }
};

export const useFileStore = create<FileStore>((set, get) => ({
  files: getFilesFromUrl() || initFiles,
  selectedFileName: 'App.tsx',
  
  setSelectedFileName: (fileName) => set({ selectedFileName: fileName }),
  
  setFiles: (files) => {
    set({ files });
    syncFilesToUrl(files);
  },
  
  addFile: (name) => {
    const { files } = get();
    const newFiles = {
      ...files,
      [name]: {
        name,
        language: fileName2Language(name),
        value: '',
      }
    };
    set({ files: newFiles });
    syncFilesToUrl(newFiles);
  },
  
  removeFile: (name) => {
    const { files } = get();
    const { [name]: removed, ...newFiles } = files;
    set({ files: newFiles });
    syncFilesToUrl(newFiles);
  },
  
  updateFileName: (oldFieldName, newFieldName) => {
    const { files } = get();
    if (!files[oldFieldName] || !newFieldName) return;
    
    const { [oldFieldName]: value, ...rest } = files;
    const newFiles = {
      ...rest,
      [newFieldName]: {
        ...value,
        language: fileName2Language(newFieldName),
        name: newFieldName,
      },
    };
    set({ files: newFiles });
    syncFilesToUrl(newFiles);
  },
}));
