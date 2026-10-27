import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { aiApi } from './server/plugin.ts'

const root = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 프로젝트 폴더의 .env.local에서 ANTHROPIC_* 값을 서버 프로세스에만 넣는다
  // (VITE_ 접두사가 없어 브라우저 번들에는 안 들어감). 실행 위치와 상관없이 이 폴더를 본다.
  const env = loadEnv(mode, root, 'ANTHROPIC_')
  for (const [k, v] of Object.entries(env)) if (v && !process.env[k]) process.env[k] = v
  return { plugins: [react(), aiApi()] }
})
