import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface Instructor {
  id: string;
  name: string;
  bio?: string;
  hourlyRate: number;
  rating?: number;
  reviews?: number;
}

export default function PublicBookingScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [step, setStep] = useState<'instructor-search' | 'booking-form' | 'account-info'>('instructor-search');
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(false);

  // Booking form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [pickupAddress, setPickupAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Account creation state
  const [createAccount, setCreateAccount] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadInstructors = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/public/instructors`);
      setInstructors(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load instructors');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBooking = async () => {
    // Validation
    if (!clientName || !clientEmail || !clientPhone || !date || !time || !pickupAddress) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (createAccount && (!password || !confirmPassword)) {
      Alert.alert('Error', 'Password is required for new account');
      return;
    }

    if (createAccount && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);

      // Parse date and time into ISO format
      const [day, month, year] = date.split('/');
      const [hours, mins] = time.split(':');
      const startTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(mins)
      );
      const endTime = new Date(startTime.getTime() + parseInt(duration) * 60000);

      const bookingData = {
        instructorId: selectedInstructor?.id,
        clientName,
        clientEmail,
        clientPhone,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: parseInt(duration),
        pickupAddress,
        notes,
        createAccount,
        password: createAccount ? password : undefined,
      };

      const response = await axios.post(`${API_URL}/api/public/bookings`, bookingData);

      Alert.alert(
        'Success',
        createAccount
          ? 'Account created and booking confirmed! Check your email for confirmation.'
          : 'Booking confirmed! Check your email for confirmation.'
      );

      // Reset form
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setDate('');
      setTime('');
      setDuration('60');
      setPickupAddress('');
      setNotes('');
      setPassword('');
      setConfirmPassword('');
      setStep('instructor-search');
      setSelectedInstructor(null);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Step: Instructor Search
  if (step === 'instructor-search' && !selectedInstructor) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book a Lesson</Text>
          <Text style={styles.headerSubtitle}>Find your perfect instructor</Text>
        </View>

        {!instructors.length && !loading ? (
          <TouchableOpacity style={styles.button} onPress={loadInstructors}>
            <Text style={styles.buttonText}>Load Instructors</Text>
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : (
          <ScrollView style={styles.instructorsList}>
            {instructors.map((instructor) => (
              <TouchableOpacity
                key={instructor.id}
                style={styles.instructorCard}
                onPress={() => {
                  setSelectedInstructor(instructor);
                  setStep('booking-form');
                }}
              >
                <Text style={styles.instructorName}>{instructor.name}</Text>
                {instructor.bio && (
                  <Text style={styles.instructorBio}>{instructor.bio}</Text>
                )}
                <View style={styles.instructorMeta}>
                  <Text style={styles.instructorRate}>💷 £{instructor.hourlyRate}/hr</Text>
                  {instructor.rating && (
                    <Text style={styles.instructorRating}>⭐ {instructor.rating}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // Step: Booking Form
  if (step === 'booking-form' && selectedInstructor) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('instructor-search')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book with {selectedInstructor.name}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Your Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            value={clientName}
            onChangeText={setClientName}
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="john@example.com"
            value={clientEmail}
            onChangeText={setClientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Phone *</Text>
          <TextInput
            style={styles.input}
            placeholder="+44 7123 456789"
            value={clientPhone}
            onChangeText={setClientPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Date (DD/MM/YYYY) *</Text>
          <TextInput
            style={styles.input}
            placeholder="25/12/2024"
            value={date}
            onChangeText={setDate}
          />

          <Text style={styles.label}>Time (HH:MM) *</Text>
          <TextInput
            style={styles.input}
            placeholder="14:00"
            value={time}
            onChangeText={setTime}
          />

          <Text style={styles.label}>Duration (minutes)</Text>
          <View style={styles.buttonGroup}>
            {['60', '90', '120'].map((dur) => (
              <TouchableOpacity
                key={dur}
                style={[styles.durationButton, duration === dur && styles.durationButtonActive]}
                onPress={() => setDuration(dur)}
              >
                <Text
                  style={[styles.durationButtonText, duration === dur && styles.durationButtonTextActive]}
                >
                  {dur}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Pickup Address *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="123 Main Street, London"
            value={pickupAddress}
            onChangeText={setPickupAddress}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any special requests..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setCreateAccount(!createAccount)}
            >
              <Text style={createAccount ? styles.checkboxChecked : styles.checkboxUnchecked}>
                {createAccount ? '✓' : ''}
              </Text>
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>Create account (optional)</Text>
          </View>

          {createAccount && (
            <>
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmitBooking}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 40,
    color: 'white',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  headerSubtitle: {
    color: '#dbeafe',
    marginTop: 5,
  },
  backButton: {
    color: 'white',
    fontSize: 16,
  },
  instructorsList: {
    padding: 10,
  },
  instructorCard: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  instructorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  instructorBio: {
    color: '#6b7280',
    marginTop: 5,
    fontSize: 14,
  },
  instructorMeta: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 15,
  },
  instructorRate: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  instructorRating: {
    color: '#f59e0b',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  durationButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  durationButtonTextActive: {
    color: 'white',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  checkboxChecked: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxUnchecked: {
    color: 'white',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
