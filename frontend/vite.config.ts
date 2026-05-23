import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Wails 使用 file:// 协议加载嵌入资源，必须使用相对路径
  // 否则绝对路径 /assets/... 在桌面环境中无法解析，导致白屏
  base: './'
})
