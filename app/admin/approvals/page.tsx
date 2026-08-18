/**
 * Admin: Approval Queue
 * Review and approve/reject high-value admin actions
 */

'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, Settings, User } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'

interface PendingApproval {
  id: string
  actionType: string
  targetType: string
  targetId: string
  requestedBy: string
  requestedByName: string | null
  requestedByEmail: string | null
  requestData: any
  reason: string | null
  status: string
  expiresAt: string
  createdAt: string
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    fetchApprovals()
  }, [])

  async function fetchApprovals() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/approvals')
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      setApprovals(data.approvals)
    } catch (error) {
      console.error('Error fetching approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDecision(approvalId: string, approved: boolean) {
    const reason = approved
      ? undefined
      : prompt('Rejection reason (required):')

    if (!approved && !reason) {
      return // User cancelled
    }

    try {
      setProcessing(approvalId)
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, approved, reason }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to process')
      }

      alert(approved ? 'Request approved!' : 'Request rejected')
      await fetchApprovals()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setProcessing(null)
    }
  }

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('PAYOUT')) return <DollarSign className="w-5 h-5 text-green-400" />
    if (actionType.includes('WALLET')) return <DollarSign className="w-5 h-5 text-blue-400" />
    if (actionType.includes('SUBSCRIPTION')) return <User className="w-5 h-5 text-violet-400" />
    if (actionType.includes('SETTINGS') || actionType.includes('PRICING')) return <Settings className="w-5 h-5 text-orange-400" />
    return <AlertTriangle className="w-5 h-5 text-yellow-400" />
  }

  const getActionColor = (actionType: string) => {
    if (actionType.includes('PAYOUT')) return 'border-green-700/50 bg-green-900/20'
    if (actionType.includes('WALLET')) return 'border-blue-700/50 bg-blue-900/20'
    if (actionType.includes('SUBSCRIPTION')) return 'border-violet-700/50 bg-violet-900/20'
    if (actionType.includes('SETTINGS') || actionType.includes('PRICING')) return 'border-orange-700/50 bg-orange-900/20'
    return 'border-yellow-700/50 bg-yellow-900/20'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Approval Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve high-value admin actions requiring two-person authorization
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-slate-500">Pending</span>
            </div>
            <p className="text-3xl font-bold text-yellow-400">{approvals.length}</p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-sm text-slate-500">Financial</span>
            </div>
            <p className="text-3xl font-bold text-green-400">
              {approvals.filter(a => a.actionType.includes('PAYOUT') || a.actionType.includes('WALLET')).length}
            </p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-slate-500">Critical</span>
            </div>
            <p className="text-3xl font-bold text-red-400">
              {approvals.filter(a => a.actionType.includes('SETTINGS') || a.actionType.includes('BAN')).length}
            </p>
          </div>
        </div>

        {/* Approval Queue */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center text-slate-500">
              Loading approvals...
            </div>
          ) : approvals.length === 0 ? (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-slate-400">No pending approvals</p>
              <p className="text-sm text-slate-600 mt-2">All high-value actions have been reviewed.</p>
            </div>
          ) : (
            approvals.map((approval) => {
              const timeLeft = new Date(approval.expiresAt).getTime() - Date.now()
              const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)))
              const isExpiringSoon = hoursLeft < 6
              
              return (
                <div
                  key={approval.id}
                  className={`border rounded-xl p-6 ${getActionColor(approval.actionType)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Action Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {getActionIcon(approval.actionType)}
                        <h3 className="text-lg font-semibold text-slate-100">
                          {approval.actionType.replace(/_/g, ' ')}
                        </h3>
                        {isExpiringSoon && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-900/40 text-red-300">
                            Expires in {hoursLeft}h
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Requested by</p>
                          <p className="text-sm text-slate-200">
                            {approval.requestedByName || approval.requestedByEmail}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Target</p>
                          <p className="text-sm text-slate-200">
                            {approval.targetType} {approval.targetId.slice(0, 8)}
                          </p>
                        </div>
                      </div>

                      {approval.reason && (
                        <div className="mb-4">
                          <p className="text-xs text-slate-500 mb-1">Reason</p>
                          <p className="text-sm text-slate-300">{approval.reason}</p>
                        </div>
                      )}

                      <details className="text-sm">
                        <summary className="text-slate-500 cursor-pointer hover:text-slate-400">
                          View request data
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-950 rounded-lg overflow-x-auto text-xs text-slate-400">
                          {JSON.stringify(approval.requestData, null, 2)}
                        </pre>
                      </details>

                      <div className="flex items-center gap-2 mt-3 text-xs text-slate-600">
                        <Clock className="w-3 h-3" />
                        <span>
                          Requested {new Date(approval.createdAt).toLocaleString('en-AU')}
                        </span>
                        <span>•</span>
                        <span>
                          Expires {new Date(approval.expiresAt).toLocaleString('en-AU')}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleDecision(approval.id, true)}
                        disabled={processing === approval.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition whitespace-nowrap"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecision(approval.id, false)}
                        disabled={processing === approval.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition whitespace-nowrap"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
