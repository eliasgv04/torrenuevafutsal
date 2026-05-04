import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages deployment - Deploy from GitHub Actions
export default defineConfig({
  plugins: [react()],
  base: '/torrenuevafutsal/'
})
