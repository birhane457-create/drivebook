'use client';

import { useState } from 'react';

interface ReviewFormProps {
  bookingId: string;
  instructorId: string;
  clientId: string;
  onSuccess?: () => void;
}

export default function ReviewForm({
  bookingId,
  instructorId,
  clientId,
  onSuccess,
}: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [punctualityRating, setPunctualityRating] = useState(5);
  const [teachingRating, setTeachingRating] = useState(5);
  const [vehicleRating, setVehicleRating] = useState(5);
  const [communicationRating, setCommunicationRating] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          instructorId,
          clientId,
          rating,
          comment,
          punctualityRating,
          teachingRating,
          vehicleRating,
          communicationRating,
        }),
      });

      if (res.ok) {
        alert('Thank you for your review!');
        if (onSuccess) onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit review');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({
    value,
    onChange,
    label,
  }: {
    value: number;
    onChange: (val: number) => void;
    label: string;
  }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none"
          >
            <svg
              className={`w-8 h-8 ${
                star <= value ? 'text-yellow-400' : 'text-gray-300'
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Rate Your Experience</h3>
        
        <StarRating
          value={rating}
          onChange={setRating}
          label="Overall Rating"
        />

        <StarRating
          value={punctualityRating}
          onChange={setPunctualityRating}
          label="Punctuality"
        />

        <StarRating
          value={teachingRating}
          onChange={setTeachingRating}
          label="Teaching Quality"
        />

        <StarRating
          value={vehicleRating}
          onChange={setVehicleRating}
          label="Vehicle Condition"
        />

        <StarRating
          value={communicationRating}
          onChange={setCommunicationRating}
          label="Communication"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Review (Optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Share your experience with this instructor..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
}
