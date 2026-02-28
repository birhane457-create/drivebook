import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Copy, Share2, QrCode } from 'lucide-react'
import Link from 'next/link'

export default async function ShareProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.instructorId) {
    redirect('/login')
  }

  const bookingUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/book/${session.user.instructorId}`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Share Your Booking Page</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Public Booking Link
          </h2>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <code className="text-sm break-all">{bookingUrl}</code>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigator.clipboard.writeText(bookingUrl)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Copy className="h-5 w-5" />
              Copy Link
            </button>
            
            <Link
              href={`/book/${session.user.instructorId}`}
              target="_blank"
              className="flex-1 border border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-2"
            >
              Preview Page
            </Link>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold mb-2">How to use:</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Share this link with potential students</li>
            <li>• Add it to your social media profiles</li>
            <li>• Include it in your email signature</li>
            <li>• Print it on business cards</li>
            <li>• Students can book directly without logging in</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
