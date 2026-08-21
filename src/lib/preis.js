const format = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

export function formatPreis(cent) {
  if (cent == null) return null
  return format.format(cent / 100)
}
