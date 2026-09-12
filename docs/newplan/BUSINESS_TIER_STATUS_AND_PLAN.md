# BUSINESS Tier Status Report & Implementation Plan
**Date:** August 18, 2026  
**Current Status:** PARTIALLY IMPLEMENTED (Subscription exists, core multi-instructor features missing)

---

## 📊 Current Implementation Status

### ✅ COMPLETE Features

#### 1. **Subscription Infrastructure**
- ✅ BUSINESS tier defined in `lib/config/subscriptions.ts`
- ✅ Pricing: $199/month or $1,990/year
- ✅ 30-day trial period (vs 14 days for other tiers)
- ✅ 10% commission rate (lowest of all tiers)
- ✅ Stripe price IDs configured
- ✅ `maxInstructors: 999` limit set

#### 2. **Database Schema**
- ✅ `Instructor.accountType` field exists (INDIVIDUAL | BUSINESS)
- ✅ `Instructor.subscriptionTier` field exists
- ✅ `Instructor.maxInstructors` field exists (default: 1, BUSINESS: 999)
- ✅ `Instructor.paymentMode` field exists (PLATFORM | DIRECT)
- ✅ `Instructor.businessName` field exists

#### 3. **Branding Features**
- ✅ Custom domain support (`customDomain`, `domainVerified`)
- ✅ Brand logo and colors (`brandLogo`, `brandColorPrimary`, `brandColorSecondary`)
- ✅ Branded booking pages (`showBrandingOnBookingPage`)
- ✅ Business name display across UI

#### 4. **AI Voice Integration**
- ✅ Voice line assignment for BUSINESS tier
- ✅ PRO/STUDIO/BUSINESS tiers get AI receptionist access
- ✅ `TwilioPhoneNumber` model for phone number pool

#### 5. **Feature Access Control**
- ✅ Tier checks in various UI components
- ✅ `lib/utils/account.ts` has tier validation logic
- ✅ Subscription status checks (TRIAL, ACTIVE, EXPIRED)

---

## ❌ MISSING Core BUSINESS Features

### 1. **Organisation/School Model** (Critical - Foundation)
**Status:** NOT IMPLEMENTED  
**Severity:** HIGH  
**Blocker for:** All multi-instructor features

**What's Missing:**
- No `Organisation` table in database
- No relationship between multiple instructors under one school
- No school-level settings or configuration
- No org-level branding inheritance

**Required Schema:**
```prisma
model Organisation {
  id                  String    @id @default(cuid())
  name                String                    // "ABC Driving School"
  slug                String    @unique         // "abcdriving" → abcdriving.drivebook.com.au
  customDomain        String?                   // "book.abcdriving.com.au"
  domainVerified      Boolean   @default(false)
  ownerUserId         String                    // User who manages the school
  brandLogo           String?
  brandColorPrimary   String?
  brandColorSecondary String?
  vapiAssistantId     String?
  welcomeMessage      String?
  supportPhone        String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  instructors         Instructor[]
  twilioNumbers       TwilioPhoneNumber[]
}
```

**Required Changes:**
- Add `organisationId` to `Instructor` model (nullable)
- Add `organisationId` to `TwilioPhoneNumber` model (nullable)
- Add `organisationId` to `Subscription` model (nullable for org-level billing)

---

### 2. **Team Management Dashboard** (Critical - Core UX)
**Status:** NOT IMPLEMENTED  
**Severity:** HIGH  
**Dependencies:** Organisation model

**Missing Routes:**
- `/dashboard/team` - Team instructor management
- `/dashboard/team-calendar` - Combined availability view
- `/dashboard/revenue` - Aggregated revenue reporting

**Required Features:**
- Add/invite team instructors
- View all instructors in school
- Assign/reassign clients between instructors
- Activate/deactivate instructor accounts
- View instructor performance metrics
- Set school-wide policies

---

### 3. **Multi-Instructor Client Management** (High Priority)
**Status:** PARTIAL - Current `/dashboard/clients` shows only own clients  
**Severity:** MEDIUM  
**Dependencies:** Organisation model

**What's Missing:**
- School owner can't see clients across all instructors
- No client reassignment feature
- No cross-instructor client history
- No school-wide client search

**Required Changes:**
- Update `/app/dashboard/clients/page.tsx` to check for BUSINESS tier
- Add `organisationId` filter to client queries
- Add instructor filter dropdown
- Add "Reassign Client" action

---

### 4. **Aggregated Analytics & Reporting** (High Priority)
**Status:** NOT IMPLEMENTED  
**Severity:** MEDIUM  
**Dependencies:** Organisation model

**Missing Features:**
- School-wide booking statistics
- Revenue per instructor breakdown
- Combined earnings/commission reports
- Export functionality for accounting
- Performance comparison between instructors

---

### 5. **School-Level Branding Inheritance** (Medium Priority)
**Status:** PARTIAL - Individual instructor branding works  
**Severity:** LOW  
**Dependencies:** Organisation model

**What's Missing:**
- No fallback chain: instructor → organisation → platform
- Instructors can't inherit school logo/colors
- No org-level branding configuration UI

**Required Logic:**
```typescript
const primary = instructor.brandColorPrimary
  ?? instructor.organisation?.brandColorPrimary
  ?? '#2563eb'  // DriveBook default
```

---

### 6. **Org-Level AI Phone Routing** (Medium Priority)
**Status:** NOT IMPLEMENTED  
**Severity:** MEDIUM  
**Dependencies:** Organisation model, Twilio webhook

**What's Missing:**
- No `/api/voice/incoming` webhook endpoint
- Phone numbers can't be assigned to organisations
- No dynamic AI assistant identity per school
- AI always says "Thanks for calling DriveBook"

**Required Implementation:**
```typescript
// app/api/voice/incoming/route.ts
// 1. Lookup incoming number in TwilioPhoneNumber
// 2. If organisationId exists, fetch org details
// 3. Inject org context into VAPI assistant:
//    - businessName
//    - welcomeMessage  
//    - serviceArea
//    - supportNumber
```

---

### 7. **RBAC for School Staff** (Low Priority)
**Status:** NOT IMPLEMENTED  
**Severity:** LOW  
**Dependencies:** Organisation model

**What's Missing:**
- No school manager/admin roles
- No permission differentiation (owner vs manager vs instructor)
- JWT doesn't contain `organisationId` or `orgRole`

**Required JWT Fields:**
```typescript
{ 
  id, email, role, instructorId, clientId,
  organisationId?,    // null for solo instructors
  orgRole?           // "OWNER" | "MANAGER"
}
```

---

### 8. **Direct Payment Mode** (Future - Not Urgent)
**Status:** NOT IMPLEMENTED  
**Severity:** LOW  
**Notes:** `paymentMode: "DIRECT"` is in schema but not wired up

**What's Missing:**
- Payments still route through DriveBook Stripe account
- No school-level Stripe Connect account
- No zero-commission billing option

---

## 🎯 Recommended Implementation Phases

### **Phase 1: Foundation** (Highest Priority)
**Goal:** Enable basic multi-instructor school management  
**Estimated Effort:** 2-3 days

#### Tasks:
1. ✅ Add `Organisation` model to schema
2. ✅ Add `organisationId` to `Instructor`, `TwilioPhoneNumber`, `Subscription`
3. ✅ Create Prisma migration
4. ✅ Create admin UI: `/admin/organisations`
   - Create new organisation
   - Link instructors to organisation
   - View organisation details
5. ✅ Add `organisationId` + `orgRole` to JWT
6. ✅ Update auth middleware to support org-level access

**Deliverables:**
- Database supports organisations
- Admin can create schools and link instructors
- Foundation for all other features

---

### **Phase 2: Team Dashboard** (Core UX)
**Goal:** School owners can view and manage their team  
**Estimated Effort:** 3-4 days

#### Tasks:
1. ✅ Create `/app/dashboard/team/page.tsx`
   - List all instructors in school
   - Show instructor status (active/inactive/pending approval)
   - Show booking count and revenue per instructor
   - Add/invite instructor action
2. ✅ Create `/app/api/instructor/team` endpoint
   - GET: List team instructors
   - POST: Invite new instructor
   - PATCH: Update instructor status
3. ✅ Update dashboard navigation
   - Show "Team" tab only for BUSINESS tier
4. ✅ Create invite flow
   - Send email invitation
   - Instructor accepts and links to organisation

**Deliverables:**
- School owners see their team
- Can invite and manage instructors
- Basic team management functionality

---

### **Phase 3: Multi-Instructor Booking/Client View** (Essential Operations)
**Goal:** School owners see all bookings and clients across team  
**Estimated Effort:** 2-3 days

#### Tasks:
1. ✅ Update `/app/dashboard/bookings/page.tsx`
   - Show all bookings across organisation if BUSINESS tier
   - Add instructor filter dropdown
   - Add instructor column to booking table
2. ✅ Update `/app/dashboard/clients/page.tsx`
   - Show all clients across organisation if BUSINESS tier
   - Add instructor filter
   - Add "Reassign Client" action
3. ✅ Update API routes to support org-scope:
   - `/api/bookings` - add org filter
   - `/api/clients` - add org filter
4. ✅ Create `/app/api/clients/[id]/reassign` endpoint

**Deliverables:**
- School owners see all bookings across team
- School owners see all clients
- Can reassign clients between instructors

---

### **Phase 4: School Analytics & Revenue** (Business Intelligence)
**Goal:** School owners see aggregated metrics and revenue  
**Estimated Effort:** 2-3 days

#### Tasks:
1. ✅ Create `/app/dashboard/revenue/page.tsx`
   - Total revenue across all instructors
   - Revenue per instructor breakdown
   - Commission paid per instructor
   - Net payout calculations
   - Date range filters
   - CSV export
2. ✅ Create `/app/api/business/revenue` endpoint
3. ✅ Update dashboard home for BUSINESS tier
   - Show school-wide stats instead of individual
   - Total active students across team
   - Total bookings this week/month
   - Team performance summary

**Deliverables:**
- Comprehensive revenue reporting
- School-level dashboard metrics
- Export capability for accounting

---

### **Phase 5: Team Calendar** (Optional - Nice to Have)
**Goal:** Visual calendar showing all instructor availability  
**Estimated Effort:** 3-4 days

#### Tasks:
1. ✅ Create `/app/dashboard/team-calendar/page.tsx`
   - Weekly view with all instructors
   - Color-coded by instructor
   - Show bookings and available slots
   - Instructor filter
2. ✅ Create `/app/api/business/team-calendar` endpoint
   - Return combined availability + bookings

**Deliverables:**
- School owners see team availability at a glance
- Easier scheduling and conflict resolution

---

### **Phase 6: Branding Inheritance** (Polish)
**Goal:** Instructors inherit school branding automatically  
**Estimated Effort:** 1-2 days

#### Tasks:
1. ✅ Update `app/subdomain/[slug]/page.tsx`
   - Implement fallback chain for colors/logo
2. ✅ Create `/app/admin/organisations/[id]/branding/page.tsx`
   - School-level branding configuration
3. ✅ Update instructor profile UI
   - Show inherited branding with indicator

**Deliverables:**
- Consistent branding across team
- Instructors can override school branding if needed

---

### **Phase 7: AI Phone Routing** (Future Enhancement)
**Goal:** Phone numbers say school name instead of "DriveBook"  
**Estimated Effort:** 2-3 days

#### Tasks:
1. ✅ Create `/app/api/voice/incoming/route.ts`
   - Twilio webhook handler
   - Lookup organisationId from phone number
   - Inject org context into VAPI
2. ✅ Update VAPI system prompt to use variables:
   - `{{businessName}}`
   - `{{welcomeMessage}}`
   - `{{serviceArea}}`
3. ✅ Test with school phone number

**Deliverables:**
- AI receptionist identifies as the school
- White-label phone experience

---

## 📋 Database Migration Strategy

### Migration 1: Add Organisation Model
```sql
-- Create Organisation table
CREATE TABLE "Organisation" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE NOT NULL,
  "customDomain" TEXT,
  "domainVerified" BOOLEAN DEFAULT false,
  "ownerUserId" TEXT NOT NULL,
  "brandLogo" TEXT,
  "brandColorPrimary" TEXT,
  "brandColorSecondary" TEXT,
  "vapiAssistantId" TEXT,
  "welcomeMessage" TEXT,
  "supportPhone" TEXT,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);

-- Add organisationId to Instructor (nullable - all existing rows null)
ALTER TABLE "Instructor" ADD COLUMN "organisationId" TEXT;
ALTER TABLE "Instructor" ADD CONSTRAINT "FK_Instructor_Organisation" 
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id");

-- Add organisationId to TwilioPhoneNumber (nullable)
ALTER TABLE "TwilioPhoneNumber" ADD COLUMN "organisationId" TEXT;
ALTER TABLE "TwilioPhoneNumber" ADD CONSTRAINT "FK_TwilioPhoneNumber_Organisation" 
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id");

-- Add organisationId to Subscription (nullable)
ALTER TABLE "Subscription" ADD COLUMN "organisationId" TEXT;
ALTER TABLE "Subscription" ADD CONSTRAINT "FK_Subscription_Organisation" 
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id");
```

**Safe Migration:** All new fields are nullable. Existing solo instructors continue working unchanged.

---

## 🔐 Authentication Changes

### Current JWT:
```typescript
{ 
  id: string,
  email: string, 
  role: "CLIENT" | "INSTRUCTOR" | "ADMIN",
  instructorId?: string,
  clientId?: string
}
```

### Enhanced JWT (Phase 1):
```typescript
{ 
  id: string,
  email: string, 
  role: "CLIENT" | "INSTRUCTOR" | "ADMIN",
  instructorId?: string,
  clientId?: string,
  organisationId?: string,     // NEW - null for solo instructors
  orgRole?: "OWNER" | "MANAGER" // NEW - only set for school accounts
}
```

---

## 🎨 UI/UX Considerations

### 1. **Dashboard Navigation Changes**
Current navigation for instructors:
- Dashboard
- Bookings
- Clients
- Earnings
- Profile
- Settings

**BUSINESS tier additions:**
- **Team** (new)
- **Team Calendar** (new)
- **Revenue** (replaces Earnings)
- Bookings (shows all team bookings)
- Clients (shows all team clients)

### 2. **Visual Indicators**
- Badge showing "School Account" in header
- Instructor filter dropdowns on all list pages
- "Assigned Instructor" column in tables
- Color-coding per instructor in calendars

### 3. **Onboarding Flow**
When BUSINESS tier subscribes:
1. Welcome screen: "Set up your driving school"
2. Enter school name
3. Upload school logo (optional)
4. Set brand colors (optional)
5. Invite first team instructor

---

## 📊 Metrics to Track (Post-Implementation)

1. **Adoption Metrics:**
   - Number of BUSINESS tier subscriptions
   - Average instructors per school
   - Churn rate BUSINESS vs solo tiers

2. **Usage Metrics:**
   - Team dashboard daily active users
   - Revenue report exports per month
   - Client reassignments per month

3. **Performance Metrics:**
   - API response times with org-scope queries
   - Database query performance with joins

---

## ⚠️ Known Risks & Mitigations

### Risk 1: Query Performance with Organisation Joins
**Mitigation:** 
- Add database indexes: `organisationId` on all affected tables
- Implement query result caching for team lists
- Paginate large result sets

### Risk 2: Breaking Changes for Solo Instructors
**Mitigation:**
- All new fields nullable
- Backward-compatible API responses
- Comprehensive testing before deployment

### Risk 3: Stripe Billing Complexity (Org-Level Subscriptions)
**Mitigation:**
- Phase 1-6 keep individual instructor subscriptions
- Phase 7+ implements org-level billing as optional upgrade
- Document billing flow clearly

---

## 🚀 Next Steps (Immediate)

### Option A: Full Implementation (Recommended)
**Timeline:** 10-15 days  
**Approach:** Implement Phases 1-4 to deliver core BUSINESS tier functionality

**Week 1:**
- Days 1-2: Phase 1 (Foundation - Organisation model)
- Days 3-5: Phase 2 (Team Dashboard)

**Week 2:**
- Days 1-3: Phase 3 (Multi-Instructor Views)
- Days 4-5: Phase 4 (Revenue Reporting)

### Option B: MVP (Fastest Time to Market)
**Timeline:** 5-7 days  
**Approach:** Implement Phases 1-2 only

**Delivers:**
- School account creation
- Team instructor management
- Basic team visibility

**Defers:**
- Cross-instructor booking/client views
- Advanced analytics
- Team calendar

### Option C: Incremental (Lowest Risk)
**Timeline:** 15-20 days  
**Approach:** One phase per week with production testing between

**Benefits:**
- User feedback between phases
- Safer rollout
- Time to fix issues before next phase

---

## 💡 Recommendation

**Implement Option A (Full Core Implementation)**

**Rationale:**
1. BUSINESS tier promises are already advertised ($199/month subscription exists)
2. Without Phases 1-4, BUSINESS tier has no differentiation from STUDIO tier
3. Core multi-instructor features are table stakes for school customers
4. Foundation work (Phase 1) is required for all future phases anyway

**Success Criteria:**
- School owner can invite and manage team instructors
- School owner sees all bookings/clients across team
- School owner sees aggregated revenue reporting
- No breaking changes for solo instructors
- All TypeScript errors resolved
- Full test coverage for new features

---

## 📝 Documentation Updates Needed

Post-implementation:
1. Update `docs/DOCROLEBASE/04-business/` with actual routes and features
2. Create user guide: "Setting Up Your Driving School Account"
3. Update API documentation with org-scope endpoints
4. Create migration guide for existing BUSINESS tier customers
5. Update pricing page with accurate feature list

---

**End of Report**
