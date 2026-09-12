# DriveBook Navigation Architecture
## Source of Truth for Public Navigation

**Version:** 2.0  
**Date:** January 2025  
**Status:** READY FOR IMPLEMENTATION  
**Based on:** VERIFIED_MASTER_INVENTORY.md

**Major Changes in v2.0:**
- ✅ Combined "For Instructors" + "For Driving Schools" → "For Instructors & Schools"
- ✅ School-specific features moved to third column in B2B mega-menu
- ✅ Removed "Manage Your Learning" from public navigation (authenticated only)
- ✅ Simplified learner menu groupings by customer intent
- ✅ Simplified Resources to standard dropdown (not mega-menu)
- ✅ Context-aware "Get Started" CTA guidance
- ✅ Clarified payment model (direct to instructor, not through DriveBook)

---

## Core Principles

### 1. Navigation Answers Customer Intent, Not Product Structure

> **"What am I here to do?" not "Which internal product/feature does this belong to?"**

**What this means:**
- Navigation organized by **customer jobs**, not internal taxonomy
- Both instructors and schools use the **same Business Platform**
- School features don't need separate top-level menu (they segment inside)
- This makes the platform feel bigger and more cohesive, not scattered

### 2. Navigation Visibility ≠ Product Status

> **A feature may receive prominent navigation placement when it represents a high-value customer need or differentiator.**

**What this means:**
- Product taxonomy answers: "What are we selling?"
- Navigation answers: "What does the customer need to find?"
- These should NOT be forced to match
- Features can be prominently featured without becoming "products"

---

## Primary Audiences & Customer Journeys

### 1. **Learners/Students** (B2C Marketplace)
- **Goal:** Find instructor, book lessons, learn to drive, pass test
- **Entry point:** Homepage, `/book`
- **Navigation label:** "Find an Instructor"
- **Customer job:** "I need to learn to drive and find the right instructor"

### 2. **Instructors & Driving Schools** (B2B SaaS Platform)
- **Goal:** Run business efficiently, grow student base, scale operations
- **Entry point:** `/teach-with-drivebook`, `/platform`
- **Navigation label:** "For Instructors & Schools"
- **Customer job:** "I need to run/grow my instructor business or driving school"

**Key Insight:** Solo instructors and driving schools use the **same Business Platform**. The difference is scale and tier-locked capabilities (Multi-Instructor, Permissions, etc.), not separate products.

**Why combined navigation:**
- Both use same core features (Booking, Calendar, CRM, Payments)
- Schools need to see core features (not hidden in separate menu)
- Solo instructors can see school features (visible growth path)
- Platform feels bigger and more cohesive
- Less scattered header
- Natural segmentation happens **inside** the mega-menu

### 3. **Resources** (All Audiences)
- **Goal:** Learn, research, get support
- **Entry point:** `/learn-to-drive`, `/blog`, `/help`
- **Navigation label:** "Resources"
- **Customer job:** "I need to educate myself or get help"

---

## Top-Level Navigation Structure

### Desktop Header (Public, Unauthenticated)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Find an Instructor ▼  For Instructors & Schools ▼  Resources ▼  About │  Login | Get Started
└──────────────────────────────────────────────────────────────────────────────┘
```

**Left Side (Primary Navigation):**
1. **Logo** (links to `/`)
2. **Find an Instructor** ▼ (learner mega-menu)
3. **For Instructors & Schools** ▼ (B2B mega-menu)
4. **Resources** ▼ (simple dropdown, NOT mega-menu)
5. **About** (direct link)

**Right Side (Utility Navigation):**
- **Login** (direct link to `/login`)
- **Get Started** (context-aware CTA button - see guidance below)

---

## MEGA-MENU 1: FIND AN INSTRUCTOR (Learners)

### Top-Level Label: "Find an Instructor"
**Hover behavior:** Desktop mega-menu opens  
**Mobile behavior:** Expands to show sections

---

### Section 1: "Find the Right Instructor"
**Customer Intent:** Discovery, research, comparison

| Item | URL | Role | Status |
|------|-----|------|--------|
| **Find an Instructor** | `/book` | Primary | LIVE |
| Browse by Location | `/driving-lessons` | Primary | LIVE |
| Instructor Profiles | Embedded in `/book` | Feature | LIVE |
| Reviews & Ratings | Embedded in profiles | Feature | LIVE |

---

### Section 2: "Book Lessons"
**Customer Intent:** Transaction, booking

| Item | URL | Role | Status |
|------|-----|------|--------|
| **Driving Lessons** | `/book` (default) | Service | LIVE |
| Lesson Packages | `/book` (package flow) | Service | LIVE |

---

### Section 3: "Prepare for Your Test"
**Customer Intent:** Test preparation, specialized services

| Item | URL | Role | Status |
|------|-----|------|--------|
| Test Preparation | Instructor packages | Service | LIVE |
| PDA Test-Day Services | Instructor packages (WA) | Service | LIVE |

---

### Section 4: "Learn"
**Customer Intent:** Education, self-help content

| Item | URL | Role | Status |
|------|-----|------|--------|
| Learn to Drive | `/learn-to-drive` | Resource | LIVE |
| PDA Guide | `/pda-guide` | Resource | LIVE |

---

### ⚠️ REMOVED FROM PUBLIC NAV: "Manage Your Learning"

**Previously included (now REMOVED):**
- My Bookings
- Progress
- Lesson History
- Wallet / Credits

**Reason:** These are **authenticated app features**, not public discovery pages.

**Where they appear:** Only in **logged-in learner navigation** (AuthenticatedNav.tsx)

---

## MEGA-MENU 2: FOR INSTRUCTORS & SCHOOLS (B2B Platform)

### Top-Level Label: "For Instructors & Schools"
**Hover behavior:** Desktop mega-menu opens (3-column layout)  
**Mobile behavior:** Expands to show 3 sections vertically

---

### Three-Column Desktop Layout:

```
┌─────────────────────────┬──────────────────────────┬────────────────────────────┐
│  RUN YOUR BUSINESS      │  GROW YOUR BUSINESS      │  FOR DRIVING SCHOOLS       │
│                         │                          │                            │
│  DriveBook Platform     │  🤖 AI Receptionist      │  👥 Multi-Instructor       │
│  Online Booking         │     Answer calls 24/7    │     Manage your team       │
│  Calendar & Scheduling  │                          │                            │
│  Student Management     │  🌐 Custom Domain        │  Instructor Calendars      │
│  Payments & Payouts     │     Build your brand     │  Staff & Permissions       │
│  Analytics              │                          │  School Reporting          │
│                         │  Marketing & SEO         │  White-Label Experience    │
│                         │  Professional Website    │                            │
│                         │  Student Progress        │                            │
│                         │                          │                            │
│  GET STARTED                                                                    │
│  Pricing · Teach with DriveBook · Instructor Resources · Contact               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Column 1: "Run Your Business"
**Customer Intent:** Core platform capabilities, daily operations  
**Audience:** ALL instructors and schools

| Item | URL | Role | Featured | Status |
|------|-----|------|----------|--------|
| **DriveBook Platform** | `/platform` | Product | NO | LIVE |
| Online Booking | `/features/online-booking` | Capability | NO | LIVE |
| Calendar & Scheduling | TBD | Capability | NO | TBD |
| Student Management | TBD | Capability | NO | TBD |
| Payments & Payouts | `/features/payments` | Capability | NO | LIVE |
| Analytics | TBD | Capability | NO | TBD |

**Customer Job:** "I need to run my instructor business efficiently"

**Notes:**
- "DriveBook Platform" is the anchor/overview page
- Other items are specific capabilities
- These are features of the Business Platform, but individually navigable
- All instructors and schools need these

---

### Column 2: "Grow Your Business"
**Customer Intent:** Differentiators, growth tools, marketing, automation  
**Audience:** ALL instructors and schools (tier-gated features)

| Item | URL | Role | Featured | Benefit | Status |
|------|-----|------|----------|---------|--------|
| **🤖 AI Receptionist** | `/features/ai-receptionist` | Capability | **YES** | Answer calls 24/7, never miss a booking | LIVE |
| **🌐 Custom Domain** | `/features/custom-domain` | Capability | **YES** | Build your brand on your own domain | LIVE |
| Marketing & SEO | TBD | Capability | NO | n/a | TBD |
| Professional Website | `/features/online-booking` | Capability | NO | n/a | LIVE |
| Student Progress | `/features/student-progress` | Capability | NO | n/a | LIVE |

**Customer Job:** "I need to attract more students and grow my business"

**Featured Items:**
- **AI Receptionist:** Major differentiator, PRO+ tier
- **Custom Domain:** Strong branding value, STUDIO+ tier

**Visual Treatment:**
- Icon/emoji (🤖 🌐)
- Short benefit statement below title
- Slightly larger or highlighted styling

---

### Column 3: "For Driving Schools"
**Customer Intent:** School-specific operations, team management, multi-instructor  
**Audience:** Driving schools (STUDIO/BUSINESS tier)

| Item | URL | Role | Featured | Benefit | Status |
|------|-----|------|----------|---------|--------|
| **👥 Multi-Instructor Management** | `/features/multi-instructor` | Capability | **YES** | Manage your entire instructor team from one place | LIVE |
| Instructor Calendars | TBD | Capability | NO | n/a | TBD |
| Staff & Permissions | TBD (BUSINESS tier) | Capability | NO | n/a | TBD |
| School Reporting | `/features/payments` or TBD | Capability | NO | n/a | TBD |
| White-Label Experience | `/features/custom-domain` | Capability | NO | n/a | LIVE |

**Customer Job:** "I need to manage my driving school team and operations"

**Featured Item:**
- **Multi-Instructor Management:** Primary school differentiator, STUDIO+ tier

**Why separate column, not separate menu:**
- Solo instructors can see growth path (upsell visibility)
- Schools see core features in Column 1 (not hidden)
- Platform feels cohesive, not fragmented
- Natural segmentation without header clutter

---

### Bottom Section: "Get Started"
**Customer Intent:** Conversion, onboarding, learning

| Item | URL | Role | Status |
|------|-----|------|--------|
| Pricing | `/pricing` or TBD | Commercial | TBD |
| Teach with DriveBook | `/teach-with-drivebook` | CTA/Recruitment | LIVE |
| Instructor Resources | `/for-instructors` | Resource | LIVE |
| Contact | `/contact` | CTA | LIVE |

**Customer Job:** "I want to sign up or learn more"

---

## STANDARD DROPDOWN: RESOURCES (All Audiences)

### Top-Level Label: "Resources"
**Behavior:** Standard dropdown (NOT mega-menu)  
**Why:** Simpler content links, less visual weight needed

---

### Section 1: "For Learners"

| Item | URL | Audience | Status |
|------|-----|----------|--------|
| Learn to Drive | `/learn-to-drive` | Learner | LIVE |
| PDA Guide | `/pda-guide` | Learner (WA) | LIVE |

---

### Section 2: "For Instructors"

| Item | URL | Audience | Status |
|------|-----|----------|--------|
| Instructor Resources | `/for-instructors` | Instructor | LIVE |

---

### Section 3: "Learn More"

| Item | URL | Audience | Status |
|------|-----|----------|--------|
| Blog | `/blog` | Multiple | LIVE |
| Help Centre | `/help` | Multiple | LIVE |

**Customer Job:** "I need to educate myself or get support"

---

## DIRECT LINK: ABOUT

### Top-Level Label: "About"
**Behavior:** Direct link (no dropdown)

| Item | URL | Audience | Role | Status |
|------|-----|----------|------|--------|
| About Us | `/about` | Multiple | Company | LIVE |

---

## RIGHT-SIDE UTILITY NAVIGATION

### Always Visible (Public)

| Item | URL | Style | Status |
|------|-----|-------|--------|
| Login | `/login` | Text link | LIVE |
| Get Started | Context-aware (see below) | Button (primary color) | LIVE |

---

### "Get Started" CTA - Context-Aware Guidance

**Problem:** DriveBook has two fundamentally different acquisition journeys (learner vs instructor/school)

**Solution:** Make CTA context-aware based on page type

#### Option A: Homepage - Choice Modal/Page

**"Get Started" opens choice:**

```
What are you looking for?

🚗 Find a Driving Instructor
   Find and book lessons near you
   → /book

👨‍🏫 Run Your Instructor Business
   Get started with DriveBook
   → /register/business-type or /teach-with-drivebook

🏫 Run a Driving School
   Manage your team with DriveBook
   → /register/business-type or /contact
```

#### Option B: Context-Aware Destination (Recommended)

| Page Context | CTA Label | Destination |
|--------------|-----------|-------------|
| Homepage | "Get Started" | Choice modal (above) |
| Learner pages (`/book`, `/learn-to-drive`) | "Find an Instructor" | `/book` |
| Instructor pages (`/platform`, `/teach-with-drivebook`) | "Get Started" or "Start Free" | `/register/business-type` |
| School pages (Multi-Instructor, Platform) | "Get Started" or "Contact Us" | `/contact` or `/register/business-type` |

**Recommended:** Use Option B (context-aware) for cleaner UX

---

## PAYMENT MODEL CLARIFICATION

### How Payments Actually Work:

```
STUDENT
   │
   │ pays (Stripe)
   ▼
INSTRUCTOR'S CONNECTED ACCOUNT
   │
   └── DriveBook platform fee: 3.6% (auto-deducted)
```

**Key Points:**
- Student pays **directly** to instructor's Stripe Connected Account
- DriveBook does **not** receive/hold the lesson money
- DriveBook platform fee (3.6%) is **automatically deducted** by Stripe
- For schools: payments can flow to business's connected account
- This is a **pass-through marketplace**, not a payment processor

**Navigation Impact:**
- Don't describe as "DriveBook collects payments and pays instructors"
- Use neutral language: "Payments & Payouts"
- This is a backend detail that doesn't complicate public navigation

---

## FEATURED ITEM VISUAL TREATMENT

### What Makes an Item "Featured"

**Criteria:**
1. Major differentiator vs. competitors
2. High customer interest/frequently asked about
3. Tier-locked capability with strong value prop
4. Strategic product emphasis

**Current Featured Items:**
- 🤖 **AI Receptionist** (Instructors + Schools) - PRO+ tier
- 🌐 **Custom Domain** (Instructors + Schools) - STUDIO+ tier
- 👥 **Multi-Instructor Management** (Schools only) - STUDIO+ tier

---

### Visual Treatment (Desktop)

**Standard item:**
```html
<a href="/features/online-booking">
  Online Booking
</a>
```

**Featured item:**
```html
<a href="/features/ai-receptionist" class="featured-nav-item">
  <span class="icon">🤖</span>
  <div>
    <div class="title">AI Receptionist</div>
    <div class="benefit">Answer calls 24/7, never miss a booking</div>
  </div>
</a>
```

**Styling suggestions:**
- Icon/emoji prefix (larger, colorful)
- Title in bold or slightly larger font
- Benefit text in muted color, smaller font (one line)
- Subtle background highlight or border (optional)
- Extra padding/spacing

**Mobile:** Same structure but more compact

---

## DESKTOP MEGA-MENU BEHAVIOR

### Interaction:
1. **Hover to open** - mega-menu appears on hover
2. **Click to navigate** - clicking top-level label either opens menu or does nothing
3. **Stay open on hover** - menu stays open while cursor in menu area
4. **Close on outside click** - menu closes when clicking elsewhere
5. **Keyboard accessible** - Tab/Enter/Escape work
6. **Smooth animation** - fade in/out with subtle scale

### Layout:

**Learner Menu (4 sections, 1 column):**
- Vertical stack
- Section headers
- Max-width: ~300px

**B2B Menu (3 columns side-by-side):**
- Multi-column grid
- Visual hierarchy with section headers
- Max-width: ~900px
- Equal column widths

**Resources Menu (Simple dropdown):**
- Single column
- Grouped by section headers
- Max-width: ~250px

---

## MOBILE NAVIGATION BEHAVIOR

### Structure:

```
☰ Menu

[When opened:]

Find an Instructor ▼
  [Expandable sections: 4 groups]

For Instructors & Schools ▼
  [Expandable sections: 3 columns → vertical]

Resources ▼
  [Simple list]

About

────────
Login
Get Started (button)
```

### Key Principles:
1. **Vertical accordion** - tap to expand sections
2. **Same structure** as desktop mega-menus (consistency)
3. **3-column B2B menu** becomes **3 vertical sections**
4. **Featured items** still get icon/emoji + benefit treatment
5. **Sticky header** with hamburger menu icon
6. **Overlay** - darkens background when menu open
7. **Close on selection** - menu closes when link clicked

---

## AUTHENTICATED VS PUBLIC NAVIGATION

### Critical Distinction:

**Public Navigation (this document):**
- Unauthenticated users
- Discovery, marketing, education
- Leads to sign-up or booking
- Component: `PublicNav.tsx`

**Authenticated Navigation (separate system):**
- Logged-in users
- In-app functionality
- Task-oriented
- Components: `AuthenticatedNav.tsx`, `DashboardNav.tsx`, `ClientNav.tsx`

---

### Implementation Separation:

**PublicNav.tsx** (this component):
```tsx
// Only handles public routes
// Shown when: user NOT logged in

<nav>
  <Link href="/book">Find an Instructor</Link>
  <MegaMenu label="For Instructors & Schools">...</MegaMenu>
  ...
</nav>
```

**AuthenticatedNav.tsx** (separate components per role):
```tsx
// Only handles app routes
// Shown when: user IS logged in
// Different per role (learner, instructor, admin)

// Learner example (ClientNav.tsx):
<nav>
  <Link href="/book">Find Instructor</Link>
  <Link href="/my-bookings">My Bookings</Link>
  <Link href="/client-dashboard">Dashboard</Link>
  ...
</nav>

// Instructor example (DashboardNav.tsx):
<nav>
  <Link href="/dashboard">Dashboard</Link>
  <Link href="/dashboard/bookings">Bookings</Link>
  <Link href="/dashboard/clients">Students</Link>
  ...
</nav>
```

**Why separate?**
1. Different user contexts
2. Different mental models
3. Different information needs
4. Prevents giant conditional component
5. Easier to maintain
6. Better performance (smaller bundles)

---

## ITEMS DELIBERATELY EXCLUDED FROM PUBLIC NAVIGATION

### Why Excluded: Authentication Required (App Features)

These appear in **authenticated navigation only** (separate component):

**Learner Dashboard:**
- `/my-bookings`
- `/manage-booking`
- `/client-dashboard`
- `/client-dashboard/progress`
- `/client-dashboard/wallet`

**Instructor Dashboard:**
- `/dashboard` (instructor view)
- `/dashboard/bookings`
- `/dashboard/clients`
- `/dashboard/earnings`
- `/dashboard/analytics`
- `/dashboard/availability`
- `/dashboard/documents`
- `/dashboard/branding`
- All other `/dashboard/*` pages

**Reason:** These are in-app features, not discovery/marketing pages

---

### Why Excluded: Admin/Internal Operations

- All `/admin/*` pages
- Staff tools
- Internal operations

**Reason:** Not customer-facing

---

### Why Excluded: Workflow Pages

- `/booking` (may be duplicate of `/book`)
- `/cancel-booking`
- `/payment`
- `/onboarding`
- `/business-setup`

**Reason:** These are steps in workflows, not destinations

---

### Why Excluded: Legal/Footer Pages

- `/terms`
- `/privacy`
- `/instructor-terms`

**Reason:** Belong in footer, not primary navigation

---

### Why Excluded: Comparison/Marketing Pages

- `/compare`
- `/compare/google-calendar`
- `/compare/calendly`
- `/compare/paper-diary`

**Reason:** Sales content, not primary navigation. Link from marketing pages or feature pages

---

### Why Excluded: SEO Infrastructure

- `/driving-lessons/[state]/[suburb]` (auto-generated location pages)
- `/sitemap.xml`
- `/robots.txt`
- `/rss.xml`

**Reason:** Organic discovery, not navigation

---

## URL AUDIT STATUS

### ✅ VERIFIED LIVE URLs:
- `/` (homepage)
- `/book` (search/booking)
- `/driving-lessons` (location directory)
- `/platform` (platform overview)
- `/teach-with-drivebook` (instructor recruitment)
- `/for-instructors` (instructor resources)
- `/learn-to-drive` (learner guide)
- `/pda-guide` (PDA test guide)
- `/blog` (blog)
- `/help` (help centre)
- `/about` (about page)
- `/contact` (contact page)
- `/login` (login)
- `/register` (registration)
- `/features/ai-receptionist` (AI receptionist page)
- `/features/online-booking` (online booking page)
- `/features/custom-domain` (custom domain page)
- `/features/multi-instructor` (multi-instructor page)
- `/features/payments` (payments page)
- `/features/student-progress` (student progress page)

### ⚠️ TBD / NEEDS VERIFICATION:
- `/pricing` (pricing page) - needs creation or is at `/teach-with-drivebook`?
- `/features/calendar` (calendar feature) - may not exist
- `/features/analytics` (analytics feature) - may not exist
- `/features/student-management` (CRM feature) - may not exist
- `/features/marketing` (marketing tools) - may not exist

**Decision needed:** Create these pages or remove from navigation?

### ❌ SHOULD NOT BE IN PUBLIC NAV:
- `/dashboard/*` (authenticated only)
- `/my-bookings` (authenticated only)
- `/client-dashboard/*` (authenticated only)
- `/admin/*` (internal only)

---

## IMPLEMENTATION CHECKLIST

Before building PublicNav.tsx:

### Content
- [ ] All nav labels approved
- [ ] URLs verified or marked TBD
- [ ] Featured items confirmed (AI Receptionist, Custom Domain, Multi-Instructor)
- [ ] Benefit statements approved
- [ ] TBD pages: create or remove decision made
- [ ] No authenticated routes in public nav

### Structure
- [ ] 2 mega-menus (Learners, Instructors & Schools)
- [ ] 1 standard dropdown (Resources)
- [ ] 1 direct link (About)
- [ ] 2 utility links (Login, Get Started)
- [ ] B2B mega-menu has 3-column layout
- [ ] Featured items visually distinct

### Behavior
- [ ] Desktop: hover to open mega-menus
- [ ] Mobile: tap to expand accordion
- [ ] Keyboard accessible
- [ ] Screen reader friendly
- [ ] Close on outside click
- [ ] Close on link selection (mobile)
- [ ] Context-aware "Get Started" CTA

### Visual
- [ ] Featured items have icon + benefit
- [ ] Clear visual hierarchy
- [ ] Consistent spacing
- [ ] Readable font sizes
- [ ] Touch targets ≥44px (mobile)

---

## TESTING CHECKLIST

After implementation:

### Functional
- [ ] All links navigate correctly
- [ ] Hover/tap interactions work
- [ ] Mega-menus open/close properly
- [ ] Mobile menu opens/closes
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Context-aware CTA works on different pages

### Visual
- [ ] Featured items stand out
- [ ] Typography is consistent
- [ ] Colors match brand
- [ ] Spacing is consistent
- [ ] No layout shifts on open/close
- [ ] Smooth animations

### Responsive
- [ ] Desktop (≥1024px) shows mega-menus
- [ ] Tablet (768-1023px) shows simplified mega-menus or mobile
- [ ] Mobile (<768px) shows hamburger menu
- [ ] Touch targets are large enough
- [ ] No horizontal scroll

### Accessibility
- [ ] Screen reader announces nav items
- [ ] ARIA labels present where needed
- [ ] Focus visible on keyboard navigation
- [ ] Proper heading hierarchy
- [ ] Contrast ratios meet WCAG AA

### Performance
- [ ] No layout shift on page load
- [ ] Mega-menus open smoothly
- [ ] No janky animations
- [ ] Mobile menu doesn't block scroll

---

## NEXT STEPS

1. **Business owner approval**
   - Approve navigation structure
   - Approve featured items and benefit statements
   - Decide on TBD URLs (create pages or remove)
   - Approve context-aware CTA strategy

2. **Create navigation data file**
   - `lib/navigation-data.ts` or `lib/navigation-data.js`
   - Single source of truth for all nav items
   - Type-safe (if using TypeScript)

3. **Build PublicNav.tsx component**
   - Data-driven structure
   - Mega-menu components
   - Featured item component
   - Mobile accordion
   - Responsive behavior

4. **Create feature pages for TBD items** (if approved)
   - `/pricing`
   - `/features/calendar`
   - `/features/analytics`
   - `/features/student-management`
   - `/features/marketing`

5. **Test thoroughly**
   - All devices
   - All browsers
   - Keyboard navigation
   - Screen readers
   - Performance

6. **Deploy to production**

---

## REVISION HISTORY

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Jan 2025 | Initial navigation architecture (3 mega-menus) | - |
| 2.0 | Jan 2025 | Combined Instructors + Schools, simplified structure | - |

---

## SUMMARY

**Public Navigation:**
1. **Find an Instructor** (4 sections: Find, Book, Prepare, Learn)
2. **For Instructors & Schools** (3 columns: Run, Grow, Schools)
3. **Resources** (simple dropdown)
4. **About** (direct link)
5. **Login** + **Get Started** (utility)

**Key Decisions:**
- Combined B2B navigation (less scattered)
- 3-column B2B mega-menu (natural segmentation)
- Featured treatment for AI Receptionist, Custom Domain, Multi-Instructor
- Removed authenticated routes from public nav
- Context-aware "Get Started" CTA
- Data-driven implementation

**Ready for implementation once URLs are verified and business owner approves.**
