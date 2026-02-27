import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { earningsAPI } from '../services/api';

interface EarningsSummary {
  totalEarnings: number;
  pendingEarnings: number;
  thisMonthEarnings: number;
  totalLessons: number;
  averageRating: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'earning' | 'payout' | 'fee' | 'refund';
  status: 'completed' | 'pending' | 'failed';
}

interface Props {
  onNavigate?: (screen: string) => void;
}

export default function EarningsScreen({ onNavigate }: Props) {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    fetchEarnings();
  }, [period]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const [summaryResponse, transactionsResponse] = await Promise.all([
        earningsAPI.getSummary(),
        earningsAPI.getTransactions(20),
      ]);
      setSummary(summaryResponse.data);
      setTransactions(transactionsResponse.data);
    } catch (error: any) {
      console.error('Failed to fetch earnings:', error);
      Alert.alert('Error', 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load earnings</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchEarnings}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Main Earnings Card */}
      <View style={styles.earningsCard}>
        <View style={styles.earningsCardContent}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <View style={styles.earningsAmount}>
            <Text style={styles.earningsValue}>£{summary.totalEarnings.toLocaleString()}</Text>
          </View>
          <Text style={styles.earningsSubtitle}>Lifetime earnings</Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💰</Text>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statValue}>£{summary.pendingEarnings}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={styles.statLabel}>This Month</Text>
          <Text style={styles.statValue}>£{summary.thisMonthEarnings}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📚</Text>
          <Text style={styles.statLabel}>Lessons</Text>
          <Text style={styles.statValue}>{summary.totalLessons}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⭐</Text>
          <Text style={styles.statLabel}>Rating</Text>
          <Text style={styles.statValue}>{summary.averageRating}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onNavigate?.('payouts')}
        >
          <Text style={styles.actionIcon}>🏦</Text>
          <Text style={styles.actionText}>Request Payout</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={fetchEarnings}
        >
          <Text style={styles.actionIcon}>🔄</Text>
          <Text style={styles.actionText}>Refresh Data</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Period Filter */}
      <View style={styles.periodFilter}>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'week' && styles.periodBtnActive]}
          onPress={() => setPeriod('week')}
        >
          <Text style={[styles.periodBtnText, period === 'week' && styles.periodBtnTextActive]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.periodBtnText, period === 'month' && styles.periodBtnTextActive]}>
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'year' && styles.periodBtnActive]}
          onPress={() => setPeriod('year')}
        >
          <Text style={[styles.periodBtnText, period === 'year' && styles.periodBtnTextActive]}>
            Year
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Recent Transactions</Text>

        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions yet</Text>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.transactionItem}>
              <View style={styles.txLeft}>
                <Text style={styles.txIcon}>
                  {tx.type === 'earning' ? '💵' :
                   tx.type === 'payout' ? '💸' :
                   tx.type === 'fee' ? '⚠️' :
                   '↩️'}
                </Text>
                <View style={styles.txInfo}>
                  <Text style={styles.txDescription}>{tx.description}</Text>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
              </View>
              <View style={styles.txRight}>
                <Text style={[
                  styles.txAmount,
                  (tx.type === 'earning' || tx.type === 'refund') ? styles.txAmountPositive : styles.txAmountNegative
                ]}>
                  {(tx.type === 'earning' || tx.type === 'refund') ? '+' : '-'}£{Math.abs(tx.amount)}
                </Text>
                <Text style={[styles.txStatus, 
                  tx.status === 'completed' ? styles.txStatusCompleted :
                  tx.status === 'pending' ? styles.txStatusPending :
                  styles.txStatusFailed
                ]}>
                  {tx.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsCard: {
    backgroundColor: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    elevation: 3,
  },
  earningsCardContent: {
    alignItems: 'center',
  },
  earningsLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  earningsAmount: {
    marginBottom: 8,
  },
  earningsValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  earningsSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  actionsContainer: {
    marginBottom: 20,
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionIcon: {
    fontSize: 20,
  },
  actionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  actionArrow: {
    fontSize: 20,
    color: '#D1D5DB',
  },
  periodFilter: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: '#3B82F6',
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodBtnTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  transactionItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  txAmountPositive: {
    color: '#10B981',
  },
  txAmountNegative: {
    color: '#EF4444',
  },
  txStatus: {
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  txStatusCompleted: {
    backgroundColor: '#DBEAFE',
    color: '#0369A1',
  },
  txStatusPending: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  txStatusFailed: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    paddingVertical: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
