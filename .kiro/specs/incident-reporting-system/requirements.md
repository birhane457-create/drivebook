# Requirements Document

## Introduction

The incident reporting system enables instructors and clients to report accidents, incidents, and safety concerns that occur during driving lessons. The system captures essential information for insurance claims and compliance purposes while respecting the independent contractor status of instructors. Admins can review incidents, export data for insurance purposes, and link incidents to specific bookings.

## Glossary

- **Incident_System**: The incident reporting and management system
- **Instructor**: An independent contractor who provides driving lessons
- **Client**: A learner who books driving lessons
- **Admin**: A system administrator who reviews and manages incident reports
- **Incident**: An accident, near-miss, safety concern, or reportable event during a lesson
- **Booking**: A scheduled driving lesson linking an instructor and client
- **Evidence_Photo**: A digital image uploaded to support an incident report
- **Insurance_Export**: A formatted document containing incident data for insurance claims

## Requirements

### Requirement 1: Instructor Incident Reporting

**User Story:** As an instructor, I want to report accidents or incidents during lessons from my mobile device, so that I can document events immediately for insurance and compliance purposes.

#### Acceptance Criteria

1. THE Incident_System SHALL provide a mobile-responsive incident report form
2. WHEN an Instructor accesses the incident form, THE Incident_System SHALL display fields for incident date, time, location, and description
3. WHEN an Instructor submits an incident report, THE Incident_System SHALL link the report to the associated Booking
4. WHEN an Instructor submits an incident report, THE Incident_System SHALL accept up to 10 Evidence_Photos per report
5. THE Incident_System SHALL validate that incident description contains at least 20 characters
6. WHEN an incident report is successfully submitted, THE Incident_System SHALL display a confirmation message with the incident reference number
7. THE Incident_System SHALL allow Instructors to select incident type from predefined categories including accident, near-miss, vehicle damage, and other
8. WHEN an Instructor submits an incident report, THE Incident_System SHALL capture the submitter role as instructor

### Requirement 2: Client Safety Concern Reporting

**User Story:** As a client, I want to report safety concerns about my lesson, so that issues can be documented and reviewed by administrators.

#### Acceptance Criteria

1. THE Incident_System SHALL provide a client-accessible safety concern report form
2. WHEN a Client accesses the safety concern form, THE Incident_System SHALL display fields for concern date, time, and description
3. WHEN a Client submits a safety concern, THE Incident_System SHALL link the report to the associated Booking
4. WHEN a Client submits a safety concern, THE Incident_System SHALL accept up to 5 Evidence_Photos per report
5. THE Incident_System SHALL validate that concern description contains at least 20 characters
6. WHEN a safety concern is successfully submitted, THE Incident_System SHALL display a confirmation message with the incident reference number
7. WHEN a Client submits a safety concern, THE Incident_System SHALL capture the submitter role as client

### Requirement 3: Photo Evidence Management

**User Story:** As a user reporting an incident, I want to upload photos as evidence, so that visual documentation supports the incident report.

#### Acceptance Criteria

1. THE Incident_System SHALL accept Evidence_Photos in JPEG, PNG, and HEIC formats
2. THE Incident_System SHALL validate that each Evidence_Photo does not exceed 10 megabytes
3. WHEN an Evidence_Photo upload fails, THE Incident_System SHALL display an error message indicating the reason
4. THE Incident_System SHALL store Evidence_Photos with secure access controls
5. WHEN an Evidence_Photo is uploaded, THE Incident_System SHALL generate a unique identifier for the photo
6. THE Incident_System SHALL associate each Evidence_Photo with exactly one incident report

### Requirement 4: Admin Incident Review

**User Story:** As an admin, I want to review all incident reports in a centralized interface, so that I can assess incidents and take appropriate action.

#### Acceptance Criteria

1. THE Incident_System SHALL provide an admin interface displaying all incident reports
2. THE Incident_System SHALL display incidents sorted by submission date with most recent first
3. WHEN an Admin views an incident report, THE Incident_System SHALL display incident type, date, time, location, description, submitter role, and linked Booking details
4. WHEN an Admin views an incident report, THE Incident_System SHALL display all associated Evidence_Photos
5. THE Incident_System SHALL allow Admins to filter incidents by date range, incident type, and submitter role
6. THE Incident_System SHALL allow Admins to search incidents by Booking reference or description keywords
7. THE Incident_System SHALL display the instructor name and client name associated with each incident via the linked Booking
8. THE Incident_System SHALL allow Admins to update incident status to pending, under review, resolved, or closed

### Requirement 5: Insurance Export Functionality

**User Story:** As an admin, I want to export incident data for insurance purposes, so that I can provide required documentation to insurance providers.

#### Acceptance Criteria

1. THE Incident_System SHALL allow Admins to export incident reports in CSV format
2. THE Incident_System SHALL allow Admins to export incident reports in PDF format
3. WHEN an Admin exports incidents, THE Incident_System SHALL include incident reference number, type, date, time, location, description, instructor name, client name, and Booking reference
4. THE Incident_System SHALL allow Admins to filter which incidents are included in the Insurance_Export by date range and status
5. WHEN an Admin initiates an export, THE Incident_System SHALL generate the Insurance_Export within 30 seconds
6. THE Incident_System SHALL include Evidence_Photo file names in the Insurance_Export
7. WHEN an Admin exports incidents in PDF format, THE Incident_System SHALL format the document with clear sections and readable typography

### Requirement 6: Booking Linkage

**User Story:** As a system, I want to link incidents to bookings, so that incident context includes instructor, client, and lesson details.

#### Acceptance Criteria

1. WHEN an incident report is submitted, THE Incident_System SHALL require a valid Booking identifier
2. THE Incident_System SHALL validate that the Booking identifier exists in the system
3. WHEN an incident is linked to a Booking, THE Incident_System SHALL retrieve and display the instructor name, client name, lesson date, and lesson time
4. THE Incident_System SHALL allow multiple incidents to be linked to the same Booking
5. WHEN viewing a Booking, THE Incident_System SHALL display a count of linked incidents
6. THE Incident_System SHALL prevent deletion of a Booking that has linked incidents

### Requirement 7: Email Notifications

**User Story:** As an admin, I want to receive email notifications when incidents are reported, so that I can respond promptly to urgent situations.

#### Acceptance Criteria

1. WHEN an incident report is submitted, THE Incident_System SHALL send an email notification to all Admin users
2. THE Incident_System SHALL include in the notification email the incident reference number, type, date, submitter role, and incident description
3. THE Incident_System SHALL include in the notification email a direct link to view the full incident report
4. WHEN an email notification fails to send, THE Incident_System SHALL log the error and retry up to 3 times
5. THE Incident_System SHALL send the notification email within 2 minutes of incident submission
6. THE Incident_System SHALL use the existing email service configured in the application

### Requirement 8: Data Privacy and Access Control

**User Story:** As a system administrator, I want incident data to be secure and access-controlled, so that sensitive information is protected and compliant with privacy requirements.

#### Acceptance Criteria

1. THE Incident_System SHALL restrict incident report submission to authenticated users with Instructor or Client roles
2. THE Incident_System SHALL restrict incident review and export functions to authenticated users with Admin role
3. WHEN an Instructor views incidents, THE Incident_System SHALL display only incidents where the Instructor is associated with the linked Booking
4. WHEN a Client views incidents, THE Incident_System SHALL display only incidents where the Client is associated with the linked Booking
5. THE Incident_System SHALL prevent Instructors from viewing aggregate incident statistics or incident history across multiple bookings
6. THE Incident_System SHALL prevent Clients from viewing other Clients' incident reports
7. THE Incident_System SHALL log all access to incident reports including user identifier, timestamp, and action performed

### Requirement 9: Mobile Responsiveness

**User Story:** As a user reporting an incident from a mobile device, I want the incident form to be fully functional on small screens, so that I can report incidents from the field.

#### Acceptance Criteria

1. WHEN the incident form is displayed on a device with screen width less than 768 pixels, THE Incident_System SHALL render the form in a single-column layout
2. THE Incident_System SHALL ensure all form input fields are tappable with a minimum touch target size of 44 pixels
3. WHEN Evidence_Photos are uploaded from a mobile device, THE Incident_System SHALL allow access to the device camera
4. THE Incident_System SHALL display uploaded Evidence_Photos as thumbnails with a maximum width of 100 pixels on mobile devices
5. WHEN the incident form is submitted from a mobile device, THE Incident_System SHALL display loading indicators during submission

### Requirement 10: Data Retention and Compliance

**User Story:** As a business owner, I want incident reports retained appropriately for legal and compliance purposes, so that historical records are available when needed.

#### Acceptance Criteria

1. THE Incident_System SHALL retain all incident reports for a minimum of 7 years from the incident date
2. THE Incident_System SHALL retain all Evidence_Photos for a minimum of 7 years from the incident date
3. THE Incident_System SHALL prevent modification of incident report core fields after 24 hours of submission
4. THE Incident_System SHALL allow Admins to add notes to existing incident reports at any time
5. WHEN an incident report is older than 7 years, THE Incident_System SHALL allow Admins to archive the report
6. THE Incident_System SHALL record the timestamp and user identifier for incident report creation and any status changes
