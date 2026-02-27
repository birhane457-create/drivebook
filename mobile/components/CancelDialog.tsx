import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { clientAPI } from '../services/api';

interface CancelDialogProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  instructorName: string;
  bookingDate: string;
  bookingPrice: number;
  onSuccess?: () => void;
}

export default function CancelDialog({
  visible,
  onClose,
  bookingId,
  instructorName,
  bookingDate,
  bookingPrice,
  onSuccess,
}: CancelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundInfo = useMemo(() => {
    const now = new Date();
    const bookingTime = new Date(bookingDate);
    const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil >= 48) {
      return {
        percentage: 100,
        amount: bookingPrice,
        notice: '48+ hours',
      };
    } else if (hoursUntil >= 24) {
      return {
        percentage: 50,
        amount: bookingPrice * 0.5,
        notice: '24-48 hours',
      };
    } else {
      return {
        percentage: 0,
        amount: 0,
        notice: '<24 hours',
      };
    }
  }, [bookingDate, bookingPrice]);

  const handleCancel = async () => {
    try {
      setLoading(true);
      setError(null);
      await clientAPI.cancelBooking(bookingId);
      Alert.alert(
        'Success',
        'Booking cancelled successfully!',
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
      setError(err.response?.data?.error || 'Failed to cancel booking');
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
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.headerTitle}>Cancel Booking?</Text>
              <Text style={styles.headerSubtitle}>This action cannot be undone</Text>
            </View>

            {/* Booking Details */}
            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Instructor</Text>
                <Text style={styles.detailValue}>{instructorName}</Text>
              </View>
              <View style={[styles.detailRow, styles.divider]}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {new Date(bookingDate).toLocaleDateString()} {new Date(bookingDate).toLocaleTimeString()}
                </Text>
              </View>
              <View style={[styles.detailRow, styles.divider]}>
                <Text style={styles.detailLabel}>Original Price</Text>
                <Text style={styles.detailValue}>${bookingPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Cancellation Notice</Text>
                <Text style={styles.detailValue}>{refundInfo.notice}</Text>
              </View>
            </View>

            {/* Refund Policy */}
            <View style={styles.refundBox}>
              <Text style={styles.refundTitle}>💰 Refund Policy</Text>
              <View style={styles.refundDetails}>
                <View style={styles.refundRow}>
                  <Text style={styles.refundLabel}>Refund Percentage:</Text>
                  <Text style={styles.refundValue}>{refundInfo.percentage}%</Text>
                </View>
                <View style={[styles.refundRow, styles.refundRowHighlight]}>
                  <Text style={styles.refundLabelBold}>Refund Amount:</Text>
                  <Text style={styles.refundAmountBold}>${refundInfo.amount.toFixed(2)}</Text>
                </View>
              </View>
              <Text style={styles.refundNote}>
                Refunds are processed to your original payment method within 3-5 business days.
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.keepButton]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.keepButtonText}>Keep Booking</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.cancelButtonText}>Yes, Cancel Booking</Text>
                )}
              </TouchableOpacity>
            </View>
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
    alignItems: 'center',
    marginBottom: 24,
  },
  warningIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  detailsBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  refundBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  refundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  refundDetails: {
    marginBottom: 12,
  },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  refundRowHighlight: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  refundLabel: {
    fontSize: 14,
    color: '#1F2937',
  },
  refundValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  refundLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  refundAmountBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  refundNote: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
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
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  keepButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  keepButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
