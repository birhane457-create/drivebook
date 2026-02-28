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
  Switch,
  Linking,
  Modal,
} from 'react-native';
import { settingsAPI, calendarAPI } from '../services/api';

interface TimeSlot {
  start: string;
  end: string;
}

interface WorkingHours {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('60');
  const [serviceRadius, setServiceRadius] = useState('20');
  const [bookingBuffer, setBookingBuffer] = useState(15);
  const [enableTravelTime, setEnableTravelTime] = useState(false);
  const [travelTime, setTravelTime] = useState(10);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([60, 120]);
  const [calendarBufferMode, setCalendarBufferMode] = useState<'auto' | 'manual'>('auto');
  const [workingHours, setWorkingHours] = useState<WorkingHours>({
    monday: [{ start: '09:00', end: '17:00' }],
    tuesday: [{ start: '09:00', end: '17:00' }],
    wednesday: [{ start: '09:00', end: '17:00' }],
    thursday: [{ start: '09:00', end: '17:00' }],
    friday: [{ start: '09:00', end: '17:00' }],
    saturday: [{ start: '09:00', end: '13:00' }],
    sunday: [],
  });

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState({
    pricing: false,
    serviceArea: false,
    booking: false,
    workingHours: false,
    calendar: false,
  });

  // Info tooltip state
  const [showInfo, setShowInfo] = useState<string | null>(null);

  // Calendar state
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);

  useEffect(() => {
    loadSettings();
    checkCalendarConnection();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.get();
      const data = response.data;
      
      if (data) {
        setHourlyRate(data.hourlyRate?.toString() || '60');
        setServiceRadius(data.serviceRadiusKm?.toString() || '20');
        setBookingBuffer(data.bookingBufferMinutes || 15);
        setEnableTravelTime(data.enableTravelTime || false);
        setTravelTime(data.travelTimeMinutes || 10);
        setAllowedDurations(data.allowedDurations || [60, 120]);
        if (data.workingHours) {
          setWorkingHours(data.workingHours);
        }
      }
    } catch (error: any) {
      console.error('Load settings error:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const checkCalendarConnection = async () => {
    try {
      const response = await calendarAPI.getStatus();
      setCalendarConnected(response.data.connected || false);
      setCalendarBufferMode(response.data.bufferMode || 'auto');
    } catch (error) {
      console.error('Check calendar error:', error);
      // Silently fail - calendar feature is optional
      // Don't show error to user, just assume not connected
      setCalendarConnected(false);
      setCalendarBufferMode('auto');
    }
  };

  const handleSave = async () => {
    // Validation
    if (!hourlyRate || parseFloat(hourlyRate) <= 0) {
      Alert.alert('Error', 'Please enter a valid hourly rate');
      return;
    }
    if (allowedDurations.length === 0) {
      Alert.alert('Error', 'Please select at least one lesson duration');
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.update({
        hourlyRate: parseFloat(hourlyRate),
        serviceRadiusKm: parseInt(serviceRadius),
        bookingBufferMinutes: bookingBuffer,
        enableTravelTime,
        travelTimeMinutes: travelTime,
        allowedDurations,
        workingHours,
      });

      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error: any) {
      console.error('Save settings error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleDuration = (duration: number) => {
    if (allowedDurations.includes(duration)) {
      // Don't allow removing if it's the last one
      if (allowedDurations.length === 1) {
        Alert.alert('Error', 'You must have at least one lesson duration');
        return;
      }
      setAllowedDurations(allowedDurations.filter(d => d !== duration));
    } else {
      setAllowedDurations([...allowedDurations, duration].sort((a, b) => a - b));
    }
  };

  const updateWorkingHours = (day: keyof WorkingHours, field: 'start' | 'end', value: string) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: prev[day].length > 0 
        ? [{ ...prev[day][0], [field]: value }]
        : [{ start: field === 'start' ? value : '09:00', end: field === 'end' ? value : '17:00' }]
    }));
  };

  const toggleDayOff = (day: keyof WorkingHours) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: prev[day].length > 0 ? [] : [{ start: '09:00', end: '17:00' }]
    }));
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const showInfoTooltip = (key: string) => {
    setShowInfo(key);
  };

  const hideInfoTooltip = () => {
    setShowInfo(null);
  };

  const InfoButton = ({ infoKey, text }: { infoKey: string; text: string }) => (
    <>
      <TouchableOpacity
        onPress={() => showInfoTooltip(infoKey)}
        style={styles.infoButton}
      >
        <Text style={styles.infoButtonText}>ℹ️</Text>
      </TouchableOpacity>
      <Modal
        visible={showInfo === infoKey}
        transparent={true}
        animationType="fade"
        onRequestClose={hideInfoTooltip}
      >
        <TouchableOpacity 
          style={styles.tooltipOverlay}
          activeOpacity={1}
          onPress={hideInfoTooltip}
        >
          <View style={styles.tooltipContainer}>
            <View style={styles.tooltip}>
              <ScrollView style={styles.tooltipScroll} showsVerticalScrollIndicator={true}>
                <Text style={styles.tooltipText}>{text}</Text>
              </ScrollView>
              <TouchableOpacity onPress={hideInfoTooltip} style={styles.tooltipClose}>
                <Text style={styles.tooltipCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );

  const handleConnectCalendar = async () => {
    try {
      setCalendarLoading(true);
      const response = await calendarAPI.connect();
      const authUrl = response.data.authUrl;
      
      Alert.alert(
        'Connect Google Calendar',
        'You will be redirected to Google to authorize calendar access. After authorization, return to the app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              Linking.openURL(authUrl).catch(err => {
                Alert.alert('Error', 'Failed to open browser');
                console.error('Failed to open URL:', err);
              });
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to connect calendar');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    Alert.alert(
      'Disconnect Calendar',
      'Are you sure you want to disconnect Google Calendar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setCalendarLoading(true);
              await calendarAPI.disconnect();
              setCalendarConnected(false);
              Alert.alert('Success', 'Calendar disconnected');
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect calendar');
            } finally {
              setCalendarLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSyncCalendar = async () => {
    try {
      setCalendarSyncing(true);
      const response = await calendarAPI.sync();
      Alert.alert('Success', `Synced ${response.data.eventsProcessed || 0} events`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to sync calendar');
    } finally {
      setCalendarSyncing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  const days: Array<{ key: keyof WorkingHours; label: string }> = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Pricing Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('pricing')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>💰 Pricing</Text>
              <InfoButton 
                infoKey="pricing" 
                text="Your base hourly rate for driving lessons. This is what students will be charged per hour." 
              />
            </View>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.sectionValue}>${hourlyRate}/hr</Text>
              <Text style={styles.expandIcon}>{expandedSections.pricing ? '▼' : '▶'}</Text>
            </View>
          </TouchableOpacity>
          
          {expandedSections.pricing && (
            <View style={styles.sectionContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Hourly Rate ($)</Text>
                <TextInput
                  style={styles.input}
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  keyboardType="decimal-pad"
                  placeholder="60"
                />
              </View>
            </View>
          )}
        </View>

        {/* Service Area Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('serviceArea')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>📍 Service Area</Text>
              <InfoButton 
                infoKey="serviceArea" 
                text="Maximum distance you're willing to travel for student pickups. Students outside this radius won't be able to book." 
              />
            </View>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.sectionValue}>{serviceRadius}km</Text>
              <Text style={styles.expandIcon}>{expandedSections.serviceArea ? '▼' : '▶'}</Text>
            </View>
          </TouchableOpacity>
          
          {expandedSections.serviceArea && (
            <View style={styles.sectionContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Service Radius (km)</Text>
                <TextInput
                  style={styles.input}
                  value={serviceRadius}
                  onChangeText={setServiceRadius}
                  keyboardType="number-pad"
                  placeholder="20"
                />
              </View>
            </View>
          )}
        </View>

        {/* Booking Settings Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('booking')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>⏱️ Booking Preferences</Text>
              <InfoButton 
                infoKey="booking" 
                text="Control lesson durations you offer, buffer time between lessons, and optional travel time settings." 
              />
            </View>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.sectionValue}>{allowedDurations.length} durations</Text>
              <Text style={styles.expandIcon}>{expandedSections.booking ? '▼' : '▶'}</Text>
            </View>
          </TouchableOpacity>
          
          {expandedSections.booking && (
            <View style={styles.sectionContent}>
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Lesson Durations You Offer</Text>
                  <InfoButton 
                    infoKey="durations" 
                    text="Select which lesson lengths you offer. Students can only book these durations. Must select at least one." 
                  />
                </View>
                <View style={styles.durationGrid}>
                  {[30, 60, 90, 120].map((duration) => (
                    <TouchableOpacity
                      key={duration}
                      style={[
                        styles.durationChip,
                        allowedDurations.includes(duration) && styles.durationChipActive
                      ]}
                      onPress={() => toggleDuration(duration)}
                    >
                      <Text style={[
                        styles.durationChipText,
                        allowedDurations.includes(duration) && styles.durationChipTextActive
                      ]}>
                        {duration === 30 ? '30 min' : duration === 60 ? '1 hour' : duration === 90 ? '1.5 hours' : '2 hours'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Buffer Between Bookings</Text>
                  <InfoButton 
                    infoKey="buffer" 
                    text="Time for rest, paperwork, and preparation between students. Always applied." 
                  />
                </View>
                <View style={styles.segmentedControl}>
                  {[10, 15, 20].map((minutes) => (
                    <TouchableOpacity
                      key={minutes}
                      style={[
                        styles.segmentButton,
                        bookingBuffer === minutes && styles.segmentButtonActive
                      ]}
                      onPress={() => setBookingBuffer(minutes)}
                    >
                      <Text style={[
                        styles.segmentButtonText,
                        bookingBuffer === minutes && styles.segmentButtonTextActive
                      ]}>
                        {minutes}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>Add travel time between bookings</Text>
                      <InfoButton 
                        infoKey="travel" 
                        text="Optional: Add extra time on top of buffer for traveling between locations." 
                      />
                    </View>
                  </View>
                  <Switch
                    value={enableTravelTime}
                    onValueChange={setEnableTravelTime}
                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                    thumbColor={enableTravelTime ? '#2563EB' : '#F3F4F6'}
                  />
                </View>
              </View>

              {enableTravelTime && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Travel Time (minutes)</Text>
                  <View style={styles.segmentedControl}>
                    {[5, 10, 15, 20].map((minutes) => (
                      <TouchableOpacity
                        key={minutes}
                        style={[
                          styles.segmentButton,
                          travelTime === minutes && styles.segmentButtonActive
                        ]}
                        onPress={() => setTravelTime(minutes)}
                      >
                        <Text style={[
                          styles.segmentButtonText,
                          travelTime === minutes && styles.segmentButtonTextActive
                        ]}>
                          {minutes}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Schedule Example */}
              <View style={styles.scheduleExample}>
                <Text style={styles.scheduleExampleTitle}>📅 Schedule Example:</Text>
                <Text style={styles.scheduleExampleText}>
                  Lesson: 1 hour (9:00-10:00)
                </Text>
                <Text style={styles.scheduleExampleText}>
                  Buffer: {bookingBuffer} minutes (10:00-10:{bookingBuffer.toString().padStart(2, '0')})
                </Text>
                {enableTravelTime && (
                  <Text style={styles.scheduleExampleText}>
                    Travel: {travelTime} minutes (10:{bookingBuffer.toString().padStart(2, '0')}-10:{(bookingBuffer + travelTime).toString().padStart(2, '0')})
                  </Text>
                )}
                <Text style={[styles.scheduleExampleText, styles.scheduleExampleTotal]}>
                  Total blocked: {60 + bookingBuffer + (enableTravelTime ? travelTime : 0)} minutes
                </Text>
                <Text style={[styles.scheduleExampleText, styles.scheduleExampleTotal]}>
                  Next available: {enableTravelTime 
                    ? `10:${(bookingBuffer + travelTime).toString().padStart(2, '0')}`
                    : `10:${bookingBuffer.toString().padStart(2, '0')}`
                  }
                </Text>
              </View>

              {/* PDA Test Buffer Mode */}
              {calendarConnected && (
                <View style={styles.pdaBufferSection}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>PDA Test Buffer Mode</Text>
                    <InfoButton 
                      infoKey="pdaBuffer" 
                      text="Choose how the system handles PDA test blocking times when syncing from Google Calendar." 
                    />
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.bufferModeOption, calendarBufferMode === 'auto' && styles.bufferModeOptionActive]}
                    onPress={() => setCalendarBufferMode('auto')}
                  >
                    <View style={styles.bufferModeRadio}>
                      {calendarBufferMode === 'auto' && <View style={styles.bufferModeRadioInner} />}
                    </View>
                    <View style={styles.bufferModeContent}>
                      <Text style={styles.bufferModeTitle}>Automatic Buffer</Text>
                      <Text style={styles.bufferModeDesc}>
                        System blocks 2h before + 1h after PDA tests
                      </Text>
                      <Text style={styles.bufferModeExample}>
                        Test 10:00-11:00 → Blocks 8:00-12:00
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bufferModeOption, calendarBufferMode === 'manual' && styles.bufferModeOptionActive]}
                    onPress={() => setCalendarBufferMode('manual')}
                  >
                    <View style={styles.bufferModeRadio}>
                      {calendarBufferMode === 'manual' && <View style={styles.bufferModeRadioInner} />}
                    </View>
                    <View style={styles.bufferModeContent}>
                      <Text style={styles.bufferModeTitle}>Manual Buffer</Text>
                      <Text style={styles.bufferModeDesc}>
                        You set exact times in Google Calendar
                      </Text>
                      <Text style={styles.bufferModeExample}>
                        Create event 8:00-12:00 → Blocks 8:00-12:00
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Working Hours Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('workingHours')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>🕐 Working Hours</Text>
              <InfoButton 
                infoKey="workingHours" 
                text="Set your available hours for each day. Toggle days on/off and set start/end times." 
              />
            </View>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.sectionValue}>
                {Object.values(workingHours).filter(h => h.length > 0).length} days
              </Text>
              <Text style={styles.expandIcon}>{expandedSections.workingHours ? '▼' : '▶'}</Text>
            </View>
          </TouchableOpacity>
          
          {expandedSections.workingHours && (
            <View style={styles.sectionContent}>
              {days.map(({ key, label }) => {
                const isWorking = workingHours[key].length > 0;
                const slot = workingHours[key][0];

                return (
                  <View key={key} style={styles.compactDayRow}>
                    <View style={styles.dayRowHeader}>
                      <Text style={styles.compactDayLabel}>{label.substring(0, 3)}</Text>
                      <TouchableOpacity
                        style={[styles.compactDayToggle, isWorking && styles.compactDayToggleActive]}
                        onPress={() => toggleDayOff(key)}
                      >
                        <Text style={[styles.compactDayToggleText, isWorking && styles.compactDayToggleTextActive]}>
                          {isWorking ? '✓' : '✕'}
                        </Text>
                      </TouchableOpacity>
                      {isWorking && slot && (
                        <View style={styles.compactTimeDisplay}>
                          <TextInput
                            style={styles.compactTimeInput}
                            value={slot.start}
                            onChangeText={(value) => updateWorkingHours(key, 'start', value)}
                            placeholder="09:00"
                          />
                          <Text style={styles.compactTimeSeparator}>-</Text>
                          <TextInput
                            style={styles.compactTimeInput}
                            value={slot.end}
                            onChangeText={(value) => updateWorkingHours(key, 'end', value)}
                            placeholder="17:00"
                          />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Google Calendar Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('calendar')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>📅 Google Calendar</Text>
              <InfoButton 
                infoKey="calendar" 
                text="Sync your Google Calendar to automatically block booking times when you have other appointments. Prevents double bookings." 
              />
            </View>
            <View style={styles.sectionHeaderRight}>
              <Text style={[styles.sectionValue, calendarConnected && styles.connectedText]}>
                {calendarConnected ? 'Connected' : 'Not connected'}
              </Text>
              <Text style={styles.expandIcon}>{expandedSections.calendar ? '▼' : '▶'}</Text>
            </View>
          </TouchableOpacity>
          
          {expandedSections.calendar && (
            <View style={styles.sectionContent}>
              {calendarConnected ? (
                <View style={styles.calendarActions}>
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedBadgeText}>✓ Connected to Google Calendar</Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.syncButton}
                    onPress={handleSyncCalendar}
                    disabled={calendarSyncing}
                  >
                    {calendarSyncing ? (
                      <ActivityIndicator color="#2563EB" size="small" />
                    ) : (
                      <>
                        <Text style={styles.syncButtonIcon}>🔄</Text>
                        <Text style={styles.syncButtonText}>Sync Now</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={handleDisconnectCalendar}
                    disabled={calendarLoading}
                  >
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  </TouchableOpacity>

                  <View style={styles.privacyNote}>
                    <Text style={styles.privacyNoteIcon}>🔒</Text>
                    <Text style={styles.privacyNoteText}>
                      Syncs your calendar events to block booking times. Auto-syncs every hour. PDA buffer mode can be set in Booking Preferences above.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.calendarActions}>
                  <TouchableOpacity
                    style={styles.connectButton}
                    onPress={handleConnectCalendar}
                    disabled={calendarLoading}
                  >
                    {calendarLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.connectButtonIcon}>🔗</Text>
                        <Text style={styles.connectButtonText}>Connect Google Calendar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Settings</Text>
            )}
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sectionValue: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  connectedText: {
    color: '#10B981',
  },
  expandIcon: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  infoButton: {
    padding: 4,
  },
  infoButtonText: {
    fontSize: 16,
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '70%',
  },
  tooltip: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: '100%',
  },
  tooltipScroll: {
    maxHeight: '100%',
  },
  tooltipText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    paddingRight: 32,
    paddingBottom: 8,
  },
  tooltipClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
  },
  tooltipCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  segmentButtonTextActive: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationChip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  durationChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  durationChipTextActive: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  scheduleExample: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  scheduleExampleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 6,
  },
  scheduleExampleText: {
    fontSize: 11,
    color: '#1E40AF',
    marginBottom: 2,
  },
  scheduleExampleTotal: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
    fontWeight: '600',
  },
  pdaBufferSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  // Compact working hours styles
  compactDayRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dayRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactDayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    width: 40,
  },
  compactDayToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactDayToggleActive: {
    backgroundColor: '#10B981',
  },
  compactDayToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  compactDayToggleTextActive: {
    color: '#fff',
  },
  compactTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  compactTimeInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: '#1F2937',
    textAlign: 'center',
  },
  compactTimeSeparator: {
    fontSize: 14,
    color: '#6B7280',
  },
  dayRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  dayToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  dayToggleActive: {
    backgroundColor: '#10B981',
  },
  dayToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  dayToggleTextActive: {
    color: '#fff',
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  timeSeparator: {
    fontSize: 18,
    color: '#6B7280',
    marginTop: 20,
  },
  calendarActions: {
    gap: 12,
  },
  connectedBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  connectedBadgeText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: 'bold',
  },
  connectButton: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButtonIcon: {
    fontSize: 18,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  syncButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  syncButtonIcon: {
    fontSize: 16,
  },
  syncButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  privacyNoteIcon: {
    fontSize: 16,
  },
  privacyNoteText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  bufferModeOption: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  bufferModeOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  bufferModeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bufferModeRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  bufferModeContent: {
    flex: 1,
  },
  bufferModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  bufferModeDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  bufferModeExample: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  buttonContainer: {
    padding: 16,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
