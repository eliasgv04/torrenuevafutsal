import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages deployment - Deploy from GitHub Actions
export default defineConfig({
  plugins: [react()],
  base: '/torrenuevafutsal/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // The full suite now has 45+ files running in parallel worker threads;
    // under CPU contention some interaction-heavy tests (userEvent.type,
    // multiple awaited clicks) can exceed the 5s default even though they're
    // not actually hung — give them more headroom.
    testTimeout: 15000,
    // Makes api.js's HAS_SUPABASE true during tests (it's computed once at
    // module load from these), so tests exercise the real Supabase-calling
    // code path by default instead of the localStorage fallback.
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON: 'test-anon-key'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: ['src/**/__tests__/**', 'src/test/**']
    }
  }
})
