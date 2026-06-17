import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-400 mb-4">404</h1>
        <p className="text-xl text-slate-300 mb-2">Page not found</p>
        <p className="text-slate-500 mb-8">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
