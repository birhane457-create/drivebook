'use client';

import { useEffect, useState } from 'react';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  punctualityRating: number | null;
  teachingRating: number | null;
  vehicleRating: number | null;
  communicationRating: number | null;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  client: {
    name: string;
  };
}

export default function ReviewList({ instructorId }: { instructorId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, [instructorId]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?instructorId=${instructorId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setAverageRating(data.averageRating);
        setTotalReviews(data.totalReviews);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const StarDisplay = ({ rating }: { rating: number }) => (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-5 h-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );

  if (loading) {
    return <div className="text-center py-8">Loading reviews...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">
              {averageRating.toFixed(1)}
            </div>
            <StarDisplay rating={Math.round(averageRating)} />
            <div className="text-sm text-gray-500 mt-1">
              {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{review.client.name}</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-sm text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1">
                  <StarDisplay rating={review.rating} />
                </div>
              </div>
            </div>

            {review.comment && (
              <p className="mt-3 text-gray-700">{review.comment}</p>
            )}

            {/* Detailed Ratings */}
            {(review.punctualityRating || review.teachingRating || review.vehicleRating || review.communicationRating) && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {review.punctualityRating && (
                  <div>
                    <span className="text-gray-600">Punctuality: </span>
                    <span className="font-medium">{review.punctualityRating}/5</span>
                  </div>
                )}
                {review.teachingRating && (
                  <div>
                    <span className="text-gray-600">Teaching: </span>
                    <span className="font-medium">{review.teachingRating}/5</span>
                  </div>
                )}
                {review.vehicleRating && (
                  <div>
                    <span className="text-gray-600">Vehicle: </span>
                    <span className="font-medium">{review.vehicleRating}/5</span>
                  </div>
                )}
                {review.communicationRating && (
                  <div>
                    <span className="text-gray-600">Communication: </span>
                    <span className="font-medium">{review.communicationRating}/5</span>
                  </div>
                )}
              </div>
            )}

            {/* Instructor Response */}
            {review.response && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  Instructor Response
                </div>
                <p className="text-sm text-gray-700">{review.response}</p>
                {review.respondedAt && (
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(review.respondedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {reviews.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No reviews yet
          </div>
        )}
      </div>
    </div>
  );
}
