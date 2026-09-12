# Document Compliance System

## Overview

The traffic light compliance system helps you manage instructor document verification and expiry tracking to reduce legal liability.

## Traffic Light Status

- 🟢 **Valid**: All documents current and valid
- 🟡 **Expiring Soon**: Documents expire within 30 days (SMS reminder sent)
- 🔴 **Expired/Invalid**: Documents expired or missing (instructor auto-deactivated)

## Features

### Admin Dashboard (`/admin/documents`)

- View all instructors with compliance status
- Filter by status (Valid/Expiring/Expired)
- Manual actions:
  - Send SMS reminder to instructors with expiring documents
  - Deactivate instructors with expired documents
- Auto-process button: Automatically deactivate expired and remind expiring

### Automatic Compliance Checking

Run the compliance checker script daily:

```bash
node scripts/check-document-compliance.js
```

This script:
1. Checks all active instructors
2. Deactivates those with expired documents
3. Sends SMS reminders for documents expiring within 30 days
4. Provides summary report

### Document Expiry Tracking

Required documents with expiry dates:
- Driver's License
- Insurance Policy
- Police Check (must be < 12 months old)
- Working with Children Check (WWC)

### Instructor Documents Page (`/dashboard/documents`)

Instructors can:
- Upload verification documents
- View current document status
- See expiry dates
- Replace expired documents

## Legal Protection

By maintaining strict document verification:

1. **Proof of Compliance**: You can demonstrate to courts or Department of Transport that all documents were current at time of booking
2. **Reduced Liability**: Automatic deactivation prevents instructors with expired credentials from taking bookings
3. **Audit Trail**: Document verification timestamps tracked in database
4. **Proactive Management**: SMS reminders help instructors stay compliant

## Setup

### 1. Update Database Schema

The schema includes these expiry fields:
- `licenseExpiry`
- `insuranceExpiry`
- `policeCheckExpiry`
- `wwcCheckExpiry`

### 2. Schedule Compliance Checks

Set up a daily cron job or Windows Task Scheduler:

**Linux/Mac (crontab):**
```bash
0 2 * * * cd /path/to/app && node scripts/check-document-compliance.js
```

**Windows Task Scheduler:**
- Create new task
- Trigger: Daily at 2:00 AM
- Action: Start program `node.exe`
- Arguments: `scripts/check-document-compliance.js`
- Start in: `E:\DOC\PDA`

### 3. Configure SMS Notifications

SMS reminders use Twilio (already configured in your `.env`):
- Expired documents: "Your account has been suspended..."
- Expiring soon: "Your documents are expiring soon..."

## API Endpoints

### Get Compliance Status
```
GET /api/admin/documents/compliance
```

Returns array of instructors with compliance status.

### Process Compliance Actions
```
POST /api/admin/documents/compliance
Body: { action: 'deactivate', instructorId: '...' }
Body: { action: 'sendReminder', instructorId: '...' }
Body: { action: 'autoProcess' }
```

### Update Expiry Dates
```
POST /api/instructor/documents/expiry
Body: {
  licenseExpiry: '2025-12-31',
  insuranceExpiry: '2025-12-31',
  policeCheckExpiry: '2025-12-31',
  wwcCheckExpiry: '2025-12-31'
}
```

## Best Practices

1. **Run compliance checks daily** to catch expired documents quickly
2. **Set 30-day reminder threshold** to give instructors time to renew
3. **Keep audit logs** of all deactivations and reminders
4. **Review compliance dashboard weekly** to monitor trends
5. **Require expiry dates** before approving new instructors

## Perth Business Benefits

- **Legal compliance** with WA driving instructor regulations
- **Insurance protection** by ensuring all instructors have current coverage
- **Professional reputation** by maintaining high standards
- **Risk mitigation** through automated enforcement
- **Peace of mind** knowing your platform is protected

## Next Steps

1. ✅ Documents upload system (completed)
2. ✅ Admin compliance dashboard (completed)
3. ✅ Automatic compliance checking (completed)
4. ⏳ Add expiry date inputs to instructor documents page
5. ⏳ Schedule daily compliance checks
6. ⏳ Test SMS notifications
7. ⏳ Train admin staff on compliance dashboard
