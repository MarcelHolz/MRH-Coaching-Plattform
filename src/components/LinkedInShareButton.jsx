import { useState } from 'react'

// LinkedIns öffentlicher Share-Dialog (linkedin.com/sharing/share-offsite)
// akzeptiert seit einigen Jahren aus Anti-Spam-Gründen keinen
// vorbefüllten Beitragstext mehr, nur noch "url" als Parameter --
// LinkedIn liest die Vorschau-Kachel selbst aus den OG-Tags der URL.
// Als bestmöglicher Kompromiss kopiert dieser Button den
// vorformulierten Text zusätzlich in die Zwischenablage, bevor sich
// das LinkedIn-Fenster öffnet, und weist im UI darauf hin, ihn dort
// einzufügen.
export default function LinkedInShareButton({ text, url }) {
  const [kopiert, setKopiert] = useState(false)

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text)
      setKopiert(true)
      setTimeout(() => setKopiert(false), 4000)
    } catch {
      // Zwischenablage nicht verfügbar -- der Share-Dialog öffnet sich
      // trotzdem, nur ohne den Komfort des vorbefüllten Textes.
    }

    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-lg border border-[#0A66C2] px-4 py-2 text-sm font-medium text-[#0A66C2] transition hover:bg-[#0A66C2]/10"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
        </svg>
        Auf LinkedIn teilen
      </button>
      {kopiert && (
        <p className="mt-1 text-xs text-mrh-grey">
          Text kopiert -- im LinkedIn-Fenster einfach einfügen.
        </p>
      )}
    </div>
  )
}
