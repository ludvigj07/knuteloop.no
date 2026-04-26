import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { InvitePage } from './pages/InvitePage.jsx'
import { LogoutPage } from './pages/LogoutPage.jsx'

function Root() {
  if (typeof window !== 'undefined') {
    if (window.location.pathname === '/invite') return <InvitePage />
    if (window.location.pathname === '/logout') return <LogoutPage />
  }
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

// Registrer service worker (kun i produksjon for å slippe dev-cache-rot)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Sjekk for ny versjon ved fokus / hver time
        const checkForUpdate = () => {
          registration.update().catch(() => {})
        }
        window.addEventListener('focus', checkForUpdate)
        setInterval(checkForUpdate, 60 * 60 * 1000)

        // Når en ny SW har installert seg og venter — aktiver med en gang
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
      .catch(() => {})

    // Last på nytt når den nye SW-en har tatt over, sånn at brukeren ser ny versjon
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}
