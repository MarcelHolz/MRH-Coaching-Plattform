import { TRAIT_COLOR, TRAIT_LABEL, TRAIT_ORDER } from '../lib/testergebnisse'

// Diverging Säulendiagramm für die vier Punktewerte eines Testergebnisses.
// Werte können negativ sein (Coaching-Vorbereitungstest), deshalb kein
// Radar-/Spinnendiagramm (das setzt eine nicht-negative Skala ab der Mitte
// voraus) -- stattdessen Säulen je Merkmal, die von EINER gemeinsamen
// Nulllinie aus nach oben (positiv) oder unten (negativ) wachsen. Farbe
// codiert die Typ-Identität (siehe TRAIT_COLOR), nicht das Vorzeichen --
// das Vorzeichen liest man an Richtung + direktem Zahlenlabel ab, beides
// bereits vorhanden, Farbe ist also nie der einzige Vorzeichen-Hinweis.

const CHART_WIDTH = 320
const MARGIN_X = 8
const COLUMN_WIDTH = 24
const COLUMN_RADIUS = 4
const PADDING_Y = 8
const TOP_RESERVE = 92
const BOTTOM_RESERVE = 92
const VALUE_LABEL_RESERVE = 20
const CATEGORY_LABEL_GAP = 8
const CATEGORY_LABEL_HEIGHT = 14

const CHART_HEIGHT =
  PADDING_Y + TOP_RESERVE + BOTTOM_RESERVE + CATEGORY_LABEL_GAP + CATEGORY_LABEL_HEIGHT + PADDING_Y

function roundedColumnPath(x, y, width, height, radius, roundTop) {
  const r = Math.min(radius, width / 2, height)
  if (r <= 0) {
    return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`
  }
  if (roundTop) {
    return [
      `M ${x} ${y + r}`,
      `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
      `H ${x + width - r}`,
      `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
      `V ${y + height}`,
      `H ${x} Z`,
    ].join(' ')
  }
  return [
    `M ${x} ${y}`,
    `H ${x + width}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r} Z`,
  ].join(' ')
}

export default function TestergebnisChart({ punkte }) {
  const werte = TRAIT_ORDER.map((key) => punkte?.[key] ?? 0)
  const domain = Math.max(1, ...werte.map((w) => Math.abs(w)))

  const columnAreaWidth = CHART_WIDTH - MARGIN_X * 2
  const slotWidth = columnAreaWidth / TRAIT_ORDER.length
  const zeroY = PADDING_Y + TOP_RESERVE
  const barMaxLength = Math.min(TOP_RESERVE, BOTTOM_RESERVE) - VALUE_LABEL_RESERVE
  const categoryLabelY = zeroY + BOTTOM_RESERVE + CATEGORY_LABEL_GAP + CATEGORY_LABEL_HEIGHT - 2

  return (
    <div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`Punkteverteilung: ${TRAIT_ORDER.map((key, i) => `${TRAIT_LABEL[key]} ${werte[i]}`).join(', ')}`}
      >
        <line
          x1={MARGIN_X}
          y1={zeroY}
          x2={CHART_WIDTH - MARGIN_X}
          y2={zeroY}
          stroke="#e2e8f0"
          strokeWidth={1}
        />

        {TRAIT_ORDER.map((key, i) => {
          const value = werte[i]
          const barLength = (Math.abs(value) / domain) * barMaxLength
          const columnCenterX = MARGIN_X + slotWidth * i + slotWidth / 2
          const columnX = columnCenterX - COLUMN_WIDTH / 2
          const isPositive = value >= 0
          const columnY = isPositive ? zeroY - barLength : zeroY
          const path = roundedColumnPath(
            columnX,
            columnY,
            COLUMN_WIDTH,
            barLength,
            COLUMN_RADIUS,
            isPositive,
          )
          const valueLabelY = isPositive ? zeroY - barLength - 6 : zeroY + barLength + 15

          return (
            <g key={key}>
              {barLength > 0 && (
                <path d={path} fill={TRAIT_COLOR[key]}>
                  <title>
                    {TRAIT_LABEL[key]}: {value}
                  </title>
                </path>
              )}
              <text
                x={columnCenterX}
                y={valueLabelY}
                textAnchor="middle"
                className="fill-slate-500 text-[11px] tabular-nums"
              >
                {value}
              </text>
              <text
                x={columnCenterX}
                y={categoryLabelY}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-medium"
              >
                {TRAIT_LABEL[key]}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="mt-1 text-[11px] text-slate-400">
        Säule nach oben = positiver Wert, nach unten = negativer Wert
      </p>
    </div>
  )
}
