export function toVimeoEmbedUrl(url) {
  if (!url) return null

  try {
    const parsed = new URL(url)

    if (!parsed.hostname.includes('vimeo.com')) return null

    if (parsed.hostname.includes('player.vimeo.com')) {
      return parsed.pathname.startsWith('/video/') ? url : null
    }

    // vimeo.com/123456789 oder vimeo.com/123456789/abcdef0123 (privater
    // Hash-Link) -- beide Formen als Pfadsegmente übernehmen.
    const segmente = parsed.pathname.split('/').filter(Boolean)
    const id = segmente[0]
    if (!id || !/^\d+$/.test(id)) return null

    const hash = segmente[1]
    return hash
      ? `https://player.vimeo.com/video/${id}?h=${hash}`
      : `https://player.vimeo.com/video/${id}`
  } catch {
    return null
  }
}
