import { redirect } from 'next/navigation';
import { checkPermission } from '@/lib/rbac/checkPermission'
import { PERM } from '@/lib/rbac/permissions'
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminNav from '@/components/admin/AdminNav';
import { AdminPageLayout } from '@/components/ui'

export default async function AdminReviewsPage() {
  const session = await getServerSession(authOptions);

  const permCheck = await checkPermission(session, PERM.ENGAGEMENT_REVIEWS_VIEW)
  if (!permCheck.allowed) redirect('/admin')

  // Reviews are stored on Booking records (customerRating, customerRating, reviewGivenAt)
  const reviews = await prisma.booking.findMany({
    where: {
      customerRating: { not: null },
    } as any,
    orderBy: { reviewGivenAt: 'desc' } as any,
    take: 100,
    include: {
      provider: { select: { name: true } },
      customer: { select: { name: true } },
    },
  });

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum: any, r: any) => sum + ((r as any).customerRating ?? 0), 0) / totalReviews).toFixed(1)
    : '0.0';
  const fiveStars = reviews.filter((r: any) => (r as any).customerRating === 5).length;
  const oneOrTwo = reviews.filter((r: any) => (r as any).customerRating <= 2).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Reviews" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Reviews</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground/60 mb-1">Total Reviews</p>
            <p className="text-2xl font-bold text-foreground">{totalReviews}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground/60 mb-1">Avg Rating</p>
            <p className="text-2xl font-bold text-yellow-500">{avgRating} ⭐</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground/60 mb-1">5-Star Reviews</p>
            <p className="text-2xl font-bold text-emerald-400">{fiveStars}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground/60 mb-1">1–2 Star Reviews</p>
            <p className="text-2xl font-bold text-red-500">{oneOrTwo}</p>
          </div>
        </div>

        {/* Reviews list */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {reviews.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground/60">
              <p className="text-lg font-medium">No reviews yet</p>
              <p className="text-sm mt-1">Reviews appear here once students submit them after completed lessons.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-background">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Rating</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Student</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Instructor</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Review</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reviews.map((r: any) => {
                  const rating = (r as any).customerRating ?? 0;
                  const review = (r as any).customerRating;
                  const reviewDate = (r as any).reviewGivenAt;
                  return (
                    <tr key={r.id} className="hover:bg-secondary transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-400 text-base">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
                          <span className="text-xs text-muted-foreground/60 ml-1">{rating}/5</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium text-foreground">
                        {r.customer?.name || (r as any).customerName || '—'}
                      </td>
                      <td className="px-5 py-3 text-foreground">{r.provider?.name || '—'}</td>
                      <td className="px-5 py-3 max-w-xs">
                        <p className="text-muted-foreground truncate">{review || <span className="text-muted-foreground/60 italic">No comment</span>}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground/60 text-xs">
                        {reviewDate ? new Date(reviewDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminPageLayout>
    </div>
  )
}
