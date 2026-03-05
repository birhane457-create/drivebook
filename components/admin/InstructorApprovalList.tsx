'use client';

import React, { useState, useEffect } from 'react';

interface Instructor {
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
  documentsVerified: boolean;
  createdAt: Date;
  user: { email: string };
  _count: {
    bookings: number;
    reviews: number;
  };
}

interface ComplianceStatus {
  instructorId: string;
  status: 'valid' | 'expiring' | 'expired';
  issues: string[];
  licenseExpiry: Date | null;
  insuranceExpiry: Date | null;
  policeCheckExpiry: Date | null;
  wwcCheckExpiry: Date | null;
}

export default function InstructorApprovalList({ instructors }: { instructors: Instructor[] }) {
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [complianceData, setComplianceData] = useState<Map<string, ComplianceStatus>>(new Map());

  // Fetch compliance data
  useEffect(() => {
    const fetchCompliance = async () => {
      try {
        const res = await fetch('/api/admin/documents/compliance');
        if (res.ok) {
          const data = await res.json();
          const map = new Map<string, ComplianceStatus>();
          data.forEach((item: ComplianceStatus) => {
            map.set(item.instructorId, item);
          });
          setComplianceData(map);
        }
      } catch (error) {
        console.error('Failed to fetch compliance data:', error);
      }
    };
    fetchCompliance();
  }, []);

  const toggleRow = (instructorId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(instructorId)) {
      newExpanded.delete(instructorId);
    } else {
      newExpanded.add(instructorId);
    }
    setExpandedRows(newExpanded);
  };

  const getComplianceIndicator = (instructorId: string) => {
    const compliance = complianceData.get(instructorId);
    if (!compliance) return { icon: '⚪', color: 'text-gray-400', label: 'Unknown' };
    
    if (compliance.status === 'valid') {
      return { icon: '🟢', color: 'text-green-600', label: 'Valid' };
    } else if (compliance.status === 'expiring') {
      return { icon: '🟡', color: 'text-yellow-600', label: 'Expiring Soon' };
    } else {
      return { icon: '🔴', color: 'text-red-600', label: 'Expired/Missing' };
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  const filteredInstructors = instructors.filter(instructor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      instructor.name.toLowerCase().includes(query) ||
      instructor.user.email.toLowerCase().includes(query) ||
      instructor.phone.toLowerCase().includes(query)
    );
  });

  const handleApprove = async (instructorId: string) => {
    if (!confirm('Are you sure you want to approve this instructor?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}/approve`, {
        method: 'POST',
      });

      if (res.ok) {
        alert('Instructor approved successfully!');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to approve instructor');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (instructorId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        alert('Instructor rejected');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reject instructor');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (instructorId: string) => {
    const reason = prompt('Please provide a reason for suspension:');
    if (!reason) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        alert('Instructor suspended');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to suspend instructor');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Compact Table */}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">License</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Police</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WWC</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stats</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredInstructors.map((instructor) => {
            const isExpanded = expandedRows.has(instructor.id);
            const compliance = complianceData.get(instructor.id);
            const indicator = getComplianceIndicator(instructor.id);
            
            return (
              <React.Fragment key={instructor.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleRow(instructor.id)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      {instructor.profileImage ? (
                        <img
                          src={instructor.profileImage}
                          alt={instructor.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 text-xs font-medium">
                            {instructor.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{instructor.name}</div>
                        <div className="text-xs text-gray-500">{instructor.user?.email || instructor.email || 'No email'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        instructor.approvalStatus === 'APPROVED'
                          ? 'bg-green-100 text-green-800'
                          : instructor.approvalStatus === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : instructor.approvalStatus === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {instructor.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="text-lg">{indicator.icon}</div>
                    <div className="text-xs text-gray-500">{formatDate(compliance?.licenseExpiry || null)}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="text-lg">{indicator.icon}</div>
                    <div className="text-xs text-gray-500">{formatDate(compliance?.insuranceExpiry || null)}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="text-lg">{indicator.icon}</div>
                    <div className="text-xs text-gray-500">{formatDate(compliance?.policeCheckExpiry || null)}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="text-lg">{indicator.icon}</div>
                    <div className="text-xs text-gray-500">{formatDate(compliance?.wwcCheckExpiry || null)}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div>{instructor._count.bookings} bookings</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.location.href = `/admin/instructors/${instructor.id}`}
                        className="text-sm text-blue-600 hover:text-blue-900"
                      >
                        View Profile
                      </button>
                      {instructor.approvalStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(instructor.id)}
                            disabled={loading}
                            className="text-sm text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(instructor.id)}
                            disabled={loading}
                            className="text-sm text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {instructor.approvalStatus === 'APPROVED' && (
                        <button
                          onClick={() => handleSuspend(instructor.id)}
                          disabled={loading}
                          className="text-sm text-orange-600 hover:text-orange-900 disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-semibold text-gray-700 mb-2">Contact</p>
                          <p className="text-gray-600">Phone: {instructor.phone}</p>
                          <p className="text-gray-600">Email: {instructor.user?.email || instructor.email || 'No email'}</p>
                          <p className="text-gray-600">Joined: {new Date(instructor.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 mb-2">Documents</p>
                          <p className="text-gray-600">License: {instructor.licenseNumber || 'Not provided'}</p>
                          <p className="text-gray-600">Insurance: {instructor.insuranceNumber || 'Not provided'}</p>
                          <p className="text-gray-600">
                            Status: {instructor.documentsVerified ? '✓ Verified' : 'Not verified'}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 mb-2">Statistics</p>
                          <p className="text-gray-600">Bookings: {instructor._count.bookings}</p>
                          <p className="text-gray-600">Reviews: {instructor._count.reviews}</p>
                        </div>
                        {compliance && compliance.issues.length > 0 && (
                          <div className="md:col-span-3">
                            <p className="font-semibold text-gray-700 mb-2">Compliance Issues</p>
                            <ul className="list-disc list-inside text-red-600 text-sm">
                              {compliance.issues.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {instructor.bio && (
                          <div className="md:col-span-3">
                            <p className="font-semibold text-gray-700 mb-2">Bio</p>
                            <p className="text-gray-600">{instructor.bio}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {filteredInstructors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No instructors found</p>
        </div>
      )}
    </div>
  );
}
