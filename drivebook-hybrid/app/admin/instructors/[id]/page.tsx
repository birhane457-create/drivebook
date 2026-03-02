'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import { formatBookingId } from '@/lib/utils';

interface InstructorData {
  id: string;
  name: string;
  phone: string;
  bio: string | null;
  profileImage: string | null;
  approvalStatus: string;
  licenseNumber: string | null;
  licenseExpiry: Date | null;
  insuranceNumber: string | null;
  insuranceExpiry: Date | null;
  policeCheckExpiry: Date | null;
  wwcCheckExpiry: Date | null;
  licenseImageFront: string | null;
  licenseImageBack: string | null;
  insurancePolicyDoc: string | null;
  policeCheckDoc: string | null;
  wwcCheckDoc: string | null;
  averageRating: number | null;
  isActive: boolean;
  createdAt: Date;
  user: { email: string };
  _count: {
    bookings: number;
    reviews: number;
  };
  bookings: any[];
  reviews: any[];
}

export default function AdminInstructorProfilePage() {
  const router = useRouter();
  const params = useParams();
  const instructorId = params.id as string;
  
  const [instructor, setInstructor] = useState<InstructorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'reviews' | 'documents'>('overview');

  useEffect(() => {
    fetchInstructor();
  }, [instructorId]);

  const fetchInstructor = async () => {
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}`);
      if (res.ok) {
        const data = await res.json();
        setInstructor(data);
      } else if (res.status === 401 || res.status === 403) {
        router.push('/login');
      } else {
        router.push('/admin/instructors');
      }
    } catch (error) {
      console.error('Failed to fetch instructor:', error);
      router.push('/admin/instructors');
    } finally {
      setLoading(false);
    }
  };

  const getDocStatus = (expiry: Date | null, docUrl: string | null) => {
    if (!expiry || !docUrl) return { status: 'expired', label: 'Missing', color: 'text-red-600', icon: '🔴' };
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiryDate = new Date(expiry);
    if (expiryDate < now) return { status: 'expired', label: 'Expired', color: 'text-red-600', icon: '🔴' };
    if (expiryDate < thirtyDaysFromNow) return { status: 'expiring', label: 'Expiring Soon', color: 'text-yellow-600', icon: '🟡' };
    return { status: 'valid', label: 'Valid', color: 'text-green-600', icon: '🟢' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading instructor profile...</p>
        </div>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Instructor Not Found</h1>
            <Link href="/admin/instructors" className="text-blue-600 hover:text-blue-800">
              Back to Instructors
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const licenseStatus = getDocStatus(instructor.licenseExpiry, instructor.licenseImageFront);
  const insuranceStatus = getDocStatus(instructor.insuranceExpiry, instructor.insurancePolicyDoc);
  const policeStatus = getDocStatus(instructor.policeCheckExpiry, instructor.policeCheckDoc);
  const wwcStatus = getDocStatus(instructor.wwcCheckExpiry, instructor.wwcCheckDoc);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link 
          href="/admin/instructors"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Instructors
        </Link>

        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex items-start gap-6">
              {instructor.profileImage ? (
                <img
                  src={instructor.profileImage}
                  alt={instructor.name}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-3xl font-medium">
                    {instructor.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{instructor.name}</h1>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    instructor.approvalStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    instructor.approvalStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    instructor.approvalStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {instructor.approvalStatus}
                  </span>
                </div>
                <div className="space-y-1 text-gray-600">
                  <p>📧 {instructor.user.email}</p>
                  <p>📞 {instructor.phone}</p>
                  <p>🆔 License: {instructor.licenseNumber || 'Not provided'}</p>
                  <p>📅 Joined: {new Date(instructor.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            {instructor.bio && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-gray-700">{instructor.bio}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Bookings</p>
            <p className="text-2xl font-bold text-gray-900">{instructor._count.bookings}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Reviews</p>
            <p className="text-2xl font-bold text-gray-900">{instructor._count.reviews}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Average Rating</p>
            <p className="text-2xl font-bold text-gray-900">
              {instructor.averageRating ? instructor.averageRating.toFixed(1) : 'N/A'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Account Status</p>
            <p className={`text-lg font-bold ${instructor.isActive ? 'text-green-600' : 'text-red-600'}`}>
              {instructor.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'bookings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Bookings ({instructor.bookings.length})
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'reviews'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Reviews ({instructor.reviews.length})
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documents
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Stats</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-gray-600">Completed</p>
                      <p className="text-xl font-bold text-green-600">
                        {instructor.bookings.filter((b: any) => b.status === 'COMPLETED').length}
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-gray-600">Upcoming</p>
                      <p className="text-xl font-bold text-blue-600">
                        {instructor.bookings.filter((b: any) => b.status === 'CONFIRMED' && new Date(b.startTime) > new Date()).length}
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-gray-600">Cancelled</p>
                      <p className="text-xl font-bold text-red-600">
                        {instructor.bookings.filter((b: any) => b.status === 'CANCELLED').length}
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-gray-600">Pending</p>
                      <p className="text-xl font-bold text-yellow-600">
                        {instructor.bookings.filter((b: any) => b.status === 'PENDING').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Document Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">License</p>
                      <p className={`text-lg font-bold ${licenseStatus.color}`}>
                        {licenseStatus.icon} {licenseStatus.label}
                      </p>
                      {instructor.licenseExpiry && (
                        <p className="text-xs text-gray-500 mt-1">
                          Expires: {new Date(instructor.licenseExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Insurance</p>
                      <p className={`text-lg font-bold ${insuranceStatus.color}`}>
                        {insuranceStatus.icon} {insuranceStatus.label}
                      </p>
                      {instructor.insuranceExpiry && (
                        <p className="text-xs text-gray-500 mt-1">
                          Expires: {new Date(instructor.insuranceExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Police Check</p>
                      <p className={`text-lg font-bold ${policeStatus.color}`}>
                        {policeStatus.icon} {policeStatus.label}
                      </p>
                      {instructor.policeCheckExpiry && (
                        <p className="text-xs text-gray-500 mt-1">
                          Expires: {new Date(instructor.policeCheckExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">WWC Check</p>
                      <p className={`text-lg font-bold ${wwcStatus.color}`}>
                        {wwcStatus.icon} {wwcStatus.label}
                      </p>
                      {instructor.wwcCheckExpiry && (
                        <p className="text-xs text-gray-500 mt-1">
                          Expires: {new Date(instructor.wwcCheckExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">📋 Coming Soon</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Payment History & Invoices</li>
                    <li>• Earnings & Commission Breakdown</li>
                    <li>• PDA Test Results & Statistics</li>
                    <li>• Activity Log (Login history, changes made)</li>
                    <li>• Performance Metrics (Completion rate, cancellation rate)</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div>
                {instructor.bookings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {instructor.bookings.map((booking: any) => (
                          <tr key={booking.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">#{formatBookingId(booking.id)}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{booking.client.name}</div>
                              <div className="text-xs text-gray-500">{booking.client.email}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(booking.startTime).toLocaleDateString()}
                              <div className="text-xs">{new Date(booking.startTime).toLocaleTimeString()}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{booking.bookingType}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                                booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">${booking.price.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/booking/${booking.id}`}
                                className="text-sm text-blue-600 hover:text-blue-900"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No bookings yet</p>
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div>
                {instructor.reviews.length > 0 ? (
                  <div className="space-y-4">
                    {instructor.reviews.map((review: any) => (
                      <div key={review.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900">{review.client.name}</p>
                          <div className="flex items-center">
                            <span className="text-yellow-500 text-lg">★</span>
                            <span className="ml-1 font-bold text-lg">{review.rating}</span>
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-gray-600 mb-2">{review.comment}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()} at {new Date(review.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No reviews yet</p>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div>
                <div className="flex justify-end mb-4">
                  <Link
                    href={`/admin/documents/review/${instructor.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Review & Manage Documents
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">License</h4>
                    <p className={`font-bold mb-2 ${licenseStatus.color}`}>
                      {licenseStatus.icon} {licenseStatus.label}
                    </p>
                    <p className="text-sm text-gray-600">Number: {instructor.licenseNumber || 'Not provided'}</p>
                    {instructor.licenseExpiry && (
                      <p className="text-sm text-gray-600">Expires: {new Date(instructor.licenseExpiry).toLocaleDateString()}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      {instructor.licenseImageFront && (
                        <a href={instructor.licenseImageFront} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">
                          View Front Image →
                        </a>
                      )}
                      {instructor.licenseImageBack && (
                        <a href={instructor.licenseImageBack} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">
                          View Back Image →
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Insurance</h4>
                    <p className={`font-bold mb-2 ${insuranceStatus.color}`}>
                      {insuranceStatus.icon} {insuranceStatus.label}
                    </p>
                    <p className="text-sm text-gray-600">Number: {instructor.insuranceNumber || 'Not provided'}</p>
                    {instructor.insuranceExpiry && (
                      <p className="text-sm text-gray-600">Expires: {new Date(instructor.insuranceExpiry).toLocaleDateString()}</p>
                    )}
                    {instructor.insurancePolicyDoc && (
                      <a href={instructor.insurancePolicyDoc} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mt-2">
                        View Document →
                      </a>
                    )}
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Police Check</h4>
                    <p className={`font-bold mb-2 ${policeStatus.color}`}>
                      {policeStatus.icon} {policeStatus.label}
                    </p>
                    {instructor.policeCheckExpiry && (
                      <p className="text-sm text-gray-600">Expires: {new Date(instructor.policeCheckExpiry).toLocaleDateString()}</p>
                    )}
                    {instructor.policeCheckDoc && (
                      <a href={instructor.policeCheckDoc} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mt-2">
                        View Document →
                      </a>
                    )}
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">WWC Check</h4>
                    <p className={`font-bold mb-2 ${wwcStatus.color}`}>
                      {wwcStatus.icon} {wwcStatus.label}
                    </p>
                    {instructor.wwcCheckExpiry && (
                      <p className="text-sm text-gray-600">Expires: {new Date(instructor.wwcCheckExpiry).toLocaleDateString()}</p>
                    )}
                    {instructor.wwcCheckDoc && (
                      <a href={instructor.wwcCheckDoc} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mt-2">
                        View Document →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
