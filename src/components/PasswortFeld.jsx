import { useState } from 'react'

// Passwortfeld mit Augen-Symbol zum Anzeigen/Verbergen. Alle übrigen
// Props (id, value, onChange, required, minLength, autoComplete, name ...)
// gehen unverändert an das <input>. Der Umschalter ist ein eigener
// type="button" (sendet das Formular nie ab), per Tastatur bedienbar und
// mindestens 40 x 40 px groß.
function AugeOffen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.1 12.3a1 1 0 0 1 0-.6C3.6 7.4 7.5 4.5 12 4.5s8.4 2.9 9.9 7.2a1 1 0 0 1 0 .6c-1.5 4.3-5.4 7.2-9.9 7.2s-8.4-2.9-9.9-7.2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function AugeZu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.6 5.1A10 10 0 0 1 12 5c4.5 0 8.4 2.9 9.9 7.2a1 1 0 0 1 0 .6 10.6 10.6 0 0 1-2.6 4M6.6 6.6A10.6 10.6 0 0 0 2.1 11.7a1 1 0 0 0 0 .6C3.6 16.6 7.5 19.5 12 19.5a9.9 9.9 0 0 0 5.4-1.6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

export default function PasswortFeld({ className = '', ...inputProps }) {
  const [sichtbar, setSichtbar] = useState(false)

  return (
    <div className="relative">
      <input
        {...inputProps}
        type={sichtbar ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        onClick={() => setSichtbar((wert) => !wert)}
        aria-label={sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
        aria-pressed={sichtbar}
        aria-controls={inputProps.id}
        className="absolute inset-y-0 right-0 flex w-11 min-h-10 items-center justify-center rounded-r-lg text-slate-500 transition hover:text-mrh-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-mrh-navy"
      >
        {sichtbar ? <AugeZu /> : <AugeOffen />}
      </button>
    </div>
  )
}
