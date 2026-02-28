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

  const reviews = await (prisma as any).review.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      instructor: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const stats = {
    total: reviews.length,
    published: reviews.filter((r: any) => r.isPublished).length,
    flagged: reviews.filter((r: any) => r.isFlagged).length,
    avgRating: reviews.length > 0 
      ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Reviews Management</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">Total Reviews</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">Published</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.published}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">Flagged</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.flagged}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">Avg Rating</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.avgRating} ⭐</p>
          </div>
        </div>

        {/* Reviews List */}
        <div className="bg-white rounded-lg shadow">
          {reviews.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No reviews yet
            </div>
          ) : (
            <>
              {/* Mobile: Card view */}
              <div className="block sm:hidden divide-y divide-gray-200">
                {reviews.map((review: any) => (
                  <div key={review.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-yellow-500">{'⭐'.repeat(review.rating)}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{review.client?.name || 'Anonymous'}</p>
                        <p className="text-xs text-gray-500">for {review.instructor?.name || 'N/A'}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {review.isPublished ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Published
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            Hidden
                          </span>
                        )}
                        {review.isFlagged && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Flagged
                          </span>
                        )}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-700 mt-2 line-clamp-3">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: Table view */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reviews.map((review: any) => (
                      <tr key={review.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-yellow-500 text-lg">{review.rating}</span>
                            <span className="ml-1 text-gray-400">⭐</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {review.client?.name || 'Anonymous'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {review.instructor?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-sm text-gray-700 truncate">
                            {review.comment || 'No comment'}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {review.isPublished ? (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Published
                              </span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                Hidden
                              </span>
                            )}
                            {review.isFlagged && (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                Flagged
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
