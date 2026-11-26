import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Ask the browser to keep our localStorage (it may otherwise be cleared under storage pressure)
void navigator.storage?.persist?.().catch(() => {})

// Offline shell (production only; dev server stays uncached)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* PWA is optional; the app works without it */
    })
  })
  // A home-screen app is usually resumed, not reloaded, so it would keep running
  // an old build. When the app comes back to the foreground, compare our bundle
  // with the one the live index.html points to, and reload once if it changed.
  const bundleOf = (html: string) => html.match(/assets\/index-[\w-]+\.js/)?.[0] ?? null
  const current = bundleOf(document.documentElement.outerHTML)
  let checking = false
  const checkForUpdate = async () => {
    if (checking || !current || document.visibilityState !== 'visible' || !navigator.onLine) return
    checking = true
    try {
      const res = await fetch('./index.html', { cache: 'no-store' })
      const latest = res.ok ? bundleOf(await res.text()) : null
      if (latest && latest !== current) window.location.reload()
    } catch {
      /* offline or blocked: keep the running build */
    } finally {
      checking = false
    }
  }
  document.addEventListener('visibilitychange', checkForUpdate)
  window.addEventListener('focus', checkForUpdate)
}
