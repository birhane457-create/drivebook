'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, Loader2, Calendar, Clock, MapPin, CheckCircle } from 'lucide-react';
import PDABookingForm from '@/components/PDABookingForm';

interface PDAConfig {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  discountPercent?: number | null;
  testCentres: Array<{ id: string; name: string; address: string }>;
  includes?: {
    pickup?: boolean;
    dropoff?: boolean;
    debriefing?: boolean;
  };
}

interface Instructor {
  id: string;
  name: string;
  profileImage?: string;
}

export default function BookPDATestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const instructorId = searchParams?.get('instructorId') || '';

  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [pdaConfigs, setPdaConfigs] = useState<PDAConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<PDAConfig | null>(null);
  const [formData, setFormData] = useState<{
    testCentreId: string;
    testDate: string;
    testTime: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check auth
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Load instructor and PDA configs
  useEffect(() => {
    if (!instructorId || status !== 'authenticated') return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load instructor
        const instructorRes = await fetch(`/api/instructors/${instructorId}`);
        if (!instructorRes.ok) {
          throw new Error('Failed to load instructor');
        }
        const instructorData = await instructorRes.json();
        setInstructor(instructorData);

        // Load PDA configs for this instructor
        const configsRes = await fetch(`/api/instructors/${instructorId}/pda-configs`);
        if (!configsRes.ok) {
          throw new Error('Failed to load PDA test options');
        }
        const configsData = await configsRes.json();
        setPdaConfigs(configsData.configs || []);

        if (configsData.configs && configsData.configs.length > 0) {
          setSelectedConfig(configsData.configs[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load booking information');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [instructorId, status]);

  const handleFormSubmit = async (data: {
    testCentreId: string;
    testDate: string;
    testTime: string;
  }) => {
    if (!selectedConfig || !session?.user?.id || !instructorId) {
      setError('Missing required information');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/pda-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: session.user.id,
          configId: selectedConfig.id,
          testCentreId: data.testCentreId,
          testDate: data.testDate,
          testTime: data.testTime,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to book PDA test');
      }

      const result = await res.json();
      setFormData(data);
      setSuccess(true);

      // Redirect to PDA tests page after 2 seconds
      setTimeout(() => {
        router.push('/client-dashboard/pda-tests');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!instructor || pdaConfigs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
            <h2 className="text-2xl font-bold text-slate-100 mb-2">PDA Tests Not Available</h2>
            <p className="text-slate-300 mb-6">
              This instructor does not currently offer PDA test packages.
            </p>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Book a PDA Test</h1>
          <p className="text-slate-400">
            {instructor.name} - PDA Test Preparation
          </p>
        </div>

        {/* Success State */}
        {success && (
          <div className="bg-green-900/20 border border-green-700/50 rounded-2xl p-8 text-center mb-8">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Booking Confirmed!</h2>
            <p className="text-slate-300 mb-6">Your PDA test has been booked successfully.</p>
            <p className="text-sm text-slate-400">Redirecting to PDA tests page...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-2xl p-4 mb-8 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Booking Form */}
        {!success && selectedConfig && (
          <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl shadow-slate-950/50 p-6 sm:p-8">
            {/* PDA Config Selector */}
            {pdaConfigs.length > 1 && (
              <div className="mb-8 pb-8 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Select PDA Test Package</h3>
                <div className="space-y-2">
                  {pdaConfigs.map((config) => {
                    const finalPrice = config.discountPercent
                      ? config.price * (1 - config.discountPercent / 100)
                      : config.price;
                    return (
                      <button
                        key={config.id}
                        onClick={() => setSelectedConfig(config)}
                        className={`w-full p-4 rounded-lg border-2 text-left transition ${
                          selectedConfig.id === config.id
                            ? 'border-blue-500 bg-blue-900/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-blue-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-100">{config.name}</h4>
                            <p className="text-sm text-slate-400">
                              {Math.floor(config.durationMinutes / 60)}h{' '}
                              {config.durationMinutes % 60 > 0 ? `${config.durationMinutes % 60}m` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            {config.discountPercent && config.discountPercent > 0 ? (
                              <div>
                                <div className="text-xs line-through text-slate-500">
                                  ${config.price.toFixed(2)}
                                </div>
                                <div className="font-bold text-green-500">
                                  ${finalPrice.toFixed(2)}
                                </div>
                              </div>
                            ) : (
                              <div className="font-bold text-slate-100">${finalPrice.toFixed(2)}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PDA Booking Form */}
            <PDABookingForm
              config={selectedConfig}
              instructorId={instructorId}
              onSubmit={handleFormSubmit}
              isLoading={submitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
