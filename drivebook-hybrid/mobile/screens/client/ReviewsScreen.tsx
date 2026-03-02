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
} from 'react-native';
import { clientAPI } from '../../services/api';

interface PendingReview {
  id: string;
  bookingId: string;
  instructorName: string;
  bookingDate: string;
}

interface Review {
  id: string;
  instructorName: string;
  rating: number;
  comment: string;
  date: string;
  verified?: boolean;
}

interface Props {
  onBack?: () => void;
}

export default function ReviewsScreen({ onBack }: Props) {
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [completedReviews, setCompletedReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  // Review form state
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const [pendingResponse, completedResponse] = await Promise.all([
        clientAPI.getPendingReviews(),
        clientAPI.getCompletedReviews(),
      ]);
      setPendingReviews(pendingResponse.data || []);
      setCompletedReviews(completedResponse.data || []);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      Alert.alert('Error', 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    if (!selectedReview || rating === 0 || !comment.trim()) {
      Alert.alert('Validation', 'Please rate and add a comment');
      return;
    }

    try {
      setSubmitting(true);
      await clientAPI.submitReview(selectedReview.bookingId, {
        rating,
        comment: comment.trim(),
      });

      Alert.alert('Success', 'Review submitted successfully!');
      setSelectedReview(null);
      setRating(0);
      setComment('');
      fetchReviews();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit review');
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

  // Review Form Modal
  if (selectedReview) {
    return (
      <View style={styles.container}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setSelectedReview(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>Leave a Review</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.formContent}>
          <View style={styles.instructorCard}>
            <Text style={styles.instructorCardName}>
              {selectedReview.instructorName}
            </Text>
            <Text style={styles.lessonDateText}>
              Lesson on {selectedReview.bookingDate}
            </Text>
          </View>

          {/* Rating */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Rating</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={styles.starButton}
                  onPress={() => setRating(r)}
                >
                  <Text style={[styles.star, rating >= r && styles.starActive]}>
                    ⭐
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.ratingText}>Your rating: {rating} stars</Text>
            )}
          </View>

          {/* Comment */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Your Experience</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Share your feedback about this lesson..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{comment.length}/500</Text>
          </View>

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.submitButton, (!rating || !comment) && styles.submitButtonDisabled]}
            onPress={submitReview}
            disabled={submitting || !rating || !comment}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setSelectedReview(null)}
            disabled={submitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Reviews List
  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending ({pendingReviews.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Completed ({completedReviews.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'pending' ? (
        // Pending Reviews
        pendingReviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>No pending reviews</Text>
          </View>
        ) : (
          <FlatList
            data={pendingReviews}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pendingCard}
                onPress={() => setSelectedReview(item)}
              >
                <View>
                  <Text style={styles.pendingInstructor}>{item.instructorName}</Text>
                  <Text style={styles.pendingDate}>Lesson: {item.bookingDate}</Text>
                </View>
                <Text style={styles.pendingArrow}>›</Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        // Completed Reviews
        completedReviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>No reviews yet</Text>
            <Text style={styles.emptySubtext}>Complete a lesson to leave a review</Text>
          </View>
        ) : (
          <FlatList
            data={completedReviews}
            renderItem={({ item }) => (
              <View style={styles.completedCard}>
                <View style={styles.completedHeader}>
                  <View>
                    <Text style={styles.completedInstructor}>{item.instructorName}</Text>
                    <View style={styles.ratingDisplay}>
                      {[...Array(5)].map((_, i) => (
                        <Text key={i} style={styles.starIcon}>
                          {i < item.rating ? '⭐' : '☆'}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.completedComment}>{item.comment}</Text>
                <Text style={styles.completedDate}>{item.date}</Text>
              </View>
            )}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        )
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
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 20,
  },
  backButton: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  formContent: {
    flex: 1,
    padding: 16,
  },
  instructorCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  instructorCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  instructorCardSpec: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  lessonDateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 32,
    opacity: 0.3,
  },
  starActive: {
    opacity: 1,
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#fff',
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'right',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '500',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  pendingCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingInstructor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  pendingSpec: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  pendingDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  pendingArrow: {
    fontSize: 20,
    color: '#D1D5DB',
  },
  completedCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  completedInstructor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  ratingDisplay: {
    flexDirection: 'row',
    marginTop: 6,
  },
  starIcon: {
    fontSize: 14,
    marginRight: 2,
  },
  verifiedBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  verifiedBadgeText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600',
  },
  completedComment: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
  },
  completedDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#D1D5DB',
  },
});
