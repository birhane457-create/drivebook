# DriveBook Design System

**Status:** ✅ Current  
**Last Updated:** 2026-09-01

---

> Single source of truth for theming, layout, components, and UI conventions.  
> Last updated: August 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Theme System](#2-theme-system)
3. [CSS Design Tokens](#3-css-design-tokens)
4. [Tailwind Token Mapping](#4-tailwind-token-mapping)
5. [Layout Components](#5-layout-components)
6. [UI Primitives](#6-ui-primitives)
7. [Chart Components](#7-chart-components)
8. [CSS Utility Classes](#8-css-utility-classes)
9. [Page Shell Reference](#9-page-shell-reference)
10. [Content Rules â€” Text Respects BG](#10-content-rules--text-respects-bg)
11. [File Conventions](#11-file-conventions)
12. [Do / Don't](#12-do--dont)

---

## 1. Architecture Overview

DriveBook uses a **dual-theme, CSS-variable token system** built on Tailwind CSS 3.4.

```
globals.css          â†’ CSS custom property definitions (:root/.dark/.light)
tailwind.config.ts   â†’ maps CSS vars to Tailwind utility names
components/ui/       â†’ shadcn-style primitives that consume token classes
app/**/layout.tsx    â†’ each layout declares its theme via className="dark|light"
```

**Key principle:** No component hardcodes a colour. Every bg, text, and border uses a token class (`bg-card`, `text-foreground`, `border-border`). When the parent layout switches theme, all children adapt automatically.

---

## 2. Theme System

### Two themes, one token set

| Theme class | Where applied | Background | Text |
|---|---|---|---|
| `dark` *(default / `:root`)* | Dashboard, Admin, Business Setup | Deep navy `#020617` | Near-white `#f0f2f6` |
| `light` | Public pages, Student portal, Booking flow | Near-white `#f4f6fa` | Near-black `#111827` |

### How themes are activated

Each layout wrapper declares its theme once. All descendants inherit it automatically.

```tsx
// Instructor dashboard â€” dark navy
<div className="dark min-h-screen bg-background text-foreground">

// Student booking flow â€” light white
<div className="light min-h-screen bg-background text-foreground">

// Public marketing pages â€” via PublicLayout component
<PublicLayout>   {/* applies class="light" internally */}
```

### Theme routing map

```
/admin/**              â†’ class="dark"   admin layout
/dashboard/**          â†’ class="dark"   instructor dashboard layout
/business-setup/**     â†’ class="dark"   business setup layout
/client-dashboard/**   â†’ class="light"  student dashboard layout
/book/**               â†’ class="light"  booking flow layout
/teach-with-drivebook  â†’ class="light"  via PublicLayout
/driving-lessons       â†’ class="light"  via PublicLayout
/features/**           â†’ class="light"  via PublicLayout
/login, /register      â†’ class="light"  via PublicLayout (hideFooter)
```

### Adding a new route

1. Decide: is this audience staff/instructor (dark) or consumer/student (light)?
2. Wrap in the appropriate layout or use `PublicLayout` for marketing pages.
3. Use only token classes inside â€” never hardcode a colour.

---

## 3. CSS Design Tokens

Defined in `app/globals.css`. All values are HSL without the `hsl()` wrapper so they compose with Tailwind's opacity modifier (`bg-primary/20`).

### Dark theme (`:root` + `.dark`)

```css
/* Backgrounds */
--background:      222 47%  5%    /* #020617 â€” deep navy page */
--card:            222 40%  9%    /* #0f172a â€” dark card surface */
--card-elevated:   222 36% 12%    /* slightly lighter variant */

/* Text */
--foreground:      210 20% 97%    /* #f0f2f6 â€” near-white */
--muted-foreground:220 12% 72%    /* #a9b4c9 â€” readable mid-grey */

/* Borders */
--border:          222 28% 16%    /* subtle dark divider */
--input:           222 28% 20%    /* slightly brighter for form fields */

/* Brand */
--primary:         225 73% 57%    /* #3b82f6 â€” blue-500 */
--secondary:       222 36% 15%    /* dark muted surface */
--accent:          262 83% 58%    /* #8b5cf6 â€” violet-500 */

/* Status */
--destructive:     0   72% 51%    /* red */
--success:         162 63% 41%    /* emerald */
--warning:         38  92% 50%    /* amber */
```

### Light theme (`.light`)

```css
/* Backgrounds */
--background:      214 32% 97%    /* #f4f6fa â€” near-white page */
--card:            0    0% 100%   /* #ffffff â€” pure white card */

/* Text */
--foreground:      222 47% 11%    /* #111827 â€” near-black */
--muted-foreground:220  9% 40%    /* #5a6375 â€” dark grey */

/* Borders */
--border:          220 13% 88%    /* very soft â€” barely visible on white */
--input:           220 13% 82%    /* slightly stronger for form fields */

/* Brand â€” same as dark */
--primary:         225 73% 57%
--secondary:       214 32% 93%    /* soft blue-grey chip bg */
--accent:          262 83% 58%
```

### Shared tokens (identical in both themes)

| Token | Value | Use |
|---|---|---|
| `--primary` | blue-500 | Buttons, links, active states |
| `--accent` | violet-500 | Admin accent, badges |
| `--destructive` | red | Errors, delete actions |
| `--success` | emerald | Confirmed states |
| `--warning` | amber | Alerts, pending states |
| `--radius` | `0.75rem` | Base border radius |

---

## 4. Tailwind Token Mapping

`tailwind.config.ts` maps every CSS var to a Tailwind utility name.

```ts
darkMode: 'class',   // required â€” enables .dark/.light class switching

colors: {
  background:  'hsl(var(--background))',
  foreground:  'hsl(var(--foreground))',
  card:        { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
  border:      'hsl(var(--border))',
  primary:     { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
  secondary:   { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
  muted:       { DEFAULT: 'hsl(var(--muted))',     foreground: 'hsl(var(--muted-foreground))' },
  accent:      { DEFAULT: 'hsl(var(--accent))',    foreground: 'hsl(var(--accent-foreground))' },
  destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: '...' },
}
```

### Quick reference â€” which class to use

| Need | Class to use | Never use |
|---|---|---|
| Page background | `bg-background` | `bg-slate-950`, `bg-white` |
| Card surface | `bg-card` | `bg-slate-900`, `bg-white` |
| Hover/chip surface | `bg-secondary` | `bg-slate-800`, `bg-gray-100` |
| Primary text | `text-foreground` | `text-white`, `text-gray-900` |
| Secondary text | `text-muted-foreground` | `text-slate-400`, `text-gray-500` |
| Divider | `border-border` | `border-slate-700`, `border-gray-200` |
| Input bg | `bg-card` or default | `bg-slate-900`, `bg-white` |
| Brand blue | `text-primary`, `bg-primary` | `text-blue-400`, `bg-blue-600` |
| Danger | `text-destructive`, `bg-destructive` | `text-red-400`, `bg-red-600` |

---

## 5. Layout Components

### `DashboardPageLayout`

Standard instructor-portal page shell. Import from `@/components/ui`.

```tsx
import { DashboardPageLayout } from '@/components/ui'

<DashboardPageLayout
  title="Bookings"
  description="Manage all your upcoming and past lessons"
  breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Bookings' }]}
  status={{ label: 'Live', variant: 'success' }}
  primaryAction={{ label: 'New Booking', icon: <Plus />, href: '/dashboard/bookings/new' }}
  secondaryActions={[{ label: 'Export', icon: <Download />, onClick: handleExport }]}
  kpis={[
    { label: 'This Week',   value: 12, trend: '+3 vs last week', trendUp: true,  icon: <Calendar /> },
    { label: 'This Month',  value: 48, sub: '4 cancelled',                       icon: <BarChart /> },
    { label: 'Revenue MTD', value: '$2,400', color: 'text-emerald-400',          icon: <DollarSign /> },
    { label: 'Completion',  value: '94%',    trend: '+2%', trendUp: true },
  ]}
  tabs={[
    { id: 'upcoming', label: 'Upcoming', badge: 12 },
    { id: 'past',     label: 'Past' },
    { id: 'cancelled',label: 'Cancelled', badge: 2, badgeVariant: 'warning' },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  showHeroBanner
>
  {/* tab content */}
</DashboardPageLayout>
```

**Props:**

| Prop | Type | Description |
|---|---|---|
| `title` | `string` | Page heading |
| `description` | `string?` | Subtitle below heading |
| `breadcrumbs` | `BreadcrumbItem[]?` | Nav trail above title |
| `status` | `StatusBadge?` | Badge next to title |
| `primaryAction` | `PageAction?` | Blue gradient CTA button |
| `secondaryActions` | `PageAction[]?` | Outline buttons |
| `kpis` | `KPI[]?` | Stat cards row |
| `kpiColumns` | `2\|3\|4\|5?` | Override auto column count |
| `tabs` | `TabItem[]?` | Tab strip with optional badge counts |
| `activeTab` | `string?` | Controlled active tab id |
| `onTabChange` | `(id) => void?` | Tab change callback |
| `showHeroBanner` | `boolean?` | Radial gradient behind header |
| `isLoading` | `boolean?` | Shows skeletons in KPI cards |
| `error` | `string\|null?` | Red error banner |

---

### `AdminPageLayout`

Admin portal page shell. Same API as `DashboardPageLayout` plus:

```tsx
import { AdminPageLayout } from '@/components/ui'

<AdminPageLayout
  title="Payouts"
  description="Process instructor earnings"
  backHref="/admin"
  breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Payouts' }]}
  status={{ label: '3 pending', variant: 'warning' }}
  primaryAction={{ label: 'Process All', icon: <Send />, onClick: handleProcess }}
  onRefresh={loadData}
  lastUpdated="2 min ago"
  alertBanner={<Alert variant="warning">...</Alert>}
  kpis={[...]}
  tabs={[
    { id: 'eligible', label: 'Eligible',  badge: 12 },
    { id: 'withheld', label: 'Withheld',  badge: 3, badgeVariant: 'warning' },
    { id: 'disputes', label: 'Disputes',  badge: 1, badgeVariant: 'destructive' },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
>
  {/* tab content */}
</AdminPageLayout>
```

**Additional props (vs DashboardPageLayout):**

| Prop | Type | Description |
|---|---|---|
| `backHref` | `string?` | Animated back arrow link |
| `onRefresh` | `() => void\|Promise?` | Refresh button with spin state |
| `lastUpdated` | `string?` | "Updated X ago" label |
| `alertBanner` | `ReactNode?` | Attention callout above KPIs |

---

### `PublicLayout`

Wraps all public/marketing pages. Applies `class="light"`, consistent nav, and footer.

```tsx
import PublicLayout from '@/components/PublicLayout'

// Default nav (find instructors + for instructors + pricing)
<PublicLayout>
  <YourPageContent />
</PublicLayout>

// Instructor-focused nav (features + pricing + Start Free Trial CTA)
<PublicLayout navVariant="instructor">
  ...
</PublicLayout>

// Student-focused nav (find instructors + PDA guide)
<PublicLayout navVariant="student">
  ...
</PublicLayout>

// Auth pages â€” no footer
<PublicLayout hideFooter>
  <LoginForm />
</PublicLayout>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `navVariant` | `default\|instructor\|student` | `default` | Which nav links to show |
| `hideFooter` | `boolean` | `false` | Hides footer (auth pages) |
| `className` | `string?` | â€” | Extra classes on root div |

---

## 6. UI Primitives

All from `@/components/ui`. Built on Radix UI + CVA, dark-first tokens.

### Button

```tsx
import { Button } from '@/components/ui'

<Button variant="default">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="outline">Export</Button>
<Button variant="ghost">View</Button>
<Button variant="destructive">Delete</Button>
<Button variant="gradient">Get Started</Button>   {/* blueâ†’indigo gradient */}
<Button variant="violet">Admin Action</Button>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui'

<Card>
  <CardHeader>
    <CardTitle>Weekly Revenue</CardTitle>
    <CardDescription>Last 7 days vs previous week</CardDescription>
  </CardHeader>
  <CardContent>
    <BarChart ... />
  </CardContent>
  <CardFooter>
    <p className="text-xs text-muted-foreground">Updated 2 min ago</p>
  </CardFooter>
</Card>
```

### Badge

```tsx
import { Badge } from '@/components/ui'

<Badge variant="default">Active</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="outline">Manual</Badge>
<Badge variant="destructive">Overdue</Badge>
<Badge variant="success">Confirmed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="info">Processing</Badge>
<Badge variant="violet">Admin</Badge>
<Badge variant="sky">Student</Badge>
```

### Alert

```tsx
import { Alert, AlertDescription } from '@/components/ui'

<Alert variant="default">...</Alert>
<Alert variant="destructive"><AlertTriangle /><AlertDescription>...</AlertDescription></Alert>
<Alert variant="warning">...</Alert>
<Alert variant="success">...</Alert>
<Alert variant="info">...</Alert>
```

### Tabs (Radix)

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="details">...</TabsContent>
</Tabs>
```

### Dialog (Radix)

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui'

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>This cannot be undone.</DialogDescription>
    </DialogHeader>
    {/* content */}
  </DialogContent>
</Dialog>
```

### Input

```tsx
import { Input } from '@/components/ui'

<Input type="text" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
```

### Skeleton

```tsx
import { Skeleton } from '@/components/ui'

<Skeleton className="h-7 w-32" />     // value placeholder
<Skeleton className="h-4 w-48 mt-1" /> // label placeholder
```

### Separator

```tsx
import { Separator } from '@/components/ui'

<Separator />                    // horizontal
<Separator orientation="vertical" className="h-6" />
```

### Avatar

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui'

<Avatar>
  <AvatarImage src={user.image} alt={user.name} />
  <AvatarFallback>{user.name[0]}</AvatarFallback>
</Avatar>
```

---

## 7. Chart Components

Thin recharts wrappers. All dark-themed by default. Import from `@/components/ui`.

```tsx
import { AreaChart, BarChart, LineChart, DonutChart, Sparkline } from '@/components/ui'
```

### AreaChart

```tsx
<AreaChart
  data={weeklyData}          // Record<string, any>[]
  xKey="week"
  series={[
    { key: 'revenue',  label: 'Revenue',  color: '#3b82f6' },
    { key: 'expenses', label: 'Expenses', color: '#8b5cf6' },
  ]}
  height={260}
  format={(v) => `$${v}`}
/>
```

### BarChart

```tsx
<BarChart
  data={dailyData}
  xKey="day"
  series={[{ key: 'bookings', label: 'Bookings', color: 'hsl(var(--primary))' }]}
  height={200}
  stacked={false}
/>
```

### LineChart

```tsx
<LineChart
  data={trendData}
  xKey="date"
  series={[
    { key: 'completed', label: 'Completed', color: '#10b981' },
    { key: 'cancelled', label: 'Cancelled', color: '#ef4444' },
  ]}
  height={220}
/>
```

### DonutChart

```tsx
<DonutChart
  data={[
    { name: 'Stripe',  value: 68, color: '#3b82f6' },
    { name: 'Wallet',  value: 22, color: '#10b981' },
    { name: 'Offline', value: 10, color: '#f59e0b' },
  ]}
  height={200}
  innerRadius={55}
  outerRadius={85}
/>
```

### Sparkline

```tsx
<Sparkline
  data={[{ value: 4 }, { value: 7 }, { value: 5 }, { value: 9 }, { value: 12 }]}
  color="#3b82f6"
  height={48}
/>
```

### Brand colour palette

```ts
import { CHART_COLORS } from '@/components/ui'

CHART_COLORS.blue    // '#3b82f6'
CHART_COLORS.violet  // '#8b5cf6'
CHART_COLORS.emerald // '#10b981'
CHART_COLORS.amber   // '#f59e0b'
CHART_COLORS.red     // '#ef4444'
CHART_COLORS.sky     // '#0ea5e9'
CHART_COLORS.indigo  // '#6366f1'
CHART_COLORS.slate   // '#64748b'
```

---

## 8. CSS Utility Classes

Applied directly in `className`. Defined in `app/globals.css`.

### Section wrappers â€” lock a block to a specific bg+text

| Class | Background | Text | Use for |
|---|---|---|---|
| `section-hero` | Dark navy gradient | White | Generic dark hero sections |
| `section-hero-emerald` | Dark emerald gradient | White | Instructor marketing hero |
| `section-brand` | Blueâ†’violet gradient | White | CTA strips, pricing callouts |

> These classes **always** produce their own bg+text regardless of the parent `.dark` or `.light` class. They are self-contained.

```tsx
<header className="section-hero-emerald py-16 px-4">
  <h1>Always white text on dark emerald â€” regardless of page theme</h1>
  <p>Always readable body text</p>
</header>

<section className="section-brand py-14 text-center">
  <h2>Blue gradient CTA â€” white text always</h2>
  <Button>Get Started</Button>
</section>
```

### Card utilities â€” adapt to parent theme

| Class | Light theme | Dark theme | Use for |
|---|---|---|---|
| `card-feature` | White card, soft border | Dark card, dark border | Feature grid items, state cards |
| `card-faq` | Light grey bg | Dark muted bg | FAQ / accordion items |
| `card-tint-emerald` | 8% emerald tint | 8% emerald tint | Instructor highlight cards |
| `card-tint-blue` | 8% blue tint | 8% blue tint | Platform feature callouts |
| `card-tint-violet` | 8% violet tint | 8% violet tint | Admin/advanced features |
| `card-tint-amber` | 8% amber tint | 8% amber tint | Warning/scenario boxes |

```tsx
<div className="card-feature p-6 rounded-xl hover:scale-[1.01] transition-all">
  <h3 className="text-foreground">Reads well on both white and navy</h3>
  <p className="text-muted-foreground">Body text adapts automatically</p>
</div>

<div className="card-tint-emerald p-6 rounded-xl">
  <h3 className="text-foreground">Founder story or testimonial</h3>
</div>
```

### Navigation â€” theme-aware

```tsx
<a href="/features" className="nav-link">Features</a>
<a href="/pricing" className="nav-link active">Pricing</a>  {/* blue active state */}
```

### Step circles â€” how-it-works sections

```tsx
<div className="step-circle">1</div>  {/* blueâ†’violet gradient, white text, glow shadow */}
```

### Other utilities

| Class | Purpose |
|---|---|
| `scrollbar-hide` | Hide scrollbar (tab strips, overflow carousels) |
| `animate-fade-in` | Page entry animation (translateY 6px â†’ 0, opacity 0 â†’ 1) |
| `text-gradient-blue` | Clip text to blueâ†’indigo gradient |
| `text-gradient-violet` | Clip text to violetâ†’purple gradient |
| `font-heading` | Plus Jakarta Sans (display headings) |
| `glow-blue` | `box-shadow` blue glow |
| `glow-violet` | `box-shadow` violet glow |
| `glow-emerald` | `box-shadow` emerald glow |

---

## 9. Page Shell Reference

### Instructor dashboard page

```tsx
// app/dashboard/my-page/page.tsx
'use client'
import { DashboardPageLayout } from '@/components/ui'

export default function MyPage() {
  return (
    <DashboardPageLayout
      title="My Page"
      description="Short description"
      kpis={[...]}
    >
      <Card>...</Card>
    </DashboardPageLayout>
  )
}
```

### Admin page

```tsx
// app/admin/my-admin/page.tsx
'use client'
import { AdminPageLayout } from '@/components/ui'

export default function MyAdminPage() {
  return (
    <AdminPageLayout
      title="My Admin Page"
      backHref="/admin"
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'My Admin Page' }]}
      onRefresh={loadData}
      kpis={[...]}
    >
      <Card>...</Card>
    </AdminPageLayout>
  )
}
```

### Public marketing page

```tsx
// app/my-feature/page.tsx
import PublicLayout from '@/components/PublicLayout'

export default function MyFeaturePage() {
  return (
    <PublicLayout>
      <header className="section-hero py-16 px-4 text-center">
        <h1>Hero â€” always dark</h1>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="card-feature p-6 rounded-xl">
            <h3 className="text-foreground">Feature</h3>
            <p className="text-muted-foreground">Description</p>
          </div>
        </div>
      </div>

      <section className="section-brand py-14 text-center">
        <h2>CTA</h2>
      </section>
    </PublicLayout>
  )
}
```

---

## 10. Content Rules â€” Text Respects BG

These rules must be followed everywhere. A text colour that doesn't adapt to its background is a bug.

### Rule 1 â€” Never hardcode a colour that touches user-visible text

```tsx
// âŒ Wrong â€” breaks on light bg
<p className="text-slate-400">Description</p>
<h2 className="text-white">Title</h2>

// âœ… Correct â€” adapts to theme
<p className="text-muted-foreground">Description</p>
<h2 className="text-foreground">Title</h2>
```

### Rule 2 â€” Never hardcode a background colour on a visible surface

```tsx
// âŒ Wrong â€” hard-coded colour, doesn't adapt
<div className="bg-slate-900 rounded-xl p-4">
<div className="bg-white rounded-xl p-4">

// âœ… Correct
<div className="bg-card rounded-xl p-4">
<Card className="p-4">
```

### Rule 3 â€” Dark gradient sections stay dark always

When a section intentionally has a dark gradient background (hero, CTA), use `section-hero`, `section-hero-emerald`, or `section-brand`. Never rely on the parent theme for these sections.

```tsx
// âŒ Wrong â€” this will be near-white on .light pages
<header className="bg-emerald-950 text-white">

// âœ… Correct â€” always dark regardless of parent
<header className="section-hero-emerald">
```

### Rule 4 â€” Tinted cards use card-tint-* classes

Tinted highlight cards (founder story, feature callouts, warning boxes) use the `card-tint-*` CSS utility classes. These use opacity-based backgrounds and token-based text so they work on both white and navy parents.

```tsx
// âŒ Wrong â€” 10% opacity on white is invisible
<div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
  <h3 className="text-slate-100">Title</h3>    {/* white text on near-white bg */}

// âœ… Correct
<div className="card-tint-emerald rounded-xl">
  <h3 className="text-foreground">Title</h3>   {/* adapts to theme */}
```

### Rule 5 â€” Status colours are acceptable inline

Semantic status colours (emerald for success, amber for warning, destructive for errors) can be used inline and do not need to flip between themes. They remain identifiable on both dark and light backgrounds.

```tsx
// âœ… These are fine â€” status colours have sufficient contrast on both themes
<span className="text-emerald-400">Confirmed</span>
<span className="text-amber-400">Pending</span>
<span className="text-destructive">Failed</span>
```

### Contrast targets (WCAG AA)

| Combination | Ratio | Passes |
|---|---|---|
| `text-foreground` on `bg-background` (dark) | 17:1 | âœ… AAA |
| `text-foreground` on `bg-background` (light) | 16:1 | âœ… AAA |
| `text-muted-foreground` on `bg-card` (dark) | 7.5:1 | âœ… AA |
| `text-muted-foreground` on `bg-card` (light) | 6.2:1 | âœ… AA |
| `text-primary` on `bg-background` (dark) | 4.8:1 | âœ… AA |
| `text-primary` on `bg-background` (light) | 4.5:1 | âœ… AA |

---

## 11. File Conventions

```
components/
  ui/
    button.tsx          Radix + CVA button
    card.tsx            Card, CardHeader, CardContent, CardFooter, CardTitle
    badge.tsx           CVA badge variants
    input.tsx           Dark-first input
    tabs.tsx            Radix tabs
    dialog.tsx          Radix dialog
    alert.tsx           CVA alert variants
    avatar.tsx          Radix avatar
    separator.tsx       Radix separator
    skeleton.tsx        Pulse skeleton
    chart.tsx           AreaChart, BarChart, LineChart, DonutChart, Sparkline
    page-layout.tsx     DashboardPageLayout (instructor portal)
    admin-page-layout.tsx AdminPageLayout (admin portal)
    index.ts            Barrel export â€” import everything from here

  PublicLayout.tsx      Public page wrapper â€” applies .light, nav, footer

lib/
  cn.ts                 cn() = clsx + tailwind-merge

app/
  globals.css           :root/.dark/.light tokens + utility classes
tailwind.config.ts      darkMode: 'class', token colour mapping
```

### Import pattern

```tsx
// UI primitives â€” always from barrel
import { Card, CardContent, Badge, Button, Skeleton, BarChart } from '@/components/ui'
import { DashboardPageLayout, AdminPageLayout } from '@/components/ui'

// Public layout â€” direct import
import PublicLayout from '@/components/PublicLayout'

// cn utility
import { cn } from '@/lib/cn'
```

---

## 12. Do / Don't

| âœ… Do | âŒ Don't |
|---|---|
| Use `bg-card`, `bg-background`, `bg-secondary` | Use `bg-slate-900`, `bg-white`, `bg-gray-100` |
| Use `text-foreground`, `text-muted-foreground` | Use `text-white`, `text-slate-400`, `text-gray-900` |
| Use `border-border` | Use `border-slate-700`, `border-gray-200`, `border-white/10` |
| Use `text-primary`, `bg-primary` | Use `text-blue-400`, `bg-blue-600` |
| Use `text-destructive` | Use `text-red-400`, `text-red-600` |
| Use `card-feature` for adaptive cards | Use `bg-white/[0.04]` (invisible on white) |
| Use `section-hero` for always-dark sections | Rely on parent theme for dark gradient sections |
| Use `card-tint-emerald` etc for tinted highlights | Use `bg-emerald-500/10` (may be invisible on white) |
| Add `class="dark"` once on layout root | Add `dark` to every individual component |
| Add `class="light"` once on PublicLayout | Forget to set theme on new layouts |
| Use `rounded-xl` / `rounded-2xl` | Use `rounded-3xl`, `rounded-[2rem]` |
| Use `DashboardPageLayout` or `AdminPageLayout` | Reinvent header/KPI/tab structure per page |
| Use `PublicLayout` for all marketing pages | Write custom nav/footer per page |
| Keep status colours inline (`text-emerald-400`) | Flip status colours between themes |

---

*This document reflects the state of the design system after the August 2026 overhaul.*  
*For questions about individual API routes or database schema, see `DEVELOPER_ONBOARDING.md`.*
