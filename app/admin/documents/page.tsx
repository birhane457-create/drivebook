'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';

interface ComplianceRecord {
  instructorId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  status: 'valid' | 'expiring' | 'expired';
  issues: string[];
  isActive: boolean;
  licenseExpiry: string | null;
  insuranceExpiry: string | null;
  policeCheckExpiry: string | null;
  wwcCheckExpiry: string | null;
}

export default function DocumentCompliancePage() {
  const router = useRouter();
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'valid' | 'expiring' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchCompliance();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCompliance = async () => {
    try {
      const res = await fetch('/api/admin/documents/compliance');
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      } else {
        showToast('error', 'Failed to load compliance data.');
      }
    } catch (error) {
      console.error('Failed to fetch compliance:', error);
      showToast('error', 'Failed to load compliance data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (instructorId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(instructorId)) {
      newExpanded.delete(instructorId);
    } else {
      newExpanded.add(instructorId);
    }
    setExpandedRows(newExpanded);
  };

  const handleDeactivate = async (instructorId: string) => {
    if (!confirm('Deactivate this instructor? They will be hidden from search results.')) {
      return;
    }

    try {
      const res = await fetch('/api/admin/documents/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', instructorId }),
      });

      if (res.ok) {
        showToast('success', 'Instructor deactivated.');
        fetchCompliance();
      } else {
        showToast('error', 'Failed to deactivate instructor.');
      }
    } catch (error) {
      console.error('Failed to deactivate:', error);
      showToast('error', 'Failed to deactivate instructor. Please try again.');
    }
  };

  const handleSendReminder = async (instructorId: string) => {
    try {
      const res = await fetch('/api/admin/documents/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendReminder', instructorId }),
      });

      if (res.ok) {
        showToast('success', 'SMS reminder sent.');
      } else {
        showToast('error', 'Failed to send SMS reminder.');
      }
    } catch (error) {
      console.error('Failed to send reminder:', error);
      showToast('error', 'Failed to send SMS reminder. Please try again.');
    }
  };

  const handleAutoProcess = async () => {
    if (!confirm('Auto-process all instructors? This will deactivate expired accounts and send reminders.')) {
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/admin/documents/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'autoProcess' }),
      });

      if (res.ok) {
        const result = await res.json();
        showToast('success', result.message || 'Auto-process completed.');
        fetchCompliance();
      } else {
        showToast('error', 'Failed to auto-process compliance records.');
      }
    } catch (error) {
      console.error('Failed to auto-process:', error);
      showToast('error', 'Failed to auto-process compliance records. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-AU');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return '🟢';
      case 'expiring': return '🟡';
      case 'expired': return '🔴';
      default: return '⚪';
    }
  };

  const filteredRecords = records.filter(r => {
    // Filter by status
    if (filter !== 'all' && r.status !== filter) return false;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(query) ||
        r.email.toLowerCase().includes(query) ||
        r.phone.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const stats = {
    valid: records.filter(r => r.status === 'valid').length,
    expiring: records.filter(r => r.status === 'expiring').length,
    expired: records.filter(r => r.status === 'expired').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading compliance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Document Compliance Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Traffic light system for instructor document verification and expiry tracking
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold">{records.length}</div>
            <div className="text-gray-600">Total Instructors</div>
          </div>
          <div className="bg-green-50 p-6 rounded-lg shadow border-2 border-green-200">
            <div className="text-2xl font-bold text-green-700">🟢 {stats.valid}</div>
            <div className="text-gray-600">Valid</div>
          </div>
          <div className="bg-yellow-50 p-6 rounded-lg shadow border-2 border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">🟡 {stats.expiring}</div>
            <div className="text-gray-600">Expiring Soon</div>
          </div>
          <div className="bg-red-50 p-6 rounded-lg shadow border-2 border-red-200">
            <div className="text-2xl font-bold text-red-700">🔴 {stats.expired}</div>
            <div className="text-gray-600">Expired/Invalid</div>
          </div>
        </div>

        {/* Actions and Search */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleAutoProcess}
                disabled={processing}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {processing ? 'Processing...' : 'Auto-Process All'}
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('valid')}
                className={`px-4 py-2 rounded ${filter === 'valid' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
              >
                🟢 Valid
              </button>
              <button
                onClick={() => setFilter('expiring')}
                className={`px-4 py-2 rounded ${filter === 'expiring' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
              >
                🟡 Expiring
              </button>
              <button
                onClick={() => setFilter('expired')}
                className={`px-4 py-2 rounded ${filter === 'expired' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
              >
                🔴 Expired
              </button>
            </div>
            
            {/* Search */}
            <div className="w-full md:w-auto">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Compact Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.map((record) => {
                const isExpanded = expandedRows.has(record.instructorId);
                return (
                  <>
                    <tr key={record.instructorId} className={
                      record.status === 'expired' ? 'bg-red-50' :
                      record.status === 'expiring' ? 'bg-yellow-50' :
                      'bg-white'
                    }>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRow(record.instructorId)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-2xl">{getStatusIcon(record.status)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{record.name}</div>
                        <div className="text-xs text-gray-500">{record.email}</div>
                        {!record.isActive && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-1">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          record.issues.length > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {record.issues.length > 0 ? `${record.issues.length} issues` : 'No issues'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/admin/documents/review/${record.instructorId}`)}
                            className="text-sm text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Review
                          </button>
                          {record.status === 'expiring' && (
                            <button
                              onClick={() => handleSendReminder(record.instructorId)}
                              className="text-sm text-yellow-600 hover:text-yellow-900"
                            >
                              Remind
                            </button>
                          )}
                          {record.status === 'expired' && record.isActive && (
                            <button
                              onClick={() => handleDeactivate(record.instructorId)}
                              className="text-sm text-red-600 hover:text-red-900"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className={
                        record.status === 'expired' ? 'bg-red-50' :
                        record.status === 'expiring' ? 'bg-yellow-50' :
                        'bg-gray-50'
                      }>
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Contact</p>
                              <p className="text-gray-600">Phone: {record.phone}</p>
                              <p className="text-gray-600">Email: {record.email}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Expiry Dates</p>
                              <p className="text-gray-600">License: {formatDate(record.licenseExpiry)}</p>
                              <p className="text-gray-600">Insurance: {formatDate(record.insuranceExpiry)}</p>
                              <p className="text-gray-600">Police Check: {formatDate(record.policeCheckExpiry)}</p>
                              <p className="text-gray-600">WWC: {formatDate(record.wwcCheckExpiry)}</p>
                            </div>
                            {record.issues.length > 0 && (
                              <div className="md:col-span-2">
                                <p className="font-semibold text-gray-700 mb-2">Issues</p>
                                <ul className="list-disc list-inside text-red-600">
                                  {record.issues.map((issue, idx) => (
                                    <li key={idx}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No instructors found for this filter
          </div>
        )}
      </div>

      {/* Toast notifications */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm text-white ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
