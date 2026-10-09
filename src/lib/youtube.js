// Liefert die Einbettungs-URL über youtube-nocookie.com (erweiterter
// Datenschutzmodus: YouTube setzt erst beim Abspielen Cookies).
const EMBED_BASIS = 'https://www.youtube-nocookie.com/embed/'

function extrahiereId(url) {
  const parsed = new URL(url)
  const host = parsed.hostname

  if (host.includes('youtu.be')) {
    return parsed.pathname.replace('/', '') || null
  }

  if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
    if (parsed.pathname.startsWith('/embed/')) {
      return parsed.pathname.slice('/embed/'.length).split('/')[0] || null
    }
    if (parsed.pathname.startsWith('/shorts/')) {
      return parsed.pathname.slice('/shorts/'.length).split('/')[0] || null
    }
  }

  return null
}

export function toYoutubeEmbedUrl(url) {
  if (!url) return null

  try {
    const id = extrahiereId(url)
    return id && /^[\w-]+$/.test(id) ? `${EMBED_BASIS}${id}` : null
  } catch {
    return null
  }
}
