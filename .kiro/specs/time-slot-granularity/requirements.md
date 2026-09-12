# Time Slot Granularity Improvement

## Problem Statement

Currently, when users select a lesson duration (e.g., 2 hours), the availability calendar only shows time slots at intervals matching that duration. For example:
- 2-hour lesson: Shows slots at 09:00, 11:00, 13:00, 15:00
- This prevents booking at intermediate times like 10:00, 10:30, 11:30
- Wastes available schedule time and reduces booking flexibility

Additionally, there are two critical real-world issues:
1. **Small Gap Problem:** 30-minute intervals can create small gaps (e.g., 9:00-9:30) that are unlikely to be booked since most students prefer 1-hour lessons
2. **No Buffer Between Bookings:** Back-to-back bookings leave no transition time for instructors between students

## User Stories

### User Story 1: Instructor Slot Preferences
**As an** instructor  
**I want to** configure which lesson durations I offer (30min, 1hr, 1.5hr, 2hr)  
**So that** the system only shows time slots that match my preferred teaching intervals and avoids creating unusable small gaps

### User Story 2: Automatic Buffer Management
**As an** instructor  
**I want to** set a buffer time between bookings (10, 15, or 20 minutes)  
**So that** I have adequate transition time between students without manually managing it

### User Story 3: Optional Travel Time Addition
**As an** instructor  
**I want to** optionally add extra travel time on top of my buffer time  
**So that** I have additional time when traveling between different pickup locations

### User Story 4: Flexible Booking
**As a** client or instructor booking a lesson  
**I want to** see all available time slots based on the instructor's preferences  
**So that** I can book at any time that works within the instructor's configured intervals

## Current Implementation

Location: `app/api/availability/slots/route.ts`

The current logic:
1. Finds available gaps between blocked time ranges
2. Generates slots based on the requested duration
3. Creates slots at `duration` intervals (e.g., every 2 hours for a 2-hour lesson)
4. Adds some 30-minute offset slots if there's remaining time

**Problems:**
- Slot generation is tied to duration, limiting flexibility
- Complex logic with offset calculations
- Doesn't show all valid start times

## Proposed Solution: Configurable Slot Intervals with Automatic Buffer

### Overview

Allow each instructor to configure:
1. **Allowed Lesson Durations:** Which lesson lengths they offer (can select multiple: 30min, 1hr, 1.5hr, 2hr)
2. **Buffer Time:** Automatic break between bookings (10, 15, or 20 minutes)

The system generates time slots based on the instructor's smallest configured interval, ensuring no unusable gaps are created.

### How It Works

**Step 1: Instructor Configuration (in Settings)**
```
Allowed Lesson Durations: [✓] 30 min  [✓] 1 hour  [✓] 1.5 hours  [✓] 2 hours
Buffer Between Bookings: ○ 10 min  ● 15 min  ○ 20 min
```

**Step 2: Slot Generation Algorithm**
1. Determine smallest allowed duration (e.g., if instructor allows 30min and 1hr, use 30min)
2. Generate slots at that interval within working hours
3. For each slot, validate that `duration + buffer` fits before next blocked time
4. When a booking is made, block: `lesson time + buffer time`
5. Next available slot starts after the buffer period

**Step 3: Client Booking Experience**
- Client selects desired duration from instructor's allowed options
- System shows only slots where that duration + buffer fits
- Slots are shown at the instructor's configured intervals

### Real-World Examples

#### Example 1: Instructor Allows 1-Hour Intervals Only
```
Configuration:
- Allowed durations: [1hr, 2hr]
- Buffer: 15 minutes
- Working hours: 9:00-17:00

Student books 1-hour lesson:
- Available slots: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00
- Student selects: 10:00
- System blocks: 10:00-11:15 (1hr lesson + 15min buffer)
- Next available: 12:00 (11:00 is too close, would overlap buffer)

Result: Clean schedule, no small gaps, automatic breaks
```

#### Example 2: Instructor Allows 30-Min and 1-Hour Intervals
```
Configuration:
- Allowed durations: [30min, 1hr, 1.5hr]
- Buffer: 10 minutes
- Working hours: 9:00-17:00

Student A books 1-hour lesson at 9:00:
- System blocks: 9:00-10:10 (1hr + 10min buffer)

Student B books 30-min lesson:
- Available slots: 10:30, 11:00, 11:30, 12:00... (30-min intervals after buffer)
- Student selects: 10:30
- System blocks: 10:30-11:10 (30min + 10min buffer)

Student C books 1.5-hour lesson:
- Available slots: 11:30, 12:00, 12:30... (must fit 1.5hr + buffer)
- Student selects: 11:30
- System blocks: 11:30-13:10 (1.5hr + 10min buffer)

Result: Flexible schedule, instructor controls granularity, automatic breaks
```

#### Example 3: Conservative Instructor (1-Hour Only)
```
Configuration:
- Allowed durations: [1hr, 2hr]  (no 30-min lessons)
- Buffer: 20 minutes
- Working hours: 9:00-17:00

Benefits:
- No small 30-minute gaps created
- Longer breaks between students (20 min)
- Predictable, easy-to-manage schedule
- Available slots: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00
```

### Key Benefits

1. **No Unusable Gaps:** Instructor controls minimum interval, preventing small gaps they don't want
2. **Automatic Breaks:** Buffer time ensures transition time between students
3. **Flexibility:** Instructors who want 30-min slots can enable them; others can stick to 1-hour
4. **Better Utilization:** More booking options within instructor's preferences
5. **Professional Schedule:** Clean, predictable timing with built-in breaks

## Acceptance Criteria

### Requirement 1: Instructor Slot Configuration

**User Story:** As an instructor, I want to configure which lesson durations I offer, so that the system only shows time slots that match my preferred teaching intervals.

#### Acceptance Criteria

1. THE Instructor_Settings_Page SHALL display checkboxes for lesson durations: 30 minutes, 1 hour, 1.5 hours, 2 hours
2. THE Instructor SHALL be able to select one or more lesson durations
3. WHEN an instructor saves their settings, THE System SHALL store the allowed durations in the database
4. THE System SHALL default to [1 hour, 2 hours] for new instructors
5. WHEN no durations are selected, THE System SHALL prevent saving and display a validation error

### Requirement 2: Buffer Time Configuration

**User Story:** As an instructor, I want to set a buffer time between bookings, so that I have adequate transition time between students.

#### Acceptance Criteria

1. THE Instructor_Settings_Page SHALL display radio buttons for buffer times: 10 minutes, 15 minutes, 20 minutes
2. THE Instructor SHALL be able to select exactly one buffer time
3. WHEN an instructor saves their settings, THE System SHALL store the buffer time in the database
4. THE System SHALL default to 15 minutes for new instructors
5. WHEN a booking is created, THE System SHALL automatically block the lesson duration plus the buffer time

### Requirement 3: Optional Travel Time Addition

**User Story:** As an instructor, I want to optionally add extra travel time on top of my buffer time, so that I have additional time when traveling between different pickup locations.

#### Acceptance Criteria

1. THE Instructor_Settings_Page SHALL display a checkbox "Add travel time between bookings"
2. WHEN the checkbox is checked, THE System SHALL display a number input for travel time in minutes
3. THE Instructor SHALL be able to enter travel time between 5 and 60 minutes
4. WHEN travel time is enabled, THE System SHALL add both buffer time AND travel time after bookings
5. WHEN travel time is disabled, THE System SHALL only add buffer time after bookings
6. THE System SHALL default to disabled (no travel time) for new instructors

**Example:**
- Buffer time: 10 minutes (always applied)
- Travel time: 10 minutes (optional)
- If enabled: Total blocked = lesson + 10min buffer + 10min travel = lesson + 20min
- If disabled: Total blocked = lesson + 10min buffer

### Requirement 4: Slot Generation Based on Configuration

**User Story:** As a system, I need to generate time slots based on instructor preferences, so that only valid booking times are shown.

#### Acceptance Criteria

1. WHEN generating slots, THE System SHALL use the instructor's smallest allowed duration as the interval
2. WHEN an instructor allows only [1 hour, 2 hours], THE System SHALL generate slots at 1-hour intervals
3. WHEN an instructor allows [30 minutes, 1 hour], THE System SHALL generate slots at 30-minute intervals
4. FOR ALL generated slots, THE System SHALL validate that the requested duration plus buffer fits before the next blocked time
5. THE System SHALL exclude slots where the full duration plus buffer would exceed working hours

### Requirement 4: Buffer Time Blocking

**User Story:** As a system, I need to automatically block buffer time after bookings, so that instructors have transition time between students.

#### Acceptance Criteria

1. WHEN a booking is created, THE System SHALL block the time range from start time to (end time + buffer)
2. WHEN calculating available slots, THE System SHALL treat buffer time as unavailable
3. WHEN a booking is cancelled, THE System SHALL release both the lesson time and buffer time
4. WHEN editing a booking, THE System SHALL exclude the current booking's time and buffer from blocking calculations
5. THE System SHALL apply buffer time to all booking types: LESSON, PDA_TEST, MOCK_TEST

### Requirement 5: Client Booking Experience

**User Story:** As a client, I want to see available time slots that match the instructor's preferences, so that I can book at valid times.

#### Acceptance Criteria

1. WHEN a client selects a lesson duration, THE System SHALL only show that duration if the instructor allows it
2. WHEN displaying available slots, THE System SHALL show slots at the instructor's configured interval
3. WHEN a slot is selected, THE System SHALL validate that the duration plus buffer fits
4. THE System SHALL display a message if no slots are available for the selected duration
5. THE Booking_Form SHALL only show duration options that the instructor has enabled

### Requirement 6: Backward Compatibility

**User Story:** As a system administrator, I want existing instructors to continue working without disruption, so that the update doesn't break existing functionality.

#### Acceptance Criteria

1. WHEN an instructor has no slot configuration, THE System SHALL use default values: [1 hour, 2 hours] and 15-minute buffer
2. WHEN migrating existing data, THE System SHALL set all instructors to default configuration
3. THE System SHALL continue to support the existing travel buffer field (travelBufferMinutes) separately from the new booking buffer
4. WHEN both travel buffer and booking buffer exist, THE System SHALL apply travel buffer after bookings with travel, and booking buffer after all bookings
5. THE System SHALL maintain all existing blocking logic for PDA tests, exceptions, and bookings

### Requirement 7: Settings UI Integration

**User Story:** As an instructor, I want to easily configure my slot preferences in the settings page, so that I can control my schedule.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "Booking Preferences" section
2. THE Section SHALL include clear labels and descriptions for each setting
3. WHEN an instructor changes settings, THE System SHALL show a preview of how slots will appear
4. WHEN settings are saved, THE System SHALL display a success message
5. THE Settings_Page SHALL validate that at least one duration is selected before saving

## Database Schema Changes

### New Fields in Instructor Model

```prisma
model Instructor {
  // ... existing fields ...
  
  // New fields for slot configuration
  allowedDurations        Int[]    @default([60, 120])  // Minutes: 30, 60, 90, 120
  bookingBufferMinutes    Int      @default(15)         // 10, 15, or 20 (always applied)
  enableTravelTime        Boolean  @default(false)      // Whether to add travel time
  travelTimeMinutes       Int?     @default(10)         // Additional travel time (5-60 min)
}
```

### Migration Notes

- Default values ensure backward compatibility
- Existing instructors will get: `allowedDurations: [60, 120]`, `bookingBufferMinutes: 15`, `enableTravelTime: false`
- **Buffer time** (bookingBufferMinutes): Always applied for transition/paperwork between students
- **Travel time** (travelTimeMinutes): Optional additional time for traveling to different locations
- When `enableTravelTime` is true: Total blocked = lesson + buffer + travel
- When `enableTravelTime` is false: Total blocked = lesson + buffer only

### Clarification: Buffer vs Travel Time

```typescript
// Buffer Time (bookingBufferMinutes): 
// - Always applied after every booking
// - For rest, paperwork, preparation
// - Minimum required time between students
// - Example: 10-20 minutes

// Travel Time (travelTimeMinutes):
// - Optional, instructor can enable/disable
// - Additional time on top of buffer
// - For driving to next student's location
// - Example: 10 minutes

// Total blocked time calculation:
const totalBlocked = lessonDuration + bookingBufferMinutes + (enableTravelTime ? travelTimeMinutes : 0)

// Example 1: Buffer only
// - Lesson: 60 min
// - Buffer: 15 min
// - Travel: disabled
// - Total blocked: 75 min

// Example 2: Buffer + Travel
// - Lesson: 60 min
// - Buffer: 10 min
// - Travel: enabled (10 min)
// - Total blocked: 80 min
```

## Technical Implementation Details

### Slot Generation Algorithm

```typescript
function generateSlots(
  workingHours: WorkingHours,
  blockedRanges: BlockedRange[],
  requestedDuration: number,
  instructorConfig: {
    allowedDurations: number[],
    bookingBufferMinutes: number
  }
): TimeSlot[] {
  // Step 1: Validate requested duration is allowed
  if (!instructorConfig.allowedDurations.includes(requestedDuration)) {
    return []
  }
  
  // Step 2: Determine slot interval (smallest allowed duration)
  const slotInterval = Math.min(...instructorConfig.allowedDurations)
  
  // Step 3: Generate slots at interval
  const slots: TimeSlot[] = []
  let currentTime = workingHours.start
  
  while (currentTime < workingHours.end) {
    // Check if duration + buffer fits
    const slotEnd = addMinutes(currentTime, requestedDuration)
    const bufferEnd = addMinutes(slotEnd, instructorConfig.bookingBufferMinutes)
    
    // Validate slot doesn't exceed working hours
    if (bufferEnd > workingHours.end) {
      break
    }
    
    // Check if slot conflicts with blocked ranges
    const hasConflict = blockedRanges.some(blocked => 
      hasTimeOverlap(currentTime, bufferEnd, blocked.start, blocked.end)
    )
    
    if (!hasConflict) {
      slots.push({
        time: format(currentTime, 'HH:mm'),
        available: true
      })
    }
    
    // Move to next interval
    currentTime = addMinutes(currentTime, slotInterval)
  }
  
  return slots
}
```

### Booking Creation with Buffer

```typescript
async function createBooking(bookingData) {
  const instructor = await getInstructor(bookingData.instructorId)
  
  // Calculate actual blocked time
  const startTime = bookingData.startTime
  const endTime = bookingData.endTime
  const bufferEnd = addMinutes(endTime, instructor.bookingBufferMinutes)
  
  // Create booking (stores actual lesson time)
  const booking = await prisma.booking.create({
    data: {
      ...bookingData,
      startTime,
      endTime,
      // Store buffer for reference
      bufferMinutes: instructor.bookingBufferMinutes
    }
  })
  
  // Note: Buffer is applied during availability calculation, not stored separately
  return booking
}
```

### Buffer Application Logic

```typescript
// When building blocked ranges for availability check
bookings.forEach(booking => {
  const instructor = await getInstructor(booking.instructorId)
  
  // Block lesson time
  blockedRanges.push({
    start: booking.startTime,
    end: booking.endTime,
    reason: 'Booked'
  })
  
  // Always block buffer time after lesson (for rest/paperwork)
  const bufferEnd = addMinutes(booking.endTime, instructor.bookingBufferMinutes)
  blockedRanges.push({
    start: booking.endTime,
    end: bufferEnd,
    reason: 'Transition time'
  })
  
  // Optionally block travel time (if instructor has it enabled)
  if (instructor.enableTravelTime && instructor.travelTimeMinutes) {
    blockedRanges.push({
      start: bufferEnd,
      end: addMinutes(bufferEnd, instructor.travelTimeMinutes),
      reason: 'Travel time to next location'
    })
  }
})
```

### Settings UI Example

```typescript
// Settings Page UI
<div className="booking-preferences">
  <h3>Booking Preferences</h3>
  
  {/* Allowed Durations */}
  <div className="setting-group">
    <label>Lesson Durations You Offer:</label>
    <div className="checkboxes">
      <label><input type="checkbox" value="30" /> 30 minutes</label>
      <label><input type="checkbox" value="60" checked /> 1 hour</label>
      <label><input type="checkbox" value="90" /> 1.5 hours</label>
      <label><input type="checkbox" value="120" checked /> 2 hours</label>
    </div>
    <p className="hint">Select at least one duration</p>
  </div>
  
  {/* Buffer Time */}
  <div className="setting-group">
    <label>Buffer Between Bookings:</label>
    <div className="radio-buttons">
      <label><input type="radio" name="buffer" value="10" /> 10 minutes</label>
      <label><input type="radio" name="buffer" value="15" checked /> 15 minutes</label>
      <label><input type="radio" name="buffer" value="20" /> 20 minutes</label>
    </div>
    <p className="hint">Time for rest and paperwork between students</p>
  </div>
  
  {/* Travel Time (Optional) */}
  <div className="setting-group">
    <label>
      <input type="checkbox" id="enableTravel" />
      Add travel time between bookings
    </label>
    <div className="travel-time-input" style={{ display: enableTravel ? 'block' : 'none' }}>
      <label>Travel time (minutes):</label>
      <input type="number" min="5" max="60" value="10" />
      <p className="hint">Additional time on top of buffer for traveling to next location</p>
    </div>
  </div>
  
  {/* Example Preview */}
  <div className="preview">
    <h4>Example Schedule:</h4>
    <p>With buffer: 10 min, Travel: {enableTravel ? '10 min' : 'disabled'}</p>
    <ul>
      <li>9:00-10:00 Lesson → Blocked until {enableTravel ? '10:20' : '10:10'}</li>
      <li>Next available: {enableTravel ? '10:30' : '10:30'}</li>
    </ul>
  </div>
</div>
```

## Testing Scenarios

### Scenario 1: Instructor with 1-Hour Intervals Only
```
Configuration:
- Allowed durations: [60, 120] (1hr, 2hr)
- Booking buffer: 15 minutes
- Working hours: 9:00-17:00

Test Case 1a: Book 1-hour lesson
- Expected slots: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00
- Student books: 10:00-11:00
- System blocks: 10:00-11:15 (lesson + buffer)
- Next available: 12:00 (11:00 would end at 12:15, overlaps with buffer)

Test Case 1b: Book 2-hour lesson
- Expected slots: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00
- Student books: 11:00-13:00
- System blocks: 11:00-13:15 (lesson + buffer)
- Next available: 14:00
```

### Scenario 2: Instructor with 30-Min and 1-Hour Intervals
```
Configuration:
- Allowed durations: [30, 60, 90] (30min, 1hr, 1.5hr)
- Booking buffer: 10 minutes
- Working hours: 9:00-17:00

Test Case 2a: Book 30-min lesson
- Expected slots: 9:00, 9:30, 10:00, 10:30, 11:00, 11:30... (every 30 min)
- Student books: 9:30-10:00
- System blocks: 9:30-10:10 (lesson + buffer)
- Next available: 10:30 (10:00 would end at 10:40, overlaps)

Test Case 2b: Book 1-hour lesson after 30-min booking
- Existing: 9:30-10:10 (blocked)
- Expected slots: 10:30, 11:00, 11:30, 12:00...
- Student books: 11:00-12:00
- System blocks: 11:00-12:10
```

### Scenario 3: Multiple Bookings with Buffer
```
Configuration:
- Allowed durations: [60, 120]
- Booking buffer: 20 minutes
- Working hours: 9:00-17:00

Timeline:
- 9:00-10:00 (Booking A) → blocks until 10:20
- 11:00-12:00 (Booking B) → blocks until 12:20
- 14:00-16:00 (Booking C, 2hr) → blocks until 16:20

Available slots for 1-hour lesson:
- 10:00 ✗ (would end at 11:20, overlaps with Booking B)
- 11:00 ✗ (booked)
- 12:00 ✗ (would end at 13:20, but 12:00-12:20 is buffer)
- 13:00 ✓ (fits 13:00-14:20, ends at Booking C start)
- 14:00 ✗ (booked)
- 16:00 ✗ (would end at 17:20, exceeds working hours)
```

### Scenario 4: Edit Mode Excludes Current Booking
```
Configuration:
- Allowed durations: [60, 120]
- Booking buffer: 15 minutes
- Working hours: 9:00-17:00

Existing bookings:
- 10:00-11:00 (Booking A - being edited)
- 13:00-14:00 (Booking B)

When editing Booking A:
- System excludes 10:00-11:15 from blocking
- Available slots: 9:00, 10:00, 11:00, 12:00, 14:00, 15:00, 16:00
- Can reschedule to 10:00 (same time) or any other available slot
```

### Scenario 5: PDA Test with Buffer
```
Configuration:
- Allowed durations: [60]
- Booking buffer: 15 minutes
- Working hours: 9:00-17:00

PDA Test scheduled: 14:00
- System blocks: 12:00-15:00 (2hr before + test + 1hr after)

Available slots for 1-hour lesson:
- 9:00 ✓ (ends at 10:15)
- 10:00 ✓ (ends at 11:15)
- 11:00 ✗ (would end at 12:15, overlaps with PDA buffer)
- 12:00 ✗ (PDA blocked)
- 13:00 ✗ (PDA blocked)
- 14:00 ✗ (PDA blocked)
- 15:00 ✓ (starts after PDA buffer)
```

### Scenario 6: Settings Validation
```
Test Case 6a: No durations selected
- User unchecks all duration options
- Clicks Save
- Expected: Error message "Please select at least one lesson duration"
- Settings not saved

Test Case 6b: Valid configuration
- User selects: [30, 60, 90]
- User selects buffer: 10 minutes
- Clicks Save
- Expected: Success message, settings saved to database

Test Case 6c: Default values for new instructor
- New instructor registers
- Expected: allowedDurations = [60, 120], bookingBufferMinutes = 15
```

## Success Metrics

1. **Instructor Control:** 100% of instructors can configure their preferred slot intervals
2. **No Small Gaps:** Instructors who choose 1-hour intervals have no 30-minute gaps
3. **Automatic Breaks:** All bookings include configured buffer time
4. **Flexibility:** Instructors who want 30-minute slots can enable them
5. **Better Utilization:** More bookable slots within instructor preferences
6. **Performance:** API response time remains < 500ms

## Implementation Phases

### Phase 1: Database Schema Update
1. Add `allowedDurations` field to Instructor model (Int array)
2. Add `bookingBufferMinutes` field to Instructor model (Int)
3. Run migration with default values
4. Update existing instructors to default configuration

### Phase 2: Settings UI
1. Add "Booking Preferences" section to settings page
2. Add checkboxes for lesson durations (30min, 1hr, 1.5hr, 2hr)
3. Add radio buttons for buffer time (10, 15, 20 minutes)
4. Add validation to require at least one duration
5. Update settings API to handle new fields

### Phase 3: Slot Generation Logic
1. Update `/api/availability/slots` to fetch instructor configuration
2. Modify slot generation to use smallest allowed duration as interval
3. Add validation to check if requested duration is allowed
4. Update buffer blocking logic to use `bookingBufferMinutes`
5. Maintain backward compatibility with existing bookings

### Phase 4: Booking Form Updates
1. Update duration dropdown to show only instructor's allowed durations
2. Fetch instructor configuration when loading booking form
3. Display message if selected duration is not available
4. Update all booking pages (public, instructor new, instructor edit)

### Phase 5: Testing & Validation
1. Test all scenarios with different configurations
2. Verify buffer time is applied correctly
3. Test edit mode with buffer exclusion
4. Verify PDA tests still block correctly
5. Performance testing with multiple bookings

### Phase 6: Documentation & Migration
1. Update user documentation
2. Create migration guide for instructors
3. Add tooltips explaining new settings
4. Monitor for issues after deployment

## Future Enhancements (Out of Scope for Initial Release)

These features could be added in future iterations:

### 1. Minimum Notice Period
```typescript
minimumNoticeHours: 2  // Can't book lessons less than 2 hours from now
```
- Prevents last-minute bookings when instructor is already en route
- Configurable per instructor (2, 4, 8, 24 hours)

### 2. Recurring Break Times
```typescript
lunchBreak: {
  start: "12:00",
  end: "13:00",
  days: [1,2,3,4,5]  // Monday-Friday
}
```
- Define recurring breaks (lunch, prayer time, etc.)
- Different breaks for different days
- Automatically blocks these times from booking

### 3. Smart Interval Selection (GCD Algorithm)
```typescript
// For non-standard durations like 45min, 90min
function determineSlotInterval(allowedDurations: number[]): number {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  return allowedDurations.reduce((acc, curr) => gcd(acc, curr))
}
```
- Automatically finds optimal interval for unusual duration combinations
- Example: [45, 90] → 45-minute intervals

### 4. Visual Schedule Preview in Settings
- Show live preview of how schedule will look with current settings
- Display example day with bookings and buffers
- Help instructors understand impact of their choices

### 5. End-of-Day Buffer Handling
```typescript
// Option A: Strict - don't allow if buffer extends past working hours
// Option B: Flexible - allow lesson if it ends before working hours, even if buffer extends past
```
- Let instructors choose how to handle last slot of the day
- Some may want to leave early if no next student

### 6. Dynamic Travel Time Based on Distance
- Calculate actual travel time between locations using Google Maps API
- Override fixed travel time with calculated time
- More accurate scheduling for instructors covering large areas

### 7. Peak/Off-Peak Pricing with Different Buffers
- Shorter buffers during peak hours (more bookings)
- Longer buffers during off-peak (more rest)
- Automatic adjustment based on time of day

These enhancements can be prioritized based on user feedback after the initial release.
