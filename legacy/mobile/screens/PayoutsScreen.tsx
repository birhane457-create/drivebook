import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
} from 'react-native';
import { earningsAPI } from '../services/api';

interface PendingPayout {
  id: string;
  amount: number;
  requestedDate: string;
  status: 'pending' | 'approved' | 'rejected';
  paymentMethod: string;
}

interface PayoutHistory {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
}

interface Props {
  onBack?: () => void;
}

export default function PayoutsScreen({ onBack }: Props) {
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Request payout form
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const [pendingResponse, historyResponse] = await Promise.all([
        earningsAPI.getPendingPayouts(),
        earningsAPI.getPayoutHistory(),
      ]);
      setPendingPayouts(pendingResponse.data);
      setPayoutHistory(historyResponse.data);
    } catch (error: any) {
      console.error('Failed to fetch payouts:', error);
      Alert.alert('Error', 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!requestAmount || parseFloat(requestAmount) <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      await earningsAPI.requestPayout(parseFloat(requestAmount), paymentMethod);
      Alert.alert('Success', 'Payout request submitted!');
      setRequestAmount('');
      setPaymentMethod('bank_transfer');
      setShowRequestModal(false);
      fetchPayouts();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to request payout');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Request Payout Button */}
        <TouchableOpacity
          style={styles.requestButton}
          onPress={() => setShowRequestModal(true)}
        >
          <Text style={styles.requestIcon}>🏦</Text>
          <View style={styles.requestContent}>
            <Text style={styles.requestText}>Request Payout</Text>
            <Text style={styles.requestSubtext}>Withdraw your earnings</Text>
          </View>
          <Text style={styles.requestArrow}>›</Text>
        </TouchableOpacity>

        {/* Pending Payouts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏳ Pending Payouts</Text>
          {pendingPayouts.length === 0 ? (
            <Text style={styles.emptyText}>No pending payouts</Text>
          ) : (
            pendingPayouts.map((payout) => (
              <View key={payout.id} style={styles.payoutCard}>
                <View style={styles.payoutHeader}>
                  <View>
                    <Text style={styles.payoutAmount}>£{payout.amount}</Text>
                    <Text style={styles.payoutMethod}>{payout.paymentMethod}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    payout.status === 'pending' && styles.statusPending,
                    payout.status === 'approved' && styles.statusApproved,
                    payout.status === 'rejected' && styles.statusRejected,
                  ]}>
                    <Text style={styles.statusText}>{payout.status}</Text>
                  </View>
                </View>
                <Text style={styles.payoutDate}>Requested: {payout.requestedDate}</Text>
              </View>
            ))
          )}
        </View>

        {/* Payout History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Payout History</Text>
          {payoutHistory.length === 0 ? (
            <Text style={styles.emptyText}>No payout history</Text>
          ) : (
            payoutHistory.map((history) => (
              <View key={history.id} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyAmount}>£{history.amount}</Text>
                  <Text style={styles.historyMethod}>{history.method}</Text>
                  <Text style={styles.historyDate}>{history.date}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyRef}>{history.reference}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* How it Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❓ How Payouts Work</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>1</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Request Payment</Text>
              <Text style={styles.infoDesc}>Submit a payout request for your available earnings</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>2</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>We Process It</Text>
              <Text style={styles.infoDesc}>Our team reviews and approves within 2-3 business days</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>3</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Money In Your Account</Text>
              <Text style={styles.infoDesc}>Funds are transferred to your bank account</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Request Payout Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Request Payout</Text>
              <View style={{ width: 30 }} />
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Amount (£)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={requestAmount}
                  onChangeText={setRequestAmount}
                  keyboardType="decimal-pad"
                  editable={!submitting}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Payment Method</Text>
                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[
                      styles.methodOption,
                      paymentMethod === 'bank_transfer' && styles.methodOptionActive,
                    ]}
                    onPress={() => setPaymentMethod('bank_transfer')}
                    disabled={submitting}
                  >
                    <Text style={styles.methodIcon}>🏦</Text>
                    <Text style={styles.methodLabel}>Bank Transfer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.methodOption,
                      paymentMethod === 'paypal' && styles.methodOptionActive,
                    ]}
                    onPress={() => setPaymentMethod('paypal')}
                    disabled={submitting}
                  >
                    <Text style={styles.methodIcon}>💳</Text>
                    <Text style={styles.methodLabel}>PayPal</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Conditions</Text>
                <View style={styles.infoBox}>
                  <Text style={styles.infoBullet}>
                    • Minimum payout amount: £50
                  </Text>
                  <Text style={styles.infoBullet}>
                    • Processing time: 2-3 business days
                  </Text>
                  <Text style={styles.infoBullet}>
                    • Bank fees may apply (varies by method)
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowRequestModal(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, (!requestAmount || submitting) && styles.submitBtnDisabled]}
                onPress={handleRequestPayout}
                disabled={!requestAmount || submitting}
              >
                <Text style={styles.submitBtnText}>
                  {submitting ? 'Submitting...' : 'Request Payout'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  content: {
    flex: 1,
    padding: 16,
  },
  requestButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  requestIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  requestContent: {
    flex: 1,
  },
  requestText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  requestSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  requestArrow: {
    fontSize: 20,
    color: '#D1D5DB',
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
  payoutCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  payoutAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  payoutMethod: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusApproved: {
    backgroundColor: '#DBEAFE',
  },
  statusRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  payoutDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  historyCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyLeft: {
    flex: 1,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  historyMethod: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  historyDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  historyRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  historyRef: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DBEAFE',
    color: '#0369A1',
    fontWeight: 'bold',
    textAlign: 'center',
    paddingTop: 3,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    paddingVertical: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalClose: {
    fontSize: 24,
    color: '#9CA3AF',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalBody: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  methodOption: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  methodOptionActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  methodIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  methodLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoBullet: {
    fontSize: 12,
    color: '#1F2937',
    marginBottom: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
