'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, Mail, Phone, MapPin, Lock, Eye, EyeOff, 
  Package, DollarSign, Check, CreditCard 
} from 'lucide-react';
import { 
  HOUR_PACKAGES, 
  DRIVING_TEST_PACKAGE, 
  calculatePackagePrice,
  PackageType 
} from '@/lib/config/packages';

interface BulkBookingFormProps {
  instructorId: string;
  instructorName: string;
  hourlyRate: number;
  searchedLocation?: string | null;
  brandColorPrimary?: string;
  brandColorSecondary?: string;
}

export default function BulkBookingForm({ 
  instructorId, 
  instructorName, 
  hourlyRate,
  searchedLocation,
  brandColorPrimary = '#3B82F6',
  brandColorSecondary = '#10B981'
}: BulkBookingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageType>('PACKAGE_10');
  const [customHours, setCustomHours] = useState(10);
  const [includeTestPackage, setIncludeTestPackage] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: searchedLocation || '',
    password: '',
    confirmPassword: '',
    notes: ''
  });

  const hours = selectedPackage === 'CUSTOM' ? customHours : HOUR_PACKAGES[selectedPackage].hours;
  const pricing = calculatePackagePrice(hourlyRate, hours, selectedPackage, includeTestPackage);

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

      const response = await fetch('/api/public/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId,
          clientName: formData.name,
          clientEmail: formData.email,
          clientPhone: formData.phone,
          pickupAddress: formData.address,
          notes: formData.notes,
          packageType: selectedPackage,
          hours,
          includeTestPackage,
          pricing,
          createAccount,
          password: createAccount ? formData.password : undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to payment page
        router.push(`/booking/${data.bookingId}/payment`);
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
      {/* Step 1: Select Package */}
      <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
          Select Your Package
        </h3>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Custom Hours */}
          <div
            onClick={() => setSelectedPackage('CUSTOM')}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedPackage === 'CUSTOM'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <h4 className="font-semibold mb-1">Custom</h4>
              <p className="text-sm text-gray-600 mb-2">Choose hours</p>
              {selectedPackage === 'CUSTOM' && (
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={customHours}
                  onChange={(e) => setCustomHours(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1 border rounded text-center"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>

          {/* 6 Hour Package */}
          <div
            onClick={() => setSelectedPackage('PACKAGE_6')}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedPackage === 'PACKAGE_6'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="text-center">
              <div className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
                SAVE 5%
              </div>
              <h4 className="font-semibold mb-1">6 Hours</h4>
              <p className="text-2xl font-bold text-blue-600">
                ${(hourlyRate * 6 * 0.95).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 line-through">
                ${(hourlyRate * 6).toFixed(0)}
              </p>
            </div>
          </div>

          {/* 10 Hour Package */}
          <div
            onClick={() => setSelectedPackage('PACKAGE_10')}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all relative ${
              selectedPackage === 'PACKAGE_10'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs px-2 py-1 rounded-bl rounded-tr">
              POPULAR
            </div>
            <div className="text-center">
              <div className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
                SAVE 10%
              </div>
              <h4 className="font-semibold mb-1">10 Hours</h4>
              <p className="text-2xl font-bold text-blue-600">
                ${(hourlyRate * 10 * 0.9).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 line-through">
                ${(hourlyRate * 10).toFixed(0)}
              </p>
            </div>
          </div>

          {/* 15 Hour Package */}
          <div
            onClick={() => setSelectedPackage('PACKAGE_15')}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all relative ${
              selectedPackage === 'PACKAGE_15'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs px-2 py-1 rounded-bl rounded-tr">
              BEST VALUE
            </div>
            <div className="text-center">
              <div className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
                SAVE 12%
              </div>
              <h4 className="font-semibold mb-1">15 Hours</h4>
              <p className="text-2xl font-bold text-blue-600">
                ${(hourlyRate * 15 * 0.88).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 line-through">
                ${(hourlyRate * 15).toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        {/* Driving Test Package Option */}
        <div className="mt-6 border-t pt-6">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="testPackage"
              checked={includeTestPackage}
              onChange={(e) => setIncludeTestPackage(e.target.checked)}
              className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <label htmlFor="testPackage" className="font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                Add Driving Test Package
                <span className="bg-purple-100 text-purple-800 text-sm font-bold px-3 py-1 rounded">
                  +${DRIVING_TEST_PACKAGE.price}
                </span>
              </label>
              <p className="text-sm text-gray-600 mt-1">{DRIVING_TEST_PACKAGE.description}</p>
              <ul className="mt-2 space-y-1">
                {DRIVING_TEST_PACKAGE.features.map((feature, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Order Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
          Order Summary
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">{hours} hrs Booking Credit</span>
            <span className="font-semibold">${pricing.subtotal.toFixed(2)}</span>
          </div>

          {pricing.discount > 0 && (
            <div className="flex justify-between items-center text-green-600">
              <span>Credit Discount ({pricing.discountPercentage}% OFF)</span>
              <span className="font-semibold">-${pricing.discount.toFixed(2)}</span>
            </div>
          )}

          {includeTestPackage && (
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Driving Test Package</span>
              <span className="font-semibold">${pricing.testPackage.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Platform Processing Fee (3.6%)</span>
            <span>${pricing.platformFee.toFixed(2)}</span>
          </div>

          <div className="border-t-2 border-blue-300 pt-3 flex justify-between items-center">
            <span className="text-xl font-bold">Total Payment Due</span>
            <span className="text-3xl font-bold text-blue-600">
              ${pricing.total.toFixed(2)}
            </span>
          </div>

          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-sm text-gray-600">Or 4 payments of</p>
            <p className="text-2xl font-bold text-gray-900">
              ${pricing.installments.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Step 3: Account Creation */}
      <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
          Learner Registration
        </h3>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
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
                Create account for 24/7 booking management
              </label>
              <p className="text-sm text-gray-600 mt-1">
                Access your dashboard anytime to view lessons and manage bookings
              </p>
            </div>
          </div>
        </div>

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

        <div className="mt-4">
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

        {createAccount && (
          <div className="grid sm:grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
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

        <div className="mt-4">
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
            Where should {instructorName} pick you up for lessons?
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Additional Notes (Optional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Experience level, special requirements, preferred lesson times..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Step 4: Payment */}
      <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
          Payment
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="h-5 w-5" />
            {loading ? 'Processing...' : 'Book Now'}
          </button>

          <button
            type="button"
            disabled={loading}
            className="bg-gray-100 text-gray-700 py-4 rounded-lg font-bold text-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Book Later
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Secure payment processing. You'll schedule individual lessons after payment.
        </p>
      </div>
    </form>
  );
}
