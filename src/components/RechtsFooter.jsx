import { Link } from 'react-router-dom'
import {
  AGB_URL,
  DATENSCHUTZ_URL,
  IMPRESSUM_URL,
  WIDERRUF_URL,
} from '../lib/rechtliches'

const LINKS = [
  { label: 'Impressum', href: IMPRESSUM_URL },
  { label: 'Datenschutz', href: DATENSCHUTZ_URL },
  { label: 'AGB', href: AGB_URL },
  { label: 'Widerrufsbelehrung', href: WIDERRUF_URL },
]

// Rechtliche Pflichtlinks plus Kündigungsbutton (§ 312k BGB) für alle
// öffentlichen Seiten und den Coachie-Bereich. "dunkel" für Seiten mit
// schwarzem Hintergrund (Kaufseite, Mitgliedschaft).
export default function RechtsFooter({ dunkel = false, linksbuendig = false, className = '' }) {
  const farbe = dunkel
    ? 'text-white/50 hover:text-white'
    : 'text-mrh-grey hover:text-mrh-navy'

  return (
    <nav
      aria-label="Rechtliches"
      className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${linksbuendig ? 'justify-start' : 'justify-center'} ${className}`}
    >
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${farbe} hover:underline`}
        >
          {link.label}
        </a>
      ))}
      <Link to="/vertrag-kuendigen" className={`${farbe} hover:underline`}>
        Verträge hier kündigen
      </Link>
    </nav>
  )
}
