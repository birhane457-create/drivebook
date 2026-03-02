import { useState, useEffect } from 'react';
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
import { clientsAPI, bookingAPI, availabilityAPI } from '../services/api';

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

export default function NewBookingScreen({ onBack }: { onBack: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [instructorId, setInstructorId] = useState('');
  const [hourlyRate, setHourlyRate] = useState(0);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([60, 120]);
  
  // Form state
  const [bookingType, setBookingType] = useState<'LESSON' | 'MOCK_TEST' | 'PDA_TEST'>('LESSON');
  const [showBookingTypePicker, setShowBookingTypePicker] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [dateInput, setDateInput] = useState(''); // DD/MM/YY format
  const [date, setDate] = useState(''); // YYYY-MM-DD for API
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [notes, setNotes] = useState('');
  
  // PDA Test specific fields
  const [testCenterName, setTestCenterName] = useState('');
  const [testCenterAddress, setTestCenterAddress] = useState('');

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.phone.includes(clientSearch)
  );

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch time slots when date or duration changes
  useEffect(() => {
    if (date && duration && instructorId) {
      fetchTimeSlots();
    }
  }, [date, duration, instructorId]);

  const loadInitialData = async () => {
    try {
      const [clientsRes, instructorRes] = await Promise.all([
        clientsAPI.getAll(),
        availabilityAPI.getInstructorProfile()
      ]);
      
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      
      if (instructorRes.data) {
        setInstructorId(instructorRes.data.id);
        setHourlyRate(instructorRes.data.hourlyRate);
        
        // Get allowed durations from instructor settings
        const durations = instructorRes.data.allowedDurations || [60, 120];
        setAllowedDurations(durations);
        setDuration(durations[0]); // Set first allowed duration as default
      }
    } catch (error: any) {
      console.error('Load initial data error:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSlots = async () => {
    if (!instructorId || !date || !duration) return;
    
    setLoadingSlots(true);
    setSelectedTime(''); // Reset selected time when fetching new slots
    
    try {
      const response = await availabilityAPI.getSlots(instructorId, date, duration);
      setTimeSlots(response.data.slots || []);
    } catch (error: any) {
      console.error('Fetch slots error:', error);
      Alert.alert('Error', 'Failed to load available time slots');
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const calculatePrice = () => {
    const hours = duration / 60;
    return (hourlyRate * hours).toFixed(2);
  };

  const handleDateInputChange = (text: string) => {
    // Allow only numbers and slashes
    const cleaned = text.replace(/[^0-9/]/g, '');
    
    // Auto-add slashes
    let formatted = cleaned;
    if (cleaned.length >= 2 && !cleaned.includes('/')) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length >= 5 && cleaned.split('/').length === 2) {
      const parts = cleaned.split('/');
      formatted = parts[0] + '/' + parts[1].slice(0, 2) + '/' + cleaned.slice(5);
    }
    
    setDateInput(formatted);
    
    // Parse and validate when complete (DD/MM/YY)
    if (formatted.length === 8) {
      const parts = formatted.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = 2000 + parseInt(parts[2]); // Convert YY to YYYY
        
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          const parsedDate = new Date(year, month - 1, day);
          setSelectedDate(parsedDate);
          setDate(formatDateValue(parsedDate));
        }
      }
    }
  };

  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const generateCalendarDays = (currentMonth: Date) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Generate calendar grid
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const changeMonth = (direction: number) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(calendarMonth.getMonth() + direction);
    setCalendarMonth(newMonth);
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const formatDateDisplay = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatDateValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (selectedDate: Date) => {
    setSelectedDate(selectedDate);
    setDate(formatDateValue(selectedDate));
    
    // Update input field with DD/MM/YY format
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const year = String(selectedDate.getFullYear()).slice(-2);
    setDateInput(`${day}/${month}/${year}`);
    
    setShowDatePicker(false);
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedClientId) {
      Alert.alert('Error', 'Please select a client');
      return;
    }
    if (!date) {
      Alert.alert('Error', 'Please enter a date');
      return;
    }
    if (!selectedTime) {
      Alert.alert('Error', 'Please select a time slot');
      return;
    }
    
    // PDA Test specific validation
    if (bookingType === 'PDA_TEST') {
      if (!testCenterName) {
        Alert.alert('Error', 'Please enter test center name');
        return;
      }
      if (!testCenterAddress) {
        Alert.alert('Error', 'Please enter test center address');
        return;
      }
    } else {
      // Regular lesson/mock test requires pickup address
      if (!pickupAddress) {
        Alert.alert('Error', 'Please enter pickup address');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Create start and end times
      const [hours, minutes] = selectedTime.split(':');
      const startTime = new Date(date);
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + duration);

      await bookingAPI.create({
        clientId: selectedClientId,
        bookingType,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        pickupAddress: bookingType === 'PDA_TEST' ? testCenterAddress : pickupAddress,
        dropoffAddress: bookingType === 'PDA_TEST' ? testCenterAddress : (dropoffAddress || pickupAddress),
        notes,
        // PDA Test specific data
        ...(bookingType === 'PDA_TEST' && {
          testCenterName,
          testCenterAddress,
        }),
      });

      Alert.alert('Success', 'Booking created successfully!', [
        { text: 'OK', onPress: onBack }
      ]);
    } catch (error: any) {
      console.error('Create booking error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Booking</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Booking Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Type</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Type *</Text>
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowBookingTypePicker(!showBookingTypePicker)}
              >
                <Text style={styles.dropdownText}>
                  {bookingType === 'LESSON' ? 'Regular Lesson' : 
                   bookingType === 'MOCK_TEST' ? 'Mock Test' : 'PDA Test'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              
              {showBookingTypePicker && (
                <View style={styles.dropdownOptions}>
                  <TouchableOpacity
                    style={styles.dropdownOption}
                    onPress={() => {
                      setBookingType('LESSON');
                      setShowBookingTypePicker(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>Regular Lesson</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownOption}
                    onPress={() => {
                      setBookingType('MOCK_TEST');
                      setShowBookingTypePicker(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>Mock Test</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownOption}
                    onPress={() => {
                      setBookingType('PDA_TEST');
                      setShowBookingTypePicker(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>PDA Test</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Search & Select Client *</Text>
            <TextInput
              style={styles.input}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="Search by name or phone..."
              placeholderTextColor="#9CA3AF"
            />
            {clientSearch.length > 0 && (
              <View style={styles.clientListContainer}>
                {filteredClients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientChip,
                      selectedClientId === client.id && styles.clientChipSelected
                    ]}
                    onPress={() => {
                      setSelectedClientId(client.id);
                      setClientSearch(''); // Clear search after selection
                    }}
                  >
                    <Text style={[
                      styles.clientChipText,
                      selectedClientId === client.id && styles.clientChipTextSelected
                    ]}>
                      {client.name}
                    </Text>
                    <Text style={styles.clientChipPhone}>{client.phone}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {selectedClientId && (
              <View style={styles.selectedClientBadge}>
                <Text style={styles.selectedClientText}>
                  ✓ {clients.find(c => c.id === selectedClientId)?.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedClientId('')}>
                  <Text style={styles.clearClientText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date (DD/MM/YY) *</Text>
            <View style={styles.dateInputRow}>
              <TextInput
                style={[styles.input, styles.dateInput]}
                value={dateInput}
                onChangeText={handleDateInputChange}
                placeholder="25/02/26"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={8}
              />
              <TouchableOpacity
                style={styles.calendarButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.calendarButtonText}>📅</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthButton}>
                    <Text style={styles.monthButtonText}>←</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthButton}>
                    <Text style={styles.monthButtonText}>→</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeButton}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.calendarContainer}>
                  {/* Day headers */}
                  <View style={styles.weekDaysRow}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <View key={day} style={styles.weekDayCell}>
                        <Text style={styles.weekDayText}>{day}</Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Calendar grid */}
                  <View style={styles.calendarGrid}>
                    {generateCalendarDays(calendarMonth).map((day, index) => {
                      if (!day) {
                        return <View key={`empty-${index}`} style={styles.calendarDay} />;
                      }
                      
                      const isSelected = date === formatDateValue(day);
                      const isDisabled = isDateDisabled(day);
                      const isToday = formatDateValue(day) === formatDateValue(new Date());
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.calendarDay,
                            isSelected && styles.calendarDaySelected,
                            isDisabled && styles.calendarDayDisabled,
                            isToday && !isSelected && styles.calendarDayToday,
                          ]}
                          onPress={() => !isDisabled && handleDateSelect(day)}
                          disabled={isDisabled}
                        >
                          <Text style={[
                            styles.calendarDayText,
                            isSelected && styles.calendarDayTextSelected,
                            isDisabled && styles.calendarDayTextDisabled,
                            isToday && !isSelected && styles.calendarDayTextToday,
                          ]}>
                            {day.getDate()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          </Modal>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Duration *</Text>
            <View style={styles.durationButtons}>
              {allowedDurations.map((dur) => (
                <TouchableOpacity
                  key={dur}
                  style={[
                    styles.durationButton,
                    duration === dur && styles.durationButtonSelected
                  ]}
                  onPress={() => setDuration(dur)}
                >
                  <Text style={[
                    styles.durationButtonText,
                    duration === dur && styles.durationButtonTextSelected
                  ]}>
                    {dur >= 60 ? `${dur / 60}h` : `${dur}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {date && duration && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Available Time Slots *</Text>
              {loadingSlots ? (
                <View style={styles.loadingSlots}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.loadingSlotsText}>Loading available times...</Text>
                </View>
              ) : timeSlots.length === 0 ? (
                <View style={styles.noSlots}>
                  <Text style={styles.noSlotsText}>No available time slots for this date and duration</Text>
                </View>
              ) : (
                <View style={styles.slotsContainer}>
                  {timeSlots.map((slot) => (
                    <TouchableOpacity
                      key={slot.time}
                      style={[
                        styles.timeSlot,
                        selectedTime === slot.time && styles.timeSlotSelected,
                        !slot.available && styles.timeSlotDisabled
                      ]}
                      onPress={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        selectedTime === slot.time && styles.timeSlotTextSelected,
                        !slot.available && styles.timeSlotTextDisabled
                      ]}>
                        {slot.time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {selectedTime && (
            <View style={styles.priceInfo}>
              <Text style={styles.priceLabel}>Total Price:</Text>
              <Text style={styles.priceValue}>${calculatePrice()}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          {bookingType === 'PDA_TEST' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Test Center Name *</Text>
                <TextInput
                  style={styles.input}
                  value={testCenterName}
                  onChangeText={setTestCenterName}
                  placeholder="Enter test center name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Test Center Address *</Text>
                <TextInput
                  style={styles.input}
                  value={testCenterAddress}
                  onChangeText={setTestCenterAddress}
                  placeholder="Enter test center address"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pickup Address *</Text>
                <TextInput
                  style={styles.input}
                  value={pickupAddress}
                  onChangeText={setPickupAddress}
                  placeholder="Enter pickup address"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Dropoff Address</Text>
                <TextInput
                  style={styles.input}
                  value={dropoffAddress}
                  onChangeText={setDropoffAddress}
                  placeholder="Same as pickup if empty"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special instructions..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Create Booking</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onBack}
            disabled={submitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
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
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2563EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
  },
  dropdownText: {
    fontSize: 16,
    color: '#1F2937',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6B7280',
  },
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
  },
  dropdownOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  pickerContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateInput: {
    flex: 1,
  },
  calendarButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarButtonText: {
    fontSize: 20,
  },
  clientListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  clientScroll: {
    flexDirection: 'row',
  },
  clientChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  clientChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  clientChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  clientChipTextSelected: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  clientChipPhone: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  selectedClientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  selectedClientText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: 'bold',
  },
  clearClientText: {
    fontSize: 18,
    color: '#6B7280',
    paddingHorizontal: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  datePickerButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#1F2937',
  },
  datePickerIcon: {
    fontSize: 20,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  durationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 70,
    alignItems: 'center',
  },
  durationButtonSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  durationButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  durationButtonTextSelected: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  loadingSlots: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    gap: 12,
  },
  loadingSlotsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  noSlots: {
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  noSlotsText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotsScroll: {
    flexDirection: 'row',
  },
  timeSlot: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 80,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  timeSlotDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
  timeSlotText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  timeSlotTextDisabled: {
    color: '#9CA3AF',
  },
  priceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginTop: 8,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  monthButton: {
    padding: 8,
  },
  monthButtonText: {
    fontSize: 24,
    color: '#2563EB',
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280',
  },
  calendarContainer: {
    padding: 16,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  calendarDaySelected: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 16,
    color: '#1F2937',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  calendarDayTextDisabled: {
    color: '#9CA3AF',
  },
  calendarDayTextToday: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  dateList: {
    padding: 16,
  },
  dateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  dateOptionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  dateOptionTextSelected: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  dateOptionCheck: {
    fontSize: 20,
    color: '#2563EB',
    fontWeight: 'bold',
  },
});
