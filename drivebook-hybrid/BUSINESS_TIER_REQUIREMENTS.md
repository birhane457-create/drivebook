# Business Tier Requirements

## Current Status

The instructor dashboard is **production ready for BASIC and PRO tiers** (90% complete).

For **BUSINESS tier**, we need to build additional features for multi-instructor driving schools.

---

## ✅ What's Ready (BASIC & PRO)

### BASIC Tier ($29/month) ✅
- [x] Single instructor account
- [x] Unlimited bookings
- [x] Google Calendar sync
- [x] Email notifications
- [x] Basic analytics
- [x] Student reviews
- [x] Mobile app access
- [x] 15% commission per booking
- [x] 8% bonus for new students

### PRO Tier ($79/month) ✅
- [x] Everything in Basic
- [x] Advanced analytics & insights
- [x] SMS notifications
- [x] Waiting list management
- [x] PDA test tracking
- [x] Document management
- [x] Check-in/Check-out system
- [x] Custom service areas
- [x] 12% commission per booking
- [x] 10% bonus for new students
- [x] Priority email support

---

## ⚠️ What's Missing (BUSINESS)

### BUSINESS Tier ($199/month) ⚠️

#### 1. Multiple Instructor Accounts (NOT BUILT)
**Current**: Single instructor per account
**Needed**: Multiple instructors under one business account

**Requirements**:
- Business owner dashboard (separate from instructor dashboard)
- Add/remove instructors
- Assign instructors to bookings
- Per-instructor analytics
- Per-instructor earnings
- Instructor permissions/roles
- Instructor schedules (separate calendars)

**Database Changes**:
```prisma
model Business {
  id              String       @id @default(cuid())
  name            String
  ownerId         String       @unique
  owner           User         @relation(fields: [ownerId], references: [id])
  instructors     Instructor[]
  subscriptionTier String      @default("BUSINESS")
  customDomain    String?
  brandingSettings Json?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model Instructor {
  // Add business relationship
  businessId      String?
  business        Business?    @relation(fields: [businessId], references: [id])
  role            String       @default("INSTRUCTOR") // OWNER, MANAGER, INSTRUCTOR
}
```

**Estimated Time**: 20 hours

---

#### 2. Branded Booking Pages (NOT BUILT)
**Current**: Generic platform branding
**Needed**: Custom branding per business

**Requirements**:
- Custom logo upload
- Custom color scheme
- Custom booking page URL (e.g., `/book/business-name`)
- Hide platform branding
- Custom email templates
- Custom SMS sender name

**Features**:
- Logo upload (Cloudinary)
- Color picker for primary/secondary colors
- Custom business name display
- Custom footer text
- Custom terms & conditions link

**Estimated Time**: 12 hours

---

#### 3. Custom Domain Support (NOT BUILT)
**Current**: All bookings on platform domain
**Needed**: Custom domain per business (e.g., `bookings.drivingschool.com`)

**Requirements**:
- DNS configuration guide
- Domain verification
- SSL certificate setup (Let's Encrypt)
- Subdomain routing
- Domain management UI

**Technical Stack**:
- Vercel custom domains API
- DNS verification (TXT records)
- SSL auto-provisioning
- Multi-tenant routing

**Estimated Time**: 16 hours

---

#### 4. API Access (NOT BUILT)
**Current**: No public API
**Needed**: REST API for integrations

**Requirements**:
- API key generation
- API documentation
- Rate limiting per business
- Webhook support
- API endpoints:
  - GET /api/v1/bookings
  - POST /api/v1/bookings
  - GET /api/v1/instructors
  - GET /api/v1/clients
  - GET /api/v1/analytics

**Security**:
- API key authentication
- Rate limiting (1000 requests/hour)
- IP whitelisting (optional)
- Webhook signatures

**Estimated Time**: 24 hours

---

#### 5. Advanced Reporting (NOT BUILT)
**Current**: Basic analytics per instructor
**Needed**: Business-wide reporting

**Requirements**:
- Multi-instructor analytics
- Revenue by instructor
- Bookings by instructor
- Client distribution
- Performance comparisons
- Export to CSV/PDF
- Scheduled reports (email)

**Reports**:
- Daily summary
- Weekly performance
- Monthly revenue
- Instructor leaderboard
- Client retention
- Booking trends

**Estimated Time**: 16 hours

---

#### 6. Dedicated Account Manager (MANUAL)
**Current**: Email support only
**Needed**: Dedicated account manager

**Requirements**:
- Assign account manager to business
- Direct phone line
- Priority support queue
- Monthly check-in calls
- Training sessions
- Onboarding assistance

**Implementation**:
- Add `accountManagerId` to Business model
- Create account manager dashboard
- Support ticket system with priority
- Calendar integration for calls

**Estimated Time**: 12 hours (technical) + hiring account manager

---

#### 7. White-Label Solution (NOT BUILT)
**Current**: Platform branding visible
**Needed**: Complete white-label

**Requirements**:
- Remove all platform branding
- Custom login page
- Custom email domain
- Custom SMS sender
- Custom app name (mobile)
- Custom support email

**Features**:
- Configurable branding settings
- Custom email templates
- Custom SMS templates
- Custom mobile app build (optional)

**Estimated Time**: 20 hours

---

## 📊 Business Tier Development Summary

| Feature | Status | Estimated Time | Priority |
|---------|--------|----------------|----------|
| Multiple Instructors | ❌ Not Built | 20 hours | Critical |
| Branded Booking Pages | ❌ Not Built | 12 hours | High |
| Custom Domain | ❌ Not Built | 16 hours | Medium |
| API Access | ❌ Not Built | 24 hours | Medium |
| Advanced Reporting | ❌ Not Built | 16 hours | High |
| Account Manager | ⚠️ Manual | 12 hours | Low |
| White-Label | ❌ Not Built | 20 hours | Medium |

**Total Estimated Time**: 120 hours (3 weeks full-time)

---

## 🎯 Recommended Approach

### Phase 1: Core Multi-Tenant (40 hours)
1. Multiple instructor accounts (20 hours)
2. Business owner dashboard (12 hours)
3. Per-instructor analytics (8 hours)

**Deliverable**: Business can add multiple instructors and manage them

---

### Phase 2: Branding & Customization (32 hours)
1. Branded booking pages (12 hours)
2. White-label solution (20 hours)

**Deliverable**: Business can customize branding and remove platform branding

---

### Phase 3: Advanced Features (48 hours)
1. Custom domain support (16 hours)
2. API access (24 hours)
3. Advanced reporting (8 hours)

**Deliverable**: Business has full control and integration capabilities

---

## 💡 Quick Win: Launch Without Business Tier

**Recommendation**: Launch with BASIC and PRO tiers now, build BUSINESS tier later.

**Reasons**:
1. ✅ BASIC and PRO are production ready (90%)
2. ✅ Most driving schools are single-instructor (BASIC/PRO market)
3. ✅ Business tier is complex (120 hours development)
4. ✅ Can validate market demand before building
5. ✅ Revenue from BASIC/PRO funds BUSINESS development

**Timeline**:
- **Now**: Launch BASIC and PRO tiers
- **Month 1-2**: Gather feedback, validate demand
- **Month 3**: Start BUSINESS tier development if demand exists
- **Month 4-5**: Complete BUSINESS tier
- **Month 6**: Launch BUSINESS tier

---

## 🚀 Current Launch Status

### Ready to Launch ✅
- **BASIC Tier**: 100% Ready
- **PRO Tier**: 100% Ready
- **BUSINESS Tier**: 0% Ready (not built)

### Recommendation
**Launch with BASIC and PRO tiers immediately**

Mark BUSINESS tier as "Coming Soon" or "Contact Sales" on pricing page.

---

## 📋 Business Tier Checklist (When Ready to Build)

### Phase 1: Multi-Tenant Foundation
- [ ] Create Business model in database
- [ ] Add businessId to Instructor model
- [ ] Build business owner dashboard
- [ ] Add/remove instructors UI
- [ ] Instructor role management
- [ ] Per-instructor scheduling
- [ ] Per-instructor analytics
- [ ] Per-instructor earnings

### Phase 2: Branding
- [ ] Logo upload system
- [ ] Color scheme customization
- [ ] Custom booking page URL
- [ ] Custom email templates
- [ ] Custom SMS templates
- [ ] Hide platform branding option

### Phase 3: Custom Domain
- [ ] DNS configuration guide
- [ ] Domain verification system
- [ ] SSL certificate setup
- [ ] Subdomain routing
- [ ] Domain management UI

### Phase 4: API
- [ ] API key generation
- [ ] API documentation
- [ ] Rate limiting
- [ ] Webhook system
- [ ] API endpoints (bookings, instructors, clients, analytics)

### Phase 5: Advanced Reporting
- [ ] Multi-instructor analytics
- [ ] Revenue by instructor
- [ ] Performance comparisons
- [ ] Export to CSV/PDF
- [ ] Scheduled reports

### Phase 6: White-Label
- [ ] Remove all platform branding
- [ ] Custom login page
- [ ] Custom email domain
- [ ] Custom support email
- [ ] Custom mobile app (optional)

---

## 💰 Pricing Strategy

### Current Pricing
- **BASIC**: $29/month (15% commission)
- **PRO**: $79/month (12% commission)
- **BUSINESS**: $199/month (10% commission)

### Recommendation
Keep BUSINESS tier pricing but mark as "Coming Soon" or "Contact Sales" until features are built.

**Alternative**: Offer PRO tier with "Business features coming Q2 2026" message.

---

## 📞 Next Steps

### Option 1: Launch Now (Recommended)
1. ✅ Launch BASIC and PRO tiers immediately
2. ⏰ Mark BUSINESS as "Coming Soon"
3. 📊 Gather market feedback
4. 🔨 Build BUSINESS tier if demand exists

### Option 2: Wait for Business Tier
1. ⏰ Delay launch 3 weeks
2. 🔨 Build BUSINESS tier features
3. 🚀 Launch all 3 tiers together

**Recommendation**: **Option 1** - Launch now with BASIC/PRO, build BUSINESS later based on demand.

---

**Last Updated**: Business Tier Analysis
**Status**: BASIC/PRO Ready ✅ | BUSINESS Not Built ⚠️
**Recommendation**: Launch BASIC/PRO now, build BUSINESS later
