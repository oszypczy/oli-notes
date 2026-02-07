import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pdfTreePlugin } from './vite-plugins/pdfTreePlugin'

export default defineConfig({
  plugins: [react(), pdfTreePlugin()],
})
