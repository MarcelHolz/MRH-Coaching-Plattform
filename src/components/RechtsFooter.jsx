import { Link } from 'react-router-dom'
import {
  AGB_PFAD,
  DATENSCHUTZ_URL,
  IMPRESSUM_URL,
  VERTRAG_KUENDIGEN_PFAD,
  VERTRAG_WIDERRUFEN_PFAD,
  WIDERRUF_PFAD,
} from '../lib/rechtliches'

// Externe Seiten (mrh-beratung.de) öffnen in neuem Tab, Seiten der
// Plattform als normaler Link. Die beiden gesetzlichen Schaltflächen
// (Widerruf § 356a, Kündigung § 312k BGB) sind etwas kräftiger
// gesetzt, damit sie gut erkennbar sind.
const LINKS = [
  { label: 'Impressum', href: IMPRESSUM_URL, extern: true },
  { label: 'Datenschutz', href: DATENSCHUTZ_URL, extern: true },
  { label: 'AGB', href: AGB_PFAD },
  { label: 'Widerrufsbelehrung', href: WIDERRUF_PFAD },
  { label: 'Vertrag widerrufen', href: VERTRAG_WIDERRUFEN_PFAD, betont: true },
  { label: 'Verträge hier kündigen', href: VERTRAG_KUENDIGEN_PFAD, betont: true },
]

// Rechtliche Pflichtlinks plus Widerrufs- und Kündigungsbutton für alle
// öffentlichen Seiten und den Coachie-Bereich. "dunkel" für Seiten mit
// schwarzem Hintergrund (Kaufseite, Mitgliedschaft). Beim Drucken
// ausgeblendet.
export default function RechtsFooter({ dunkel = false, linksbuendig = false, className = '' }) {
  const farbe = dunkel
    ? 'text-white/50 hover:text-white'
    : 'text-mrh-grey hover:text-mrh-navy'
  const betontFarbe = dunkel
    ? 'font-semibold text-white/80 hover:text-white'
    : 'font-semibold text-mrh-navy'

  return (
    <nav
      aria-label="Rechtliches"
      className={`flex flex-wrap gap-x-4 gap-y-1 text-xs print:hidden ${linksbuendig ? 'justify-start' : 'justify-center'} ${className}`}
    >
      {LINKS.map((link) =>
        link.extern ? (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${farbe} hover:underline`}
          >
            {link.label}
          </a>
        ) : (
          <Link
            key={link.href}
            to={link.href}
            className={`${link.betont ? betontFarbe : farbe} hover:underline`}
          >
            {link.label}
          </Link>
        ),
      )}
    </nav>
  )
}
