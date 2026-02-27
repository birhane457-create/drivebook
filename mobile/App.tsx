import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, Animated } from 'react-native';
import { useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from './services/api';
import BookingsScreen from './screens/BookingsScreen';
import BookingDetailScreen from './screens/BookingDetailScreen';
import DashboardScreen from './screens/DashboardScreen';
import ClientsScreen from './screens/ClientsScreen';
import ClientPerformanceScreen from './screens/ClientPerformanceScreen';
import NewBookingScreen from './screens/NewBookingScreen';
import SettingsScreen from './screens/SettingsScreen';
import HelpScreen from './screens/HelpScreen';
import ProfileScreen from './screens/ProfileScreen';

import AnalyticsScreen from './screens/AnalyticsScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import PDATestsScreen from './screens/PDATestsScreen';

// Client screens
import ClientDashboardScreen from './screens/client/ClientDashboardScreen';
import MyLessonsScreen from './screens/client/MyLessonsScreen';
import WalletScreen from './screens/client/WalletScreen';
import FindInstructorsScreen from './screens/client/FindInstructorsScreen';
import ReviewsScreen from './screens/client/ReviewsScreen';
import ClientProfileScreen from './screens/client/ClientProfileScreen';
import ClientSettingsScreen from './screens/client/ClientSettingsScreen';

// Instructor screens
import EarningsScreen from './screens/EarningsScreen';
import PayoutsScreen from './screens/PayoutsScreen';

// Public screens
import PublicBookingScreen from './screens/PublicBookingScreen';

type Screen = 'login' | 'publicBooking' | 'dashboard' | 'bookings' | 'clients' | 'clientPerformance' | 'tests' | 'analytics' | 'subscription' | 'profile' | 'settings' | 'help' | 'bookingDetail' | 'newBooking' | 'clientDashboard' | 'myLessons' | 'wallet' | 'findInstructors' | 'reviews' | 'earnings' | 'payouts';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'instructor' | 'client' | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-250)).current;

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      setLoading(true);
      const response = await authAPI.login(email, password);
      
      // Save token and user data
      await AsyncStorage.setItem('authToken', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      
      const rawRole = (response.data.user?.role || 'instructor').toString();
      const role = rawRole.toLowerCase() === 'client' ? 'client' : 'instructor';
      setUserName(response.data.user.name);
      setUserRole(role as 'instructor' | 'client');
      setIsLoggedIn(true);
      // Set initial screen based on role
      setCurrentScreen(role === 'client' ? 'clientDashboard' : 'dashboard');
      Alert.alert('Success', `Logged in as ${role}!`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    setIsLoggedIn(false);
    setCurrentScreen('login');
    setEmail('');
    setPassword('');
    setUserName('');
    setUserRole(null);
    setMenuVisible(false);
  };

  const navigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
    closeMenu();
  };

  const toggleMenu = () => {
    const toValue = menuVisible ? -250 : 0;
    setMenuVisible(!menuVisible);
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -250,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setMenuVisible(false));
  };

  const handleSelectBooking = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setCurrentScreen('bookingDetail');
  };

  const handleBackToBookings = () => {
    setCurrentScreen('bookings');
    setSelectedBookingId(null);
  };

  const handleNewBooking = () => {
    setCurrentScreen('newBooking');
  };

  if (!isLoggedIn) {
    // Show public booking screen if user switches mode
    if (currentScreen === 'publicBooking') {
      return (
        <>
          <PublicBookingScreen 
            onNavigate={(screen) => {
              if (screen === 'back') setCurrentScreen('login');
              else setCurrentScreen(screen as Screen);
            }}
          />
          <StatusBar style="auto" />
        </>
      );
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>🚗 DriveBook</Text>
        <Text style={styles.subtitle}>Instructor Mobile App</Text>
        
        <View style={styles.form}>
          <TouchableOpacity
            style={[styles.button, { marginBottom: 0 }]}
            onPress={() => setCurrentScreen('publicBooking')}
          >
            <Text style={styles.buttonText}>📅 Book a Lesson</Text>
          </TouchableOpacity>

          <Text style={styles.divider}>or</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
          
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Logging in...' : 'Login as Instructor'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={async () => {
              const { testConnection } = await import('./utils/networkTest');
              const result = await testConnection();
              Alert.alert(
                result.success ? 'Connection Test' : 'Connection Failed',
                result.message + (result.details?.hint ? '\n\n' + result.details.hint : ''),
                [{ text: 'OK' }]
              );
            }}
          >
            <Text style={styles.testButtonText}>🔌 Test Connection</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            💡 Use your DriveBook credentials
          </Text>
          <Text style={styles.apiUrl}>
            API: 192.168.2.108:3001
          </Text>
        </View>
        
        <StatusBar style="auto" />
      </View>
    );
  }

  if (currentScreen === 'newBooking') {
    return (
      <>
        <NewBookingScreen onBack={handleBackToBookings} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (currentScreen === 'bookingDetail' && selectedBookingId) {
    return (
      <>
        <BookingDetailScreen 
          bookingId={selectedBookingId} 
          onBack={handleBackToBookings}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // Render main content based on current screen
  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return userRole === 'client' ? (
          <ClientDashboardScreen 
            onNavigate={(screen: string) => setCurrentScreen(screen as Screen)}
            onSelectBooking={handleSelectBooking}
          />
        ) : (
          <DashboardScreen 
            onSelectBooking={handleSelectBooking}
            onNavigate={(screen) => setCurrentScreen(screen)}
            onSelectClient={(id: string) => { setSelectedClientId(id); setCurrentScreen('clientPerformance'); }}
          />
        );
      case 'clientDashboard':
        return (
          <ClientDashboardScreen 
            onNavigate={(screen: string) => setCurrentScreen(screen as Screen)}
            onSelectBooking={handleSelectBooking}
          />
        );
      case 'myLessons':
        return (
          <MyLessonsScreen
            onSelectBooking={handleSelectBooking}
            onBack={() => setCurrentScreen('clientDashboard')}
          />
        );
      case 'wallet':
        return (
          <WalletScreen 
            onNavigate={(screen: string) => setCurrentScreen(screen as Screen)}
          />
        );
      case 'findInstructors':
        return (
          <FindInstructorsScreen 
            onSelectInstructor={(id: string) => {
              // TODO: Implement booking flow when selecting instructor
              Alert.alert('Coming Soon', 'Instructor booking coming soon!');
            }}
          />
        );
      case 'reviews':
        return (
          <ReviewsScreen 
            onBack={() => setCurrentScreen('clientDashboard')}
          />
        );
      case 'bookings':
        return <BookingsScreen onSelectBooking={handleSelectBooking} onNewBooking={handleNewBooking} />;
      case 'clients':
        return (
          <ClientsScreen onViewPerformance={(id: string) => { setSelectedClientId(id); setCurrentScreen('clientPerformance'); }} />
        );
      case 'clientPerformance':
        return (
          <ClientPerformanceScreen
            clientId={selectedClientId}
            onBack={() => setCurrentScreen('clients')}
          />
        );
      case 'tests':
        return <PDATestsScreen />;
      case 'analytics':
        return <AnalyticsScreen />;
      case 'subscription':
        return <SubscriptionScreen />;
      case 'earnings':
        return (
          <EarningsScreen
            onNavigate={(screen: string) => setCurrentScreen(screen as Screen)}
          />
        );
      case 'payouts':
        return (
          <PayoutsScreen 
            onBack={() => setCurrentScreen('earnings')}
          />
        );
      case 'profile':
        return userRole === 'client' ? <ClientProfileScreen /> : <ProfileScreen />;
      case 'settings':
        return userRole === 'client' ? <ClientSettingsScreen /> : <SettingsScreen />;
      case 'help':
        return <HelpScreen />;
      default:
        return userRole === 'client' ? (
          <ClientDashboardScreen 
            onNavigate={(screen: string) => setCurrentScreen(screen as Screen)}
            onSelectBooking={handleSelectBooking}
          />
        ) : (
          <DashboardScreen 
            onSelectBooking={handleSelectBooking}
            onNavigate={(screen) => setCurrentScreen(screen)}
            onSelectClient={(id: string) => { setSelectedClientId(id); setCurrentScreen('clientPerformance'); }}
          />
        );
    }
  };

  return (
    <View style={styles.appContainer}>
      <View style={styles.appHeader}>
        <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigateTo('dashboard')}>
          <Text style={styles.appTitle}>🚗 DriveBook</Text>
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>
      
      {renderScreen()}
      
      {menuVisible && (
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={closeMenu}
        />
      )}
      
      <Animated.View 
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Menu</Text>
          <Text style={styles.drawerSubtitle}>
            {userName} • {userRole === 'client' ? '👨‍🎓 Student' : '👨‍🏫 Instructor'}
          </Text>
        </View>
        
        <View style={styles.drawerContent}>
          {/* Shared - Dashboard */}
          <TouchableOpacity 
            style={[styles.menuItem, (currentScreen === 'dashboard' || currentScreen === 'clientDashboard') && styles.menuItemActive]}
            onPress={() => navigateTo(userRole === 'client' ? 'clientDashboard' : 'dashboard')}
          >
            <Text style={styles.menuItemIcon}>🏠</Text>
            <Text style={styles.menuItemText}>Dashboard</Text>
          </TouchableOpacity>

          {/* Instructor-only: Bookings, Clients, PDA Tests, Analytics, Subscription */}
          {userRole === 'instructor' && (
            <>
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'bookings' && styles.menuItemActive]}
                onPress={() => navigateTo('bookings')}
              >
                <Text style={styles.menuItemIcon}>📅</Text>
                <Text style={styles.menuItemText}>Bookings</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'clients' && styles.menuItemActive]}
                onPress={() => navigateTo('clients')}
              >
                <Text style={styles.menuItemIcon}>👥</Text>
                <Text style={styles.menuItemText}>Clients</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'tests' && styles.menuItemActive]}
                onPress={() => navigateTo('tests')}
              >
                <Text style={styles.menuItemIcon}>🚗</Text>
                <Text style={styles.menuItemText}>PDA Tests</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'analytics' && styles.menuItemActive]}
                onPress={() => navigateTo('analytics')}
              >
                <Text style={styles.menuItemIcon}>📊</Text>
                <Text style={styles.menuItemText}>Analytics</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'subscription' && styles.menuItemActive]}
                onPress={() => navigateTo('subscription')}
              >
                <Text style={styles.menuItemIcon}>💳</Text>
                <Text style={styles.menuItemText}>Subscription</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'earnings' && styles.menuItemActive]}
                onPress={() => navigateTo('earnings')}
              >
                <Text style={styles.menuItemIcon}>💰</Text>
                <Text style={styles.menuItemText}>Earnings</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Client-only: My Lessons, Wallet, Find Instructors, Reviews */}
          {userRole === 'client' && (
            <>
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'myLessons' && styles.menuItemActive]}
                onPress={() => navigateTo('myLessons')}
              >
                <Text style={styles.menuItemIcon}>📝</Text>
                <Text style={styles.menuItemText}>My Lessons</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'wallet' && styles.menuItemActive]}
                onPress={() => navigateTo('wallet')}
              >
                <Text style={styles.menuItemIcon}>💰</Text>
                <Text style={styles.menuItemText}>Wallet & Packages</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'findInstructors' && styles.menuItemActive]}
                onPress={() => navigateTo('findInstructors')}
              >
                <Text style={styles.menuItemIcon}>🔍</Text>
                <Text style={styles.menuItemText}>Find Instructor</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, currentScreen === 'reviews' && styles.menuItemActive]}
                onPress={() => navigateTo('reviews')}
              >
                <Text style={styles.menuItemIcon}>⭐</Text>
                <Text style={styles.menuItemText}>Reviews</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Shared Items */}
          <TouchableOpacity 
            style={[styles.menuItem, currentScreen === 'profile' && styles.menuItemActive]}
            onPress={() => navigateTo('profile')}
          >
            <Text style={styles.menuItemIcon}>👤</Text>
            <Text style={styles.menuItemText}>Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.menuItem, currentScreen === 'settings' && styles.menuItemActive]}
            onPress={() => navigateTo('settings')}
          >
            <Text style={styles.menuItemIcon}>⚙️</Text>
            <Text style={styles.menuItemText}>Settings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.menuItem, currentScreen === 'help' && styles.menuItemActive]}
            onPress={() => navigateTo('help')}
          >
            <Text style={styles.menuItemIcon}>❓</Text>
            <Text style={styles.menuItemText}>Help</Text>
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity 
            style={[styles.menuItem, styles.logoutMenuItem]}
            onPress={() => {
              closeMenu();
              Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', onPress: handleLogout, style: 'destructive' }
                ]
              );
            }}
          >
            <Text style={styles.menuItemIcon}>🚪</Text>
            <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 40,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuButton: {
    padding: 8,
    width: 40,
  },
  menuIcon: {
    fontSize: 24,
    color: '#1F2937',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 250,
    backgroundColor: '#fff',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  drawerHeader: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: 60,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  drawerSubtitle: {
    fontSize: 14,
    color: '#E0E7FF',
  },
  drawerContent: {
    flex: 1,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingLeft: 20,
  },
  menuItemActive: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 16,
    width: 24,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
    marginHorizontal: 20,
  },
  logoutMenuItem: {
    marginTop: 'auto',
    marginBottom: 20,
  },
  logoutText: {
    color: '#EF4444',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 40,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  divider: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginVertical: 15,
    fontSize: 14,
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#6B7280',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  apiUrl: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 8,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  hint: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 20,
    fontSize: 14,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 40,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});
