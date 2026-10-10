import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fraunces lokal ausgeliefert statt über Google Fonts (keine
// Übertragung der IP-Adresse an Google). Nur die genutzten Schnitte.
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/500-italic.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/600-italic.css'
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
