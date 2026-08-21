import { Link } from 'react-router-dom'

export default function KaufErfolgPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mrh-cream px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-mrh-orange/15">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-mrh-orange">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <h1 className="mb-2 text-xl font-semibold text-mrh-navy">
          Danke für deinen Kauf!
        </h1>
        <p className="mb-6 text-sm text-mrh-grey">
          Du erhältst in Kürze eine E-Mail zum Festlegen deines Passworts.
          Hast du bereits ein Konto bei uns, ist das neue Programm ab sofort
          direkt in deinem Bereich verfügbar.
        </p>
        <Link
          to="/login"
          className="inline-block rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
        >
          Zum Login
        </Link>
      </div>
    </div>
  )
}
