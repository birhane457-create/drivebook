import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';

interface Props {
  clientId: string | null;
  onBack: () => void;
}

interface Booking {
  id: string;
  startTime: string;
  duration: number;
  lessonFeedback: number[];
  feedbackGivenAt: string | null;
}

export default function ClientPerformanceScreen({ clientId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<number[]>([]);
  const [performanceScore, setPerformanceScore] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!clientId) return;
      setLoading(true);
      try {
        const perfRes = await fetch(`/api/instructor/client-performance?clientId=${clientId}`);
        if (!perfRes.ok) throw new Error('Failed to fetch performance');
        const perfData = await perfRes.json();
        setPerformance(perfData);

        const catRes = await fetch('/api/feedback/categories');
        if (!catRes.ok) throw new Error('Failed to fetch categories');
        const catData = await catRes.json();
        setCategories(catData.categories || []);

        const bookRes = await fetch(`/api/instructor/client-lesson-feedback?clientId=${clientId}&limit=50`);
        if (!bookRes.ok) throw new Error('Failed to fetch bookings');
        const bookData = await bookRes.json();
        setBookings(bookData.lessons || []);
      } catch (err: any) {
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clientId]);

  const toggleFeedback = (code: number) => {
    setSelectedFeedback((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleSubmit = async () => {
    if (!selectedBookingId || selectedFeedback.length === 0) {
      Alert.alert('Validation', 'Select a lesson and at least one feedback item');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/instructor/lesson-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBookingId,
          feedback: selectedFeedback,
          performanceScore: performanceScore ? parseInt(performanceScore, 10) : null,
          instructorNotes: notes || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      Alert.alert('Success', 'Feedback submitted');
      setSelectedBookingId(null);
      setSelectedFeedback([]);
      setPerformanceScore('');
      setNotes('');

      // refresh performance
      if (clientId) {
        const perfRes = await fetch(`/api/instructor/client-performance?clientId=${clientId}`);
        if (perfRes.ok) setPerformance(await perfRes.json());
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading performance...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{performance?.client?.name || 'Client'}'s Performance</Text>

      <View style={styles.row}>{/* Summary boxes */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Lessons</Text>
          <Text style={styles.summaryValue}>{performance?.totalLessons ?? '—'}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>With Feedback</Text>
          <Text style={styles.summaryValue}>{performance?.lessonsWithFeedback ?? '—'}</Text>
        </View>
      </View>

      {performance?.commonIssues?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Issues to Address</Text>
          {performance.commonIssues.map((i: any) => (
            <View key={i.code} style={styles.issueRow}>
              <Text style={styles.issueText}>{i.description}</Text>
              <Text style={styles.issueCount}>{i.occurrences}x</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Lessons</Text>
        {performance?.feedbackHistory?.slice(0, 10).map((lesson: any) => (
          <TouchableOpacity key={lesson.id} style={styles.lessonRow} onPress={() => setSelectedBookingId(lesson.id)}>
            <View>
              <Text style={styles.lessonDate}>{new Date(lesson.date).toLocaleDateString()}</Text>
              <Text style={styles.lessonMeta}>{lesson.feedbackCount} feedback items</Text>
            </View>
            {lesson.performanceScore ? <Text style={styles.lessonScore}>{lesson.performanceScore}%</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Lesson Feedback</Text>

        <Text style={styles.label}>Select Lesson</Text>
        <View style={styles.pickerList}>
          <TouchableOpacity style={styles.pickerItem} onPress={() => { setSelectedBookingId(null); setSelectedFeedback([]); }}>
            <Text style={styles.pickerItemText}>{selectedBookingId ? 'Change selection' : 'Choose a lesson...'}</Text>
          </TouchableOpacity>
          {bookings.map((b) => (
            <TouchableOpacity key={b.id} style={[styles.pickerItem, selectedBookingId === b.id && styles.pickerItemActive]} onPress={() => { setSelectedBookingId(b.id); setSelectedFeedback([]); }}>
              <Text style={styles.pickerItemText}>{new Date(b.startTime).toLocaleDateString()} ({b.duration}h)</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Performance Score (0-100)</Text>
        <TextInput keyboardType="numeric" value={performanceScore} onChangeText={setPerformanceScore} style={styles.input} placeholder="e.g., 85" />

        <Text style={styles.label}>Notes</Text>
        <TextInput value={notes} onChangeText={setNotes} style={[styles.input, { height: 80 }]} multiline />

        <Text style={styles.label}>Select Feedback Items ({selectedFeedback.length})</Text>
        <View style={styles.feedbackList}>
          {categories.map((cat: any) => (
            <View key={cat.id} style={styles.feedbackCategory}>
              <Text style={styles.categoryTitle}>{cat.name}</Text>
              {cat.feedbacks.map((f: any) => (
                <TouchableOpacity key={f.code} style={styles.feedbackItem} onPress={() => toggleFeedback(f.code)}>
                  <Text style={styles.checkbox}>{selectedFeedback.includes(f.code) ? '☑' : '☐'}</Text>
                  <Text style={styles.feedbackText}>{f.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.submitButton, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Feedback'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#6B7280' },
  backButton: { padding: 8 },
  backText: { color: '#2563EB', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', marginVertical: 8, color: '#1F2937' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryBox: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryLabel: { fontSize: 12, color: '#6B7280' },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 6, color: '#1F2937' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  issueRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  issueText: { color: '#1F2937' },
  issueCount: { color: '#EF7E30', fontWeight: '700' },
  lessonRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  lessonDate: { fontWeight: '600' },
  lessonMeta: { color: '#6B7280' },
  lessonScore: { fontWeight: '700', color: '#2563EB' },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 6 },
  pickerList: { marginBottom: 8 },
  pickerItem: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 6, backgroundColor: '#fff' },
  pickerItemActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  pickerItemText: { color: '#1F2937' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 8 },
  feedbackList: { maxHeight: 300 },
  feedbackCategory: { marginBottom: 8 },
  categoryTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  feedbackItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkbox: { width: 28 },
  feedbackText: { color: '#1F2937' },
  submitButton: { marginTop: 12, backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
  errorText: { color: '#EF4444', padding: 16 },
});
