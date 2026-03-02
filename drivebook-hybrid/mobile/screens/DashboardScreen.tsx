import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { dashboardAPI } from '../services/api';

interface DashboardStats {
  upcomingLessons: number;
  totalClients: number;
  monthlyRevenue: number;
  hourlyRate: number;
  upcomingBookings: Array<{
    id: string;
    clientName: string;
    date: string;
    time: string;
    location: string;
  }>;
  recentClients: Array<{
    id: string;
    name: string;
    phone: string;
    email: string;
  }>;
}

export default function DashboardScreen({ 
  onSelectBooking,
  onSelectClient,
  onNavigate 
}: { 
  onSelectBooking: (id: string) => void;
  onSelectClient?: (id: string) => void;
  onNavigate: (screen: 'bookings' | 'clients' | 'tests' | 'analytics' | 'profile' | 'settings') => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error: any) {
      console.error('Load dashboard error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to load dashboard';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
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
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Your driving school overview</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statInner}>
            <View>
              <Text style={styles.statValue}>{stats.upcomingLessons}</Text>
              <Text style={styles.statLabel}>Upcoming Lessons</Text>
            </View>
            <Text style={styles.statIcon}>📅</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statInner}>
            <View>
              <Text style={styles.statValue}>{stats.totalClients}</Text>
              <Text style={styles.statLabel}>Total Clients</Text>
            </View>
            <Text style={styles.statIcon}>👥</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statInner}>
            <View>
              <Text style={styles.statValue}>${Number(stats.monthlyRevenue).toLocaleString()}</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
            <Text style={styles.statIcon}>📈</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statInner}>
            <View>
              <Text style={styles.statValue}>${Number(stats.hourlyRate).toFixed(2)}</Text>
              <Text style={styles.statLabel}>Hourly Rate</Text>
            </View>
            <Text style={styles.statIcon}>💲</Text>
          </View>
        </View>
      </View>

        <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Upcoming Lessons</Text>
          <TouchableOpacity onPress={() => onNavigate('bookings')}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {stats.upcomingBookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No upcoming lessons</Text>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            {stats.upcomingBookings.map((booking) => (
              <TouchableOpacity
                key={booking.id}
                style={styles.bookingItem}
                onPress={() => onSelectBooking(booking.id)}
              >
                <View style={styles.bookingIndicator} />
                <View style={styles.bookingContent}>
                  <Text style={styles.bookingClient}>{booking.clientName}</Text>
                  <Text style={styles.bookingTime}>{booking.date} • {booking.time}</Text>
                  {booking.location && (
                    <Text style={styles.bookingLocation} numberOfLines={1}>
                      📍 {booking.location}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Clients</Text>
          <TouchableOpacity onPress={() => onNavigate('clients')}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {stats.recentClients.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No clients yet</Text>
            <TouchableOpacity onPress={() => onNavigate('clients')}>
              <Text style={styles.emptyLink}>Add your first client</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.clientsList}>
            {stats.recentClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={styles.clientItem}
                onPress={() => { onSelectClient ? onSelectClient(client.id) : onNavigate('clients'); }}
              >
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientAvatarText}>
                    {client.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.clientContent}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <Text style={styles.clientPhone}>{client.phone}</Text>
                  {client.email && (
                    <Text style={styles.clientEmail} numberOfLines={1}>
                      {client.email}
                    </Text>
                  )}
                </View>
                <Text style={styles.clientArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.quickActionsSection}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => onNavigate('bookings')}
          >
            <Text style={styles.quickActionIcon}>📅</Text>
            <Text style={styles.quickActionText}>New Booking</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => onNavigate('clients')}
          >
            <Text style={styles.quickActionIcon}>👥</Text>
            <Text style={styles.quickActionText}>Add Client</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => onNavigate('profile')}
          >
            <Text style={styles.quickActionIcon}>🚗</Text>
            <Text style={styles.quickActionText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => onNavigate('settings')}
          >
            <Text style={styles.quickActionIcon}>⚙️</Text>
            <Text style={styles.quickActionText}>Settings</Text>
          </TouchableOpacity>
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
  errorText: {
    fontSize: 16,
    color: '#EF4444',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  statIcon: {
    fontSize: 28,
    marginLeft: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  quickActionsSection: {
    marginTop: 12,
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  quickActionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    padding: 12,
    borderRadius: 8,
  },
  quickActionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewAllLink: {
    color: '#2563EB',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyLink: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 8,
  },
  bookingsList: {
    gap: 12,
  },
  bookingItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  bookingIndicator: {
    width: 4,
    marginRight: 12,
  },
  bookingContent: {
    flex: 1,
  },
  bookingClient: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  bookingTime: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  bookingLocation: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  clientsList: {
    gap: 12,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  clientContent: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  clientPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  clientEmail: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  clientArrow: {
    fontSize: 24,
    color: '#9CA3AF',
    marginLeft: 8,
  },
});
