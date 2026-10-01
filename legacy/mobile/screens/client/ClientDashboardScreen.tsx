import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { clientAPI } from '../../services/api';

interface UpcomingLesson {
  id: string;
  instructorName: string;
  date: string;
  time: string;
  location: string;
  duration: number;
}

interface CurrentInstructor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  averageRating: number;
  totalReviews: number;
  hourlyRate?: number;
  services?: string[];
  profileImage?: string;
}

interface Dashboard {
  upcomingLessons: UpcomingLesson[];
  currentInstructor?: CurrentInstructor;
  totalBookings: number;
  totalCredits: number;
  averageRating: number;
}

interface Props {
  onNavigate?: (screen: string) => void;
  onSelectBooking?: (bookingId: string) => void;
}

export default function ClientDashboardScreen({ onNavigate, onSelectBooking }: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await clientAPI.getDashboard();
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard');
      // Fallback to placeholder
      setDashboard({
        upcomingLessons: [],
        totalBookings: 0,
        totalCredits: 0,
        averageRating: 0,
      });
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

  if (!dashboard) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDashboard}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Lessons</Text>
          <Text style={styles.statValue}>{dashboard.totalBookings}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Credits</Text>
          <Text style={styles.statValue}>{dashboard.totalCredits}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Rating</Text>
          <Text style={styles.statValue}>⭐ {dashboard.averageRating}</Text>
        </View>
      </View>

      {/* Current Instructor Card */}
      {dashboard.currentInstructor && (
        <View style={styles.instructorCard}>
          <View style={styles.instructorHeader}>
            <View>
              <Text style={styles.instructorName}>{dashboard.currentInstructor.name}</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.rating}>⭐ {dashboard.currentInstructor.averageRating}</Text>
                <Text style={styles.reviewCount}>({dashboard.currentInstructor.totalReviews} reviews)</Text>
              </View>
            </View>
          </View>

          {/* Contact Info */}
          {dashboard.currentInstructor.phone && (
            <TouchableOpacity 
              style={styles.contactRow}
              onPress={() => Linking.openURL(`tel:${dashboard.currentInstructor!.phone}`)}
            >
              <Text style={styles.contactIcon}>📞</Text>
              <Text style={styles.contactText}>{dashboard.currentInstructor.phone}</Text>
            </TouchableOpacity>
          )}

          {dashboard.currentInstructor.email && (
            <TouchableOpacity 
              style={styles.contactRow}
              onPress={() => Linking.openURL(`mailto:${dashboard.currentInstructor!.email}`)}
            >
              <Text style={styles.contactIcon}>✉️</Text>
              <Text style={styles.contactText}>{dashboard.currentInstructor.email}</Text>
            </TouchableOpacity>
          )}

          {dashboard.currentInstructor.hourlyRate && (
            <View style={styles.contactRow}>
              <Text style={styles.contactIcon}>💰</Text>
              <Text style={styles.contactText}>${dashboard.currentInstructor.hourlyRate}/hour</Text>
            </View>
          )}

          {/* Services */}
          {dashboard.currentInstructor.services && dashboard.currentInstructor.services.length > 0 && (
            <View style={styles.servicesContainer}>
              <Text style={styles.servicesLabel}>Services:</Text>
              <View style={styles.servicesList}>
                {dashboard.currentInstructor.services.map((service, index) => (
                  <View key={index} style={styles.serviceBadge}>
                    <Text style={styles.serviceBadgeText}>{service}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.instructorActions}>
            <TouchableOpacity style={styles.bookButton} onPress={() => onNavigate?.('findInstructors')}>
              <Text style={styles.bookButtonText}>Book Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchButton} onPress={() => onNavigate?.('findInstructors')}>
              <Text style={styles.switchButtonText}>Switch Instructor</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Upcoming Lessons */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📅 Upcoming Lessons</Text>
          {dashboard.upcomingLessons.length > 0 && (
            <TouchableOpacity onPress={() => onNavigate?.('myLessons')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {dashboard.upcomingLessons.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming lessons</Text>
        ) : (
          dashboard.upcomingLessons.slice(0, 3).map((lesson) => (
            <TouchableOpacity
              key={lesson.id}
              style={styles.lessonCard}
              onPress={() => onSelectBooking?.(lesson.id)}
            >
              <View style={styles.lessonInfo}>
                <Text style={styles.lessonInstructor}>{lesson.instructorName}</Text>
                <Text style={styles.lessonDetails}>
                  📍 {lesson.location} • ⏱️ {lesson.duration} min
                </Text>
                <Text style={styles.lessonDateTime}>
                  {lesson.date} at {lesson.time}
                </Text>
              </View>
              <Text style={styles.lessonArrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onNavigate?.('findInstructors')}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={styles.actionLabel}>Find Instructor</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onNavigate?.('wallet')}
          >
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionLabel}>Add Credits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onNavigate?.('reviews')}
          >
            <Text style={styles.actionIcon}>⭐</Text>
            <Text style={styles.actionLabel}>Leave Review</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onNavigate?.('myLessons')}
          >
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionLabel}>My Lessons</Text>
          </TouchableOpacity>
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  viewAllText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  lessonCard: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lessonInfo: {
    flex: 1,
  },
  lessonInstructor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  lessonDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  lessonDateTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  lessonArrow: {
    fontSize: 20,
    color: '#D1D5DB',
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '500',
    textAlign: 'center',
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
  // Instructor Card Styles
  instructorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    elevation: 2,
  },
  instructorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  reviewCount: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactIcon: {
    fontSize: 16,
    marginRight: 8,
    width: 20,
  },
  contactText: {
    fontSize: 14,
    color: '#3B82F6',
  },
  servicesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  servicesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  serviceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  instructorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  bookButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  switchButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  switchButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
});
