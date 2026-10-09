import { AGB_URL, WIDERRUF_URL } from '../lib/rechtliches'

// Pflicht-Checkboxen vor jedem kostenpflichtigen Checkout (AGB und
// Widerrufsverzicht bei digitalen Inhalten, § 356 Abs. 5 BGB). Merkt sich
// den Zeitpunkt des Anhakens, der an den Server geht und dort in den
// Metadaten der Stripe-Session sowie später in coachie_programme bzw.
// mitgliedschaften landet. Abhaken setzt den Zeitpunkt zurück.

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
    onChange({ ...zustimmung, [feld]: angehakt ? new Date().toISOString() : null })
  }

  return (
    <div className="mb-5 space-y-3">
      <Checkbox
        checked={Boolean(zustimmung.agbAkzeptiertAm)}
        onChange={(angehakt) => setze('agbAkzeptiertAm', angehakt)}
      >
        Ich habe die{' '}
        <a href={AGB_URL} target="_blank" rel="noopener noreferrer" className={linkKlassen}>
          AGB
        </a>{' '}
        gelesen und akzeptiere sie.
      </Checkbox>
      <Checkbox
        checked={Boolean(zustimmung.widerrufsverzichtAm)}
        onChange={(angehakt) => setze('widerrufsverzichtAm', angehakt)}
      >
        Ich verlange ausdrücklich, dass vor Ablauf der Widerrufsfrist mit der
        Bereitstellung der digitalen Inhalte begonnen wird. Mir ist bekannt, dass
        ich mit Beginn der Bereitstellung mein{' '}
        <a
          href={WIDERRUF_URL}
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
