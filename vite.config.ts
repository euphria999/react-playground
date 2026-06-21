import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = Number(env.PORT) || 3001;

  return {
    plugins: [react()],
    resolve: {
      mainFields: ['main', 'module']
    },
    optimizeDeps: {
      esbuildOptions: {
        mainFields: ['main', 'module']
      }
    },
    test: {
      projects: [
        {
          test: {
            name: 'frontend',
            environment: 'jsdom',
            include: ['src/**/*.test.ts']
          }
        },
        {
          test: {
            name: 'backend',
            environment: 'node',
            include: ['api/**/*.test.ts']
          }
        }
      ]
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            monaco: ['@monaco-editor/react', 'monaco-editor'],
            antd: ['antd', '@ant-design/icons'],
            babel: ['@babel/standalone'],
            layout: ['allotment'],
            utils: ['lodash-es', 'classnames', 'fflate', 'jszip', 'file-saver']
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug']
        }
      }
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api/chat-stream': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: false
        }
      }
    }
  };
});
