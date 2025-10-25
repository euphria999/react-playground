import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // React核心
          vendor: ['react', 'react-dom'],
          // Monaco编辑器 - 最大的chunk
          monaco: ['@monaco-editor/react', 'monaco-editor'],
          // UI组件库
          antd: ['antd', '@ant-design/icons'],
          // Babel编译器
          babel: ['@babel/standalone'],
          // 布局组件
          layout: ['allotment'],
          // 工具库
          utils: ['lodash-es', 'classnames', 'fflate', 'jszip', 'file-saver']
        }
      }
    },
    // 优化chunk大小
    chunkSizeWarningLimit: 1000,
    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 移除console
        drop_debugger: true, // 移除debugger
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // 移除指定函数调用
      },
    } as any, // 临时类型断言解决类型问题
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        headers: {
          'Connection': 'keep-alive'
        }
      }
    }
  }
})
