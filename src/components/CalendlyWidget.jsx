import { useEffect, useRef, useState } from 'react'

const WIDGET_SCRIPT_SRC = 'https://assets.calendly.com/assets/external/widget.js'

// Standard-Inline-Embed von Calendly (kein API-Key nötig, siehe
// https://help.calendly.com/hc/de/articles/223147027). Das Skript wird
// nur einmal pro Seite geladen und macht window.Calendly global
// verfügbar; mehrere Widgets auf derselben Seite können dasselbe
// Skript teilen.
let scriptPromise = null

function ladeCalendlyScript() {
  if (window.Calendly) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = WIDGET_SCRIPT_SRC
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.body.appendChild(script)
  })

  return scriptPromise
}

export default function CalendlyWidget({ url }) {
  const containerRef = useRef(null)
  const [bereit, setBereit] = useState(false)

  useEffect(() => {
    let cancelled = false

    ladeCalendlyScript().then(() => {
      if (!cancelled) setBereit(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!bereit || !containerRef.current || !window.Calendly) return

    containerRef.current.innerHTML = ''
    window.Calendly.initInlineWidget({
      url,
      parentElement: containerRef.current,
    })
  }, [bereit, url])

  return (
    <div
      ref={containerRef}
      style={{ minWidth: '280px', height: '650px' }}
      className="w-full"
    />
  )
}
