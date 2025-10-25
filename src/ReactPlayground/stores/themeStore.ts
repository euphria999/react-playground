import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// 从 localStorage 获取主题
const getStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem('react-playground-theme');
    return (stored as Theme) || 'light';
  } catch {
    return 'light';
  }
};

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: getStoredTheme(),
  
  setTheme: (theme) => {
    set({ theme });
    try {
      localStorage.setItem('react-playground-theme', theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  },
}));
