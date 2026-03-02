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
import { subscriptionAPI } from '../services/api';

interface SubscriptionData {
  current: {
    tier: 'PRO' | 'BUSINESS';
    status: string;
    commissionRate: number;
    newStudentBonus: number;
    subscription: {
      monthlyAmount: number;
      currentPeriodEnd: string;
      trialEndsAt: string | null;
      cancelAtPeriodEnd: boolean;
    } | null;
  };
  pricing: {
    PRO: {
      monthlyPrice: number;
      commissionRate: number;
      features: string[];
    };
    BUSINESS: {
      monthlyPrice: number;
      commissionRate: number;
      features: string[];
    };
  };
}

export default function SubscriptionScreen() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await subscriptionAPI.get();
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      Alert.alert('Error', 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const changeTier = async (tier: 'PRO' | 'BUSINESS') => {
    Alert.alert(
      'Change Plan',
      `Switch to ${tier} plan?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdating(true);
            try {
              await subscriptionAPI.changeTier(tier);
              await fetchSubscription();
              Alert.alert('Success', 'Subscription updated successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to update subscription');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const cancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? You will retain access until the end of your billing period.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              await subscriptionAPI.cancel();
              await fetchSubscription();
              Alert.alert('Cancelled', 'You will retain access until the end of your billing period.');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel subscription');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading subscription...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load subscription data</Text>
      </View>
    );
  }

  const isOnTrial = data.current.subscription?.trialEndsAt &&
    new Date(data.current.subscription.trialEndsAt) > new Date();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Subscription</Text>
        <Text style={styles.headerSubtitle}>Manage your plan and billing</Text>
      </View>

      {/* Current Plan */}
      <View style={styles.currentPlanCard}>
        <Text style={styles.sectionTitle}>Current Plan</Text>
        <View style={styles.planInfo}>
          <View>
            <Text style={styles.planTier}>{data.current.tier}</Text>
            <Text style={styles.planPrice}>
              ${data.current.subscription?.monthlyAmount || 0}/month + {data.current.commissionRate}% commission
            </Text>
            {isOnTrial && (
              <Text style={styles.trialText}>
                Trial ends: {new Date(data.current.subscription!.trialEndsAt!).toLocaleDateString()}
              </Text>
            )}
            {data.current.subscription?.cancelAtPeriodEnd && (
              <Text style={styles.cancelText}>
                Cancels on: {new Date(data.current.subscription.currentPeriodEnd).toLocaleDateString()}
              </Text>
            )}
          </View>
          <View style={styles.statusBadge}>
            <Text style={[
              styles.statusText,
              data.current.status === 'ACTIVE' && styles.statusActive,
              data.current.status === 'TRIAL' && styles.statusTrial,
            ]}>
              {data.current.status}
            </Text>
          </View>
        </View>

        {data.current.subscription && !data.current.subscription.cancelAtPeriodEnd && (
          <TouchableOpacity
            onPress={cancelSubscription}
            disabled={updating}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Available Plans */}
      <View style={styles.plansSection}>
        <Text style={styles.sectionTitle}>Available Plans</Text>

        {/* PRO Plan */}
        <View style={[
          styles.planCard,
          data.current.tier === 'PRO' && styles.planCardActive
        ]}>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>PRO</Text>
            {data.current.tier === 'PRO' && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>

          <Text style={styles.planAmount}>${data.pricing.PRO.monthlyPrice}</Text>
          <Text style={styles.planPeriod}>per month</Text>
          <Text style={styles.planCommission}>
            + {data.pricing.PRO.commissionRate}% per booking
          </Text>
          <Text style={styles.planBonus}>
            (+{data.current.newStudentBonus}% bonus on first booking with new clients)
          </Text>

          <View style={styles.features}>
            {data.pricing.PRO.features.map((feature, idx) => (
              <View key={idx} style={styles.feature}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {data.current.tier !== 'PRO' && (
            <TouchableOpacity
              onPress={() => changeTier('PRO')}
              disabled={updating}
              style={styles.switchButton}
            >
              <Text style={styles.switchButtonText}>
                {updating ? 'Updating...' : 'Switch to PRO'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* BUSINESS Plan */}
        <View style={[
          styles.planCard,
          data.current.tier === 'BUSINESS' && styles.planCardActive
        ]}>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>BUSINESS</Text>
            {data.current.tier === 'BUSINESS' && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>

          <Text style={styles.planAmount}>${data.pricing.BUSINESS.monthlyPrice}</Text>
          <Text style={styles.planPeriod}>per month</Text>
          <Text style={styles.planCommission}>
            + {data.pricing.BUSINESS.commissionRate}% per booking
          </Text>
          <Text style={styles.planBonus}>
            (+{data.current.newStudentBonus}% bonus on first booking with new clients)
          </Text>

          <View style={styles.features}>
            {data.pricing.BUSINESS.features.map((feature, idx) => (
              <View key={idx} style={styles.feature}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {data.current.tier !== 'BUSINESS' && (
            <TouchableOpacity
              onPress={() => changeTier('BUSINESS')}
              disabled={updating}
              style={styles.switchButton}
            >
              <Text style={styles.switchButtonText}>
                {updating ? 'Updating...' : 'Upgrade to BUSINESS'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Pricing Works</Text>
        <View style={styles.infoContent}>
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Monthly Subscription:</Text> Fixed monthly fee for access to all platform features
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Commission:</Text> Small percentage taken from each completed booking
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>New Student Bonus:</Text> Extra {data.current.newStudentBonus}% commission on the first booking with any new client
          </Text>
          <Text style={styles.infoExample}>
            Example: On PRO plan with a $70 lesson - Regular: Platform takes $8.40 (12%), you keep $61.60. First booking with new student: Platform takes $14.00 (20%), you keep $56.00.
          </Text>
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
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  currentPlanCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  planInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planTier: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  planPrice: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  trialText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusActive: {
    color: '#10B981',
  },
  statusTrial: {
    color: '#2563EB',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#EF4444',
  },
  plansSection: {
    padding: 16,
  },
  planCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  planCardActive: {
    borderColor: '#2563EB',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  currentBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
  planAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  planPeriod: {
    fontSize: 14,
    color: '#6B7280',
  },
  planCommission: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  planBonus: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
  features: {
    marginTop: 20,
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureCheck: {
    fontSize: 16,
    color: '#10B981',
    marginRight: 8,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
  },
  switchButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoContent: {
    gap: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: 'bold',
  },
  infoExample: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 16,
  },
});
