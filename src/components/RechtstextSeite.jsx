import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { renderMarkdown } from '../lib/markdown'
import RechtsFooter from './RechtsFooter'

// Gemeinsames Layout für AGB und Widerrufsbelehrung. Der Text kommt zur
// Buildzeit aus src/content/*.md (Vite ?raw-Import) und läuft durch
// renderMarkdown (marked + DOMPurify). Keine Inhalte von außen.
export default function RechtstextSeite({ markdown, titel }) {
  useEffect(() => {
    const vorher = document.title
    document.title = `${titel} | MRH Coaching`
    return () => {
      document.title = vorher
    }
  }, [titel])

  return (
    <div className="min-h-screen bg-mrh-cream print:bg-white">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-[720px] px-4 py-5">
          <Link to="/" className="font-serif text-lg font-semibold text-mrh-navy">
            MRH Beratung &amp; Coaching
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-4 py-10 print:py-0">
        <article
          className="markdown-inhalt rechtstext text-[15px] text-slate-800"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
      </main>
      <footer className="mx-auto max-w-[720px] px-4 pb-10">
        <RechtsFooter linksbuendig />
      </footer>
    </div>
  )
}
