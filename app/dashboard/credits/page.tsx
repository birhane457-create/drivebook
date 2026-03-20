'use client';

import { useEffect, useState } from 'react';
import { Star, Users, TrendingUp, DollarSign, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface BonusTransaction {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  status: string;
}

interface BonusSummary {
  totalBonusEarned: number;
  newStudentBonuses: number;
  bonusTransactions: BonusTransaction[];
  newStudentCount: number;
}

export default function InstructorCreditsPage() {
  const [data, setData] = useState<BonusSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/instructor/earnings')
      .then(r => r.json())
      .then(d => {
        // Filter bonus-related transactions from earnings
        const bonusTxs: BonusTransaction[] = (d.transactions ?? []).filter((tx: any) =>
          tx.description?.toLowerCase().includes('bonus') ||
          tx.description?.toLowerCase().includes('new student')
        );
        const totalBonus = bonusTxs.reduce((sum: number, tx: any) => sum + (tx.instructorPayout ?? tx.amount ?? 0), 0);
        setData({
          totalBonusEarned: totalBonus,
          newStudentBonuses: bonusTxs.length,
          bonusTransactions: bonusTxs,
          newStudentCount: d.newStudentCount ?? 0,
        });
      })
      .catch(() => setData({ totalBonusEarned: 0, newStudentBonuses: 0, bonusTransactions: [], newStudentCount: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Bonuses & Credits</h1>
          <p className="text-gray-500 mt-1">New student bonuses and referral rewards earned through your subscription tier</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-yellow-100 rounded-lg p-2">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-sm text-gray-500">Total Bonuses Earned</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">${(data?.totalBonusEarned ?? 0).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 rounded-lg p-2">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-500">New Student Bonuses</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{data?.newStudentBonuses ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 rounded-lg p-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-500">New Students This Month</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{data?.newStudentCount ?? 0}</p>
          </div>
        </div>

        {/* How bonuses work */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h2 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> How Bonuses Work
          </h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li> New student bonuses are paid per first-time booking on your subscription tier</li>
            <li> Basic tier: bonus per new student as set by platform</li>
            <li> Pro & Business tiers: higher bonus rates  upgrade to earn more</li>
            <li> Bonuses are included in your regular payout cycle</li>
          </ul>
          <div className="mt-4 flex gap-3">
            <Link href="/dashboard/subscription" className="text-sm text-blue-700 font-medium hover:underline flex items-center gap-1">
              View your subscription tier <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/dashboard/earnings" className="text-sm text-blue-700 font-medium hover:underline flex items-center gap-1">
              Full earnings breakdown <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Bonus transaction history */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Bonus History</h2>
          </div>
          {(data?.bonusTransactions?.length ?? 0) === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No bonus transactions yet</p>
              <p className="text-sm mt-1">Bonuses appear here when you onboard new students</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data!.bonusTransactions.map(tx => (
                <div key={tx.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">+${tx.amount.toFixed(2)}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
