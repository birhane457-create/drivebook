# Branding & Business Setup Navigation

## Overview
The platform has **two separate pages** for business configuration and branding. They serve different purposes and are now cross-linked for easy navigation.

---

## Two Pages Explained

### 1. `/business-setup` - Business Configuration Wizard
**Purpose:** Comprehensive business setup (first-time onboarding)

**Features:**
- ✅ Setup progress tracker (completion %)
- ✅ 7 configuration sections:
  - Identity (name, ABN, contact)
  - Branding (logo, colors, slug)
  - Terminology (rename labels)
  - Services (pricing, duration)
  - Capabilities (feature toggles)
  - AI Receptionist config
  - Domain setup
- ✅ Guided wizard experience
- ✅ Overview of current configuration

**Best for:**
- New Premium tier users
- First-time business configuration
- Holistic setup view

---

### 2. `/dashboard/branding` - Brand & Public Page Manager
**Purpose:** Direct access to branding with live preview

**Features:**
- ✅ Logo upload with preview
- ✅ Brand colors (primary/secondary)
- ✅ Booking URL slug management
- ✅ Custom domain (Studio tier)
- ✅ Social links (WhatsApp, Instagram, Facebook)
- ✅ Business/brand name
- ✅ Live booking page preview
- ✅ Years of experience
- ✅ Display toggle for branding

**Best for:**
- Active providers tweaking branding
- Quick access to URL management
- Marketing-focused changes

---

## Cross-Link Implementation ✅

### From Dashboard Branding → Business Setup
**Location:** Top of `/dashboard/branding` page

```
┌──────────────────────────────────────────────────┐
│ ℹ️  Need to configure other business settings?   │
│                                                   │
│ Visit Business Setup to configure services,      │
│ AI receptionist, terminology, and more.          │
└──────────────────────────────────────────────────┘
```

**Visual:** Blue info banner with link

### From Business Setup → Dashboard Branding
**Location:** Top of `/business-setup` page

```
┌──────────────────────────────────────────────────┐
│ 🎨  Need quick access to branding with preview?  │
│                                                   │
│ Go to Dashboard Branding for full branding       │
│ control, live booking page preview, and URLs.    │
└──────────────────────────────────────────────────┘
```

**Visual:** Purple info banner with link

---

## Navigation Labels Updated ✅

### Before
```
Account
  ├─ Business Setup
  ├─ Branding          ← unclear distinction
  ├─ Subscription
  └─ ...
```

### After
```
Account
  ├─ Business Setup    ← wizard/comprehensive setup
  ├─ Branding & URLs   ← quick access with preview
  ├─ Subscription
  └─ ...
```

---

## User Journey Examples

### Journey 1: First-Time Premium User
1. Upgrades to Premium tier
2. Sees "Business Setup" in navigation
3. Goes to `/business-setup` (wizard)
4. Completes all 7 sections
5. **Sees cross-link** to Dashboard Branding for live preview
6. Goes to `/dashboard/branding` to verify booking page

### Journey 2: Active Provider Updating Logo
1. Wants to change logo quickly
2. Clicks "Branding & URLs" in navigation
3. Goes to `/dashboard/branding` (direct access)
4. Uploads new logo
5. Sees live preview immediately
6. **Sees cross-link** if needs to configure services

### Journey 3: Setting Up Custom Domain
1. Studio tier user
2. Can use either page:
   - `/business-setup` → Domain section
   - `/dashboard/branding` → Custom Domain Wizard
3. Both link to each other for convenience

---

## Benefits of This Approach

### ✅ Clear Separation of Concerns
- Business Setup = **Configuration wizard**
- Dashboard Branding = **Marketing control center**

### ✅ Multiple Entry Points
- New users → guided wizard
- Power users → direct access

### ✅ No Confusion
- Cross-links explain what each page offers
- Updated navigation labels clarify purpose

### ✅ Flexibility
- Users choose their preferred workflow
- Both pages stay accessible

---

## Technical Implementation

### Files Changed
1. ✅ `app/dashboard/branding/page.tsx` - Added blue info banner with link to Business Setup
2. ✅ `app/business-setup/page.tsx` - Added purple info banner with link to Dashboard Branding
3. ✅ `components/DashboardNav.tsx` - Updated label: "Branding" → "Branding & URLs"

### Colors Used
- **Business Setup cross-link:** Blue (`bg-blue-900/20`, `border-blue-700/50`, `text-blue-300/400`)
- **Branding cross-link:** Purple (`bg-purple-900/20`, `border-purple-700/50`, `text-purple-300/400`)

### Icons Used
- **Business Setup banner:** `AlertCircle` (info icon)
- **Branding banner:** `Palette` (branding icon)

---

## Testing

### Test 1: Branding Page Cross-Link
1. Login as provider
2. Navigate to `/dashboard/branding`
3. **Verify:** Blue banner appears at top with link to Business Setup
4. Click link → should navigate to `/business-setup`

### Test 2: Business Setup Cross-Link
1. Login as provider
2. Navigate to `/business-setup`
3. **Verify:** Purple banner appears after header with link to Dashboard Branding
4. Click link → should navigate to `/dashboard/branding`

### Test 3: Navigation Labels
1. Open dashboard sidebar
2. Expand "Account" section
3. **Verify:** Shows "Branding & URLs" (not just "Branding")

---

## Design Rationale

### Why Two Pages?
- **Different user intents:** Setup wizard vs quick edit
- **Different information density:** Comprehensive vs focused
- **Different workflows:** First-time onboarding vs regular updates

### Why Cross-Links?
- **Prevents confusion:** Users know both pages exist
- **Explains differences:** Banners clarify what each page offers
- **Reduces support:** Self-service navigation

### Why Update Navigation Label?
- **Clarifies purpose:** "Branding & URLs" is more descriptive
- **Reduces ambiguity:** Clear distinction from Business Setup
- **Better UX:** Users know what they'll find

---

## Future Enhancements (Optional)

### Option 1: Dynamic Cross-Link
Only show cross-link if user hasn't completed certain setup:
```tsx
{setupProgress < 100 && (
  <CrossLinkBanner ... />
)}
```

### Option 2: First-Visit Detection
Show different message for first-time visitors:
```tsx
{isFirstVisit && (
  <WelcomeBanner>New to branding? Start with Business Setup</WelcomeBanner>
)}
```

### Option 3: Contextual Tips
Show tips based on missing configuration:
```tsx
{!hasLogo && <Tip>Upload a logo in Dashboard Branding</Tip>}
```

---

## Summary

✅ **Cross-links added** between Business Setup and Dashboard Branding  
✅ **Navigation label updated** for clarity  
✅ **User confusion eliminated** with clear signposting  
✅ **Both workflows supported** - wizard and direct access  

**Result:** Users can now easily navigate between comprehensive business setup and quick branding updates.
