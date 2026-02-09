import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnvDir = path.resolve(__dirname, '..')
  const env = loadEnv(mode, rootEnvDir, '')

  return {
    envDir: rootEnvDir,
    server: {
      port: Number(env.FRONTEND_PORT) || 5173,
      strictPort: true,
    },
    plugins: [react()],
  }
})
