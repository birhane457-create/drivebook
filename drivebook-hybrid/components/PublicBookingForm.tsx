'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, User, Mail, Phone, MapPin, DollarSign, Lock, Eye, EyeOff } from 'lucide-react';

interface PublicBookingFormProps {
  instructorId: string;
  instructorName: string;
  hourlyRate: number;
}

export default function PublicBookingForm({ instructorId, instructorName, hourlyRate }: PublicBookingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    date: '',
    time: '',
    duration: 60,
    notes: '',
    password: '',
    confirmPassword: ''
  });

  const calculatePrice = () => {
    const hours = formData.duration / 60;
    return (hourlyRate * hours).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate password if creating account
      if (createAccount) {
        if (formData.password.length < 6) {
          alert('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          alert('Passwords do not match');
          setLoading(false);
          return;
        }
      }

      const [hours, minutes] = formData.time.split(':');
      const startTime = new Date(formData.date);
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + formData.duration);

      const response = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId,
          clientName: formData.name,
          clientEmail: formData.email,
          clientPhone: formData.phone,
          pickupAddress: formData.address,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          notes: formData.notes,
          price: parseFloat(calculatePrice()),
          createAccount,
          password: createAccount ? formData.password : undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to payment or confirmation page
        if (data.redirectTo) {
          router.push(data.redirectTo);
        } else {
          router.push(`/booking/${data.booking.id}/confirmation`);
        }
      } else {
        alert(data.error || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Account Creation Option */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="createAccount"
            checked={createAccount}
            onChange={(e) => setCreateAccount(e.target.checked)}
            className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex-1">
            <label htmlFor="createAccount" className="font-semibold text-gray-900 cursor-pointer">
              Create an account for 24/7 booking management
            </label>
            <p className="text-sm text-gray-600 mt-1">
              Get instant access to your dashboard to view, modify, and manage all your bookings anytime
            </p>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            <User className="inline h-4 w-4 mr-1" />
            Full Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            <Phone className="inline h-4 w-4 mr-1" />
            Phone *
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            placeholder="0412 345 678"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          <Mail className="inline h-4 w-4 mr-1" />
          Email *
        </label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          placeholder="john@example.com"
        />
      </div>

      {/* Password Fields (if creating account) */}
      {createAccount && (
        <div className="grid sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
          <div>
            <label className="block text-sm font-medium mb-1">
              <Lock className="inline h-4 w-4 mr-1" />
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={createAccount}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 pr-10"
                placeholder="Min. 6 characters"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              <Lock className="inline h-4 w-4 mr-1" />
              Confirm Password *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required={createAccount}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
              placeholder="Re-enter password"
              minLength={6}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          <MapPin className="inline h-4 w-4 mr-1" />
          Pickup Address *
        </label>
        <input
          type="text"
          required
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="123 Main St, Melbourne VIC 3000"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
        />
        <p className="text-xs text-gray-500 mt-1">
          Where should {instructorName} pick you up?
        </p>
      </div>

      {/* Date & Time */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            <Calendar className="inline h-4 w-4 mr-1" />
            Date *
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            <Clock className="inline h-4 w-4 mr-1" />
            Time *
          </label>
          <input
            type="time"
            required
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Duration *</label>
          <select
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          >
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Additional Notes (Optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Any special requirements, experience level, or questions..."
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Price Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-600">Lesson Duration</p>
            <p className="text-lg font-semibold">{formData.duration} minutes</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Rate</p>
            <p className="text-lg font-semibold">${hourlyRate}/hour</p>
          </div>
        </div>
        <div className="border-t-2 border-blue-200 pt-4 flex justify-between items-center">
          <span className="text-xl font-bold text-gray-900">Total Price:</span>
          <span className="text-4xl font-bold text-blue-600">
            ${calculatePrice()}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Processing...' : createAccount ? 'Create Account & Book Lesson' : 'Book Lesson'}
      </button>

      {createAccount && (
        <p className="text-sm text-gray-600 text-center">
          By creating an account, you'll be able to login at any time to view and manage your bookings
        </p>
      )}

      <p className="text-xs text-gray-500 text-center">
        Payment will be processed after your lesson is confirmed by the instructor
      </p>
    </form>
  );
}
