import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Keep a single React runtime for the app and all UI dependencies to avoid
    // invalid-hook errors in Vite dev mode.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React must live in its own chunk: antd/dayjs chunks import it, and
            // keeping it in the entry chunk makes those imports evaluate before
            // React is initialized in production builds.
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react'
            // Do not force @ant-design/charts into a manual chunk: it is imported
            // only by lazy analytics pages, and a forced chunk creates a
            // charts <-> react circular dependency in production builds.
            if (id.includes('antd') || id.includes('@ant-design/icons')) return 'antd'
            // Only the dayjs package itself: antd's `date-picker/generatePicker/dayjs.js`
            // also contains "dayjs" in its path and must stay in the antd chunk.
            if (id.includes('/dayjs/')) return 'dayjs'
          }
        },
      },
    },
  },
})
