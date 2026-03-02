'use client';

import React, { useState, useEffect } from 'react';
import { Star, Calendar, User, Loader2 } from 'lucide-react';
import ReviewModal from '@/components/ReviewModal';

interface Review {
  id: string;
  instructorName: string;
  rating: number;
  comment: string;
  date: string;
  bookingDate: string;
}

interface PendingReview {
  id: string;
  bookingId: string;
  instructorName: string;
  bookingDate: string;
}

export default function ClientReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'completed' | 'pending'>('pending');
  const [reviewModal, setReviewModal] = useState<{ isOpen: boolean; bookingId: string; instructorName: string } | null>(null);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);
      
      // Fetch completed reviews
      const completedRes = await fetch('/api/reviews');
      if (completedRes.ok) {
        const completedData = await completedRes.json();
        setReviews(completedData || []);
      }

      // Fetch pending reviews (completed bookings without reviews)
      const pendingRes = await fetch('/api/client/pending-reviews');
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingReviews(pendingData || []);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Reviews</h1>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-6 py-4 font-semibold transition ${
              activeTab === 'pending'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Pending Reviews ({pendingReviews.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-6 py-4 font-semibold transition ${
              activeTab === 'completed'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            My Reviews ({reviews.length})
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'pending' ? (
            pendingReviews.length > 0 ? (
              <div className="space-y-4">
                {pendingReviews.map((pending) => (
                  <div key={pending.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{pending.instructorName}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-4 h-4" />
                          Lesson on {new Date(pending.bookingDate).toLocaleDateString()}
                        </p>
                      </div>
                      <button 
                        onClick={() => setReviewModal({
                          isOpen: true,
                          bookingId: pending.bookingId,
                          instructorName: pending.instructorName
                        })}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                      >
                        Write Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No pending reviews</p>
                <p className="text-sm text-gray-400 mt-2">Complete a lesson to leave a review</p>
              </div>
            )
          ) : (
            reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{review.instructorName}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(review.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{review.comment}</p>
                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Lesson on {new Date(review.bookingDate).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No reviews yet</p>
                <p className="text-sm text-gray-400 mt-2">Your reviews will appear here after you submit them</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <ReviewModal
          isOpen={reviewModal.isOpen}
          onClose={() => setReviewModal(null)}
          bookingId={reviewModal.bookingId}
          instructorName={reviewModal.instructorName}
          onSuccess={loadReviews}
        />
      )}
    </div>
  );
}
