import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA-Installierbarkeit (Feature Mobile-Optimierung) -- nur in Produktion
// registrieren, damit der Service Worker den `npm run dev`-Workflow nicht
// mit gecachten Antworten stört (Vite HMR erwartet frische Antworten).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
