import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Copy, Share2, QrCode } from 'lucide-react'
import Link from 'next/link'
import DashboardPageLayout from '@/components/ui/page-layout'

export default async function ShareProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.providerId) {
    redirect('/login')
  }

  const bookingUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/book/${session!.user!.providerId}`

  return (
    <DashboardPageLayout title="Share Your Booking Page" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Share' }]}>
      <div>
      <div className="max-w-3xl mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Share Your Booking Page</h1>

        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Public Booking Link
          </h2>
          
          <div className="bg-background p-4 rounded-lg mb-4">
            <code className="text-sm break-all">{bookingUrl}</code>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigator.clipboard.writeText(bookingUrl)}
              className="flex-1 bg-primary text-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <Copy className="h-5 w-5" />
              Copy Link
            </button>
            
            <Link
              href={`/book/${session!.user!.providerId}`}
              target="_blank"
              className="flex-1 border border-blue-600 text-primary px-4 py-2 rounded-lg hover:bg-primary/10 flex items-center justify-center gap-2"
            >
              Preview Page
            </Link>
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/25 rounded-lg p-6">
          <h3 className="font-semibold mb-2">How to use:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Share this link with potential students</li>
            <li>• Add it to your social media profiles</li>
            <li>• Include it in your email signature</li>
            <li>• Print it on business cards</li>
            <li>• Students can book directly without logging in</li>
          </ul>
        </div>
      </div>
          </div>
</DashboardPageLayout>
  )
}
