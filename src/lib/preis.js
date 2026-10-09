const format = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

export function formatPreis(cent) {
  if (cent == null) return null
  return format.format(cent / 100)
}

// Hinweis unter jedem angezeigten Preis. Kleinunternehmerregelung.
// TODO ab 01.01.2027 umstellen auf 'inkl. 19 % USt.'
export const UST_HINWEIS = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'
