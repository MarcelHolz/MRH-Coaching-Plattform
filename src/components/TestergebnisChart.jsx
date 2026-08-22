import { TRAIT_COLOR, TRAIT_LABEL, TRAIT_ORDER } from '../lib/testergebnisse'

// Säulendiagramm für die vier Punktewerte eines Testergebnisses. Werte
// können negativ sein (Coaching-Vorbereitungstest) -- statt divergierender
// Balken (nach oben/unten) wird die Skala verschoben: der kleinste
// tatsächliche Wert wird als kleiner, aber sichtbarer Balken (BASELINE_HEIGHT)
// dargestellt, alle anderen proportional höher relativ zueinander. Kein
// Radar-/Spinnendiagramm, weil das eine nicht-negative Skala ab der Mitte
// voraussetzt. Farbe codiert die Typ-Identität (siehe TRAIT_COLOR); die
// echten (nicht verschobenen) Werte stehen weiterhin als Zahlenlabel an
// jeder Säule -- die Verschiebung verändert nur die Balkenhöhe, nie die
// angezeigte Zahl.

const CHART_WIDTH = 320
const MARGIN_X = 8
const COLUMN_WIDTH = 24
const COLUMN_RADIUS = 4
const PADDING_Y = 8
const BAR_AREA_HEIGHT = 90
const VALUE_LABEL_RESERVE = 16
const BASELINE_HEIGHT = 6
const CATEGORY_LABEL_GAP = 3
const CATEGORY_LABEL_HEIGHT = 14

const CHART_HEIGHT =
  PADDING_Y + BAR_AREA_HEIGHT + CATEGORY_LABEL_GAP + CATEGORY_LABEL_HEIGHT + PADDING_Y

function roundedColumnPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height)
  if (r <= 0) {
    return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`
  }
  return [
    `M ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height}`,
    `H ${x} Z`,
  ].join(' ')
}

export default function TestergebnisChart({ punkte }) {
  const werte = TRAIT_ORDER.map((key) => punkte?.[key] ?? 0)
  const minWert = Math.min(...werte)
  const verschobeneWerte = werte.map((w) => w - minWert)
  const spanne = Math.max(1, ...verschobeneWerte)

  const columnAreaWidth = CHART_WIDTH - MARGIN_X * 2
  const slotWidth = columnAreaWidth / TRAIT_ORDER.length
  const baselineY = PADDING_Y + BAR_AREA_HEIGHT
  const verfuegbareHoehe = BAR_AREA_HEIGHT - VALUE_LABEL_RESERVE - BASELINE_HEIGHT
  const categoryLabelY = baselineY + CATEGORY_LABEL_GAP + CATEGORY_LABEL_HEIGHT - 2

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
          y1={baselineY}
          x2={CHART_WIDTH - MARGIN_X}
          y2={baselineY}
          stroke="#e2e8f0"
          strokeWidth={1}
        />

        {TRAIT_ORDER.map((key, i) => {
          const value = werte[i]
          const barHeight =
            BASELINE_HEIGHT + (verschobeneWerte[i] / spanne) * verfuegbareHoehe
          const columnCenterX = MARGIN_X + slotWidth * i + slotWidth / 2
          const columnX = columnCenterX - COLUMN_WIDTH / 2
          const columnY = baselineY - barHeight
          const path = roundedColumnPath(columnX, columnY, COLUMN_WIDTH, barHeight, COLUMN_RADIUS)
          const valueLabelY = columnY - 6

          return (
            <g key={key}>
              <path d={path} fill={TRAIT_COLOR[key]}>
                <title>
                  {TRAIT_LABEL[key]}: {value}
                </title>
              </path>
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
        Balkenhöhe zeigt die Werte im Verhältnis zueinander, nicht absolut
      </p>
    </div>
  )
}
