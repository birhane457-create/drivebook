import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

export default function HelpScreen() {
  const [expandedSections, setExpandedSections] = useState({
    howItWorks: false,
    eventTypes: false,
    stepByStep: false,
    importantNotes: false,
    quickReference: false,
    examples: false,
    troubleshooting: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const Section = ({ 
    title, 
    icon, 
    sectionKey, 
    children 
  }: { 
    title: string; 
    icon: string; 
    sectionKey: keyof typeof expandedSections; 
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(sectionKey)}
      >
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionIcon}>{icon}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Text style={styles.expandIcon}>
          {expandedSections[sectionKey] ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>
      {expandedSections[sectionKey] && (
        <View style={styles.sectionContent}>{children}</View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Help Center</Text>
        <Text style={styles.headerSubtitle}>
          Learn how to use DriveBook effectively
        </Text>
      </View>

      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>📅</Text>
          <Text style={styles.cardTitle}>Google Calendar Integration</Text>
        </View>

        {/* How It Works */}
        <Section title="How It Works" icon="ℹ️" sectionKey="howItWorks">
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>2-Way Sync:</Text>
            <Text style={styles.infoText}>
              Events sync between DriveBook and Google Calendar
            </Text>
            <Text style={styles.bulletPoint}>
              ✅ Bookings created in DriveBook → Appear in Google Calendar
            </Text>
            <Text style={styles.bulletPoint}>
              ✅ Events created in Google Calendar → Block booking slots
            </Text>
            <Text style={styles.bulletPoint}>
              ✅ Cancelled bookings → Removed from Google Calendar
            </Text>
          </View>
        </Section>

        {/* Event Types */}
        <Section title="Event Types & Keywords" icon="📖" sectionKey="eventTypes">
          <View style={[styles.alertBox, styles.warningBox]}>
            <Text style={styles.alertTitle}>⚠️ IMPORTANT: Driving Keywords Required</Text>
            <Text style={styles.alertText}>
              To prevent personal reminders from blocking booking slots, events MUST contain at least one driving-related keyword.
            </Text>
          </View>

          {/* Driving Keywords */}
          <View style={[styles.keywordBox, styles.successBox]}>
            <Text style={styles.keywordTitle}>
              🟢 Driving-Related Keywords (Required)
            </Text>
            <Text style={styles.keywordSubtitle}>
              Include AT LEAST ONE of these keywords:
            </Text>
            <View style={styles.keywordList}>
              <Text style={styles.keyword}>• Lesson</Text>
              <Text style={styles.keyword}>• Driving</Text>
              <Text style={styles.keyword}>• PDA</Text>
              <Text style={styles.keyword}>• Test</Text>
              <Text style={styles.keyword}>• Student</Text>
              <Text style={styles.keyword}>• Client</Text>
              <Text style={styles.keyword}>• Pickup</Text>
              <Text style={styles.keyword}>• Practice</Text>
              <Text style={styles.keyword}>• Training</Text>
              <Text style={styles.keyword}>• Instruction</Text>
            </View>
            <View style={styles.exampleBox}>
              <Text style={styles.exampleTitle}>✅ Examples:</Text>
              <Text style={styles.exampleText}>
                "John - Lesson", "Driving with Sarah", "Student Pickup"
              </Text>
            </View>
            <View style={[styles.exampleBox, styles.errorBox]}>
              <Text style={styles.exampleTitle}>❌ Will NOT sync:</Text>
              <Text style={styles.exampleText}>
                "Doctor Appointment", "Buy Groceries", "Meeting"
              </Text>
            </View>
          </View>

          {/* Regular Lessons */}
          <View style={styles.eventTypeBox}>
            <Text style={styles.eventTypeTitle}>🔵 Regular Driving Lessons</Text>
            <Text style={styles.eventTypeDesc}>
              Use driving keywords WITHOUT PDA keywords:
            </Text>
            <View style={styles.eventExamples}>
              <Text style={styles.eventExample}>• "Driving Lesson - John"</Text>
              <Text style={styles.eventExample}>• "Student Pickup - Sarah"</Text>
              <Text style={styles.eventExample}>• "Practice Session"</Text>
            </View>
            <View style={styles.blockingInfo}>
              <Text style={styles.blockingTitle}>Blocking:</Text>
              <Text style={styles.blockingText}>Blocks exact event time only</Text>
              <Text style={styles.blockingExample}>
                Example: Event 2:00-3:00 PM → Blocks 2:00-3:00 PM
              </Text>
            </View>
          </View>

          {/* PDA Tests */}
          <View style={[styles.eventTypeBox, styles.pdaBox]}>
            <Text style={styles.eventTypeTitle}>🟠 PDA Tests (Extended Blocking)</Text>
            <Text style={styles.eventTypeDesc}>Include ANY of these PDA keywords:</Text>
            <View style={styles.eventExamples}>
              <Text style={styles.eventExample}>• "PDA Test"</Text>
              <Text style={styles.eventExample}>• "Driving Test"</Text>
              <Text style={styles.eventExample}>• "Practical Test"</Text>
              <Text style={styles.eventExample}>• "Assessment"</Text>
              <Text style={styles.eventExample}>• "Examination"</Text>
              <Text style={styles.eventExample}>• "Test Center"</Text>
            </View>
            <View style={[styles.blockingInfo, styles.pdaBlocking]}>
              <Text style={styles.blockingTitle}>⚠️ Extended Blocking:</Text>
              <Text style={styles.blockingText}>
                Blocks 2 hours BEFORE + 1 hour AFTER
              </Text>
              <Text style={styles.blockingExample}>
                Example: Test 10:00-11:00 AM → Blocks 8:00 AM - 12:00 PM
              </Text>
              <Text style={styles.blockingReason}>
                Why? Gives you prep time before and debrief time after
              </Text>
            </View>
          </View>
        </Section>

        {/* Step by Step */}
        <Section title="Step-by-Step Guide" icon="✅" sectionKey="stepByStep">
          <View style={styles.scenarioBox}>
            <Text style={styles.scenarioTitle}>
              📅 Scenario 1: Manual Booking in Google Calendar
            </Text>
            <Text style={styles.step}>1. Open Google Calendar</Text>
            <Text style={styles.step}>
              2. Create new event with client name (e.g., "John Smith - Lesson")
            </Text>
            <Text style={styles.step}>
              3. Set date and time (e.g., Tomorrow 2:00-3:00 PM)
            </Text>
            <Text style={styles.step}>
              4. Add client phone/address in description (optional)
            </Text>
            <Text style={styles.step}>5. Save event</Text>
            <Text style={styles.step}>
              6. Go to DriveBook → Settings → Click "Sync Now"
            </Text>
            <Text style={styles.step}>
              7. ✅ That time slot is now blocked for online bookings
            </Text>
          </View>

          <View style={styles.scenarioBox}>
            <Text style={styles.scenarioTitle}>🚗 Scenario 2: PDA Test Scheduled</Text>
            <Text style={styles.step}>1. Open Google Calendar</Text>
            <Text style={styles.step}>
              2. Create event: "PDA Test - Sarah Johnson"
            </Text>
            <Text style={styles.step}>
              3. Set test time (e.g., Feb 25, 10:00-11:00 AM)
            </Text>
            <Text style={styles.step}>4. Add test center address in location</Text>
            <Text style={styles.step}>5. Save event</Text>
            <Text style={styles.step}>
              6. Go to DriveBook → Settings → Click "Sync Now"
            </Text>
            <Text style={styles.step}>
              7. ✅ System blocks 8:00 AM - 12:00 PM (2 hours before + 1 hour after)
            </Text>
          </View>

          <View style={styles.scenarioBox}>
            <Text style={styles.scenarioTitle}>💻 Scenario 3: Client Books Online</Text>
            <Text style={styles.step}>1. Client visits your booking page</Text>
            <Text style={styles.step}>
              2. Selects date, time, and enters details
            </Text>
            <Text style={styles.step}>3. Confirms booking</Text>
            <Text style={styles.step}>4. ✅ Booking appears in DriveBook dashboard</Text>
            <Text style={styles.step}>
              5. ✅ Event automatically created in your Google Calendar
            </Text>
            <Text style={styles.step}>6. ✅ You receive email notification</Text>
          </View>
        </Section>

        {/* Important Notes */}
        <Section title="Important Notes" icon="⚠️" sectionKey="importantNotes">
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>🚗 Travel Time Buffer:</Text>
            <Text style={styles.noteText}>
              The system automatically adds travel time between bookings. If you finish a lesson at one location and the next student is 10 minutes away, that travel time is blocked so the next student gets their full lesson time.
            </Text>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>⏰ All-Day Events:</Text>
            <Text style={styles.noteText}>
              All-day events are ignored. Only events with specific start/end times are synced.
            </Text>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>🔄 Sync Frequency:</Text>
            <Text style={styles.noteText}>
              Automatic sync runs every hour. Click "Sync Now" for immediate sync.
            </Text>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>🔒 Privacy:</Text>
            <Text style={styles.noteText}>
              We only read/write calendar events. We never access your emails or other Google services.
            </Text>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>⚠️ Case Insensitive:</Text>
            <Text style={styles.noteText}>
              Keywords work in any case - "PDA Test", "pda test", "PDA TEST" all work the same.
            </Text>
          </View>
        </Section>

        {/* Quick Reference */}
        <Section title="Quick Reference Card" icon="⏱️" sectionKey="quickReference">
          <View style={styles.referenceTable}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Event Type</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Keywords</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Blocking</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Regular Lesson</Text>
              <Text style={styles.tableCell}>Driving (no PDA)</Text>
              <Text style={styles.tableCell}>Exact time</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>PDA Test</Text>
              <Text style={styles.tableCell}>Driving + PDA</Text>
              <Text style={styles.tableCell}>-2h to +1h</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Personal</Text>
              <Text style={styles.tableCell}>No driving</Text>
              <Text style={styles.tableCell}>Not synced</Text>
            </View>
          </View>
          <View style={styles.keywordSummary}>
            <Text style={styles.keywordSummaryTitle}>Driving Keywords:</Text>
            <Text style={styles.keywordSummaryText}>
              Lesson, Driving, PDA, Test, Student, Client, Pickup, Practice, Training, Instruction
            </Text>
          </View>
        </Section>

        {/* Examples */}
        <Section title="Examples" icon="💡" sectionKey="examples">
          <Text style={styles.examplesTitle}>✅ Good Examples</Text>
          <View style={styles.goodExample}>
            <Text style={styles.exampleLabel}>Regular Lesson:</Text>
            <Text style={styles.exampleValue}>
              "John Smith - Driving Lesson" → Syncs & blocks exact time
            </Text>
          </View>
          <View style={styles.goodExample}>
            <Text style={styles.exampleLabel}>PDA Test:</Text>
            <Text style={styles.exampleValue}>
              "Sarah - PDA Test at Licensing Center" → Syncs & blocks -2h to +1h
            </Text>
          </View>
          <View style={styles.goodExample}>
            <Text style={styles.exampleLabel}>Practice:</Text>
            <Text style={styles.exampleValue}>
              "Student Practice Session" → Syncs & blocks exact time
            </Text>
          </View>

          <Text style={[styles.examplesTitle, styles.badExamplesTitle]}>
            ❌ Will NOT Sync (No Driving Keywords)
          </Text>
          <View style={styles.badExample}>
            <Text style={styles.exampleLabel}>Personal:</Text>
            <Text style={styles.exampleValue}>
              "Doctor Appointment" → Not synced (no driving keyword)
            </Text>
          </View>
          <View style={styles.badExample}>
            <Text style={styles.exampleLabel}>Reminder:</Text>
            <Text style={styles.exampleValue}>
              "Buy Groceries" → Not synced (no driving keyword)
            </Text>
          </View>
          <View style={styles.badExample}>
            <Text style={styles.exampleLabel}>Meeting:</Text>
            <Text style={styles.exampleValue}>
              "Lunch with Friend" → Not synced (no driving keyword)
            </Text>
          </View>
        </Section>

        {/* Troubleshooting */}
        <Section title="Troubleshooting" icon="🔧" sectionKey="troubleshooting">
          <View style={styles.troubleshootItem}>
            <Text style={styles.troubleshootQ}>Q: Event not blocking slots?</Text>
            <Text style={styles.troubleshootA}>
              → Click "Sync Now" in Settings. Check event has specific times (not all-day).
            </Text>
          </View>
          <View style={styles.troubleshootItem}>
            <Text style={styles.troubleshootQ}>
              Q: PDA test not getting extended buffer?
            </Text>
            <Text style={styles.troubleshootA}>
              → Make sure title/description contains one of the PDA keywords.
            </Text>
          </View>
          <View style={styles.troubleshootItem}>
            <Text style={styles.troubleshootQ}>
              Q: Booking not appearing in Google Calendar?
            </Text>
            <Text style={styles.troubleshootA}>
              → Check "Connected to Google Calendar" in Settings. May need to reconnect.
            </Text>
          </View>
        </Section>
      </View>

      {/* Contact Support */}
      <View style={styles.supportCard}>
        <Text style={styles.supportTitle}>Need More Help?</Text>
        <Text style={styles.supportText}>
          Contact support or check Settings for more options
        </Text>
      </View>

      <View style={styles.bottomPadding} />
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  mainCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  section: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  expandIcon: {
    fontSize: 14,
    color: '#6B7280',
  },
  sectionContent: {
    padding: 16,
    gap: 12,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  infoTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#1E40AF',
  },
  infoText: {
    fontSize: 13,
    color: '#1E3A8A',
  },
  bulletPoint: {
    fontSize: 13,
    color: '#1E3A8A',
    marginLeft: 8,
  },
  alertBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  alertTitle: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#78350F',
    marginBottom: 6,
  },
  alertText: {
    fontSize: 13,
    color: '#92400E',
  },
  keywordBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#6EE7B7',
  },
  keywordTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#065F46',
    marginBottom: 6,
  },
  keywordSubtitle: {
    fontSize: 13,
    color: '#047857',
    marginBottom: 8,
  },
  keywordList: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  keyword: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#111827',
  },
  exampleBox: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  exampleTitle: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 12,
    color: '#374151',
  },
  eventTypeBox: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pdaBox: {
    borderColor: '#FDBA74',
  },
  eventTypeTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 6,
  },
  eventTypeDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  eventExamples: {
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 10,
    gap: 4,
    marginBottom: 8,
  },
  eventExample: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#111827',
  },
  blockingInfo: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 6,
    padding: 10,
  },
  pdaBlocking: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  blockingTitle: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  blockingText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  blockingExample: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  blockingReason: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  scenarioBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  scenarioTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
    color: '#111827',
  },
  step: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    lineHeight: 18,
  },
  noteBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  noteTitle: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  referenceTable: {
    borderWidth: 2,
    borderColor: '#C084FC',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FAF5FF',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E9D5FF',
    borderBottomWidth: 2,
    borderBottomColor: '#C084FC',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E9D5FF',
  },
  tableCell: {
    flex: 1,
    padding: 10,
    fontSize: 12,
    color: '#374151',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    color: '#581C87',
  },
  keywordSummary: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F3E8FF',
    borderTopWidth: 1,
    borderTopColor: '#C084FC',
    borderRadius: 6,
  },
  keywordSummaryTitle: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
    color: '#581C87',
  },
  keywordSummaryText: {
    fontSize: 11,
    color: '#6B21A8',
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  badExamplesTitle: {
    marginTop: 16,
  },
  goodExample: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  badExample: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  exampleLabel: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  exampleValue: {
    fontSize: 12,
    color: '#374151',
  },
  troubleshootItem: {
    marginBottom: 12,
  },
  troubleshootQ: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  troubleshootA: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
  },
  supportCard: {
    backgroundColor: '#2563EB',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: '#DBEAFE',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
});
