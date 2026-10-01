import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ClientSettingsScreen() {
  const [notifications, setNotifications] = useState({
    bookingReminders: true,
    lessonUpdates: true,
    promotions: false,
    emailNotifications: true,
  });

  const [preferences, setPreferences] = useState({
    language: 'English',
    currency: 'AUD',
  });

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    // TODO: Save to server
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'This feature will redirect you to the web app to change your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // TODO: Open web app password change page
            Alert.alert('Coming Soon', 'Password change via web app coming soon!');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Contact Support', 'Please contact support to delete your account.');
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://drivebook.com/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://drivebook.com/terms');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your preferences</Text>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Booking Reminders</Text>
            <Text style={styles.settingDescription}>Get reminded before your lessons</Text>
          </View>
          <Switch
            value={notifications.bookingReminders}
            onValueChange={() => handleToggle('bookingReminders')}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={notifications.bookingReminders ? '#3B82F6' : '#F3F4F6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Lesson Updates</Text>
            <Text style={styles.settingDescription}>Changes to your bookings</Text>
          </View>
          <Switch
            value={notifications.lessonUpdates}
            onValueChange={() => handleToggle('lessonUpdates')}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={notifications.lessonUpdates ? '#3B82F6' : '#F3F4F6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Promotions & Offers</Text>
            <Text style={styles.settingDescription}>Special deals and discounts</Text>
          </View>
          <Switch
            value={notifications.promotions}
            onValueChange={() => handleToggle('promotions')}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={notifications.promotions ? '#3B82F6' : '#F3F4F6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Email Notifications</Text>
            <Text style={styles.settingDescription}>Receive updates via email</Text>
          </View>
          <Switch
            value={notifications.emailNotifications}
            onValueChange={() => handleToggle('emailNotifications')}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={notifications.emailNotifications ? '#3B82F6' : '#F3F4F6'}
          />
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Preferences</Text>
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Language</Text>
            <Text style={styles.settingDescription}>{preferences.language}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Currency</Text>
            <Text style={styles.settingDescription}>{preferences.currency}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Security</Text>
        
        <TouchableOpacity style={styles.settingItem} onPress={handleChangePassword}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Change Password</Text>
            <Text style={styles.settingDescription}>Update your password</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Legal Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📄 Legal</Text>
        
        <TouchableOpacity style={styles.settingItem} onPress={handlePrivacyPolicy}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
            <Text style={styles.settingDescription}>How we handle your data</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handleTermsOfService}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Terms of Service</Text>
            <Text style={styles.settingDescription}>Our terms and conditions</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.dangerTitle]}>⚠️ Danger Zone</Text>
        
        <TouchableOpacity
          style={[styles.settingItem, styles.dangerItem]}
          onPress={handleDeleteAccount}
        >
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, styles.dangerText]}>Delete Account</Text>
            <Text style={styles.settingDescription}>Permanently delete your account</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>DriveBook Mobile v1.0.0</Text>
        <Text style={styles.appInfoText}>© 2026 DriveBook. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  dangerTitle: {
    color: '#EF4444',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dangerItem: {
    backgroundColor: '#FEF2F2',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  dangerText: {
    color: '#EF4444',
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  arrow: {
    fontSize: 24,
    color: '#D1D5DB',
    marginLeft: 12,
  },
  appInfo: {
    padding: 20,
    alignItems: 'center',
  },
  appInfoText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
});
