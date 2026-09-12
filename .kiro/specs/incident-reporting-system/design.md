# Design Document: Incident Reporting System

## Overview

The incident reporting system provides a comprehensive solution for documenting accidents, incidents, and safety concerns that occur during driving lessons. The system supports mobile-first incident reporting from both instructors and clients, admin review and management capabilities, evidence photo uploads via Cloudinary, and insurance data export functionality.

## Architecture

### System Context

The incident reporting system integrates with the existing DriveBook platform as a new feature module. It leverages existing infrastructure including:
- **Authentication**: Next-Auth session management for role-based access control
- **Database**: PostgreSQL via Prisma ORM for data persistence
- **File Storage**: Cloudinary for secure photo evidence storage
- **Email**: Existing email service for admin notifications
- **UI Framework**: React with Next.js 14 and Tailwind CSS for responsive interfaces

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Instructor │  │    Client    │  │    Admin     │      │
│  │   Mobile UI  │  │   Mobile UI  │  │  Dashboard   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────┐
│                  API Routes (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   /api/      │  │   /api/      │  │   /api/      │      │
│  │  incident    │  │   upload     │  │   export     │      │
│  │  /submit     │  │   /photo     │  │  /insurance  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────┐
│                 Business Logic Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Incident Service                              │   │
│  │  - createIncident()                                   │   │
│  │  - getIncidentsByUser()                               │   │
│  │  - updateIncidentStatus()                             │   │
│  │  - exportIncidents()                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Photo Service                                 │   │
│  │  - uploadPhotoEvidence()                              │   │
│  │  - validatePhoto()                                    │   │
│  │  - getSignedPhotoUrl()                                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Notification Service                          │   │
│  │  - sendIncidentAlert()                                │   │
│  │  - retryFailedEmail()                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────┐
│                 Data Access Layer                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Prisma Client                                 │   │
│  │  - Incident Model                                     │   │
│  │  - IncidentPhoto Model                                │   │
│  │  - IncidentAuditLog Model                             │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────┐
│              External Services                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │  Cloudinary  │  │    Email     │      │
│  │   Database   │  │ File Storage │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### Database Schema

```prisma
model Incident {
  id                  String             @id @default(cuid())
  bookingId           String
  incidentType        String             // accident, near-miss, vehicle-damage, other
  incidentDate        DateTime
  incidentTime        String?
  location            String?
  description         String
  submitterRole       String             // instructor, client
  submittedBy         String
  status              String             @default("pending") // pending, under-review, resolved, closed
  referenceNumber     String             @unique @default(cuid())
  isEditable          Boolean            @default(true)
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt
  
  booking             Booking            @relation(fields: [bookingId], references: [id], onDelete: Restrict)
  photos              IncidentPhoto[]
  auditLogs           IncidentAuditLog[]
  adminNotes          IncidentNote[]
  
  @@index([bookingId])
  @@index([submittedBy])
  @@index([status])
  @@index([incidentDate])
  @@index([referenceNumber])
}

model IncidentPhoto {
  id                String    @id @default(cuid())
  incidentId        String
  cloudinaryPublicId String
  fileName          String
  fileSize          Int       // bytes
  fileType          String    // JPEG, PNG, HEIC
  uploadedAt        DateTime  @default(now())
  uploadedBy        String
  
  incident          Incident  @relation(fields: [incidentId], references: [id], onDelete: Cascade)
  
  @@index([incidentId])
}

model IncidentAuditLog {
  id          String    @id @default(cuid())
  incidentId  String
  userId      String
  action      String    // created, viewed, status-changed, exported, note-added
  details     Json?
  timestamp   DateTime  @default(now())
  ipAddress   String?
  userAgent   String?
  
  incident    Incident  @relation(fields: [incidentId], references: [id], onDelete: Cascade)
  
  @@index([incidentId])
  @@index([userId])
  @@index([timestamp])
}

model IncidentNote {
  id          String    @id @default(cuid())
  incidentId  String
  authorId    String
  content     String
  createdAt   DateTime  @default(now())
  
  incident    Incident  @relation(fields: [incidentId], references: [id], onDelete: Cascade)
  
  @@index([incidentId])
}
```

### Booking Schema Extension

```prisma
model Booking {
  // ... existing fields
  incidents    Incident[]
}
```

## Component Design

### 1. Incident Submission Interface

#### Instructor Incident Form (`/dashboard/incidents/new`)

**Component Structure:**
```typescript
IncidentReportForm
├── BookingSelector (dropdown of instructor's recent bookings)
├── IncidentTypeSelector (accident, near-miss, vehicle-damage, other)
├── DateTimePicker (incident date and time)
├── LocationInput (text input with optional geolocation)
├── DescriptionTextarea (minimum 20 characters)
├── PhotoUploader (up to 10 photos, JPEG/PNG/HEIC, max 10MB each)
└── SubmitButton (with loading state)
```

**Key Features:**
- Mobile-responsive single-column layout (<768px)
- Touch-friendly inputs (44px minimum)
- Camera access on mobile devices
- Client-side validation before submission
- Real-time character count for description
- Thumbnail previews for uploaded photos

#### Client Safety Concern Form (`/client-dashboard/safety-concern`)

**Component Structure:**
Similar to instructor form but:
- Limited to 5 photos (vs 10)
- Simplified incident type selection
- Links to client's own bookings only
- Captures submitterRole as "client"

### 2. Admin Review Interface

#### Incident List View (`/admin/incidents`)

**Component Structure:**
```typescript
IncidentDashboard
├── FilterPanel
│   ├── DateRangePicker
│   ├── IncidentTypeFilter
│   ├── SubmitterRoleFilter
│   └── StatusFilter
├── SearchBar (booking reference / description keywords)
├── IncidentTable
│   ├── ReferenceNumber
│   ├── IncidentType
│   ├── SubmitterRole
│   ├── InstructorName (via booking)
│   ├── ClientName (via booking)
│   ├── IncidentDate
│   ├── Status
│   └── ActionsMenu
└── ExportButton (CSV/PDF)
```

**Sorting:** Default sort by submission date (most recent first)

**Actions:**
- View full incident report
- Update status
- Add notes
- Export selected incidents

#### Incident Detail View (`/admin/incidents/[id]`)

**Component Structure:**
```typescript
IncidentDetailView
├── IncidentHeader (reference number, status badge, timestamp)
├── BookingInfo (instructor, client, lesson date/time)
├── IncidentDetails
│   ├── Type, Date, Time, Location
│   └── Description
├── PhotoGallery (all evidence photos with lightbox)
├── StatusUpdateForm (pending → under-review → resolved → closed)
├── AdminNotes (timeline of notes with timestamps)
├── AuditLog (who accessed/modified, when)
└── ExportButton (single incident to PDF)
```

### 3. User Incident History

#### Instructor View (`/dashboard/incidents`)

- Lists only incidents where instructor is associated via booking
- Read-only access (no editing after 24 hours)
- View own incident reports and evidence photos

#### Client View (`/client-dashboard/incidents`)

- Lists only incidents where client is associated via booking
- Read-only access
- View own safety concerns and evidence photos

## API Design

### Incident Submission

**POST /api/incidents**

Request Body:
```typescript
{
  bookingId: string;
  incidentType: 'accident' | 'near-miss' | 'vehicle-damage' | 'other';
  incidentDate: string; // ISO 8601
  incidentTime?: string; // HH:MM
  location?: string;
  description: string; // min 20 chars
  submitterRole: 'instructor' | 'client';
  photos?: File[]; // up to 10 for instructor, 5 for client
}
```

Response:
```typescript
{
  success: boolean;
  incidentId: string;
  referenceNumber: string;
  message: string;
}
```

**Validation:**
- Authenticated user (instructor or client role)
- Booking exists and user is associated with it
- Description >= 20 characters
- Photo count within role limits
- Photo format: JPEG, PNG, or HEIC
- Photo size <= 10MB each

**Process Flow:**
1. Validate session and booking association
2. Validate incident data (description length, photo limits)
3. Create incident record with status "pending"
4. Upload photos to Cloudinary (`private/incidents/{incidentId}/`)
5. Create IncidentPhoto records
6. Create audit log entry
7. Send admin notification email (async)
8. Return confirmation with reference number

### Photo Upload

**POST /api/incidents/photos**

Request Body:
```typescript
{
  incidentId: string;
  photo: File; // multipart/form-data
}
```

Response:
```typescript
{
  success: boolean;
  photoId: string;
  fileName: string;
}
```

**Storage Path:** `private/incidents/{incidentId}/{photoId}.{ext}`

**Security:**
- Only incident submitter or admins can upload photos to an incident
- Photos stored with private access controls
- Signed URLs generated for viewing (5-minute expiry)

### Admin Incident Retrieval

**GET /api/admin/incidents**

Query Parameters:
```typescript
{
  page?: number;
  limit?: number;
  dateFrom?: string; // ISO 8601
  dateTo?: string;
  type?: 'accident' | 'near-miss' | 'vehicle-damage' | 'other';
  submitterRole?: 'instructor' | 'client';
  status?: 'pending' | 'under-review' | 'resolved' | 'closed';
  search?: string; // booking reference or description keywords
}
```

Response:
```typescript
{
  incidents: Array<{
    id: string;
    referenceNumber: string;
    incidentType: string;
    incidentDate: string;
    location: string;
    description: string;
    submitterRole: string;
    status: string;
    instructorName: string; // from booking
    clientName: string; // from booking
    bookingReference: string;
    photoCount: number;
    createdAt: string;
  }>;
  totalCount: number;
  page: number;
  limit: number;
}
```

### Status Update

**PATCH /api/admin/incidents/[id]/status**

Request Body:
```typescript
{
  status: 'pending' | 'under-review' | 'resolved' | 'closed';
}
```

Response:
```typescript
{
  success: boolean;
  updatedAt: string;
}
```

**Authorization:** Admin role only

**Side Effects:**
- Creates audit log entry
- Records user ID and timestamp

### Add Admin Note

**POST /api/admin/incidents/[id]/notes**

Request Body:
```typescript
{
  content: string;
}
```

Response:
```typescript
{
  success: boolean;
  noteId: string;
  createdAt: string;
}
```

**Authorization:** Admin role only

**Constraints:** No time limit on adding notes

### Insurance Export

**GET /api/admin/incidents/export**

Query Parameters:
```typescript
{
  format: 'csv' | 'pdf';
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  incidentIds?: string[]; // specific incidents to export
}
```

Response:
- CSV: `text/csv` with filename header
- PDF: `application/pdf` with formatted document

**CSV Columns:**
```
Reference Number, Incident Type, Date, Time, Location, Description,
Instructor Name, Client Name, Booking Reference, Submitter Role,
Status, Photo Count, Photo Filenames, Created At
```

**PDF Format:**
- Header: "Incident Report Export - [Date Range]"
- Section per incident with all fields
- Photo filenames listed
- Clear typography and spacing

**Performance:** Export generated within 30 seconds

## Business Logic

### Validation Rules

1. **Description Validation:**
   - Minimum 20 characters
   - Maximum 5000 characters (prevent abuse)

2. **Photo Validation:**
   - Instructor: 0-10 photos
   - Client: 0-5 photos
   - Formats: JPEG, PNG, HEIC only
   - Size: <= 10MB per file
   - MIME type verification + magic byte check (use existing `validateUpload` utility)

3. **Booking Association:**
   - Booking must exist
   - Instructor: bookingId must have providerId matching user's providerId
   - Client: bookingId must have customerId matching user's customer record
   - Booking cannot be deleted if incidents are linked

4. **Time-Based Immutability:**
   - Core fields locked 24 hours after submission
   - Core fields: incidentType, incidentDate, incidentTime, location, description
   - Admin notes can be added at any time
   - Status can be updated at any time (admin only)

5. **Data Retention:**
   - Incidents retained for minimum 7 years from incident date
   - Photos retained for minimum 7 years from incident date
   - Archive functionality available after 7 years (admin only)

### Access Control

1. **Submission Access:**
   - Authenticated users only
   - Instructor or Client role required
   - Must be associated with the booking

2. **View Access:**
   - Instructors: Only incidents where their providerId matches booking.providerId
   - Clients: Only incidents where their customerId matches booking.customerId
   - Admins: All incidents

3. **Modification Access:**
   - Status updates: Admin only
   - Add notes: Admin only
   - Original submitter: Read-only after 24 hours

4. **Export Access:**
   - Admin role only

5. **Aggregate Queries:**
   - Instructors: Cannot query across multiple bookings or view statistics
   - Clients: Cannot query across multiple bookings or view statistics
   - Admins: Full aggregate query access

### Audit Logging

All access and modifications are logged in `IncidentAuditLog`:

**Logged Actions:**
- `created` - Incident submission
- `viewed` - Incident detail page access
- `status-changed` - Status update
- `exported` - Incident export (single or batch)
- `note-added` - Admin note added
- `photo-uploaded` - Evidence photo added

**Logged Data:**
- User ID
- Action type
- Timestamp
- IP address (optional)
- User agent (optional)
- Action details (JSON)

### Notification Service

**Email Notification Flow:**

1. Incident submitted
2. Async job queued to send admin notification
3. Retrieve all users with `role='ADMIN'`
4. Send email to each admin using existing `EmailService`
5. Email includes:
   - Reference number
   - Incident type
   - Date
   - Submitter role
   - Description (first 200 characters)
   - Direct link to incident detail page
6. On failure: Log error and retry up to 3 times with exponential backoff
7. Target: Email sent within 2 minutes of submission

**Email Template:**
```
Subject: New Incident Report: {referenceNumber}

A new incident has been reported.

Reference Number: {referenceNumber}
Type: {incidentType}
Date: {incidentDate}
Submitted By: {submitterRole}
Instructor: {instructorName}
Client: {clientName}

Description:
{description}

View Full Report: {linkToIncident}
```

## Error Handling

### Client-Side Validation

- Real-time feedback for description character count
- Photo format/size validation before upload
- Clear error messages for validation failures

### Server-Side Error Responses

**400 Bad Request:**
- Invalid booking ID
- Description too short (<20 chars)
- Too many photos
- Invalid photo format/size
- Missing required fields

**401 Unauthorized:**
- No active session
- Wrong role for endpoint

**403 Forbidden:**
- User not associated with booking
- Attempting to view other user's incidents
- Non-admin attempting admin-only action

**404 Not Found:**
- Incident does not exist
- Booking does not exist

**500 Internal Server Error:**
- Database connection failure
- Cloudinary upload failure
- Email service failure

**Error Response Format:**
```typescript
{
  success: false;
  error: string; // User-friendly message
  code: string; // Error code for client handling
}
```

## Security Considerations

### Authentication & Authorization

- All endpoints require authentication via Next-Auth session
- Role-based access control enforced at API level
- Booking association validated on submission
- Data isolation enforced in queries (instructors/clients see only their own)

### File Upload Security

- Use existing `validateUpload` utility for:
  - MIME type allowlist verification
  - Magic byte header checking
  - File size limits
- Photos stored in private Cloudinary folder
- Signed URLs with 5-minute expiry for viewing
- Never expose permanent Cloudinary URLs to non-admins

### SQL Injection Prevention

- Prisma ORM with parameterized queries
- No raw SQL queries

### XSS Prevention

- React's automatic escaping
- Sanitize user input in description field
- Validate incident type against enum values

### CSRF Protection

- Next.js built-in CSRF protection
- API routes require valid session token

## Performance Considerations

### Database Indexing

Indexes on:
- `Incident.bookingId` (frequent join)
- `Incident.submittedBy` (user filtering)
- `Incident.status` (admin filtering)
- `Incident.incidentDate` (sorting and filtering)
- `Incident.referenceNumber` (unique lookups)
- `IncidentPhoto.incidentId` (photo retrieval)
- `IncidentAuditLog.incidentId` (audit log retrieval)
- `IncidentAuditLog.timestamp` (chronological queries)

### Query Optimization

- Use Prisma `include` for related data (booking details)
- Paginate incident list (default 20 per page)
- Lazy-load photos (thumbnails on list, full size on detail)

### File Upload Performance

- Client-side compression for photos (optional future enhancement)
- Parallel photo uploads (Promise.all for multiple files)
- Cloudinary handles image optimization

### Export Performance

- Stream large CSV exports
- Limit PDF exports to 100 incidents per request
- Background job for very large exports (future enhancement)

## Mobile Responsiveness

### Viewport Breakpoints

- Mobile: <768px (single-column layout)
- Tablet: 768px-1024px (two-column where appropriate)
- Desktop: >1024px (full layout)

### Mobile-Specific Features

1. **Touch Targets:**
   - Minimum 44x44px tap targets
   - Adequate spacing between interactive elements

2. **Camera Access:**
   - `accept="image/*"` with `capture="environment"` for camera
   - Fallback to file picker

3. **Photo Thumbnails:**
   - Max 100px width on mobile
   - Grid layout for multiple photos

4. **Loading States:**
   - Visual feedback during upload/submission
   - Progress indicators for file uploads

5. **Form Optimization:**
   - Appropriate input types (date, time, text)
   - Autocomplete where appropriate
   - Clear validation messages

## Testing Strategy

The testing strategy combines property-based testing for universal behavioral properties with example-based unit tests for specific scenarios and integration tests for external services.

### Unit Tests

**Form Validation:**
- Specific examples of valid/invalid descriptions
- Boundary cases for photo counts (0, 1, 5, 10, 11)
- Specific file format examples

**UI Rendering:**
- Form fields present for instructor/client
- Responsive layout at key breakpoints
- Loading states display correctly

**Data Formatting:**
- CSV export format with specific examples
- PDF generation with sample data
- Email template rendering

### Property-Based Tests

Property-based tests validate universal properties across randomized inputs. Each test runs a minimum of 100 iterations.

**Photo Upload Properties:**
- For any valid photo format (JPEG/PNG/HEIC) under 10MB, upload succeeds
- For any photo over 10MB, upload fails with size error
- For any invalid format, upload fails with format error
- For any uploaded photo, a unique identifier is generated

**Access Control Properties:**
- For any instructor user, only incidents from their bookings are visible
- For any client user, only incidents from their bookings are visible
- For any non-admin user, admin endpoints return 403
- For any incident access, an audit log entry is created

**Validation Properties:**
- For any description with >=20 characters, validation passes
- For any description with <20 characters, validation fails
- For any instructor submission with <=10 photos, validation passes
- For any client submission with <=5 photos, validation passes
- For any submission exceeding photo limits, validation fails

**Data Integrity Properties:**
- For any incident linked to a booking, booking details are retrievable
- For any booking with incidents, deletion is prevented
- For any incident, the reference number is unique
- For any incident >24 hours old, core fields are immutable

### Integration Tests

**Email Service Integration:**
- Submit sample incidents, verify email service is called
- Verify email contains required fields
- Test retry logic with simulated failures

**Cloudinary Integration:**
- Upload sample photos, verify Cloudinary storage
- Verify signed URL generation
- Verify photo access controls

**Database Integration:**
- Test booking association validation
- Test transaction rollback on failure
- Test audit log persistence

**Performance Tests:**
- Export generation completes within 30 seconds
- Email notifications sent within 2 minutes

## Deployment Considerations

### Database Migration

Run Prisma migration to add new tables:
```bash
npx prisma migrate dev --name add-incident-reporting-system
```

### Environment Variables

Required:
- `CLOUDINARY_CLOUD_NAME` (existing)
- `CLOUDINARY_API_KEY` (existing)
- `CLOUDINARY_API_SECRET` (existing)
- Email service configuration (existing)

### Cloudinary Folder Structure

Create folder structure:
```
{CLOUDINARY_ROOT_FOLDER}/
└── private/
    └── incidents/
        └── {incidentId}/
            ├── {photoId}.jpg
            ├── {photoId}.png
            └── {photoId}.heic
```

### Monitoring

- Log incident submission failures
- Monitor email notification failures
- Track Cloudinary upload errors
- Alert on database query timeouts

## Future Enhancements

1. **SMS Notifications:** Send SMS to admins for critical incidents (e.g., accidents)
2. **Geolocation Capture:** Auto-populate location from device GPS
3. **Video Evidence:** Support video uploads for incidents
4. **Workflow Automation:** Auto-assign incidents to specific admins based on type
5. **Analytics Dashboard:** Incident trends, hotspot analysis
6. **Insurance API Integration:** Direct submission to insurance provider APIs
7. **Multi-language Support:** Translate forms and notifications
8. **Offline Mode:** Cache incidents locally when offline, sync when online

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Booking Association Validation

*For any* incident submission, if the booking ID is valid and the user is associated with the booking (instructor's providerId or client's customerId matches), the submission succeeds; if the booking ID is invalid or the user is not associated, the submission fails with appropriate error.

**Validates: Requirements 1.3, 2.3, 6.1, 6.2**

### Property 2: Photo Count Limits by Role

*For any* incident submission from an instructor with 0-10 photos, the submission succeeds; for 11+ photos, it fails. *For any* incident submission from a client with 0-5 photos, the submission succeeds; for 6+ photos, it fails.

**Validates: Requirements 1.4, 2.4**

### Property 3: Description Length Validation

*For any* incident submission with description length >= 20 characters, validation passes; *for any* submission with description length < 20 characters, validation fails with appropriate error message.

**Validates: Requirements 1.5, 2.5**

### Property 4: Confirmation with Reference Number

*For any* successfully submitted incident, the response includes a confirmation message containing a unique reference number.

**Validates: Requirements 1.6, 2.6**

### Property 5: Submitter Role Capture

*For any* incident submitted by an instructor, the `submitterRole` field is set to "instructor"; *for any* incident submitted by a client, the `submitterRole` field is set to "client".

**Validates: Requirements 1.8, 2.7**

### Property 6: Photo Format Validation

*For any* photo with MIME type matching JPEG, PNG, or HEIC and valid magic bytes, upload succeeds; *for any* photo with other formats, upload fails with format error.

**Validates: Requirements 3.1**

### Property 7: Photo Size Validation

*For any* photo with size <= 10MB (10,485,760 bytes), upload succeeds; *for any* photo with size > 10MB, upload fails with size error.

**Validates: Requirements 3.2**

### Property 8: Upload Error Messaging

*For any* failed photo upload (format, size, or network error), an error message is displayed to the user indicating the specific reason for failure.

**Validates: Requirements 3.3**

### Property 9: Unique Photo Identifier Generation

*For any* successfully uploaded evidence photo, a unique identifier (CUID) is generated and stored with the photo record.

**Validates: Requirements 3.5**

### Property 10: Photo-Incident Association

*For any* uploaded evidence photo, it is associated with exactly one incident via the `incidentId` foreign key.

**Validates: Requirements 3.6**

### Property 11: Incident Chronological Ordering

*For any* admin query to list incidents without explicit sort parameters, the results are ordered by submission date with most recent first (descending `createdAt`).

**Validates: Requirements 4.2**

### Property 12: Complete Incident Data Display

*For any* incident viewed by an admin, the display includes incident type, date, time, location, description, submitter role, and linked booking details (instructor name, client name, lesson date, lesson time).

**Validates: Requirements 4.3, 4.7**

### Property 13: Photo Display Completeness

*For any* incident with N associated photos (where N >= 0), viewing the incident displays all N photos.

**Validates: Requirements 4.4**

### Property 14: Filter Correctness

*For any* admin filter query with criteria (date range, incident type, submitter role), all returned incidents match the specified criteria, and all matching incidents in the database are returned (no false positives or false negatives).

**Validates: Requirements 4.5**

### Property 15: Search Result Relevance

*For any* search query on booking reference or description keywords, all returned incidents contain the search term in either the booking reference or description text.

**Validates: Requirements 4.6**

### Property 16: Status Update Persistence

*For any* admin status update to an incident, the new status is persisted to the database, the `updatedAt` timestamp is updated, and an audit log entry is created.

**Validates: Requirements 4.8**

### Property 17: Export Format Validation

*For any* insurance export in CSV format, the output is valid CSV with proper escaping and includes all required columns. *For any* export in PDF format, the output is valid PDF with formatted content.

**Validates: Requirements 5.1, 5.2, 5.7**

### Property 18: Export Field Completeness

*For any* exported incident, the export includes reference number, type, date, time, location, description, instructor name, client name, booking reference, and photo filenames.

**Validates: Requirements 5.3, 5.6**

### Property 19: Export Filtering

*For any* export request with filter criteria (date range, status), only incidents matching all specified criteria are included in the export.

**Validates: Requirements 5.4**

### Property 20: Booking Linkage Validation

*For any* incident submission, the booking identifier must exist in the database; if it does not exist, the submission fails with "booking not found" error.

**Validates: Requirements 6.2**

### Property 21: Booking Detail Retrieval

*For any* incident linked to a booking, retrieving the incident also retrieves and displays the instructor name, client name, lesson date, and lesson time from the associated booking.

**Validates: Requirements 6.3**

### Property 22: Multiple Incidents Per Booking

*For any* booking, the system allows creation of multiple incidents with different incident IDs, all linking to the same booking ID.

**Validates: Requirements 6.4**

### Property 23: Incident Count Accuracy

*For any* booking with N linked incidents (where N >= 0), querying the booking displays the incident count as N.

**Validates: Requirements 6.5**

### Property 24: Booking Deletion Prevention

*For any* booking with one or more linked incidents, attempts to delete the booking fail with a referential integrity error.

**Validates: Requirements 6.6**

### Property 25: Notification Email Content

*For any* incident submission, the notification email sent to admins contains the incident reference number, type, date, submitter role, and description excerpt.

**Validates: Requirements 7.2**

### Property 26: Notification Email Link

*For any* incident submission, the notification email contains a valid URL that navigates to the full incident detail page when accessed.

**Validates: Requirements 7.3**

### Property 27: Email Retry Logic

*For any* email send failure, the system logs the error and retries up to 3 times with exponential backoff before marking the notification as failed.

**Validates: Requirements 7.4**

### Property 28: Role-Based Submission Access

*For any* incident submission request, if the user is authenticated with role "INSTRUCTOR" or "CLIENT" and associated with the booking, the request succeeds; otherwise, it returns 401 or 403.

**Validates: Requirements 8.1**

### Property 29: Admin-Only Access Control

*For any* request to admin endpoints (review, export, status update), if the user's role is "ADMIN", the request succeeds; otherwise, it returns 403.

**Validates: Requirements 8.2**

### Property 30: Instructor Data Isolation

*For any* incident query by an instructor user, only incidents where the booking's `providerId` matches the instructor's `providerId` are returned.

**Validates: Requirements 8.3**

### Property 31: Client Data Isolation

*For any* incident query by a client user, only incidents where the booking's `customerId` matches the client's `customerId` are returned.

**Validates: Requirements 8.4**

### Property 32: Aggregate Query Restriction

*For any* request from an instructor or client for aggregate statistics or cross-booking queries, the request is denied with 403.

**Validates: Requirements 8.5**

### Property 33: Cross-Client Access Prevention

*For any* client attempting to access another client's incident via direct ID request, the system returns 403 or 404.

**Validates: Requirements 8.6**

### Property 34: Audit Log Creation

*For any* incident access or modification (view, status change, export), an audit log entry is created with user ID, action type, timestamp, and action details.

**Validates: Requirements 8.7**

### Property 35: Data Retention Policy

*For any* incident with incident date within the last 7 years, the system prevents deletion. *For any* incident older than 7 years, the system allows admin-initiated archival.

**Validates: Requirements 10.1, 10.2, 10.5**

### Property 36: Time-Based Field Immutability

*For any* incident where `(currentTime - createdAt) > 24 hours`, attempts to modify core fields (incidentType, incidentDate, incidentTime, location, description) fail with error; attempts to add admin notes succeed.

**Validates: Requirements 10.3, 10.4**

### Property 37: Audit Timestamp Recording

*For any* incident creation or status change, the system records the current timestamp and the user identifier in the incident record and audit log.

**Validates: Requirements 10.6**

## Implementation Phases

### Phase 1: Database & Core Models (Week 1)
- Prisma schema migration
- Database models and relations
- Booking schema extension with onDelete: Restrict

### Phase 2: File Upload Service (Week 1)
- Cloudinary integration for incident photos
- Photo validation using existing `validateUpload`
- Signed URL generation for private photos

### Phase 3: Incident Submission (Week 2)
- Instructor incident form UI
- Client safety concern form UI
- POST /api/incidents endpoint
- Photo upload handling

### Phase 4: Admin Review Interface (Week 3)
- Admin incident list with filters and search
- Admin incident detail view
- Status update functionality
- Admin notes system

### Phase 5: Access Control & Audit (Week 3)
- Role-based access control enforcement
- User data isolation queries
- Audit logging for all operations

### Phase 6: Email Notifications (Week 4)
- Admin email notification service
- Email template creation
- Retry logic implementation

### Phase 7: Export Functionality (Week 4)
- CSV export generation
- PDF export generation
- Export filtering and performance optimization

### Phase 8: User History Views (Week 5)
- Instructor incident history page
- Client incident history page
- Time-based field locking (24 hours)

### Phase 9: Testing & QA (Week 5-6)
- Property-based test suite
- Integration tests
- Mobile device testing
- Performance testing
- Security audit

### Phase 10: Documentation & Deployment (Week 6)
- API documentation
- User guides (instructor, client, admin)
- Deployment checklist
- Production migration

