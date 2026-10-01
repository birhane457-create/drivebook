import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { clientAPI } from '../../services/api';

interface Wallet {
  credits: number;
  spent: number;
  pendingCredits: number;
}

interface Package {
  id: string;
  name: string;
  credits: number;
  price: number;
  lessonsIncluded: number;
  savings: number;
}

interface Props {
  onNavigate?: (screen: string) => void;
}

export default function WalletScreen({ onNavigate }: Props) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const [walletResponse, packagesResponse] = await Promise.all([
        clientAPI.getWallet(),
        clientAPI.getPackages(),
      ]);
      setWallet(walletResponse.data);
      setPackages(packagesResponse.data);
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
      Alert.alert('Error', 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!wallet) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load wallet</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchWallet}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Current Balance Card */}
      <View style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <View style={styles.balanceAmount}>
            <Text style={styles.balanceValue}>{wallet.credits}</Text>
            <Text style={styles.balanceCurrency}>Credits</Text>
          </View>
        </View>
        <View style={styles.balanceStats}>
          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={styles.statValue}>${wallet.spent}</Text>
          </View>
          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>+{wallet.pendingCredits}</Text>
          </View>
        </View>
      </View>

      {/* Quick Add Credits Button */}
      <TouchableOpacity style={styles.addCreditsButton}>
        <Text style={styles.addCreditsIcon}>➕</Text>
        <View style={styles.addCreditsContent}>
          <Text style={styles.addCreditsText}>Add Credits</Text>
          <Text style={styles.addCreditsSubtext}>Top up your account</Text>
        </View>
        <Text style={styles.addCreditsArrow}>›</Text>
      </TouchableOpacity>

      {/* Available Packages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Available Packages</Text>
        <Text style={styles.sectionSubtitle}>Level up your learning</Text>

        {packages.map((pkg) => (
          <View key={pkg.id} style={styles.packageCard}>
            <View style={styles.packageHeader}>
              <View>
                <Text style={styles.packageName}>{pkg.name}</Text>
                <Text style={styles.packageLessons}>
                  {pkg.lessonsIncluded} lessons included
                </Text>
              </View>
              {pkg.savings > 0 && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>Save ${pkg.savings}</Text>
                </View>
              )}
            </View>

            <View style={styles.packageDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Credits</Text>
                <Text style={styles.detailValue}>{pkg.credits}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.detailValue}>${pkg.price}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Per Credit</Text>
                <Text style={styles.detailValue}>
                  ${(pkg.price / pkg.credits).toFixed(2)}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.buyButton}>
              <Text style={styles.buyButtonText}>Purchase {pkg.name}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* How It Works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>❓ How It Works</Text>
        <View style={styles.helpItem}>
          <Text style={styles.helpNumber}>1</Text>
          <View>
            <Text style={styles.helpTitle}>Buy Credits</Text>
            <Text style={styles.helpDescription}>
              Purchase a package that fits your needs
            </Text>
          </View>
        </View>
        <View style={styles.helpItem}>
          <Text style={styles.helpNumber}>2</Text>
          <View>
            <Text style={styles.helpTitle}>Book Lessons</Text>
            <Text style={styles.helpDescription}>
              Find instructors and book in your preferred time
            </Text>
          </View>
        </View>
        <View style={styles.helpItem}>
          <Text style={styles.helpNumber}>3</Text>
          <View>
            <Text style={styles.helpTitle}>Start Learning</Text>
            <Text style={styles.helpDescription}>
              Complete lessons and earn achievements
            </Text>
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
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  balanceCurrency: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 8,
  },
  balanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statColumn: {
    alignItems: 'center',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addCreditsButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  addCreditsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  addCreditsContent: {
    flex: 1,
  },
  addCreditsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  addCreditsSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  addCreditsArrow: {
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  packageCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  packageLessons: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  savingsBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  packageDetails: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  buyButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  helpItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  helpNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    color: '#0369A1',
    fontWeight: 'bold',
    textAlign: 'center',
    paddingTop: 6,
    marginRight: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  helpDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
