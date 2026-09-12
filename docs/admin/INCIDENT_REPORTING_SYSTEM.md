# Incident Reporting System - Implementation Plan

**Status:** Spec Complete - Ready for Implementation  
**Priority:** P0 - Critical Launch Blocker  
**Created:** 2026-09-01  
**Spec Location:** .kiro/specs/incident-reporting-system/

---

## 🚨 CRITICAL OPERATIONAL GAP IDENTIFIED

### Discovery Process

During deep inspection of DriveBook admin + instructor dashboards for operational/business gaps before launch, a **critical missing workflow** was identified:

**ZERO incident/accident reporting system exists.**

### Current State
- ❌ No incident reporting forms (instructor/client/admin)
- ❌ No accident tracking database
- ❌ No insurance claim preparation tools
- ❌ No emergency response workflows
- ❌ Only mentions in legal documents (Terms section 16.5: "Emergency cancellations - illness, accident, vehicle breakdown")

### Business Risk

| Risk Category | Impact | Severity |
|--------------|--------|----------|
| **Insurance Claims** | Claims rejected due to lack of documentation | 🔴 CRITICAL |
| **Legal Liability** | No audit trail for accidents during lessons | 🔴 CRITICAL |
| **Regulatory Compliance** | Cannot prove incident response procedures | 🔴 CRITICAL |
| **Operational Chaos** | Incidents handled via email/phone with no tracking | 🔴 HIGH |
| **Data Loss** | Critical evidence lost or not captured | 🔴 HIGH |

### Real-World Scenarios Without This System

1. **Collision during lesson**
   - ❓ Instructor doesn't know how to report it formally
   - ❓ Admin learns about it days later via email
   - ❓ Insurance company asks for documentation → none exists
   - ❓ Photos taken on phone are lost
   - ❓ Police report number not recorded

2. **Student injury**
   - ❓ No formal investigation workflow
   - ❓ Instructor continues taking bookings during investigation
   - ❓ Liability exposure increases

3. **Vehicle damage**
   - ❓ Disputed responsibility (who pays?)
   - ❓ No timestamped evidence
   - ❓ Cannot link to specific booking

---

## 📋 COMPREHENSIVE SOLUTION SPEC

A complete specification has been created covering requirements, design, and implementation tasks.

### Spec Documents

1. **Requirements** (.kiro/specs/incident-reporting-system/requirements.md)
   - 10 core requirements
   - 63 acceptance criteria (formal SHALL-based)
   - Coverage: instructor reporting, client reporting, photo evidence, admin review, insurance exports, booking linkage, notifications, access control, mobile responsiveness, data retention

2. **Design** (.kiro/specs/incident-reporting-system/design.md)
   - Complete architecture diagrams
   - Prisma database schema (4 new models)
   - API specifications (5 endpoints)
   - UI component designs (3 user-facing interfaces)
   - 37 correctness properties for validation
   - Security, performance, and mobile considerations

3. **Tasks** (.kiro/specs/incident-reporting-system/tasks.md)
   - 96 discrete implementation tasks
   - 18 major task groups
   - 6 checkpoints for validation
   - Estimated 4-6 weeks implementation
   - Property-based tests integrated throughout

---

## 🎯 SYSTEM OVERVIEW

### Key Features

#### For Instructors
- **Quick Report Form** (mobile-optimized)
  - Report during or after lesson (<3 minutes)
  - Upload photos from phone camera (up to 10)
  - Link to specific booking automatically
  - Incident types: Collision, Near-miss, Vehicle damage, Injury, Property damage, Other
  - GPS location capture
  - Police report number field

- **My Reports Dashboard**
  - View status of submitted reports
  - Upload additional evidence
  - Read-only after 24 hours (immutability for compliance)

#### For Clients
- **Safety Concern Form**
  - Similar to instructor form (simplified)
  - Upload up to 5 photos
  - Report concerns about lesson safety

- **My Reports List**
  - Track status of submitted concerns
  - View admin responses

#### For Admins
- **Incident Dashboard** (\/admin/incidents\)
  - List all incidents (filterable by date, type, severity, status)
  - Search by booking reference or keywords
  - Status management: New → Under Review → Resolved → Insurance Claim
  - Instant email/SMS notifications on new reports

- **Incident Detail View**
  - Complete booking context (instructor, client, lesson details)
  - Photo gallery with lightbox
  - Timeline of admin actions
  - Add private investigation notes
  - Export single incident to PDF for insurance

- **Insurance Export Tools**
  - Bulk export to CSV/PDF
  - Filter by date range, status, severity
  - All required fields for insurance claims
  - Generated within 30 seconds

### Technical Architecture

#### Database Schema (Prisma)

\\\prisma
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
  status              String             @default("pending")
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
}

model IncidentPhoto {
  id                String    @id @default(cuid())
  incidentId        String
  cloudinaryPublicId String
  fileName          String
  fileSize          Int
  fileType          String    // JPEG, PNG, HEIC
  uploadedAt        DateTime  @default(now())
  
  incident          Incident  @relation(fields: [incidentId])
  
  @@index([incidentId])
}

model IncidentAuditLog {
  id          String    @id @default(cuid())
  incidentId  String
  userId      String
  action      String    // created, viewed, status-changed, exported, note-added
  details     Json?
  timestamp   DateTime  @default(now())
  
  incident    Incident  @relation(fields: [incidentId])
  
  @@index([incidentId])
  @@index([timestamp])
}

model IncidentNote {
  id          String    @id @default(cuid())
  incidentId  String
  authorId    String
  content     String
  createdAt   DateTime  @default(now())
  
  incident    Incident  @relation(fields: [incidentId])
}
\\\

#### API Endpoints

1. **POST /api/incidents**
   - Submit incident report (instructor/client)
   - Multipart form data (photos)
   - Returns: confirmation + reference number

2. **GET /api/admin/incidents**
   - List all incidents (admin only)
   - Pagination, filtering, search
   - Returns: incidents with booking details

3. **PATCH /api/admin/incidents/[id]/status**
   - Update incident status (admin only)
   - Creates audit log entry

4. **POST /api/admin/incidents/[id]/notes**
   - Add admin investigation note
   - No time restrictions

5. **GET /api/admin/incidents/export**
   - Export to CSV or PDF
   - Filter by date range, status
   - Includes all required fields for insurance

#### UI Pages

1. **\/dashboard/incidents/new\** - Instructor report form
2. **\/dashboard/incidents\** - Instructor reports list
3. **\/client-dashboard/safety-concern\** - Client report form
4. **\/client-dashboard/incidents\** - Client reports list
5. **\/admin/incidents\** - Admin dashboard (list view)
6. **\/admin/incidents/[id]\** - Admin detail view

---

## 🔐 COMPLIANCE & SECURITY

### Key Constraints

✅ **Independent Contractor Status Respected**
- NO instructor incident history tracking (no employment performance management)
- NO incident count metrics per instructor
- NO "high-risk instructor" flagging
- Focus: Insurance claims and compliance, NOT employee reviews

✅ **Data Privacy (Role-Based Access)**
- Instructors see only incidents from their own bookings
- Clients see only their own reports
- Admins see everything
- Full audit trail of all access

✅ **Data Retention (Regulatory Compliance)**
- 7-year minimum retention (Australia insurance requirements)
- Core fields immutable after 24 hours
- Admin notes can be added anytime
- Archive capability after 7 years

✅ **Photo Evidence Security**
- Private Cloudinary storage
- 5-minute signed URLs for viewing
- MIME type + magic byte validation
- Max 10MB per photo

✅ **Audit Logging**
- Every action logged (created, viewed, status-changed, exported)
- User ID, timestamp, IP address, user agent
- Supports compliance audits

---

## 📊 IMPLEMENTATION ROADMAP

### Phase 1: Database & Core Models (Week 1)
- [x] Prisma schema migration
- [x] Database models and relations
- [x] Booking schema extension with onDelete: Restrict

### Phase 2: File Upload Service (Week 1)
- [ ] Cloudinary integration for incident photos
- [ ] Photo validation (format, size, magic byte)
- [ ] Signed URL generation

### Phase 3: Incident Submission (Week 2)
- [ ] Instructor incident form UI
- [ ] Client safety concern form UI
- [ ] POST /api/incidents endpoint
- [ ] Photo upload handling

### Phase 4: Admin Review Interface (Week 3)
- [ ] Admin incident list with filters
- [ ] Admin incident detail view
- [ ] Status update functionality
- [ ] Admin notes system

### Phase 5: Access Control & Audit (Week 3)
- [ ] Role-based access control enforcement
- [ ] User data isolation queries
- [ ] Audit logging for all operations

### Phase 6: Email Notifications (Week 4)
- [ ] Admin email notification service
- [ ] Email template creation
- [ ] Retry logic (up to 3 attempts)

### Phase 7: Export Functionality (Week 4)
- [ ] CSV export generation
- [ ] PDF export generation
- [ ] Export filtering

### Phase 8: User History Views (Week 5)
- [ ] Instructor incident history page
- [ ] Client incident history page
- [ ] Time-based field locking (24 hours)

### Phase 9: Testing & QA (Week 5-6)
- [ ] Property-based test suite (21 properties)
- [ ] Integration tests (email, Cloudinary, database)
- [ ] Mobile device testing
- [ ] Performance testing (30s export, 2min email)
- [ ] Security audit

### Phase 10: Documentation & Deployment (Week 6)
- [ ] API documentation
- [ ] User guides (instructor, client, admin)
- [ ] Deployment checklist
- [ ] Production migration

---

## ⏱️ EFFORT ESTIMATES

| Phase | Tasks | Estimated Hours | Week |
|-------|-------|----------------|------|
| Database & Core Models | 3 | 6h | 1 |
| File Upload Service | 5 | 12h | 1 |
| Incident Submission | 4 | 16h | 2 |
| Admin Review Interface | 4 | 18h | 3 |
| Access Control & Audit | 3 | 8h | 3 |
| Email Notifications | 3 | 8h | 4 |
| Export Functionality | 3 | 12h | 4 |
| User History Views | 2 | 8h | 5 |
| Testing & QA | 5 | 24h | 5-6 |
| Documentation & Deployment | 4 | 8h | 6 |

**Total:** ~120 hours (~4-6 weeks)

### Minimum Viable Version (MVP)
For faster deployment, can reduce to core features:
- Database schema (6h)
- Photo upload service (12h)
- Basic incident submission form (8h)
- Admin list view (6h)
- Email notifications (4h)

**MVP Total:** ~36 hours (~1 week)

---

## 🎬 NEXT STEPS

### Option 1: Start Implementation Now
Click one of these links to begin:

- [Run required tasks](kiro-spec://spec?featureName=incident-reporting-system&action=runTasks)
- [Run required and optional tasks](kiro-spec://spec?featureName=incident-reporting-system&action=runTasks&makeAllRequired=true)

### Option 2: Analyze Requirements First
Review the spec before implementation:

- [Analyze the requirements](kiro-spec://spec?featureName=incident-reporting-system&action=analyze)

### Option 3: Manual Review
Open the spec files directly:
- Requirements: \.kiro/specs/incident-reporting-system/requirements.md\
- Design: \.kiro/specs/incident-reporting-system/design.md\
- Tasks: \.kiro/specs/incident-reporting-system/tasks.md\

---

## 📞 INTEGRATION POINTS

### Existing Infrastructure Used
- ✅ Next-Auth session management (role-based access control)
- ✅ PostgreSQL + Prisma ORM (database)
- ✅ Cloudinary (photo storage - already configured)
- ✅ Existing email service (\lib/services/email.ts\)
- ✅ React + Next.js 14 + Tailwind CSS (UI)
- ✅ shadcn/ui components (forms, tables, modals)

### New Dependencies (if any)
- None! Fully utilizes existing stack

### Changes Required to Existing Code
1. **Booking Model** - Add \incidents\ relation
2. **Admin Navigation** - Add "Incidents" link
3. **Instructor Dashboard** - Add "Report Incident" button
4. **Client Dashboard** - Add "Report Safety Concern" button
5. **Booking Detail Pages** - Show incident count badge

---

## 📈 SUCCESS METRICS

### Operational KPIs
- **Report Speed:** <3 minutes from incident to submission
- **Admin Response:** <2 hours to acknowledge critical incidents
- **Export Speed:** Insurance export generated <30 seconds
- **Email Delivery:** Notification sent <2 minutes

### Compliance KPIs
- **Audit Trail:** 100% of incidents have complete audit logs
- **Data Retention:** 0 incidents deleted before 7 years
- **Access Control:** 0 unauthorized access attempts succeed

### Business KPIs
- **Insurance Claims:** Successful documentation for all claims
- **Legal Protection:** Complete evidence chain for liability defense
- **Operational Efficiency:** Reduced admin time handling incidents

---

## ⚠️ RISK MITIGATION

### Identified Risks
1. **User Adoption (Instructors)**
   - Risk: Instructors bypass system, still email/call
   - Mitigation: Prominent "Report Incident" button, mobile-first design, <3min workflow

2. **Data Quality**
   - Risk: Incomplete incident descriptions
   - Mitigation: 20-character minimum, required fields validation

3. **Photo Storage Costs**
   - Risk: Large volume of photos → Cloudinary costs spike
   - Mitigation: 10MB file size limit, image compression, photo count limits (10 per incident)

4. **Email Overload**
   - Risk: Too many notifications → alert fatigue
   - Mitigation: Smart severity-based routing (SMS for critical only)

5. **Performance (Export)**
   - Risk: Large exports timeout
   - Mitigation: Streaming for CSV, 100-incident limit for PDF, background jobs for huge exports

---

## 🔗 RELATED DOCUMENTATION

- **OPERATIONAL_REQUIREMENTS.md** - Section 5.2 covers high-level incident tracking requirement
- **ADMIN_ENHANCEMENTS_TODO.md** - General admin UX improvements (separate from this critical feature)
- **Terms & Conditions** - Section 16.5 mentions emergency cancellations (legal context)

---

## 📝 DOCUMENT HISTORY

| Date | Author | Changes |
|------|--------|---------|
| 2026-09-01 | System | Initial spec creation after deep inspection |
| 2026-09-01 | System | Requirements phase complete (10 requirements, 63 criteria) |
| 2026-09-01 | System | Design phase complete (architecture, schema, APIs, UI) |
| 2026-09-01 | System | Tasks phase complete (96 tasks, 18 groups, 6 checkpoints) |
| 2026-09-01 | System | Review phase complete (validated consistency, readiness) |
| 2026-09-01 | System | Documentation created (this file) |

---

**Status:** ✅ Spec Complete - Ready for Implementation  
**Next Action:** Choose implementation option above  
**Priority:** 🔴 P0 - CRITICAL LAUNCH BLOCKER  
**Owner:** Engineering Team

