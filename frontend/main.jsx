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
