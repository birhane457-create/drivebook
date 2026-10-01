import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { clientAPI } from '../services/api';

interface RescheduleModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  currentDate: string;
  currentTime: string;
  instructorName: string;
  onSuccess?: () => void;
}

export default function RescheduleModal({
  visible,
  onClose,
  bookingId,
  currentDate,
  currentTime,
  instructorName,
  onSuccess,
}: RescheduleModalProps) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReschedule = async () => {
    setError(null);

    if (!newDate || !newTime) {
      setError('Please enter both date and time');
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) {
      setError('Date format should be YYYY-MM-DD');
      return;
    }

    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(newTime)) {
      setError('Time format should be HH:MM');
      return;
    }

    const selectedDate = new Date(newDate);
    const today = new Date();
    
    if (selectedDate < today) {
      setError('Cannot reschedule to a past date');
      return;
    }

    const hoursUntil = (selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60);
    if (hoursUntil < 24) {
      setError('You must reschedule at least 24 hours in advance');
      return;
    }

    try {
      setLoading(true);
      await clientAPI.rescheduleBooking(bookingId, {
        newDate,
        newTime,
      });
      Alert.alert(
        'Success',
        'Booking rescheduled successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess?.();
              onClose();
            }
          }
        ]
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reschedule booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Reschedule Booking</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Current Booking Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Current Booking</Text>
              <Text style={styles.infoValue}>{instructorName}</Text>
              <Text style={styles.infoDate}>
                {currentDate} at {currentTime}
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>New Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2026-02-25"
                  value={newDate}
                  onChangeText={setNewDate}
                  editable={!loading}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>New Time (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="14:30"
                  value={newTime}
                  onChangeText={setNewTime}
                  editable={!loading}
                  placeholderTextColor="#999"
                />
              </View>

              <Text style={styles.hint}>Must be at least 24 hours from now</Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.submitButton]}
                onPress={handleReschedule}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Confirm Reschedule</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.note}>
              Confirmation emails will be sent to you and {instructorName}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  closeBtn: {
    fontSize: 24,
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  infoDate: {
    fontSize: 14,
    color: '#666',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  form: {
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  note: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
