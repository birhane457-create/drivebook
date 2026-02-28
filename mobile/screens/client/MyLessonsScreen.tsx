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
import { clientAPI } from '../../services/api';
import RescheduleModal from '../../components/RescheduleModal';
import CancelDialog from '../../components/CancelDialog';
import ReviewModal from '../../components/ReviewModal';

interface Booking {
  id: string;
  instructorName: string;
  date: string;
  time: string;
  startTime?: string;
  location: string;
  duration: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  price?: number;
  rating?: number;
}

interface Props {
  onSelectBooking?: (bookingId: string) => void;
  onBack?: () => void;
}

export default function MyLessonsScreen({ onSelectBooking, onBack }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [rescheduleModal, setRescheduleModal] = useState<{ isOpen: boolean; booking?: Booking } | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ isOpen: boolean; booking?: Booking } | null>(null);
  const [reviewModal, setReviewModal] = useState<{ isOpen: boolean; booking?: Booking } | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await clientAPI.getBookings();
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      Alert.alert('Error', 'Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = bookings.filter(b => 
    filter === 'all' || b.status === filter
  );

  const renderBookingCard = (booking: Booking) => (
    <TouchableOpacity
      key={booking.id}
      style={[
        styles.bookingCard,
        booking.status === 'cancelled' && styles.bookingCardCancelled,
      ]}
      onPress={() => onSelectBooking?.(booking.id)}
    >
      <View style={styles.bookingHeader}>
        <View>
          <Text style={styles.instructorName}>{booking.instructorName}</Text>
          <Text style={styles.bookingStatus}>
            {booking.status === 'upcoming' ? '🔵 Scheduled' : 
             booking.status === 'completed' ? '✅ Completed' : 
             '❌ Cancelled'}
          </Text>
        </View>
        {booking.rating && (
          <Text style={styles.rating}>⭐ {booking.rating}</Text>
        )}
      </View>

      <View style={styles.bookingDetails}>
        <Text style={styles.detailItem}>📍 {booking.location}</Text>
        <Text style={styles.detailItem}>📅 {booking.date} at {booking.time}</Text>
        <Text style={styles.detailItem}>⏱️ {booking.duration} min</Text>
      </View>

      <View style={styles.bookingActions}>
        {booking.status === 'upcoming' && (
          <>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.rescheduleBtn]}
              onPress={() => setRescheduleModal({ isOpen: true, booking })}
            >
              <Text style={styles.actionBtnText}>📝 Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={() => setCancelDialog({ isOpen: true, booking })}
            >
              <Text style={styles.actionBtnText}>❌ Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {booking.status === 'completed' && !booking.rating && (
          <TouchableOpacity 
            style={[styles.actionBtn, styles.reviewBtn]}
            onPress={() => setReviewModal({ isOpen: true, booking })}
          >
            <Text style={styles.actionBtnText}>💬 Leave Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'upcoming' && styles.filterBtnActive]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[styles.filterBtnText, filter === 'upcoming' && styles.filterBtnTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'completed' && styles.filterBtnActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterBtnText, filter === 'completed' && styles.filterBtnTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {filteredBookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No lessons found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={({ item }) => renderBookingCard(item)}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleModal?.booking && (
        <RescheduleModal
          visible={rescheduleModal.isOpen}
          onClose={() => setRescheduleModal({ isOpen: false })}
          bookingId={rescheduleModal.booking.id}
          currentDate={rescheduleModal.booking.date}
          currentTime={rescheduleModal.booking.time}
          instructorName={rescheduleModal.booking.instructorName}
          onSuccess={fetchBookings}
        />
      )}

      {/* Cancel Dialog */}
      {cancelDialog?.booking && (
        <CancelDialog
          visible={cancelDialog.isOpen}
          onClose={() => setCancelDialog({ isOpen: false })}
          bookingId={cancelDialog.booking.id}
          instructorName={cancelDialog.booking.instructorName}
          bookingDate={cancelDialog.booking.startTime || cancelDialog.booking.date}
          bookingPrice={cancelDialog.booking.price || 0}
          onSuccess={fetchBookings}
        />
      )}

      {/* Review Modal */}
      {reviewModal?.booking && (
        <ReviewModal
          visible={reviewModal.isOpen}
          onClose={() => setReviewModal({ isOpen: false })}
          bookingId={reviewModal.booking.id}
          instructorName={reviewModal.booking.instructorName}
          onSuccess={fetchBookings}
        />
      )}
    </View>
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
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  filterBtnActive: {
    backgroundColor: '#3B82F6',
  },
  filterBtnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  bookingCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  bookingCardCancelled: {
    opacity: 0.6,
    borderLeftColor: '#EF4444',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  bookingStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  bookingDetails: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  detailItem: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  rescheduleBtn: {
    backgroundColor: '#DBEAFE',
  },
  cancelBtn: {
    backgroundColor: '#FEE2E2',
  },
  reviewBtn: {
    backgroundColor: '#FEF3C7',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});
