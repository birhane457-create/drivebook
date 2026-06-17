import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminReviewsPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  // Reviews are stored on Booking records (clientRating, clientReview, reviewGivenAt)
  const reviews = await prisma.booking.findMany({
    where: {
      clientRating: { not: null },
    } as any,
    orderBy: { reviewGivenAt: 'desc' } as any,
    take: 100,
    include: {
      instructor: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + ((r as any).clientRating ?? 0), 0) / totalReviews).toFixed(1)
    : '0.0';
  const fiveStars = reviews.filter((r) => (r as any).clientRating === 5).length;
  const oneOrTwo = reviews.filter((r) => (r as any).clientRating <= 2).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-6">Reviews</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Total Reviews</p>
            <p className="text-2xl font-bold text-slate-100">{totalReviews}</p>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Avg Rating</p>
            <p className="text-2xl font-bold text-yellow-500">{avgRating} ⭐</p>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">5-Star Reviews</p>
            <p className="text-2xl font-bold text-green-600">{fiveStars}</p>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">1–2 Star Reviews</p>
            <p className="text-2xl font-bold text-red-500">{oneOrTwo}</p>
          </div>
        </div>

        {/* Reviews list */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          {reviews.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p className="text-lg font-medium">No reviews yet</p>
              <p className="text-sm mt-1">Reviews appear here once students submit them after completed lessons.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-950">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rating</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Student</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Instructor</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Review</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reviews.map((r) => {
                  const rating = (r as any).clientRating ?? 0;
                  const review = (r as any).clientReview;
                  const reviewDate = (r as any).reviewGivenAt;
                  return (
                    <tr key={r.id} className="hover:bg-slate-800 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-400 text-base">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
                          <span className="text-xs text-slate-500 ml-1">{rating}/5</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-100">
                        {r.client?.name || (r as any).clientName || '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-300">{r.instructor?.name || '—'}</td>
                      <td className="px-5 py-3 max-w-xs">
                        <p className="text-slate-400 truncate">{review || <span className="text-slate-500 italic">No comment</span>}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
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
    </div>
  );
}
