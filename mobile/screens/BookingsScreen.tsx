import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { bookingAPI } from '../services/api';

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingType: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  price: number;
  notes?: string;
  client: {
    name: string;
    phone: string;
    email: string;
  };
  checkInTime?: string;
  checkOutTime?: string;
}

export default function BookingsScreen({ onSelectBooking, onNewBooking }: { onSelectBooking: (id: string) => void; onNewBooking: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadBookings = async () => {
    try {
      const response = await bookingAPI.getAll();
      // Ensure response.data is an array
      const bookingsData = Array.isArray(response.data) ? response.data : [];
      setBookings(bookingsData);
    } catch (error: any) {
      console.error('Load bookings error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const getFilteredBookings = () => {
    if (!Array.isArray(bookings)) {
      console.error('Bookings is not an array:', bookings);
      return [];
    }

    return bookings.filter(booking => {
      // Safety check for required fields
      if (!booking || !booking.client || !booking.startTime) {
        console.warn('Invalid booking data:', booking);
        return false;
      }

      // Search filter
      const matchesSearch = booking.client.name?.toLowerCase().includes(search.toLowerCase());
      
      // Date filter
      const bookingDate = new Date(booking.startTime);
      const now = new Date();
      
      if (filter === 'upcoming') {
        return bookingDate >= now && matchesSearch;
      }
      if (filter === 'past') {
        return bookingDate < now && matchesSearch;
      }
      return matchesSearch; // 'all'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return '#10B981'; // green
      case 'PENDING': return '#F59E0B'; // yellow
      case 'COMPLETED': return '#3B82F6'; // blue
      case 'CANCELLED': return '#EF4444'; // red
      default: return '#6B7280'; // gray
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Booking',
      'Are you sure you want to permanently delete this booking? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingAPI.cancel(id, { reason: 'Deleted by instructor' });
              Alert.alert('Success', 'Booking deleted successfully');
              loadBookings();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete booking');
            }
          }
        }
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderBooking = ({ item }: { item: Booking }) => {
    const isExpanded = expandedId === item.id;
    const statusColor = getStatusColor(item.status);
    const bookingDate = new Date(item.startTime);
    const endDate = new Date(item.endTime);
    const startTime = bookingDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Check-in/out status
    const canCheckIn = item.status === 'CONFIRMED' && !item.checkInTime;
    const canCheckOut = item.checkInTime && !item.checkOutTime;

    return (
      <View style={styles.bookingCard}>
        {/* Compact Row */}
        <TouchableOpacity
          style={styles.bookingHeader}
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.clientName} numberOfLines={1}>{item.client?.name || 'Unknown'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                  <Text style={styles.statusText}>{item.status || 'PENDING'}</Text>
                </View>
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailText}>
                  📅 {bookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={styles.detailText}>
                  🕐 {startTime} - {endTime}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.priceText}>${item.price || 0}</Text>
            <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {/* Check-in/out Quick Actions (Always Visible) */}
        {(canCheckIn || canCheckOut) && !isExpanded && (
          <View style={styles.quickActions}>
            {canCheckIn && (
              <TouchableOpacity
                style={[styles.quickActionButton, styles.checkInQuickButton]}
                onPress={() => onSelectBooking(item.id)}
              >
                <Text style={styles.quickActionText}>✓ Ready to Check In</Text>
              </TouchableOpacity>
            )}
            {canCheckOut && (
              <TouchableOpacity
                style={[styles.quickActionButton, styles.checkOutQuickButton]}
                onPress={() => onSelectBooking(item.id)}
              >
                <Text style={styles.quickActionText}>✓ Ready to Check Out</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Expanded Details */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.detailsGrid}>
              {/* Client Details */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Client Details</Text>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>👤</Text>
                  <Text style={styles.detailValue}>{item.client?.name || 'Unknown'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>📞</Text>
                  <Text style={styles.detailValue}>{item.client?.phone || 'N/A'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>✉️</Text>
                  <Text style={styles.detailValue}>{item.client?.email || 'N/A'}</Text>
                </View>
              </View>

              {/* Booking Details */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Booking Details</Text>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {bookingDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Time:</Text>
                  <Text style={styles.detailValue}>{startTime} - {endTime}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>
                    {item.bookingType ? item.bookingType.replace('_', ' ') : 'Standard Lesson'}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Price:</Text>
                  <Text style={styles.detailValue}>${item.price || 0}</Text>
                </View>
              </View>
            </View>

            {/* Locations */}
            {(item.pickupAddress || item.dropoffAddress) && (
              <View style={styles.locationSection}>
                <Text style={styles.detailSectionTitle}>Locations</Text>
                {item.pickupAddress && (
                  <View style={styles.locationItem}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <View style={styles.locationContent}>
                      <Text style={styles.locationLabel}>Pickup</Text>
                      <Text style={styles.locationAddress}>{item.pickupAddress}</Text>
                    </View>
                  </View>
                )}
                {item.dropoffAddress && (
                  <View style={styles.locationItem}>
                    <Text style={styles.locationIcon}>🔴</Text>
                    <View style={styles.locationContent}>
                      <Text style={styles.locationLabel}>Dropoff</Text>
                      <Text style={styles.locationAddress}>{item.dropoffAddress}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Notes */}
            {item.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.detailSectionTitle}>Notes</Text>
                <Text style={styles.notesText}>{item.notes}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => onSelectBooking(item.id)}
              >
                <Text style={styles.viewButtonText}>
                  {canCheckIn || canCheckOut ? '📋 View & Check-In/Out' : '📋 View Details'}
                </Text>
              </TouchableOpacity>
              {item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  const filteredBookings = getFilteredBookings();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Bookings ({bookings.length})</Text>
          </View>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={onNewBooking}
          >
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by client name..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'upcoming' && styles.filterButtonActive]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[styles.filterText, filter === 'upcoming' && styles.filterTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'past' && styles.filterButtonActive]}
          onPress={() => setFilter('past')}
        >
          <Text style={[styles.filterText, filter === 'past' && styles.filterTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {filteredBookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No bookings found</Text>
          <Text style={styles.emptySubtext}>
            {search ? 'Try a different search term' : 'Create your first booking to get started'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBooking}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2563EB',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 12,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  expandIcon: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  quickActions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  quickActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkInQuickButton: {
    backgroundColor: '#10B981',
  },
  checkOutQuickButton: {
    backgroundColor: '#3B82F6',
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#F9FAFB',
  },
  detailsGrid: {
    gap: 16,
    marginBottom: 16,
  },
  detailSection: {
    gap: 8,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailIcon: {
    fontSize: 14,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    minWidth: 50,
  },
  detailValue: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  locationSection: {
    gap: 8,
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationIcon: {
    fontSize: 14,
    marginTop: 2,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  locationAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesText: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
