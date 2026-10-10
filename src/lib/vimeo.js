// Vimeo-Einbettung immer mit dnt=1 (Do Not Track: Vimeo verzichtet auf
// Tracking-Cookies und Analyse der Wiedergabe).
export function toVimeoEmbedUrl(url) {
  if (!url) return null

  try {
    const parsed = new URL(url)

    if (!parsed.hostname.includes('vimeo.com')) return null

    if (parsed.hostname.includes('player.vimeo.com')) {
      if (!parsed.pathname.startsWith('/video/')) return null
      parsed.searchParams.set('dnt', '1')
      return parsed.toString()
    }

    // vimeo.com/123456789 oder vimeo.com/123456789/abcdef0123 (privater
    // Hash-Link): beide Formen als Pfadsegmente übernehmen.
    const segmente = parsed.pathname.split('/').filter(Boolean)
    const id = segmente[0]
    if (!id || !/^\d+$/.test(id)) return null

    const hash = segmente[1]
    return hash
      ? `https://player.vimeo.com/video/${id}?h=${hash}&dnt=1`
      : `https://player.vimeo.com/video/${id}?dnt=1`
  } catch {
    return null
  }
}
