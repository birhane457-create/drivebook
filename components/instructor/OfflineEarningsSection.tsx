'use client';

import { useState } from 'react';
import { Banknote, Calendar, ChevronDown, ChevronRight, Info, AlertCircle } from 'lucide-react';

interface OfflineBooking {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  clientName: string;
  offlineAmountPaid: number;
  offlinePaymentMethod: string;
}

interface OfflineEarningsData {
  thisMonth?: { logged: number; bookings: number };
  scheduled?: { total: number; count: number };
  allBookings?: OfflineBooking[];
}

interface GroupedDay {
  label: string;
  dateKey: string;
  bookings: OfflineBooking[];
  totalAmount: number;
}

export default function OfflineEarningsSection({ 
  data 
}: { 
  data: OfflineEarningsData 
}) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showScheduled, setShowScheduled] = useState(false);

  const toggleDay = (key: string) => {
    const s = new Set(expandedDays);
    s.has(key) ? s.delete(key) : s.add(key);
    setExpandedDays(s);
  };

  // Group bookings by day
  const groupedByDay: GroupedDay[] = [];
  const dayMap = new Map<string, OfflineBooking[]>();
  
  (data.allBookings || []).forEach(booking => {
    const d = new Date(booking.startTime);
    const key = d.toISOString().split('T')[0];
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(booking);
  });

  Array.from(dayMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([key, bookings]) => {
      const d = new Date(key + 'T00:00:00');
      groupedByDay.push({
        label: d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
        dateKey: key,
        bookings: bookings.sort((a, b) => 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        ),
        totalAmount: bookings.reduce((sum, b) => sum + (b.offlineAmountPaid || 0), 0),
      });
    });

  const completedBookings = groupedByDay;
  const scheduledBookings = data.scheduled || { total: 0, count: 0 };
  const thisMonth = data.thisMonth || { logged: 0, bookings: 0 };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-3">
          <Banknote className="h-5 w-5 text-amber-500" />
          💰 Offline Lessons Logged
        </h2>
        <p className="text-sm text-slate-400">Cash and direct payments — recorded by you, not verified by DriveBook</p>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-950 border border-amber-800 rounded-lg">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200">
          <p className="font-semibold mb-1">Self-Reported Data</p>
          <p>These are lessons you've logged as paid directly by students. DriveBook cannot verify:</p>
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-300 text-xs">
            <li>Whether payment actually happened</li>
            <li>The amount students actually paid</li>
            <li>Refund or cancellation status</li>
          </ul>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { 
            label: 'This Month', 
            value: thisMonth.logged, 
            sub: `${thisMonth.bookings} lessons logged`,
            icon: <Calendar className="h-4 w-4 text-amber-500" />
          },
          { 
            label: 'Scheduled', 
            value: scheduledBookings.total, 
            sub: `${scheduledBookings.count} upcoming lessons`,
            icon: <Calendar className="h-4 w-4 text-amber-500" />
          },
          {
            label: 'Platform Payout',
            value: 0,
            sub: 'Offline does not affect payouts',
            icon: <Info className="h-4 w-4 text-slate-400" />,
            note: true
          }
        ].map(({ label, value, sub, icon, note }) => (
          <div key={label} className={`bg-slate-950 rounded-lg shadow-sm p-4 border ${note ? 'border-slate-700' : 'border-amber-900/50'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400">{label}</p>
              {icon}
            </div>
            <p className={`text-xl font-bold ${note ? 'text-slate-400' : 'text-amber-300'}`}>${value.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Scheduled Offline Lessons */}
      {scheduledBookings.count > 0 && (
        <div className="bg-slate-950 rounded-lg shadow-sm border border-amber-900/30 overflow-hidden">
          <button
            onClick={() => setShowScheduled(!showScheduled)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              {showScheduled ? <ChevronDown className="h-4 w-4 text-amber-600" /> : <ChevronRight className="h-4 w-4 text-amber-600" />}
              <Calendar className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-slate-100 text-sm">Scheduled Offline Lessons</span>
              <span className="text-xs text-slate-400">(logged but not yet taught)</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-amber-300 text-sm">${scheduledBookings.total.toFixed(2)}</span>
              <span className="text-xs text-slate-400 ml-2">{scheduledBookings.count} lessons</span>
            </div>
          </button>

          {showScheduled && (
            <div className="divide-y divide-slate-800">
              {completedBookings.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400 text-sm">
                  No offline lessons logged yet
                </div>
              ) : (
                completedBookings.map(day => (
                  <div key={day.dateKey}>
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{day.label}</span>
                      <span className="text-xs text-slate-400">Total <span className="font-semibold text-amber-300">${day.totalAmount.toFixed(2)}</span></span>
                    </div>
                    {day.bookings.map(b => (
                      <div key={b.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50">
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {new Date(b.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}{b.clientName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {b.duration}h · {b.offlinePaymentMethod === 'cash' ? '💵 Cash' : b.offlinePaymentMethod === 'bank_transfer' ? '🏦 Bank Transfer' : '💳 Other'}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-amber-300">${b.offlineAmountPaid.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Completed Offline Lessons */}
      {completedBookings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 px-1">📋 Offline lessons recorded</p>
          
          {completedBookings.map(day => (
            <div key={day.dateKey} className="bg-slate-950 rounded-lg shadow-sm overflow-hidden border border-slate-800">
              <button
                onClick={() => toggleDay(day.dateKey)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-950 hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedDays.has(day.dateKey) ? <ChevronDown className="h-4 w-4 text-amber-600" /> : <ChevronRight className="h-4 w-4 text-amber-600" />}
                  <span className="text-sm font-medium text-slate-100">{day.label}</span>
                  <span className="text-xs text-slate-400">{day.bookings.length} lesson{day.bookings.length !== 1 ? 's' : ''}</span>
                </div>
                <span className="text-sm font-semibold text-amber-300">${day.totalAmount.toFixed(2)}</span>
              </button>

              {expandedDays.has(day.dateKey) && (
                <div className="divide-y divide-slate-800">
                  {day.bookings.map(b => (
                    <div key={b.id} className="flex items-start justify-between px-6 py-2.5 bg-slate-950 hover:bg-slate-900/50">
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          {new Date(b.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{b.clientName}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {b.duration}h
                          {' · '}
                          {b.offlinePaymentMethod === 'cash' ? '💵 Cash' : b.offlinePaymentMethod === 'bank_transfer' ? '🏦 Bank Transfer' : '💳 Other'}
                        </p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="text-sm font-semibold text-amber-300">${b.offlineAmountPaid.toFixed(2)}</p>
                        <p className="text-xs text-slate-400">logged</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {completedBookings.length === 0 && scheduledBookings.count === 0 && (
        <div className="bg-slate-950 rounded-lg shadow-sm p-10 text-center border border-slate-800">
          <Banknote className="h-12 w-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-3">No offline lessons logged yet</p>
          <a href="/dashboard/bookings/new?offline=true" className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">
            Log Your First Offline Lesson
          </a>
        </div>
      )}

      {/* Info box */}
      <div className="bg-slate-950 border border-amber-900/30 rounded-lg p-4">
        <p className="text-xs font-semibold text-amber-300 mb-1">💰 About Offline Lessons</p>
        <ul className="text-xs text-amber-200/80 space-y-1">
          <li>• Record lessons paid directly to you (cash, bank transfer, etc.)</li>
          <li>• You handle payment — DriveBook is not involved</li>
          <li>• Amounts are optional — enter them for your records</li>
          <li>• <strong>Offline earnings DO NOT affect your weekly payout</strong></li>
          <li>• Only platform lessons determine your DriveBook payout</li>
          <li>• Use this to track retention and direct income</li>
        </ul>
      </div>
    </div>
  );
}
