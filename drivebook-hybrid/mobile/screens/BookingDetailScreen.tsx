import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { bookingAPI } from '../services/api';
import { availabilityAPI } from '../services/api';

interface BookingDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  client: {
    name: string;
    phone: string;
    email: string;
  };
  pickupLocation: string;
  dropoffLocation: string;
  checkInTime?: string;
  checkInLocation?: string;
  checkOutTime?: string;
  checkOutLocation?: string;
  actualDuration?: number;
}

export default function BookingDetailScreen({ 
  bookingId, 
  onBack 
}: { 
  bookingId: string; 
  onBack: () => void;
}) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(''); // YYYY-MM-DD
  const [slots, setSlots] = useState<Array<{ time: string; available: boolean }>>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const loadBooking = async () => {
    try {
      const response = await bookingAPI.getById(bookingId);
      setBooking(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for check-in/out');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      return `${location.coords.latitude},${location.coords.longitude}`;
    } catch (error) {
      Alert.alert('Error', 'Failed to get location');
      return null;
    }
  };

  const handleCheckIn = async () => {
    Alert.alert(
      'Check In',
      'Start this lesson now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check In',
          onPress: async () => {
            setActionLoading(true);
            const location = await getCurrentLocation();
            
            if (!location) {
              setActionLoading(false);
              return;
            }

            try {
              await bookingAPI.checkIn(bookingId, { location });
              Alert.alert('Success', 'Checked in successfully!');
              loadBooking();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Check-in failed');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCheckOut = async () => {
    Alert.alert(
      'Check Out',
      'End this lesson now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          onPress: async () => {
            setActionLoading(true);
            const location = await getCurrentLocation();
            
            if (!location) {
              setActionLoading(false);
              return;
            }

            try {
              await bookingAPI.checkOut(bookingId, { location });
              Alert.alert('Success', 'Checked out successfully!');
              loadBooking();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Check-out failed');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const openReschedule = () => {
    setSelectedSlot(null);
    // default to booking start date
    try {
      const start = new Date(booking!.startTime);
      const yyyy = start.getFullYear();
      const mm = String(start.getMonth() + 1).padStart(2, '0');
      const dd = String(start.getDate()).padStart(2, '0');
      setRescheduleDate(`${yyyy}-${mm}-${dd}`);
    } catch (e) {
      const d = new Date();
      setRescheduleDate(d.toISOString().slice(0, 10));
    }
    setRescheduleModalVisible(true);
  };

  const fetchSlotsForDate = async (dateStr: string) => {
    if (!booking) return;
    setSlotLoading(true);
    try {
      // duration expected in minutes by availability API
      const duration = typeof booking.duration === 'number' ? booking.duration : 60;
      const res = await availabilityAPI.getSlots(booking.instructorId || '', dateStr, duration);
      setSlots(res.data.slots || []);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load available slots');
      setSlots([]);
    } finally {
      setSlotLoading(false);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedSlot || !booking) {
      Alert.alert('Validation', 'Please select a time slot');
      return;
    }

    setActionLoading(true);
    try {
      // Create ISO start and end times
      const start = new Date(`${rescheduleDate}T${selectedSlot}`);
      const duration = typeof booking.duration === 'number' ? booking.duration : 60; // minutes
      const end = new Date(start.getTime() + duration * 60000);

      await bookingAPI.reschedule(booking.id, {
        newStartTime: start.toISOString(),
        newEndTime: end.toISOString(),
      });

      Alert.alert('Success', 'Lesson rescheduled');
      setRescheduleModalVisible(false);
      loadBooking();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Reschedule failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Booking not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canCheckIn = booking.status === 'CONFIRMED' && !booking.checkInTime;
  const canCheckOut = booking.checkInTime && !booking.checkOutTime;
  const isCompleted = booking.checkOutTime;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{booking.client.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{booking.client.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{booking.client.email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lesson Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>
              {new Date(booking.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Time:</Text>
            <Text style={styles.value}>
              {booking.startTime} - {booking.endTime}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Duration:</Text>
            <Text style={styles.value}>{booking.duration} hours</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Status:</Text>
            <Text style={[styles.value, styles.statusValue]}>{booking.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Locations</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Pickup:</Text>
            <Text style={styles.value}>{booking.pickupLocation}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Dropoff:</Text>
            <Text style={styles.value}>{booking.dropoffLocation}</Text>
          </View>
        </View>

        {(booking.checkInTime || booking.checkOutTime) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Check-In/Out Status</Text>
            {booking.checkInTime && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Checked In:</Text>
                  <Text style={styles.value}>
                    {new Date(booking.checkInTime).toLocaleTimeString()}
                  </Text>
                </View>
                {booking.checkInLocation && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Location:</Text>
                    <Text style={styles.value} numberOfLines={1}>
                      {booking.checkInLocation}
                    </Text>
                  </View>
                )}
              </>
            )}
            {booking.checkOutTime && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Checked Out:</Text>
                  <Text style={styles.value}>
                    {new Date(booking.checkOutTime).toLocaleTimeString()}
                  </Text>
                </View>
                {booking.checkOutLocation && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Location:</Text>
                    <Text style={styles.value} numberOfLines={1}>
                      {booking.checkOutLocation}
                    </Text>
                  </View>
                )}
                {booking.actualDuration !== undefined && booking.actualDuration !== null && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Actual Duration:</Text>
                    <Text style={styles.value}>
                      {typeof booking.actualDuration === 'number' 
                        ? `${booking.actualDuration.toFixed(2)} hours`
                        : String(booking.actualDuration)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {(canCheckIn || canCheckOut) && (
        <View style={styles.actionContainer}>
          {canCheckIn && (
            <TouchableOpacity
              style={[styles.actionButton, styles.checkInButton]}
              onPress={handleCheckIn}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>✓ Check In</Text>
              )}
            </TouchableOpacity>
          )}
          {canCheckOut && (
            <TouchableOpacity
              style={[styles.actionButton, styles.checkOutButton]}
              onPress={handleCheckOut}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>✓ Check Out</Text>
              )}
            </TouchableOpacity>
          )}
          {/* Reschedule button when lesson is upcoming and not checked in */}
          {booking && booking.status === 'CONFIRMED' && !booking.checkInTime && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
              onPress={openReschedule}
              disabled={actionLoading}
            >
              <Text style={styles.actionButtonText}>Reschedule</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Reschedule Modal (simple) */}
      {rescheduleModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choose a new date</Text>
            <TextInput
              style={styles.input}
              value={rescheduleDate}
              onChangeText={(t) => { setRescheduleDate(t); fetchSlotsForDate(t); }}
              placeholder="YYYY-MM-DD"
            />
            {slotLoading ? (
              <ActivityIndicator />
            ) : (
              <View style={{ maxHeight: 220 }}>
                {slots.length === 0 ? (
                  <Text style={{ color: '#6B7280', marginVertical: 8 }}>No slots available</Text>
                ) : (
                  slots.map((s) => (
                    <TouchableOpacity
                      key={s.time}
                      style={[styles.slotItem, selectedSlot === s.time && styles.slotItemSelected]}
                      onPress={() => setSelectedSlot(s.time)}
                      disabled={!s.available}
                    >
                      <Text style={{ color: s.available ? '#1F2937' : '#9CA3AF' }}>{s.time} {s.available ? '' : '(unavailable)'}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity style={[styles.actionButton, { flex: 1, marginRight: 8 }]} onPress={handleRescheduleSubmit} disabled={actionLoading}>
                <Text style={styles.actionButtonText}>{actionLoading ? 'Please wait...' : 'Confirm'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { flex: 1, backgroundColor: '#6B7280' }]} onPress={() => setRescheduleModalVisible(false)} disabled={actionLoading}>
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 16,
  },
  backBtnText: {
    fontSize: 16,
    color: '#2563EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    width: 100,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  statusValue: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  actionContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  checkInButton: {
    backgroundColor: '#10B981',
  },
  checkOutButton: {
    backgroundColor: '#3B82F6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
