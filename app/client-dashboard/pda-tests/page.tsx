'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
  ArrowRight,
  User,
  Phone,
} from 'lucide-react';

interface Instructor {
  id: string;
  name: string;
  profileImage?: string;
  phone?: string;
  offersTestPackage: boolean;
  testPackagePrice?: number;
  testPackageDuration?: number;
}

interface PDATest {
  id: string;
  instructorId: string;
  instructor?: Instructor;
  testDate: string;
  testTime: string;
  testCenterName: string;
  testCenterAddress: string;
  result?: string;
  price: number;
  status: string;
  bookedAt?: string;
}

interface InstructorWithBookings {
  instructor: Instructor;
  bookedTests: PDATest[];
  canAddTest: boolean;
}

export default function ClientPDATestsPage() {
  const { data: session } = useSession();
  const [instructorsData, setInstructorsData] = useState<InstructorWithBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);

  useEffect(() => {
    fetchPDATestsData();
  }, [session]);

  const fetchPDATestsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch instructors the student has booked with
      const instructorsRes = await fetch('/api/client/instructors');
      if (!instructorsRes.ok) {
        throw new Error('Failed to load instructors');
      }
      const instructors = await instructorsRes.json();

      // Fetch available PDA tests
      const testsRes = await fetch('/api/pda-bookings/available');
      const tests = testsRes.ok ? await testsRes.json() : [];

      // Organize by instructor
      const organized: InstructorWithBookings[] = instructors
        .filter((inst: Instructor) => inst.offersTestPackage)
        .map((inst: Instructor) => ({
          instructor: inst,
          bookedTests: tests.filter((t: PDATest) => t.instructorId === inst.id),
          canAddTest: inst.testPackagePrice && inst.testPackagePrice > 0,
        }));

      setInstructorsData(organized);
    } catch (err) {
      console.error('Error fetching PDA tests:', err);
      setError('Failed to load PDA test information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!session?.user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          Please log in to view PDA tests
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">PDA Test Management</h1>
        <p className="text-gray-600">
          Prepare for your driving test with PDA packages from your instructors
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
          <span className="text-gray-600">Loading PDA tests...</span>
        </div>
      ) : instructorsData.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-semibold mb-2 text-blue-900">No PDA Tests Available</h3>
          <p className="text-blue-700 mb-4">
            Your instructors don't currently offer PDA test packages. Book a lesson to get started!
          </p>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Browse Instructors <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {instructorsData.map((data) => (
            <div
              key={data.instructor.id}
              className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
            >
              {/* Instructor Header */}
              <button
                onClick={() =>
                  setExpandedInstructor(
                    expandedInstructor === data.instructor.id ? null : data.instructor.id
                  )
                }
                className="w-full p-6 flex items-start gap-4 hover:bg-gray-50 transition text-left"
              >
                {/* Instructor Avatar */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {data.instructor.name.charAt(0).toUpperCase()}
                </div>

                {/* Instructor Info */}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{data.instructor.name}</h3>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                    {data.instructor.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {data.instructor.phone}
                      </div>
                    )}
                    {data.instructor.testPackageDuration && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {Math.floor((data.instructor.testPackageDuration || 0) / 60)}h{' '}
                        {((data.instructor.testPackageDuration || 0) % 60)}m prep
                      </div>
                    )}
                    {data.instructor.testPackagePrice && (
                      <div className="flex items-center gap-1 font-semibold text-blue-600">
                        <DollarSign className="w-4 h-4" />
                        {data.instructor.testPackagePrice.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expand Arrow */}
                <div className="text-gray-600">
                  {expandedInstructor === data.instructor.id ? (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7-7m0 0l-7 7m7-7v12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7 7 7-7"
                      />
                    </svg>
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {expandedInstructor === data.instructor.id && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  {/* Booked Tests */}
                  {data.bookedTests.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Booked PDA Tests ({data.bookedTests.length})
                      </h4>
                      <div className="space-y-3">
                        {data.bookedTests.map((test) => (
                          <div
                            key={test.id}
                            className="bg-white rounded p-4 border-l-4 border-green-600"
                          >
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
                              <div>
                                <p className="text-gray-600">Date & Time</p>
                                <p className="font-semibold">
                                  {new Date(test.testDate).toLocaleDateString('en-AU', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}{' '}
                                  at {test.testTime}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Test Centre</p>
                                <p className="font-semibold">{test.testCenterName}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Status</p>
                                <p className="font-semibold text-green-600">
                                  {test.result ? `Result: ${test.result}` : 'Pending'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Test Button */}
                  {data.canAddTest && (
                    <div>
                      <Link
                        href={`/client-dashboard/pda-tests/book?instructorId=${data.instructor.id}`}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                      >
                        <Plus className="w-5 h-5" />
                        Book PDA Test Package
                      </Link>
                    </div>
                  )}

                  {!data.canAddTest && data.bookedTests.length === 0 && (
                    <div className="text-center py-4 text-gray-600">
                      <p>No PDA tests available at this time.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">About PDA Tests</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>PDA tests are specialised driving test preparation packages offered by your instructors</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Book a test to prepare comprehensively for your driving examination</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Tests are scheduled at licensed test centres in your area</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
