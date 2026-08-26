export function initialen(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((teil) => teil[0].toUpperCase())
    .join('')
}
