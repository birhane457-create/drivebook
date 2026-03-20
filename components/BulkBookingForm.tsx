'use client';

import { useState } from 'react';
import {
  User, Mail, Phone, MapPin, Lock, Eye, EyeOff,
  Package, Check, CreditCard, ChevronRight, ChevronLeft,
  AlertCircle, CheckCircle, Calendar,
} from 'lucide-react';
import {
  HOUR_PACKAGES, DRIVING_TEST_PACKAGE, calculatePackagePrice, PackageType,
} from '@/lib/config/packages';
import SlotPicker from '@/components/SlotPicker';

interface BulkBookingFormProps {
  instructorId: string;
  instructorName: string;
  hourlyRate: number;
  searchedLocation?: string | null;
  brandColorPrimary?: string;
  brandColorSecondary?: string;
  lessonPackages?: Array<{
    id: string; name: string; durationMinutes: number;
    price: number; description: string; isActive: boolean;
  }>;
  serviceAreas?: string | null;
  baseAddress?: string | null;
  serviceRadiusKm?: number | null;
}

const STEP_LABELS_BASE = ['Package', 'Time Slot', 'Your Details', 'Confirm'];
const STEP_LABELS_WITH_AREA = ['Package', 'Service Area', 'Time Slot', 'Your Details', 'Confirm'];

export default function BulkBookingForm({
  instructorId,
  instructorName,
  hourlyRate,
  searchedLocation,
  brandColorPrimary = '#3B82F6',
  lessonPackages = [],
  serviceAreas,
  baseAddress,
  serviceRadiusKm,
}: BulkBookingFormProps) {
  const primary = brandColorPrimary || '#3B82F6';
  const hasServiceAreaData = !!(serviceAreas || (baseAddress && serviceRadiusKm));
  const stepLabels = hasServiceAreaData ? STEP_LABELS_WITH_AREA : STEP_LABELS_BASE;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Package
  const [selectedPackage, setSelectedPackage] = useState<PackageType>('PACKAGE_10');
  const [customHours, setCustomHours] = useState(10);
  const [includeTestPackage, setIncludeTestPackage] = useState(false);

  // Service area
  const [areaCheckAddress, setAreaCheckAddress] = useState(searchedLocation || '');
  const [areaCheckResult, setAreaCheckResult] = useState<'unknown' | 'in' | 'out' | 'skipped'>('unknown');
  const [areaCheckLoading, setAreaCheckLoading] = useState(false);

  // Slot
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);

  // Details
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'new' | 'exists'>('idle');
  const [existingAccountAction, setExistingAccountAction] = useState<'none' | 'login' | 'continue'>('none');
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    address: searchedLocation || '',
    password: '', confirmPassword: '', notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hours = selectedPackage === 'CUSTOM' ? customHours : HOUR_PACKAGES[selectedPackage].hours;
  const pricing = calculatePackagePrice(hourlyRate, hours, selectedPackage, includeTestPackage);
  const isPackage = hours > 1;
  const currentLabel = stepLabels[step];

  // ── helpers ──────────────────────────────────────────────────────────────

  const checkEmail = async (email: string) => {
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return;
    setEmailStatus('checking');
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setEmailStatus(data.exists ? 'exists' : 'new');
    } catch {
      setEmailStatus('idle');
    }
  };

  const checkServiceArea = async () => {
    if (!areaCheckAddress.trim() || !baseAddress || !serviceRadiusKm) {
      setAreaCheckResult('skipped');
      return;
    }
    setAreaCheckLoading(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      if (!apiKey) { setAreaCheckResult('skipped'); return; }
      const [uRes, bRes] = await Promise.all([
        fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(areaCheckAddress)}&key=${apiKey}`),
        fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(baseAddress)}&key=${apiKey}`),
      ]);
      const [uData, bData] = await Promise.all([uRes.json(), bRes.json()]);
      if (!uData.results?.[0] || !bData.results?.[0]) { setAreaCheckResult('skipped'); return; }
      const { lat: uLat, lng: uLng } = uData.results[0].geometry.location;
      const { lat: bLat, lng: bLng } = bData.results[0].geometry.location;
      const R = 6371;
      const dLat = (uLat - bLat) * Math.PI / 180;
      const dLng = (uLng - bLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(bLat * Math.PI / 180) * Math.cos(uLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      setAreaCheckResult(dist <= serviceRadiusKm ? 'in' : 'out');
    } catch {
      setAreaCheckResult('skipped');
    } finally {
      setAreaCheckLoading(false);
    }
  };

  const validateDetails = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Required';
    if (!formData.email.trim()) errs.email = 'Required';
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(formData.email)) errs.email = 'Invalid email';
    if (!formData.phone.trim()) errs.phone = 'Required';
    if (!formData.address.trim()) errs.address = 'Required';
    if (emailStatus !== 'exists') {
      if (formData.password.length < 6) errs.password = 'Min 6 characters';
      if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    }
    if (emailStatus === 'exists' && existingAccountAction === 'none') {
      errs.email = 'Please choose to login or continue anyway';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const canProceed = (): boolean => {
    if (currentLabel === 'Package') return true;
    if (currentLabel === 'Service Area') return areaCheckResult !== 'unknown';
    if (currentLabel === 'Time Slot') return !!(selectedSlot?.time);
    if (currentLabel === 'Your Details') return !!(formData.name && formData.email && formData.phone && formData.address);
    return true;
  };

  const handleNext = () => {
    if (currentLabel === 'Your Details' && !validateDetails()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!selectedSlot?.time) return;
    setLoading(true);
    try {
      const res = await fetch('/api/public/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId,
          packageType: selectedPackage,
          hours,
          includeTestPackage,
          bookingType: 'later',
          registrationType: 'myself',
          accountHolderName: formData.name,
          accountHolderEmail: formData.email,
          accountHolderPhone: formData.phone,
          accountHolderPassword: emailStatus === 'exists' ? '' : formData.password,
          pricing,
          scheduledBookings: [{
            date: selectedSlot.date,
            time: selectedSlot.time,
            duration: 60,
            pickupLocation: formData.address,
            notes: formData.notes || '',
          }],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const host = window.location.host;
        const parts = host.split('.');
        const mainHost = parts.length > 1 && !parts[0].includes(':') ? parts.slice(1).join('.') : host;
        window.location.href = `${window.location.protocol}//${mainHost}/booking/${data.bookingId}/payment`;
      } else {
        alert(data.error || 'Booking failed. Please try again.');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── sub-components ────────────────────────────────────────────────────────

  const ProgressBar = () => (
    <div className="flex items-center gap-1 mb-6">
      {stepLabels.map((label, i) => (
        <div key={label} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
              style={i <= step
                ? { backgroundColor: primary, borderColor: primary, color: '#fff' }
                : { borderColor: '#e5e7eb', color: '#9ca3af', backgroundColor: '#fff' }}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1 hidden sm:block ${i === step ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < stepLabels.length - 1 && (
            <div className="h-0.5 flex-1 mx-1 rounded"
              style={{ backgroundColor: i < step ? primary : '#e5e7eb' }} />
          )}
        </div>
      ))}
    </div>
  );

  const NavButtons = () => (
    <div className="flex gap-3 pt-4">
      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep(s => s - 1)}
          className="flex items-center gap-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
      )}
      {step < stepLabels.length - 1 ? (
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed()}
          className="flex-1 flex items-center justify-center gap-1 py-3 rounded-lg text-white font-bold disabled:opacity-40 transition-colors"
          style={{ backgroundColor: primary }}
        >
          Continue <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-white font-bold disabled:opacity-40 transition-colors"
          style={{ backgroundColor: primary }}
        >
          <CreditCard className="h-5 w-5" />
          {loading ? 'Processing...' : 'Pay Now'}
        </button>
      )}
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <ProgressBar />

      {/* ── STEP: Package ── */}
      {currentLabel === 'Package' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold">Choose Your Package</h3>
            <p className="text-sm text-gray-500 mt-1">Packages save you money — the more hours, the bigger the discount.</p>
          </div>

          {/* Single / Custom */}
          <div
            onClick={() => setSelectedPackage('CUSTOM')}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedPackage === 'CUSTOM' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-gray-500" />
                <div>
                  <p className="font-semibold">Single / Custom</p>
                  <p className="text-sm text-gray-500">Choose exact hours — no discount</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">${hourlyRate}/hr</p>
                {selectedPackage === 'CUSTOM' && (
                  <input
                    type="number" min="1" max="50" value={customHours}
                    onChange={(e) => setCustomHours(parseInt(e.target.value) || 1)}
                    className="mt-1 w-20 px-2 py-1 border rounded text-center text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Bulk packages */}
          <div className="grid sm:grid-cols-3 gap-3">
            {(['PACKAGE_6', 'PACKAGE_10', 'PACKAGE_15'] as PackageType[]).map((pkg) => {
              const p = HOUR_PACKAGES[pkg];
              const total = (hourlyRate * p.hours * (1 - p.discount / 100)).toFixed(0);
              const orig = (hourlyRate * p.hours).toFixed(0);
              const badge = pkg === 'PACKAGE_15'
                ? { label: 'BEST VALUE', cls: 'bg-purple-600' }
                : pkg === 'PACKAGE_10'
                ? { label: 'POPULAR', cls: 'bg-blue-600' }
                : null;
              return (
                <div
                  key={pkg}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all relative ${selectedPackage === pkg ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  {badge && (
                    <div className={`absolute -top-2 right-2 ${badge.cls} text-white text-xs px-2 py-0.5 rounded-full`}>
                      {badge.label}
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded inline-block mb-2">
                      SAVE {p.discount}%
                    </div>
                    <p className="font-bold text-gray-900">{p.hours} Hours</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: primary }}>${total}</p>
                    <p className="text-xs text-gray-400 line-through">${orig}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Test package add-on */}
          <div className="border rounded-lg p-4 flex items-start gap-3 bg-purple-50 border-purple-200">
            <input
              type="checkbox" id="testPkg" checked={includeTestPackage}
              onChange={(e) => setIncludeTestPackage(e.target.checked)}
              className="mt-1 h-5 w-5 accent-purple-600"
            />
            <label htmlFor="testPkg" className="cursor-pointer flex-1">
              <span className="font-semibold text-gray-900">Add Driving Test Package </span>
              <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded ml-1">
                +${DRIVING_TEST_PACKAGE.price}
              </span>
              <p className="text-sm text-gray-600 mt-1">{DRIVING_TEST_PACKAGE.description}</p>
              <ul className="mt-2 space-y-1">
                {DRIVING_TEST_PACKAGE.features.map((f, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </label>
          </div>

          {/* Order summary */}
          <div className="rounded-lg border p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <p className="font-semibold mb-2 text-sm">Order Summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{hours} hrs credit</span>
                <span>${pricing.subtotal.toFixed(2)}</span>
              </div>
              {pricing.discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount ({pricing.discountPercentage}% off)</span>
                  <span>-${pricing.discount.toFixed(2)}</span>
                </div>
              )}
              {includeTestPackage && (
                <div className="flex justify-between">
                  <span>Test Package</span>
                  <span>${pricing.testPackage.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>Platform fee (3.6%)</span>
                <span>${pricing.platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                <span>Total</span>
                <span style={{ color: primary }}>${pricing.total.toFixed(2)}</span>
              </div>
              <p className="text-center text-gray-500 text-xs">or 4 x ${pricing.installments.toFixed(2)}</p>
            </div>
          </div>

          <NavButtons />
        </div>
      )}

      {/* ── STEP: Service Area ── */}
      {currentLabel === 'Service Area' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold">Service Area Check</h3>
            <p className="text-sm text-gray-500 mt-1">
              Confirm {instructorName} covers your pickup location before booking.
            </p>
          </div>

          {serviceAreas && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900 mb-1">Areas covered:</p>
              <p className="text-blue-800">{serviceAreas}</p>
            </div>
          )}

          {baseAddress && serviceRadiusKm && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {instructorName} operates within <strong>{serviceRadiusKm}km</strong> of {baseAddress}.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={areaCheckAddress}
                  onChange={(e) => { setAreaCheckAddress(e.target.value); setAreaCheckResult('unknown'); }}
                  onKeyDown={(e) => e.key === 'Enter' && checkServiceArea()}
                  placeholder="Enter your suburb or postcode"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={checkServiceArea}
                  disabled={areaCheckLoading || !areaCheckAddress.trim()}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: primary }}
                >
                  {areaCheckLoading ? 'Checking...' : 'Check'}
                </button>
              </div>

              {areaCheckResult === 'in' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  {instructorName} covers your area. You&apos;re good to go!
                </div>
              )}
              {areaCheckResult === 'out' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Your location may be outside the service area.</p>
                    <p className="mt-0.5">You can still proceed — {instructorName} will confirm availability.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!baseAddress && !serviceAreas && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              No service area restrictions set for this instructor.
            </div>
          )}

          <button
            type="button"
            onClick={() => setAreaCheckResult('skipped')}
            className="text-sm text-gray-400 underline hover:text-gray-600"
          >
            Skip this check and continue
          </button>

          <NavButtons />
        </div>
      )}

      {/* ── STEP: Time Slot ── */}
      {currentLabel === 'Time Slot' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5" style={{ color: primary }} />
              {isPackage ? 'Schedule Your First Lesson' : 'Choose Your Lesson Time'}
            </h3>
            {isPackage && (
              <p className="text-sm text-gray-500 mt-1">
                Pick the date and time for your first lesson. You&apos;ll schedule the remaining{' '}
                {hours - 1} lesson{hours - 1 > 1 ? 's' : ''} after payment.
              </p>
            )}
          </div>

          <SlotPicker
            instructorId={instructorId}
            duration={60}
            selected={selectedSlot}
            onSelect={(date, time) => setSelectedSlot(time ? { date, time } : { date, time: '' })}
            primaryColor={primary}
          />

          {selectedSlot?.time && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long',
              })} at {selectedSlot.time}
            </div>
          )}

          <NavButtons />
        </div>
      )}

      {/* ── STEP: Your Details ── */}
      {currentLabel === 'Your Details' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Your Details</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                <User className="inline h-4 w-4 mr-1" />Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${fieldErrors.name ? 'border-red-400' : ''}`}
                placeholder="John Smith"
              />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                <Phone className="inline h-4 w-4 mr-1" />Phone *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${fieldErrors.phone ? 'border-red-400' : ''}`}
                placeholder="0412 345 678"
              />
              {fieldErrors.phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              <Mail className="inline h-4 w-4 mr-1" />Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setEmailStatus('idle'); setExistingAccountAction('none'); }}
              onBlur={(e) => checkEmail(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${fieldErrors.email ? 'border-red-400' : ''}`}
              placeholder="john@example.com"
            />
            {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
            {emailStatus === 'checking' && <p className="text-xs text-gray-500 mt-1">Checking email...</p>}
            {emailStatus === 'exists' && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                <p className="font-semibold mb-2">⚠️ An account already exists for this email.</p>
                {existingAccountAction === 'none' && (
                  <div className="flex gap-2 mt-1">
                    <a
                      href="/login"
                      className="flex-1 text-center px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                    >
                      Login to my account
                    </a>
                    <button
                      type="button"
                      onClick={() => setExistingAccountAction('continue')}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 text-xs font-medium hover:bg-amber-100"
                    >
                      Continue anyway
                    </button>
                  </div>
                )}
                {existingAccountAction === 'continue' && (
                  <div className="flex items-center gap-1.5 text-xs text-green-800 bg-green-50 border border-green-200 rounded p-2 mt-1">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    Booking will be linked to your existing account. No password needed.
                  </div>
                )}
              </div>
            )}
            {emailStatus === 'new' && (
              <p className="text-xs text-green-700 mt-1">New account will be created for you.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              <MapPin className="inline h-4 w-4 mr-1" />Pickup Address *
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${fieldErrors.address ? 'border-red-400' : ''}`}
              placeholder="123 Main St, Melbourne VIC 3000"
            />
            {fieldErrors.address && <p className="text-xs text-red-600 mt-1">{fieldErrors.address}</p>}
            <p className="text-xs text-gray-500 mt-1">Where should {instructorName} pick you up?</p>
          </div>

          {emailStatus !== 'exists' && (
            <div className="grid sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium mb-1">
                  <Lock className="inline h-4 w-4 mr-1" />Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg pr-10 ${fieldErrors.password ? 'border-red-400' : ''}`}
                    placeholder="Min. 6 characters"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  <Lock className="inline h-4 w-4 mr-1" />Confirm Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${fieldErrors.confirmPassword ? 'border-red-400' : ''}`}
                placeholder="Re-enter password"
              />
              {fieldErrors.confirmPassword && <p className="text-xs text-red-600 mt-1">{fieldErrors.confirmPassword}</p>}
            </div>
          </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Experience level, special requirements..."
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <NavButtons />
        </div>
      )}

      {/* ── STEP: Confirm ── */}
      {currentLabel === 'Confirm' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Confirm Your Booking</h3>

          <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
            <div className="px-4 py-3 flex justify-between">
              <span className="text-gray-500">Package</span>
              <span className="font-medium">
                {hours} hours{includeTestPackage ? ' + Test Package' : ''}
              </span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-gray-500">First Lesson</span>
              <span className="font-medium">
                {selectedSlot
                  ? `${new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} at ${selectedSlot.time}`
                  : '—'}
              </span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{formData.name}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{formData.email}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium">{formData.phone}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-gray-500">Pickup</span>
              <span className="font-medium text-right max-w-[60%]">{formData.address}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="font-bold">Total</span>
              <span className="text-2xl font-bold" style={{ color: primary }}>
                ${pricing.total.toFixed(2)}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Secure payment via Stripe. Remaining lessons scheduled after payment.
          </p>

          <NavButtons />
        </div>
      )}
    </div>
  );
}
