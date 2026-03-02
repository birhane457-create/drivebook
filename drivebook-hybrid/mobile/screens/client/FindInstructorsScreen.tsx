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

interface Instructor {
  id: string;
  name: string;
  specialization: string;
  rating: number;
  reviews: number;
  hourlyRate: number;
  availability: string;
  bio: string;
  experience: number;
}

interface Props {
  onSelectInstructor?: (instructorId: string) => void;
}

export default function FindInstructorsScreen({ onSelectInstructor }: Props) {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [filteredInstructors, setFilteredInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'price' | 'experience'>('rating');

  useEffect(() => {
    fetchInstructors();
  }, []);

  useEffect(() => {
    filterAndSortInstructors();
  }, [searchTerm, sortBy, instructors]);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const response = await clientAPI.getInstructors();
      setInstructors(response.data);
    } catch (error) {
      console.error('Failed to fetch instructors:', error);
      Alert.alert('Error', 'Failed to load instructors');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortInstructors = () => {
    let filtered = instructors;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          i.specialization.toLowerCase().includes(term)
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      } else if (sortBy === 'price') {
        return a.hourlyRate - b.hourlyRate;
      } else if (sortBy === 'experience') {
        return b.experience - a.experience;
      }
      return 0;
    });

    setFilteredInstructors(sorted);
  };

  const renderInstructorCard = (instructor: Instructor) => (
    <TouchableOpacity
      key={instructor.id}
      style={styles.instructorCard}
      onPress={() => onSelectInstructor?.(instructor.id)}
    >
      <View style={styles.instructorHeader}>
        <View style={styles.instructorAvatar}>
          <Text style={styles.avatarInitial}>
            {instructor.name.charAt(0)}
          </Text>
        </View>
        <View style={styles.instructorInfo}>
          <Text style={styles.instructorName}>{instructor.name}</Text>
          <Text style={styles.specialization}>{instructor.specialization}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>⭐ {instructor.rating}</Text>
            <Text style={styles.reviews}>({instructor.reviews} reviews)</Text>
          </View>
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>per hour</Text>
          <Text style={styles.price}>${instructor.hourlyRate}</Text>
        </View>
      </View>

      <Text style={styles.bio}>{instructor.bio}</Text>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={styles.statText}>{instructor.availability}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>📚</Text>
          <Text style={styles.statText}>{instructor.experience}+ years</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.bookButton}>
        <Text style={styles.bookButtonText}>Book Lesson</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search & Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search instructors..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'rating' && styles.sortBtnActive]}
            onPress={() => setSortBy('rating')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'rating' && styles.sortBtnTextActive]}>
              ⭐ Top Rated
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'price' && styles.sortBtnActive]}
            onPress={() => setSortBy('price')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'price' && styles.sortBtnTextActive]}>
              💰 Cheapest
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'experience' && styles.sortBtnActive]}
            onPress={() => setSortBy('experience')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'experience' && styles.sortBtnTextActive]}>
              📚 Experienced
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {filteredInstructors.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔎</Text>
          <Text style={styles.emptyText}>No instructors found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
        </View>
      ) : (
        <FlatList
          data={filteredInstructors}
          renderItem={({ item }) => renderInstructorCard(item)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
      )}
    </View>
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
  searchContainer: {
    marginBottom: 16,
  },
  searchBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  clearBtn: {
    fontSize: 16,
    color: '#D1D5DB',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  sortBtnActive: {
    backgroundColor: '#3B82F6',
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  sortBtnTextActive: {
    color: '#fff',
  },
  instructorCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  instructorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  specialization: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginRight: 4,
  },
  reviews: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  priceBox: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  bio: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  bookButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
