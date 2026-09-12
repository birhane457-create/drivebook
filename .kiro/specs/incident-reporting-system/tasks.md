# Implementation Plan: Incident Reporting System

## Overview

This implementation plan breaks down the incident reporting system into discrete coding tasks. The system provides mobile-first incident reporting for instructors and clients, admin review and management capabilities, Cloudinary photo storage, and insurance data export functionality. The implementation follows an incremental approach, building from database models through business logic to user interfaces.

## Tasks

- [ ] 1. Set up database schema and models
  - [ ] 1.1 Create Prisma schema for incident models
    - Add `Incident`, `IncidentPhoto`, `IncidentAuditLog`, and `IncidentNote` models to `prisma/schema.prisma`
    - Add incident relation to existing `Booking` model
    - Include all fields with proper types, defaults, and constraints
    - Add database indexes for performance (bookingId, submittedBy, status, incidentDate, referenceNumber)
    - _Requirements: 1.3, 2.3, 3.6, 6.1, 6.2, 6.3, 6.4, 8.7, 10.6_
  
  - [ ] 1.2 Generate and run database migration
    - Run `npx prisma migrate dev --name add-incident-reporting-system`
    - Verify migration creates all tables correctly
    - Test that booking deletion is prevented when incidents exist
    - _Requirements: 6.6_
  
  - [ ] 1.3 Generate updated Prisma client
    - Run `npx prisma generate`
    - Verify TypeScript types are available for new models
    - Test basic CRUD operations in development

- [ ] 2. Checkpoint - Database setup complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Implement photo upload service
  - [ ] 3.1 Create photo validation utility
    - Create `lib/services/incidentPhotoService.ts`
    - Implement `validatePhoto()` function for format (JPEG/PNG/HEIC), size (<=10MB), and magic byte checking
    - Use existing `validateUpload` utility if available
    - Return validation errors with specific error codes
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 3.2 Write property test for photo validation
    - **Property 6: Photo Format Validation**
    - **Property 7: Photo Size Validation**
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ] 3.3 Implement Cloudinary upload service
    - Create `uploadIncidentPhoto()` function in `lib/services/incidentPhotoService.ts`
    - Upload to `private/incidents/{incidentId}/` folder structure
    - Generate unique photo identifiers (CUID)
    - Store photo metadata (fileName, fileSize, fileType, cloudinaryPublicId)
    - Implement error handling for network failures
    - _Requirements: 3.4, 3.5_
  
  - [ ]* 3.4 Write property test for photo upload
    - **Property 9: Unique Photo Identifier Generation**
    - **Property 10: Photo-Incident Association**
    - **Validates: Requirements 3.5, 3.6**
  
  - [ ] 3.5 Implement signed URL generation
    - Create `getSignedPhotoUrl()` function for secure photo access
    - Set 5-minute expiry on signed URLs
    - Restrict access to incident submitter and admins
    - _Requirements: 3.4_

- [ ] 4. Implement incident business logic service
  - [ ] 4.1 Create incident service with validation
    - Create `lib/services/incidentService.ts`
    - Implement `createIncident()` function with all validation rules
    - Validate description length (>=20 chars, <=5000 chars)
    - Validate booking association (booking exists, user associated)
    - Validate photo count limits (10 for instructor, 5 for client)
    - Generate unique reference numbers (CUID)
    - Set initial status to "pending"
    - Create audit log entry on creation
    - _Requirements: 1.3, 1.4, 1.5, 1.7, 1.8, 2.3, 2.4, 2.5, 2.7, 6.1, 6.2, 8.7, 10.6_
  
  - [ ]* 4.2 Write property test for booking association validation
    - **Property 1: Booking Association Validation**
    - **Validates: Requirements 1.3, 2.3, 6.1, 6.2**
  
  - [ ]* 4.3 Write property test for photo count limits
    - **Property 2: Photo Count Limits by Role**
    - **Validates: Requirements 1.4, 2.4**
  
  - [ ]* 4.4 Write property test for description validation
    - **Property 3: Description Length Validation**
    - **Validates: Requirements 1.5, 2.5**
  
  - [ ] 4.4 Implement incident retrieval functions
    - Create `getIncidentsByUser()` for instructors and clients (filtered by booking association)
    - Create `getIncidentById()` with role-based access control
    - Create `getAllIncidents()` for admin (with pagination, filtering, search)
    - Include booking details (instructor name, client name) via Prisma include
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 8.3, 8.4_
  
  - [ ]* 4.5 Write property test for access control
    - **Property 15: Search Result Relevance**
    - **Validates: Requirements 4.6, 8.3, 8.4**
  
  - [ ] 4.5 Implement incident status updates
    - Create `updateIncidentStatus()` function (admin only)
    - Validate status transitions (pending → under-review → resolved → closed)
    - Create audit log entry on status change
    - Update `updatedAt` timestamp
    - _Requirements: 4.8, 8.2, 8.7, 10.6_
  
  - [ ] 4.6 Implement admin notes functionality
    - Create `addIncidentNote()` function (admin only)
    - Associate notes with incident via incidentId
    - Record author, timestamp
    - No time restrictions on adding notes
    - _Requirements: 10.4_
  
  - [ ] 4.7 Implement time-based immutability
    - Create `isIncidentEditable()` utility function
    - Check if 24 hours have passed since submission
    - Lock core fields (incidentType, incidentDate, incidentTime, location, description)
    - _Requirements: 10.3_

- [ ] 5. Checkpoint - Business logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement email notification service
  - [ ] 6.1 Create incident notification service
    - Create `lib/services/incidentNotificationService.ts`
    - Implement `sendIncidentAlert()` function
    - Retrieve all users with role='ADMIN'
    - Use existing `EmailService` for sending
    - Include reference number, type, date, submitter role, description (first 200 chars)
    - Include direct link to incident detail page
    - _Requirements: 7.1, 7.2, 7.3, 7.6_
  
  - [ ] 6.2 Implement email retry logic
    - Add retry mechanism with exponential backoff (up to 3 attempts)
    - Log email failures for monitoring
    - Target: email sent within 2 minutes
    - _Requirements: 7.4, 7.5_
  
  - [ ]* 6.3 Write integration test for email service
    - Test email service is called on incident submission
    - Test email contains required fields
    - Test retry logic with simulated failures
    - _Requirements: 7.1, 7.4_

- [ ] 7. Implement incident submission API endpoints
  - [ ] 7.1 Create POST /api/incidents endpoint
    - Create `app/api/incidents/route.ts`
    - Validate session and role (instructor or client)
    - Parse multipart form data for photos
    - Validate all input data (description, photo count, booking association)
    - Create incident record
    - Upload photos in parallel using `Promise.all`
    - Queue async email notification
    - Return confirmation with reference number
    - Handle errors with appropriate HTTP status codes (400, 401, 403, 404, 500)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 8.1_
  
  - [ ]* 7.2 Write property test for submission confirmation
    - **Property 4: Confirmation with Reference Number**
    - **Validates: Requirements 1.6, 2.6**
  
  - [ ]* 7.3 Write property test for submitter role capture
    - **Property 5: Submitter Role Capture**
    - **Validates: Requirements 1.8, 2.7**
  
  - [ ] 7.2 Create POST /api/incidents/photos endpoint
    - Create `app/api/incidents/photos/route.ts`
    - Accept single photo upload
    - Validate user is incident submitter or admin
    - Validate photo format and size
    - Upload to Cloudinary
    - Return photo ID and filename
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  
  - [ ]* 7.4 Write property test for upload error messaging
    - **Property 8: Upload Error Messaging**
    - **Validates: Requirements 3.3**

- [ ] 8. Implement admin incident management API endpoints
  - [ ] 8.1 Create GET /api/admin/incidents endpoint
    - Create `app/api/admin/incidents/route.ts`
    - Validate admin role
    - Parse query parameters (page, limit, dateFrom, dateTo, type, submitterRole, status, search)
    - Call `getAllIncidents()` with filters
    - Return paginated results with total count
    - Include booking details (instructor name, client name)
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 8.2_
  
  - [ ]* 8.2 Write property test for filtering and search
    - **Property 14: Filter Correctness**
    - **Property 15: Search Result Relevance**
    - **Validates: Requirements 4.5, 4.6**
  
  - [ ] 8.2 Create GET /api/admin/incidents/[id] endpoint
    - Create `app/api/admin/incidents/[id]/route.ts`
    - Validate admin role
    - Retrieve incident with full details
    - Include booking details and all photos
    - Include audit logs and notes
    - Create audit log entry for viewing
    - _Requirements: 4.3, 4.4, 8.2, 8.7_
  
  - [ ]* 8.3 Write property test for complete data display
    - **Property 12: Complete Incident Data Display**
    - **Property 13: Photo Display Completeness**
    - **Validates: Requirements 4.3, 4.4, 4.7**
  
  - [ ] 8.3 Create PATCH /api/admin/incidents/[id]/status endpoint
    - Create `app/api/admin/incidents/[id]/status/route.ts`
    - Validate admin role
    - Call `updateIncidentStatus()`
    - Return updated timestamp
    - _Requirements: 4.8, 8.2_
  
  - [ ]* 8.4 Write property test for status updates
    - **Property 16: Status Update Persistence**
    - **Validates: Requirements 4.8, 8.7_
  
  - [ ] 8.4 Create POST /api/admin/incidents/[id]/notes endpoint
    - Create `app/api/admin/incidents/[id]/notes/route.ts`
    - Validate admin role
    - Call `addIncidentNote()`
    - Create audit log entry
    - Return note ID and timestamp
    - _Requirements: 10.4, 8.2, 8.7_

- [ ] 9. Checkpoint - API endpoints complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement insurance export functionality
  - [ ] 10.1 Create export service
    - Create `lib/services/incidentExportService.ts`
    - Implement `exportIncidentsToCSV()` function
    - Include all required fields (reference, type, date, time, location, description, instructor, client, booking reference, photo filenames)
    - Properly escape CSV fields
    - Stream large exports
    - _Requirements: 5.1, 5.3, 5.4, 5.6_
  
  - [ ] 10.2 Implement PDF export
    - Implement `exportIncidentsToPDF()` function
    - Format with clear sections and readable typography
    - Include header with date range
    - Limit to 100 incidents per request
    - _Requirements: 5.2, 5.3, 5.6, 5.7_
  
  - [ ]* 10.3 Write property test for export validation
    - **Property 17: Export Format Validation**
    - **Property 18: Export Field Completeness**
    - **Property 19: Export Filtering**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6, 5.7**
  
  - [ ] 10.3 Create GET /api/admin/incidents/export endpoint
    - Create `app/api/admin/incidents/export/route.ts`
    - Validate admin role
    - Parse format (csv/pdf), filters (dateFrom, dateTo, status, incidentIds)
    - Call appropriate export service
    - Set proper content-type and filename headers
    - Create audit log entries for exported incidents
    - Target: complete within 30 seconds
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 8.2, 8.7_

- [ ] 11. Implement instructor incident form UI
  - [ ] 11.1 Create incident form component
    - Create `components/instructor/IncidentReportForm.tsx`
    - Include BookingSelector dropdown (instructor's recent bookings)
    - Include IncidentTypeSelector (accident, near-miss, vehicle-damage, other)
    - Include DateTimePicker for incident date and time
    - Include LocationInput (text input)
    - Include DescriptionTextarea with character counter (min 20, max 5000)
    - Include PhotoUploader (max 10 photos)
    - Add client-side validation
    - Display loading states during submission
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.7_
  
  - [ ] 11.2 Implement photo uploader component
    - Create `components/instructor/PhotoUploader.tsx`
    - Accept image/* with capture="environment" for camera access
    - Display thumbnail previews (max 100px on mobile)
    - Show file size and format for each photo
    - Allow removal of photos before submission
    - Display upload progress
    - _Requirements: 3.1, 3.2, 9.3, 9.4_
  
  - [ ] 11.3 Create incident form page
    - Create `app/dashboard/incidents/new/page.tsx`
    - Render IncidentReportForm component
    - Handle form submission
    - Display confirmation with reference number on success
    - Display error messages on failure
    - Mobile-responsive layout (single column <768px)
    - _Requirements: 1.1, 1.6, 9.1, 9.5_
  
  - [ ] 11.4 Create instructor incident list page
    - Create `app/dashboard/incidents/page.tsx`
    - Display incidents where instructor is associated via booking
    - Show reference number, type, date, status
    - Link to incident detail view
    - Sort by submission date (most recent first)
    - Read-only after 24 hours
    - _Requirements: 8.3_

- [ ] 12. Checkpoint - Instructor UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement client safety concern form UI
  - [ ] 13.1 Create client safety concern form component
    - Create `components/client/SafetyConcernForm.tsx`
    - Similar to instructor form but limited to 5 photos
    - Simplified incident type options
    - Links to client's own bookings only
    - Captures submitterRole as "client"
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.7_
  
  - [ ] 13.2 Create client safety concern page
    - Create `app/client-dashboard/safety-concern/page.tsx`
    - Render SafetyConcernForm component
    - Handle form submission
    - Display confirmation with reference number
    - Mobile-responsive layout
    - _Requirements: 2.1, 2.6, 9.1, 9.5_
  
  - [ ] 13.3 Create client incident list page
    - Create `app/client-dashboard/incidents/page.tsx`
    - Display incidents where client is associated via booking
    - Read-only view
    - Sort by submission date (most recent first)
    - _Requirements: 8.4_

- [ ] 14. Implement admin incident dashboard UI
  - [ ] 14.1 Create incident list component
    - Create `components/admin/IncidentDashboard.tsx`
    - Include FilterPanel (date range, type, submitter role, status)
    - Include SearchBar (booking reference, description keywords)
    - Include IncidentTable with all fields
    - Display photo count per incident
    - Include pagination controls
    - Include export button
    - _Requirements: 4.1, 4.2, 4.5, 4.6_
  
  - [ ] 14.2 Create admin incident list page
    - Create `app/admin/incidents/page.tsx`
    - Render IncidentDashboard component
    - Fetch incidents with filters and pagination
    - Handle filter and search changes
    - Link to incident detail pages
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 8.2_
  
  - [ ]* 14.3 Write property test for chronological ordering
    - **Property 11: Incident Chronological Ordering**
    - **Validates: Requirements 4.2**
  
  - [ ] 14.3 Create incident detail component
    - Create `components/admin/IncidentDetailView.tsx`
    - Display incident header (reference, status badge, timestamp)
    - Display booking info (instructor, client, lesson details)
    - Display all incident details
    - Include PhotoGallery with lightbox
    - Include StatusUpdateForm
    - Include AdminNotes timeline
    - Include AuditLog display
    - Include export button
    - _Requirements: 4.3, 4.4, 4.7, 4.8_
  
  - [ ] 14.4 Create admin incident detail page
    - Create `app/admin/incidents/[id]/page.tsx`
    - Render IncidentDetailView component
    - Fetch incident with all relations
    - Handle status updates
    - Handle note additions
    - Generate signed URLs for photo viewing
    - _Requirements: 4.3, 4.4, 4.8, 10.4, 8.2_

- [ ] 15. Checkpoint - Admin UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Implement mobile responsiveness enhancements
  - [ ] 16.1 Add responsive styling to all incident forms
    - Apply single-column layout for <768px viewports
    - Ensure 44px minimum touch targets
    - Test on multiple mobile screen sizes
    - _Requirements: 9.1, 9.2_
  
  - [ ] 16.2 Implement mobile camera access
    - Update PhotoUploader with `accept="image/*" capture="environment"`
    - Test camera access on iOS and Android
    - Fallback to file picker if camera unavailable
    - _Requirements: 9.3_
  
  - [ ] 16.3 Add loading indicators for mobile
    - Add spinners during form submission
    - Add progress bars during photo uploads
    - Ensure visual feedback is clear on mobile
    - _Requirements: 9.5_

- [ ] 17. Implement navigation and integration
  - [ ] 17.1 Add incident reporting links to dashboards
    - Add "Report Incident" button to instructor dashboard (`app/dashboard/page.tsx`)
    - Add "Report Safety Concern" button to client dashboard (`app/client-dashboard/page.tsx`)
    - Add "Incident Reports" link to admin navigation (`components/DashboardNav.tsx`)
    - Ensure proper role-based visibility
    - _Requirements: 1.1, 2.1, 4.1_
  
  - [ ] 17.2 Update booking detail pages with incident count
    - Modify booking detail views to display linked incident count
    - Add link to view incidents for booking
    - _Requirements: 6.5_
  
  - [ ] 17.3 Implement booking deletion prevention
    - Update booking deletion logic to check for linked incidents
    - Display error message if booking has incidents
    - _Requirements: 6.6_

- [ ] 18. Final checkpoint and testing
  - [ ] 18.1 Verify all API endpoints
    - Test all endpoints with Postman or similar
    - Verify authentication and authorization
    - Verify error handling
    - _Requirements: All API requirements_
  
  - [ ] 18.2 Verify mobile responsiveness
    - Test all forms on mobile devices
    - Verify camera access works
    - Verify touch targets are adequate
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 18.3 Run all property-based tests
    - Execute all property tests with 100+ iterations
    - Verify all properties hold
    - Fix any discovered edge cases
    - _Requirements: All requirements_
  
  - [ ] 18.4 Test end-to-end workflows
    - Submit incident as instructor, verify admin notification
    - Submit safety concern as client, verify admin can review
    - Update incident status as admin, verify persistence
    - Export incidents in CSV and PDF formats
    - Verify photo upload and viewing
    - _Requirements: All requirements_
  
  - [ ] 18.5 Final verification
    - Ensure all tests pass
    - Verify no console errors or warnings
    - Check database indexes are applied
    - Verify Cloudinary folder structure
    - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties across randomized inputs
- Unit tests and integration tests validate specific examples and external service integration
- All incident data is access-controlled based on user role and booking association
- Photos are stored securely in Cloudinary with private access controls
- Email notifications use the existing email service infrastructure
- The system leverages existing Next.js, Prisma, and authentication infrastructure
- Mobile responsiveness is a core requirement throughout implementation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["3.4", "3.5", "4.5", "4.6", "4.7", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "7.4", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "11.1"] },
    { "id": 9, "tasks": ["11.2", "11.3", "13.1"] },
    { "id": 10, "tasks": ["11.4", "13.2", "13.3", "14.1"] },
    { "id": 11, "tasks": ["14.2", "14.3"] },
    { "id": 12, "tasks": ["14.3", "14.4", "16.1"] },
    { "id": 13, "tasks": ["16.2", "16.3", "17.1"] },
    { "id": 14, "tasks": ["17.2", "17.3"] },
    { "id": 15, "tasks": ["18.1", "18.2", "18.3", "18.4", "18.5"] }
  ]
}
```
