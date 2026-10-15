import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ant Design Charts has a large React-based dependency tree. Force every
    // package and the app to use the same React runtime to avoid invalid-hook
    // errors in Vite dev mode.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@ant-design/charts') || id.includes('@ant-design/plots') || id.includes('@antv/')) return 'charts'
            if (id.includes('antd') || id.includes('@ant-design/icons')) return 'antd'
            if (id.includes('dayjs')) return 'dayjs'
          }
        },
      },
    },
  },
})
