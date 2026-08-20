import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { logAppError } from './lib/api'
import './styles.css'

// Catches JS bugs that never went through api.js's own try/catch (a render
// crash, a rejected promise nobody awaited) — same app_logs table, same
// AdminPanel view.
window.addEventListener('error', (e) => logAppError(e.error || e.message))
window.addEventListener('unhandledrejection', (e) => logAppError(e.reason))

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
