import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { pdaTestsAPI } from '../services/api';

interface PDATest {
  id: string;
  testDate: string;
  testTime: string;
  testCenterName: string;
  testCenterAddress: string;
  result: string;
  notes?: string;
  client: {
    name: string;
    phone: string;
    email: string;
  };
}

export default function PDATestsScreen() {
  const [tests, setTests] = useState<PDATest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const response = await pdaTestsAPI.getAll();
      setTests(response.data);
    } catch (error) {
      console.error('Failed to fetch PDA tests:', error);
      Alert.alert('Error', 'Failed to load PDA tests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTests();
  };

  const handleUpdateResult = (test: PDATest, result: 'PASS' | 'FAIL') => {
    Alert.alert(
      'Update Test Result',
      `Mark test as ${result}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await pdaTestsAPI.updateResult(test.id, result);
              await fetchTests();
              Alert.alert('Success', `Test marked as ${result}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to update test result');
            }
          },
        },
      ]
    );
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'PASS': return '✓';
      case 'FAIL': return '✕';
      default: return '⏱';
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'PASS': return styles.resultPass;
      case 'FAIL': return styles.resultFail;
      default: return styles.resultPending;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading PDA tests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PDA Tests ({tests.length})</Text>
        <TouchableOpacity
          style={styles.newTestButton}
          onPress={() => {
            // Navigate to new booking screen with PDA_TEST type pre-selected
            Alert.alert(
              'Create PDA Test',
              'Go to Bookings → New Booking and select "PDA Test" as the booking type.',
              [{ text: 'OK' }]
            );
          }}
        >
          <Text style={styles.newTestButtonText}>+ New Test</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyTitle}>No PDA tests scheduled</Text>
            <Text style={styles.emptyText}>Schedule your first test to get started</Text>
          </View>
        ) : (
          tests.map((test) => {
            const isExpanded = expandedId === test.id;
            const testDate = new Date(test.testDate);

            return (
              <View key={test.id} style={styles.testCard}>
                {/* Compact View */}
                <TouchableOpacity
                  style={styles.testHeader}
                  onPress={() => setExpandedId(isExpanded ? null : test.id)}
                >
                  <View style={styles.testHeaderLeft}>
                    <View style={[styles.resultIcon, getResultColor(test.result)]}>
                      <Text style={styles.resultIconText}>{getResultIcon(test.result)}</Text>
                    </View>
                    <View style={styles.testHeaderInfo}>
                      <View style={styles.testHeaderRow}>
                        <Text style={styles.clientName}>{test.client.name}</Text>
                        <View style={[styles.resultBadge, getResultColor(test.result)]}>
                          <Text style={styles.resultBadgeText}>{test.result}</Text>
                        </View>
                      </View>
                      <View style={styles.testMetaRow}>
                        <Text style={styles.testMeta}>
                          📅 {testDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        <Text style={styles.testMeta}>⏰ {test.testTime}</Text>
                      </View>
                      <Text style={styles.testCenter} numberOfLines={1}>
                        {test.testCenterName}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={styles.testDetails}>
                    {/* Student Details */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Student Details</Text>
                      <Text style={styles.detailText}>{test.client.name}</Text>
                      <Text style={styles.detailText}>📞 {test.client.phone}</Text>
                      <Text style={styles.detailText}>✉️ {test.client.email}</Text>
                    </View>

                    {/* Test Details */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Test Details</Text>
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Date: </Text>
                        {testDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Time: </Text>
                        {test.testTime}
                      </Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Result: </Text>
                        <View style={[styles.resultBadge, getResultColor(test.result)]}>
                          <Text style={styles.resultBadgeText}>{test.result}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Test Center */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Test Center</Text>
                      <Text style={styles.detailTextBold}>{test.testCenterName}</Text>
                      <Text style={styles.detailText}>📍 {test.testCenterAddress}</Text>
                    </View>

                    {/* Notes */}
                    {test.notes && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Notes</Text>
                        <Text style={styles.detailTextItalic}>{test.notes}</Text>
                      </View>
                    )}

                    {/* Update Result Buttons */}
                    {test.result === 'PENDING' && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.passButton]}
                          onPress={() => handleUpdateResult(test, 'PASS')}
                        >
                          <Text style={styles.actionButtonText}>✓ Mark as Pass</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.failButton]}
                          onPress={() => handleUpdateResult(test, 'FAIL')}
                        >
                          <Text style={styles.actionButtonText}>✕ Mark as Fail</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  newTestButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  newTestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
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
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  testCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  testHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIconText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  testHeaderInfo: {
    flex: 1,
  },
  testHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  testMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  testMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  testCenter: {
    fontSize: 12,
    color: '#6B7280',
  },
  expandIcon: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  testDetails: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#F9FAFB',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailTextBold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  detailTextItalic: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  detailLabel: {
    fontWeight: '600',
    color: '#374151',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  passButton: {
    backgroundColor: '#10B981',
  },
  failButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultPass: {
    backgroundColor: '#D1FAE5',
  },
  resultFail: {
    backgroundColor: '#FEE2E2',
  },
  resultPending: {
    backgroundColor: '#FEF3C7',
  },
});
