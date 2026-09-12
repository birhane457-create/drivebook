import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { analyticsAPI } from '../services/api';

interface Analytics {
  period: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  revenue: number;
  newClients: number;
  averageRating: number;
}

export default function AnalyticsScreen() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      const response = await analyticsAPI.get(period);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const completionRate = analytics && analytics.totalBookings > 0
    ? Math.round((analytics.completedBookings / analytics.totalBookings) * 100)
    : 0;

  const avgRevenuePerBooking = analytics && analytics.totalBookings > 0
    ? (analytics.revenue / analytics.totalBookings).toFixed(2)
    : '0.00';

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.periodButtons}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
            onPress={() => setPeriod('week')}
          >
            <Text style={[styles.periodButtonText, period === 'week' && styles.periodButtonTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
            onPress={() => setPeriod('month')}
          >
            <Text style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'year' && styles.periodButtonActive]}
            onPress={() => setPeriod('year')}
          >
            <Text style={[styles.periodButtonText, period === 'year' && styles.periodButtonTextActive]}>
              Year
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Revenue Card */}
        <View style={[styles.card, styles.revenueCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.greenCircle]}>
              <Text style={styles.iconText}>💰</Text>
            </View>
            <Text style={styles.trendIcon}>📈</Text>
          </View>
          <Text style={styles.cardLabel}>Total Revenue</Text>
          <Text style={styles.cardValue}>${analytics?.revenue.toFixed(2) || '0.00'}</Text>
        </View>

        {/* Bookings Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.blueCircle]}>
              <Text style={styles.iconText}>📅</Text>
            </View>
          </View>
          <Text style={styles.cardLabel}>Total Bookings</Text>
          <Text style={styles.cardValue}>{analytics?.totalBookings || 0}</Text>
          <Text style={styles.cardSubtext}>
            {analytics?.completedBookings || 0} completed
          </Text>
        </View>

        {/* New Clients Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.purpleCircle]}>
              <Text style={styles.iconText}>👥</Text>
            </View>
          </View>
          <Text style={styles.cardLabel}>New Clients</Text>
          <Text style={styles.cardValue}>{analytics?.newClients || 0}</Text>
        </View>

        {/* Rating Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.yellowCircle]}>
              <Text style={styles.iconText}>⭐</Text>
            </View>
          </View>
          <Text style={styles.cardLabel}>Average Rating</Text>
          <Text style={styles.cardValue}>{analytics?.averageRating.toFixed(1) || '0.0'}</Text>
          <View style={styles.stars}>
            {[...Array(5)].map((_, i) => (
              <Text key={i} style={styles.star}>★</Text>
            ))}
          </View>
        </View>

        {/* Completion Rate Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.greenCircle]}>
              <Text style={styles.iconText}>✓</Text>
            </View>
          </View>
          <Text style={styles.cardLabel}>Completion Rate</Text>
          <Text style={styles.cardValue}>{completionRate}%</Text>
        </View>

        {/* Cancelled Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.redCircle]}>
              <Text style={styles.iconText}>✕</Text>
            </View>
          </View>
          <Text style={styles.cardLabel}>Cancelled</Text>
          <Text style={styles.cardValue}>{analytics?.cancelledBookings || 0}</Text>
        </View>

        {/* Performance Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Performance Summary</Text>
          
          <View style={styles.summaryItem}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Completion Rate</Text>
              <Text style={styles.summaryValue}>{completionRate}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
            </View>
          </View>

          <View style={styles.summaryItem}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Avg Revenue per Booking</Text>
              <Text style={styles.summaryValue}>${avgRevenuePerBooking}</Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bookings per Client</Text>
              <Text style={styles.summaryValue}>
                {analytics && analytics.newClients > 0
                  ? (analytics.totalBookings / analytics.newClients).toFixed(1)
                  : '0'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#2563EB',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  revenueCard: {
    backgroundColor: '#F0FDF4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greenCircle: {
    backgroundColor: '#D1FAE5',
  },
  blueCircle: {
    backgroundColor: '#DBEAFE',
  },
  purpleCircle: {
    backgroundColor: '#E9D5FF',
  },
  yellowCircle: {
    backgroundColor: '#FEF3C7',
  },
  redCircle: {
    backgroundColor: '#FEE2E2',
  },
  iconText: {
    fontSize: 24,
  },
  trendIcon: {
    fontSize: 20,
  },
  cardLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  cardSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  stars: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 2,
  },
  star: {
    fontSize: 16,
    color: '#FBBF24',
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryItem: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
});
