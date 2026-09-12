'use client';
import { AdminPageLayout } from '@/components/ui'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';

interface ComplianceRecord {
  providerId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  status: 'valid' | 'expiring' | 'expired' | 'review';
  issues: string[];
  isActive: boolean;
  licenseExpiry?: string | null;
  insuranceExpiry?: string | null;
  policeCheckExpiry?: string | null;
  wwcCheckExpiry?: string | null;
}

export default function DocumentCompliancePage() {
  const router = useRouter();
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'valid' | 'expiring' | 'expired' | 'review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);
  const [autoProcessConfirm, setAutoProcessConfirm] = useState(false);

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

  const toggleRow = (providerId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(providerId)) {
      newExpanded.delete(providerId);
    } else {
      newExpanded.add(providerId);
    }
    setExpandedRows(newExpanded);
  };

  const handleDeactivate = async (providerId: string) => {
    setDeactivateConfirmId(null);
    try {
      const res = await fetch('/api/admin/documents/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', providerId }),
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

  const handleSendReminder = async (providerId: string) => {
    try {
      const res = await fetch('/api/admin/documents/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendReminder', providerId }),
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
    setAutoProcessConfirm(false);
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

  const formatDate = (dateStr: string | null | undefined) => {
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
    review: records.filter(r => r.status === 'review').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AdminPageLayout title="Document Compliance Dashboard" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <p>Loading compliance data...</p>
          </div>
        </AdminPageLayout>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Document Compliance Dashboard" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>
        <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Document Compliance Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Traffic light system for instructor document verification and expiry tracking
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-card p-6 rounded-lg">
            <div className="text-2xl font-bold">{records.length}</div>
            <div className="text-muted-foreground">Total Instructors</div>
          </div>
          <div className="bg-green-900/20 p-6 rounded-lg shadow border-2 border-green-700/50">
            <div className="text-2xl font-bold text-emerald-400">🟢 {stats.valid}</div>
            <div className="text-muted-foreground">Valid</div>
          </div>
          <div className="bg-yellow-900/20 p-6 rounded-lg shadow border-2 border-yellow-700/50">
            <div className="text-2xl font-bold text-yellow-700">🟡 {stats.expiring}</div>
            <div className="text-muted-foreground">Expiring Soon</div>
          </div>
          <div className="bg-red-900/20 p-6 rounded-lg shadow border-2 border-red-700/50">
            <div className="text-2xl font-bold text-destructive">🔴 {stats.expired}</div>
            <div className="text-muted-foreground">Expired/Invalid</div>
          </div>
          <div className="bg-background p-6 rounded-lg shadow border-2 border-border">
            <div className="text-2xl font-bold text-foreground">⚪ {stats.review}</div>
            <div className="text-muted-foreground">In Review</div>
          </div>
        </div>

        {/* Actions and Search */}
        <div className="bg-card p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {autoProcessConfirm ? (
                <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/50 rounded-lg px-3 py-2">
                  <span className="text-xs text-amber-300 font-medium">Deactivate expired + send reminders?</span>
                  <button onClick={handleAutoProcess} disabled={processing} className="rounded bg-amber-600 px-2 py-1 text-xs text-foreground hover:bg-amber-700 disabled:opacity-50">
                    {processing ? 'Processing…' : 'Yes, run'}
                  </button>
                  <button onClick={() => setAutoProcessConfirm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAutoProcessConfirm(true)}
                  disabled={processing}
                  className="bg-primary text-foreground px-4 py-2 rounded hover:bg-primary/90 disabled:bg-slate-600"
                >
                  Auto-Process All
                </button>
              )}
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-card text-foreground' : 'bg-secondary/70'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('valid')}
                className={`px-4 py-2 rounded ${filter === 'valid' ? 'bg-emerald-600 text-foreground' : 'bg-secondary/70'}`}
              >
                🟢 Valid
              </button>
              <button
                onClick={() => setFilter('expiring')}
                className={`px-4 py-2 rounded ${filter === 'expiring' ? 'bg-yellow-600 text-foreground' : 'bg-secondary/70'}`}
              >
                🟡 Expiring
              </button>
              <button
                onClick={() => setFilter('expired')}
                className={`px-4 py-2 rounded ${filter === 'expired' ? 'bg-destructive text-foreground' : 'bg-secondary/70'}`}
              >
                🔴 Expired
              </button>
              <button
                onClick={() => setFilter('review')}
                className={`px-4 py-2 rounded ${filter === 'review' ? 'bg-secondary text-foreground' : 'bg-secondary/70'}`}
              >
                ⚪ In Review
              </button>
            </div>
            
            {/* Search */}
            <div className="w-full md:w-auto">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-80 px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Compact Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-background">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Instructor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Issues</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground/60 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-slate-700">
              {filteredRecords.map((record) => {
                const isExpanded = expandedRows.has(record.providerId);
                return (
                  <>
                    <tr key={record.providerId} className={
                      record.status === 'expired' ? 'bg-red-900/20' :
                      record.status === 'expiring' ? 'bg-yellow-900/20' :
                      record.status === 'review' ? 'bg-secondary' :
                      'bg-card'
                    }>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRow(record.providerId)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-2xl">{getStatusIcon(record.status)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-foreground">{record.name}</div>
                        <div className="text-xs text-muted-foreground/60">{record.email}</div>
                        {!record.isActive && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-destructive mt-1">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          record.issues.length > 0 ? 'text-destructive' : 'text-emerald-400'
                        }`}>
                          {record.issues.length > 0 ? `${record.issues.length} issues` : 'No issues'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/admin/documents/review/${record.providerId}`)}
                            className="text-sm text-primary hover:text-blue-200 font-medium"
                          >
                            Review
                          </button>
                          {record.status === 'expiring' && (
                            <button
                              onClick={() => handleSendReminder(record.providerId)}
                              className="text-sm text-yellow-600 hover:text-yellow-200"
                            >
                              Remind
                            </button>
                          )}
                          {record.status === 'expired' && record.isActive && (
                            deactivateConfirmId === record.providerId ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDeactivate(record.providerId)}
                                  className="text-xs bg-destructive text-foreground px-2 py-1 rounded hover:bg-destructive/90"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeactivateConfirmId(null)}
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeactivateConfirmId(record.providerId)}
                                className="text-sm text-destructive hover:text-red-200"
                              >
                                Deactivate
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className={
                        record.status === 'expired' ? 'bg-red-900/20' :
                        record.status === 'expiring' ? 'bg-yellow-900/20' :
                        record.status === 'review' ? 'bg-secondary' :
                        'bg-secondary'
                      }>
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-semibold text-foreground mb-2">Contact</p>
                              <p className="text-muted-foreground">Phone: {record.phone}</p>
                              <p className="text-muted-foreground">Email: {record.email}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-foreground mb-2">Expiry Dates</p>
                              <p className="text-muted-foreground">License: {formatDate(record.licenseExpiry)}</p>
                              <p className="text-muted-foreground">Insurance: {formatDate(record.insuranceExpiry)}</p>
                              <p className="text-muted-foreground">Police Check: {formatDate(record.policeCheckExpiry)}</p>
                              <p className="text-muted-foreground">WWC: {formatDate(record.wwcCheckExpiry)}</p>
                            </div>
                            {record.issues.length > 0 && (
                              <div className="md:col-span-2">
                                <p className="font-semibold text-foreground mb-2">Issues</p>
                                <ul className="list-disc list-inside text-destructive">
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
          <div className="text-center py-8 text-muted-foreground/60">
            No instructors found for this filter
          </div>
        )}
      </div>

      {/* Toast notifications */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm text-foreground ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-destructive'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      </AdminPageLayout>
    </div>
  )
}
