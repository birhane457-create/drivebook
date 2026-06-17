'use client';

import { useState } from 'react';
import {
  User, Mail, Phone, MapPin, Lock, Eye, EyeOff,
  Package, Check, CreditCard, ChevronRight, ChevronLeft,
  AlertCircle, CheckCircle, Calendar,
} from 'lucide-react';
import {
  HOUR_PACKAGES, calculatePackagePrice, PackageType,
} from '@/lib/config/packages';
import SlotPicker from '@/components/SlotPicker';

interface BulkBookingFormProps {
  instructorId: string;
  instructorName: string;
  hourlyRate: number;
  searchedLocation?: string | null;
  brandColorPrimary?: string;
  brandColorSecondary?: string;
  serviceAreas?: string | null;
  baseAddress?: string | null;
  serviceRadiusKm?: number | null;
  allowedDurations?: number[];
  // Instructor test package settings
  offersTestPackage?: boolean;
  testPackagePrice?: number;
  testPackageDuration?: number;
  testPackageIncludes?: string[];
}

const STEP_LABELS_BASE = ['Package', 'Time Slot', 'Your Details', 'Confirm'];
const STEP_LABELS_BASE_LATER = ['Package', 'Your Details', 'Confirm'];
const STEP_LABELS_WITH_AREA = ['Package', 'Pickup Location', 'Time Slot', 'Your Details', 'Confirm'];
const STEP_LABELS_WITH_AREA_LATER = ['Package', 'Pickup Location', 'Your Details', 'Confirm'];

export default function BulkBookingForm({
  instructorId,
  instructorName,
  hourlyRate,
  searchedLocation,
  brandColorPrimary = '#3B82F6',
  serviceAreas,
  baseAddress,
  serviceRadiusKm,
  allowedDurations = [60],
  offersTestPackage = false,
  testPackagePrice,
  testPackageDuration,
  testPackageIncludes = [],
}: BulkBookingFormProps) {
  const primary = brandColorPrimary || '#3B82F6';
  const hasServiceAreaData = !!(serviceAreas || (baseAddress && serviceRadiusKm));

  // Booking type: 'now' = pick slot, 'later' = skip slot (schedule from dashboard)
  const [bookingType, setBookingType] = useState<'now' | 'later'>('now');

  const stepLabels = bookingType === 'later'
    ? (hasServiceAreaData ? STEP_LABELS_WITH_AREA_LATER : STEP_LABELS_BASE_LATER)
    : (hasServiceAreaData ? STEP_LABELS_WITH_AREA : STEP_LABELS_BASE);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Duration — default to first allowed duration
  const [selectedDuration, setSelectedDuration] = useState<number>(allowedDurations[0] ?? 60);

  // Package
  const [selectedPackage, setSelectedPackage] = useState<PackageType>('PACKAGE_10');
  const [customHours, setCustomHours] = useState(10);
  const [includeTestPackage, setIncludeTestPackage] = useState(false);

  // Service area / pickup location
  const [pickupAddress, setPickupAddress] = useState(searchedLocation || '');
  const [areaCheckResult, setAreaCheckResult] = useState<'unknown' | 'in' | 'out' | 'skipped' | 'checking'>('unknown');
  const [areaCheckDetail, setAreaCheckDetail] = useState<{ distanceKm?: number; radiusKm?: number } | null>(null);

  // Slot
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [isShortNoticeSlot, setIsShortNoticeSlot] = useState(false);

  // Details
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'new' | 'exists'>('idle');
  const [existingAccountAction, setExistingAccountAction] = useState<'none' | 'login' | 'continue'>('none');
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    address: searchedLocation || '',
    password: '', confirmPassword: '', notes: '',
  });  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hours = selectedPackage === 'CUSTOM' ? customHours : HOUR_PACKAGES[selectedPackage].hours;
  // Test packages are now managed via instructor PDA configs
  const pricing = calculatePackagePrice(hourlyRate, hours, selectedPackage);
  const testPackageAmount = includeTestPackage && offersTestPackage && testPackagePrice ? testPackagePrice : 0;
  const subtotalWithTest = pricing.subtotal + testPackageAmount;
  const totalAfterDiscount = subtotalWithTest - pricing.discount;
  const platformFeeWithTest = (totalAfterDiscount * 3.6) / 100;
  const summaryPricing = {
    ...pricing,
    testPackage: testPackageAmount,
    subtotal: subtotalWithTest,
    platformFee: platformFeeWithTest,
    total: totalAfterDiscount + platformFeeWithTest,
    installments: (totalAfterDiscount + platformFeeWithTest) / 4,
  };
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

  const checkServiceArea = async (address: string) => {
    if (!address.trim()) return;
    setAreaCheckResult('checking');
    setAreaCheckDetail(null);
    try {
      const res = await fetch(
        `/api/public/check-service-area?instructorId=${encodeURIComponent(instructorId)}&address=${encodeURIComponent(address)}`
      );
      const data = await res.json();
      if (data.result === 'in' || data.result === 'out') {
        setAreaCheckResult(data.result);
        setAreaCheckDetail({ distanceKm: data.distanceKm, radiusKm: data.radiusKm });
      } else if (data.reason === 'no_service_area_configured') {
        // Instructor hasn't set a service area — silently allow
        setAreaCheckResult('skipped');
      } else if (data.reason === 'no_api_key') {
        // No geocoding available — can't check, allow through
        setAreaCheckResult('skipped');
      } else {
        // Geocode failed (bad address) — keep unknown so student must fix address or skip manually
        setAreaCheckResult('unknown');
      }
    } catch {
      setAreaCheckResult('skipped');
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
    if (currentLabel === 'Pickup Location') {
      if (pickupAddress.trim().length <= 5) return false;
      if (areaCheckResult === 'checking') return false;
      // If instructor has service area data, require the check to have been run
      if (hasServiceAreaData) {
        return areaCheckResult === 'in' || areaCheckResult === 'out' || areaCheckResult === 'skipped';
      }
      // No service area configured — just need a non-empty address
      return true;
    }
    if (currentLabel === 'Time Slot') return !!(selectedSlot?.time);
    if (currentLabel === 'Your Details') return !!(formData.name && formData.email && formData.phone && formData.address);
    return true;
  };

  const handleNext = () => {
    if (currentLabel === 'Your Details' && !validateDetails()) return;
    // Carry pickup address forward to details step
    if (currentLabel === 'Pickup Location') {
      setFormData(prev => ({ ...prev, address: pickupAddress }));
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (bookingType === 'now' && !selectedSlot?.time) return;
    setLoading(true);
    try {
      const res = await fetch('/api/public/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId,
          packageType: selectedPackage,
          hours,
          bookingType,
          includeTestPackage,
          registrationType: 'myself',
          accountHolderName: formData.name,
          accountHolderEmail: formData.email,
          accountHolderPhone: formData.phone,
          accountHolderPassword: emailStatus === 'exists' ? '' : formData.password,
          pricing: summaryPricing,
          scheduledBookings: bookingType === 'now' && selectedSlot?.time ? [{
            date: selectedSlot.date,
            time: selectedSlot.time,
            duration: selectedDuration,
            pickupLocation: formData.address,
            notes: formData.notes || '',
            isShortNotice: isShortNoticeSlot,
          }] : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const host = window.location.host;
        const parts = host.split('.');
        const mainHost = parts.length > 1 && !parts[0].includes(':') ? parts.slice(1).join('.') : host;
        if (data.isShortNotice) {
          // Short-notice: no payment — go straight to confirmation with pending status
          window.location.href = `${window.location.protocol}//${mainHost}/booking/${data.bookingId}/confirmation?status=pending_approval`;
        } else {
          window.location.href = `${window.location.protocol}//${mainHost}/booking/${data.bookingId}/payment`;
        }
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

  const PdaAddOnPanel = () => {
    if (!offersTestPackage || !testPackagePrice) return null;
    return (
      <div className="rounded-lg border p-4 bg-white/90 border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">Add PDA test pack</p>
            <p className="text-sm text-gray-600 mt-1">Optional assessment add-on with instructor pricing.</p>
          </div>
          <button
            type="button"
            onClick={() => setIncludeTestPackage((prev) => !prev)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${includeTestPackage ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
          >
            {includeTestPackage ? 'Remove add-on' : 'Add PDA pack'}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-700 flex flex-wrap gap-3">
          <span className="font-semibold">Price:</span>
          <span>${testPackagePrice.toFixed(2)}</span>
          {testPackageDuration ? <span>• {Math.floor(testPackageDuration / 60)}h {testPackageDuration % 60}m</span> : null}
        </div>
      </div>
    );
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <ProgressBar />

      {/* ── STEP: Package ── */}
      {currentLabel === 'Package' && (
        <div className="space-y-4">
          {/* Book Now / Book Later toggle — at the top of the first step */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => { setBookingType('now'); setSelectedSlot(null); }}
              className="flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all"
              style={bookingType === 'now'
                ? { backgroundColor: primary, color: '#fff' }
                : { color: '#6b7280' }}
            >
              📅 Book Now
            </button>
            <button
              type="button"
              onClick={() => { setBookingType('later'); setSelectedSlot(null); }}
              className="flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all"
              style={bookingType === 'later'
                ? { backgroundColor: primary, color: '#fff' }
                : { color: '#6b7280' }}
            >
              🕐 Buy Credits
            </button>
          </div>
          {bookingType === 'later' && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              ✓ Purchase hours now, schedule your lessons from your dashboard whenever you&apos;re ready. Credits never expire.
            </p>
          )}

          <div>
            <h3 className="text-lg font-bold">Choose Your Package</h3>
            <p className="text-sm text-gray-500 mt-1">Packages save you money — the more hours, the bigger the discount.</p>
          </div>

          {/* Duration is selected in the Time Slot step for Book Now — not needed here */}

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

          <PdaAddOnPanel />

          {/* Order summary */}
          <div className="rounded-lg border p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <p className="font-semibold mb-2 text-sm">Order Summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{hours} hrs credit</span>
                <span>${summaryPricing.subtotal.toFixed(2)}</span>
              </div>
              {summaryPricing.discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount ({summaryPricing.discountPercentage}% off)</span>
                  <span>-${summaryPricing.discount.toFixed(2)}</span>
                </div>
              )}
              {includeTestPackage && testPackageAmount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>PDA test pack</span>
                  <span>${testPackageAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>Platform fee (3.6%)</span>
                <span>${summaryPricing.platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                <span>Total</span>
                <span style={{ color: primary }}>${summaryPricing.total.toFixed(2)}</span>
              </div>
              <p className="text-center text-gray-500 text-xs">or 4 x ${summaryPricing.installments.toFixed(2)}</p>
            </div>
          </div>

          <NavButtons />
        </div>
      )}

      {/* ── STEP: Pickup Location ── */}
      {currentLabel === 'Pickup Location' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold">Your Pickup Address</h3>
            <p className="text-sm text-gray-500 mt-1">
              Enter your full pickup address. We&apos;ll check if {instructorName} services your area.
            </p>
          </div>

          {serviceAreas && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-900 mb-0.5">Areas covered:</p>
              <p className="text-blue-800">{serviceAreas}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              <MapPin className="inline h-4 w-4 mr-1" />
              Pickup address *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => {
                  setPickupAddress(e.target.value);
                  setAreaCheckResult('unknown');
                  setAreaCheckDetail(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && checkServiceArea(pickupAddress)}
                placeholder="e.g. 12 Smith St, Maylands WA 6051"
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                autoComplete="street-address"
              />
              <button
                type="button"
                onClick={() => checkServiceArea(pickupAddress)}
                disabled={areaCheckResult === 'checking' || !pickupAddress.trim()}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 shrink-0"
                style={{ backgroundColor: primary }}
              >
                {areaCheckResult === 'checking' ? 'Checking…' : 'Check'}
              </button>
            </div>
            <p className="text-xs text-gray-400">Enter your full street address for the most accurate check</p>
          </div>

          {/* Hint when check hasn't been run yet */}
          {areaCheckResult === 'unknown' && pickupAddress.trim().length > 5 && hasServiceAreaData && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Click <strong>Check</strong> to verify your address is within the service area before continuing.
            </p>
          )}

          {/* Result feedback */}
          {areaCheckResult === 'in' && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{instructorName} services your area.</p>
                {areaCheckDetail?.distanceKm !== undefined && (
                  <p className="text-xs mt-0.5 text-green-700">
                    {areaCheckDetail.distanceKm} km from base · within {areaCheckDetail.radiusKm} km radius
                  </p>
                )}
              </div>
            </div>
          )}

          {areaCheckResult === 'out' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Your address is outside the service area.</p>
                {areaCheckDetail?.distanceKm !== undefined && (
                  <p className="text-xs mt-0.5">
                    {areaCheckDetail.distanceKm} km from base · service radius is {areaCheckDetail.radiusKm} km
                  </p>
                )}
                <p className="mt-1 text-xs">
                  You can still proceed, but by doing so you confirm you understand this instructor may not be able to service your location. The instructor may cancel if the address is too far.
                </p>
              </div>
            </div>
          )}

          {areaCheckResult === 'skipped' && pickupAddress.trim() && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Address saved. You&apos;re good to continue.
            </div>
          )}

          {/* Manual skip — only after a geocode failure, not before any check */}
          {areaCheckResult === 'unknown' && pickupAddress.trim().length > 5 && hasServiceAreaData && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <p className="text-sm text-amber-800 font-medium">
                ⚠️ We couldn&apos;t verify this address. Please make sure you&apos;ve entered a valid street address within {areaCheckDetail?.radiusKm ?? (serviceRadiusKm ?? '')} km of the service area.
              </p>
              <p className="text-xs text-amber-700">
                By continuing without verification, you confirm your pickup address is within the instructor&apos;s service area. If it&apos;s not, the instructor may need to cancel your booking.
              </p>
              <button
                type="button"
                onClick={() => setAreaCheckResult('skipped')}
                className="text-xs text-amber-800 underline hover:text-amber-900 font-medium"
              >
                I confirm my address is within the service area — continue anyway
              </button>
            </div>
          )}
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

          {/* Duration picker — shown here for Book Now so it affects slot availability */}
          {allowedDurations.length > 1 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">Lesson duration</p>
              <div className="flex flex-wrap gap-2">
                {allowedDurations.map((mins) => {
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  const label = m === 0 ? (h === 1 ? '1 hr' : `${h} hrs`) : `${h}h ${m}m`;
                  const cost = (hourlyRate * mins) / 60;
                  const isSelected = selectedDuration === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => { setSelectedDuration(mins); setSelectedSlot(null); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all font-medium text-sm"
                      style={isSelected
                        ? { borderColor: primary, backgroundColor: `${primary}15`, color: primary }
                        : { borderColor: '#e5e7eb', color: '#374151' }}
                    >
                      {label}
                      <span className="text-xs opacity-60">${cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400">
                Slots shown are for {(() => { const h = Math.floor(selectedDuration / 60); const m = selectedDuration % 60; return m === 0 ? (h === 1 ? '1 hr' : `${h} hrs`) : `${h}h ${m}m`; })()} lessons
              </p>
            </div>
          )}

          <SlotPicker
            instructorId={instructorId}
            duration={selectedDuration}
            selected={selectedSlot}
            onSelect={(date, time, shortNotice) => {
              setSelectedSlot(time ? { date, time } : { date, time: '' });
              setIsShortNoticeSlot(!!shortNotice);
            }}
            primaryColor={primary}
          />

          {selectedSlot?.time && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>
                {new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('en-AU', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })} at {selectedSlot.time}
                {' '}–{' '}
                {(() => {
                  const [h, m] = selectedSlot.time.split(':').map(Number);
                  const endMins = h * 60 + m + selectedDuration;
                  const eh = Math.floor(endMins / 60) % 24;
                  const em = endMins % 60;
                  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
                })()}
              </span>
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
            {hasServiceAreaData && formData.address ? (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-gray-50">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="flex-1 text-sm text-gray-700">{formData.address}</span>
                <button
                  type="button"
                  onClick={() => setStep(stepLabels.indexOf('Pickup Location'))}
                  className="text-xs text-blue-600 hover:underline shrink-0"
                >
                  Edit
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${fieldErrors.address ? 'border-red-400' : ''}`}
                placeholder="123 Main St, Melbourne VIC 3000"
              />
            )}
            {fieldErrors.address && <p className="text-xs text-red-600 mt-1">{fieldErrors.address}</p>}
            {!hasServiceAreaData && <p className="text-xs text-gray-500 mt-1">Where should {instructorName} pick you up?</p>}
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

          <PdaAddOnPanel />

          <NavButtons />
        </div>
      )}

      {/* ── STEP: Confirm ── */}
      {currentLabel === 'Confirm' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Confirm Your Booking</h3>

          {isShortNoticeSlot && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm">
              <span className="text-lg shrink-0">⚡</span>
              <div>
                <p className="font-semibold">Last-minute booking — requires instructor approval</p>
                <p className="text-xs mt-0.5">This slot is within 2 hours. Your booking will be submitted as a request. The instructor will be notified urgently and must approve before it&apos;s confirmed. You will be notified of their decision.</p>
              </div>
            </div>
          )}

          {/* Booking summary card */}
          <div className="rounded-xl border-2 p-5 space-y-4" style={{ borderColor: `${primary}40`, backgroundColor: `${primary}08` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: primary }}>
                {instructorName.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900">{instructorName}</p>
                <p className="text-xs text-gray-500">Driving Instructor</p>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              {selectedSlot?.time ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">Date &amp; Time</span>
                  <span className="font-semibold text-gray-900 text-right">
                    {new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}
                    {selectedSlot.time}
                    {' – '}
                    {(() => {
                      const [h, m] = selectedSlot.time.split(':').map(Number);
                      const endMins = h * 60 + m + selectedDuration;
                      const eh = Math.floor(endMins / 60) % 24;
                      const em = endMins % 60;
                      return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
                    })()}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-gray-500">First Lesson</span>
                  <span className="font-medium text-green-700">Schedule from dashboard after payment</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium text-gray-900">
                  {(() => { const h = Math.floor(selectedDuration / 60); const m = selectedDuration % 60; return m === 0 ? (h === 1 ? '1 hr' : `${h} hrs`) : `${h}h ${m}m`; })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Package</span>
                <span className="font-medium text-gray-900">{hours} hours</span>
              </div>
              {formData.address && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Pickup</span>
                  <span className="font-medium text-gray-900 text-right max-w-[55%]">{formData.address}</span>
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-600">PDA add-on</span>
                <button
                  type="button"
                  onClick={() => setIncludeTestPackage((prev) => !prev)}
                  disabled={!offersTestPackage || !testPackagePrice}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    includeTestPackage
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {includeTestPackage ? 'Remove PDA pack' : 'Add PDA pack'}
                </button>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>{hours} hrs × ${hourlyRate}/hr</span>
                <span>${summaryPricing.subtotal.toFixed(2)}</span>
              </div>
              {summaryPricing.discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount ({summaryPricing.discountPercentage}%)</span>
                  <span>-${summaryPricing.discount.toFixed(2)}</span>
                </div>
              )}
              {includeTestPackage && summaryPricing.testPackage > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Test Package</span>
                  <span>+${summaryPricing.testPackage.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>Platform fee (3.6%)</span>
                <span>+${summaryPricing.platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>Total</span>
                <span style={{ color: primary }}>${summaryPricing.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Secure payment via Stripe.{' '}
            {bookingType === 'now'
              ? 'Remaining lessons scheduled after payment.'
              : 'Schedule all your lessons from your dashboard after payment.'}
          </p>

          <NavButtons />
        </div>
      )}
    </div>
  );
}
