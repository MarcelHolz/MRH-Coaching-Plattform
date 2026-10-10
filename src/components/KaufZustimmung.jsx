import { AGB_PFAD, WIDERRUF_PFAD } from '../lib/rechtliches'

// Pflicht-Checkboxen vor jedem kostenpflichtigen Checkout (AGB und
// Widerrufsverzicht bei digitalen Inhalten, § 356 Abs. 5 BGB). Der Client
// meldet nur agb/widerrufsverzicht = true; den Zeitstempel setzt der
// Server selbst (unabhängig von der Geräteuhr) und legt ihn in den
// Metadaten der Stripe-Session sowie später in coachie_programme bzw.
// mitgliedschaften ab.

function Checkbox({ checked, onChange, children }) {
  return (
    <label className="flex items-start gap-2 text-xs text-white/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-mrh-gold"
      />
      <span>{children}</span>
    </label>
  )
}

const linkKlassen = 'underline hover:text-white'

export default function KaufZustimmung({ zustimmung, onChange }) {
  function setze(feld, angehakt) {
    onChange({ ...zustimmung, [feld]: angehakt })
  }

  return (
    <div className="mb-5 space-y-3">
      <Checkbox
        checked={zustimmung.agb}
        onChange={(angehakt) => setze('agb', angehakt)}
      >
        Ich habe die{' '}
        <a href={AGB_PFAD} target="_blank" rel="noopener noreferrer" className={linkKlassen}>
          AGB
        </a>{' '}
        gelesen und akzeptiere sie.
      </Checkbox>
      <Checkbox
        checked={zustimmung.widerrufsverzicht}
        onChange={(angehakt) => setze('widerrufsverzicht', angehakt)}
      >
        Ich verlange ausdrücklich, dass vor Ablauf der Widerrufsfrist mit der
        Bereitstellung der digitalen Inhalte begonnen wird. Mir ist bekannt, dass
        ich mit Beginn der Bereitstellung mein{' '}
        <a
          href={WIDERRUF_PFAD}
          target="_blank"
          rel="noopener noreferrer"
          className={linkKlassen}
        >
          Widerrufsrecht
        </a>{' '}
        verliere.
      </Checkbox>
    </div>
  )
}
