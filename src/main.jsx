import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// A deploy replaces the hashed chunk files. A tab that is already open then
// fails to import a lazy route chunk, which otherwise ends as a dead click.
// Reload once to pick up the new build; if the import keeps failing, the reload
// is skipped so ErrorBoundary can report it instead of looping.
const CHUNK_RELOAD_KEY = 'reporter-for-autotests-chunk-reload-at'
const RELOAD_COOLDOWN_MS = 10_000

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  let lastAttempt = 0
  try { lastAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0 } catch { /* Storage may be unavailable. */ }
  if (Date.now() - lastAttempt < RELOAD_COOLDOWN_MS) return
  try { sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now())) } catch { /* Reload anyway. */ }
  window.location.reload()
})

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
