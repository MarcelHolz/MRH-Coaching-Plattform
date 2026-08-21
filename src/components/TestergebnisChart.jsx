import { TRAIT_LABEL, TRAIT_ORDER } from '../lib/testergebnisse'

// Diverging Balkendiagramm für die vier Punktewerte eines Testergebnisses.
// Werte können negativ sein (Coaching-Vorbereitungstest), deshalb kein
// Radar-/Spinnendiagramm (das setzt eine nicht-negative Skala ab der Mitte
// voraus) -- stattdessen Balken je Merkmal, die von einer Nulllinie aus in
// beide Richtungen wachsen. Farben (Blau/Rot) sind gegen CVD-Sicherheit und
// Kontrast validiert (dataviz-Skill, Diverging-Paar).
const POSITIVE_COLOR = '#2a78d6'
const NEGATIVE_COLOR = '#e34948'

const ROW_LABEL_HEIGHT = 16
const ROW_LABEL_GAP = 4
const BAR_HEIGHT = 20
const ROW_GAP = 12
const ROW_HEIGHT = ROW_LABEL_HEIGHT + ROW_LABEL_GAP + BAR_HEIGHT
const PADDING_X = 6
const PADDING_Y = 8
const CHART_WIDTH = 320
const BAR_RADIUS = 4
// Platz am äußeren Rand für das Wertelabel (z. B. "-24") reservieren, damit
// es nicht vom SVG-viewBox abgeschnitten wird -- Balkenlänge darf diesen
// Bereich nie erreichen.
const VALUE_LABEL_RESERVE = 28

function roundedBarPath(x, y, width, height, radius, roundRight) {
  const r = Math.min(radius, width, height / 2)
  if (r <= 0) {
    return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`
  }
  if (roundRight) {
    return [
      `M ${x} ${y}`,
      `H ${x + width - r}`,
      `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
      `V ${y + height - r}`,
      `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
      `H ${x} Z`,
    ].join(' ')
  }
  return [
    `M ${x + r} ${y}`,
    `H ${x + width}`,
    `V ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y} Z`,
  ].join(' ')
}

export default function TestergebnisChart({ punkte }) {
  const werte = TRAIT_ORDER.map((key) => punkte?.[key] ?? 0)
  const domain = Math.max(1, ...werte.map((w) => Math.abs(w)))

  const plotWidth = CHART_WIDTH - PADDING_X * 2
  const halfPlot = plotWidth / 2
  const zeroX = PADDING_X + halfPlot
  const barMaxLength = halfPlot - VALUE_LABEL_RESERVE

  const chartHeight = PADDING_Y * 2 + TRAIT_ORDER.length * ROW_HEIGHT + (TRAIT_ORDER.length - 1) * ROW_GAP

  return (
    <div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
        width="100%"
        role="img"
        aria-label={`Punkteverteilung: ${TRAIT_ORDER.map((key, i) => `${TRAIT_LABEL[key]} ${werte[i]}`).join(', ')}`}
      >
        {TRAIT_ORDER.map((key, i) => {
          const value = werte[i]
          const barLength = (Math.abs(value) / domain) * barMaxLength
          const labelY = PADDING_Y + i * (ROW_HEIGHT + ROW_GAP)
          const trackY = labelY + ROW_LABEL_HEIGHT + ROW_LABEL_GAP
          const trackMidY = trackY + BAR_HEIGHT / 2
          const isPositive = value >= 0
          const barX = isPositive ? zeroX : zeroX - barLength
          const path = roundedBarPath(barX, trackY, barLength, BAR_HEIGHT, BAR_RADIUS, isPositive)
          const valueLabelX = isPositive ? barX + barLength + 6 : barX - 6

          return (
            <g key={key}>
              <text
                x={PADDING_X}
                y={labelY + ROW_LABEL_HEIGHT - 4}
                className="fill-slate-600 text-[11px] font-medium"
              >
                {TRAIT_LABEL[key]}
              </text>
              <line
                x1={zeroX}
                y1={trackY}
                x2={zeroX}
                y2={trackY + BAR_HEIGHT}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              {barLength > 0 && (
                <path d={path} fill={isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR}>
                  <title>
                    {TRAIT_LABEL[key]}: {value}
                  </title>
                </path>
              )}
              <text
                x={valueLabelX}
                y={trackMidY + 4}
                textAnchor={isPositive ? 'start' : 'end'}
                className="fill-slate-500 text-[11px] tabular-nums"
              >
                {value}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="mt-1 text-[11px] text-slate-400">
        <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: POSITIVE_COLOR }} />{' '}
        positiver Wert &nbsp;
        <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: NEGATIVE_COLOR }} />{' '}
        negativer Wert
      </p>
    </div>
  )
}
