# DriveBook Branding & Logo System

**Status:** ✅ COMPLETE (July 2026)  
**Last Updated:** July 2026

---

## Overview

DriveBook uses a consistent logo and branding system across all public-facing pages. The logo is implemented as a React component (`components/Logo.tsx`) that renders an inline SVG — no external image requests, no flash of missing logo.

---

## Logo Design

The DriveBook logo consists of:

1. **D-mark (icon)** — a bold letter "D" in a blue→purple→pink gradient containing:
   - A winding road (dark tarmac with white centre dashes) curving inside the D
   - A gold/yellow steering wheel positioned on the road
   
2. **Wordmark** — "Drive" + "Book" in matching typeface:
   - "Drive" — `text-slate-900` on light backgrounds, `text-white` on dark backgrounds
   - "Book" — `bg-gradient-to-r from-violet-600 to-pink-500` gradient text (always)

3. **Tagline** (SVG only, not in the React component) — "Learn. Drive. Succeed." in slate-500

### Gradient Values

| Element | Gradient |
|---------|---------|
| D background | `#4338ca` → `#7c3aed` → `#ec4899` (blue → violet → pink) |
| "Book" wordmark | `violet-600` → `pink-500` |
| Steering wheel | `#fde68a` → `#f59e0b` (radial, yellow/amber) |
| Road (tarmac) | `#1e1b4b` (very dark navy) |

---

## SVG Files (`/public/`)

| File | Use |
|------|-----|
| `public/logo.svg` | Full wordmark — D-mark + "DriveBook" + tagline. Used by JSON-LD `logo` field, RSS feed `<image>`, OG fallback. |
| `public/logo-icon.svg` | Icon only — 160×160 viewBox. For app icons, social avatars, square badges. |
| `public/favicon.svg` | 32×32 compact version. Referenced in `app/layout.tsx` via `icons.icon`. |

---

## React Logo Component (`components/Logo.tsx`)

### Props

```tsx
<Logo
  variant?: 'full' | 'icon' | 'wordmark'  // default: 'full'
  size?: number                             // icon height in px, default: 36
  dark?: boolean                            // use on dark backgrounds — makes "Drive" white
  className?: string
/>
```

### Variants

| Variant | Renders | Use case |
|---------|---------|---------|
| `full` (default) | D-mark icon + wordmark | Nav headers, footers |
| `icon` | D-mark only | Tight spaces, mobile |
| `wordmark` | Text only | Text-only contexts |

### dark prop

| `dark` | "Drive" colour | Background |
|--------|---------------|-----------|
| `false` (default) | `text-slate-900` (dark text) | White / light backgrounds |
| `true` | `text-white` | Dark (`bg-slate-950`) backgrounds |

"Book" is always the violet→pink gradient regardless of `dark`.

---

## Usage Across Pages

### Dark background pages (use `dark` prop)

| Page | Usage |
|------|-------|
| Homepage (`/`) | `<Logo size={36} />` — nav header; `<Logo size={28} dark />` — footer |
| Blog list (`/blog`) | `<Logo size={32} dark />` |
| Blog post (`/blog/[slug]`) | `<Logo size={32} dark />` |
| Blog tag (`/blog/tag/[tag]`) | `<Logo size={34} dark />` |
| Learn to Drive (`/learn-to-drive`) | `<Logo size={34} dark />` |
| PDA Guide (`/pda-guide`) | `<Logo size={34} dark />` |
| For Instructors (`/for-instructors`) | `<Logo size={34} dark />` |
| Platform (`/platform`) | `<Logo size={34} dark />` |
| About (`/about`) | header + footer: `<Logo dark />` |
| Contact (`/contact`) | header + footer: `<Logo dark />` |
| Teach with DriveBook | `<Logo size={34} dark />` |
| Instructors (`/instructors`) | `<Logo size={32} dark />` |

### Light background pages (no `dark` prop)

| Page | Usage |
|------|-------|
| Terms (`/terms`) | `<Logo size={32} />` — white nav |
| Privacy (`/privacy`) | `<Logo size={32} />` — white nav |
| Instructor Terms (`/instructor-terms`) | `<Logo size={32} />` — white nav |

---

## Instructor Branding (Platform Feature)

This is separate from the DriveBook brand system. Instructors on PRO and BUSINESS tiers can upload their own logo and brand colours, which appear on their booking page, email confirmations, and student dashboard header.

Instructor branding is stored in the `Instructor` model as:
- `brandLogo` — URL to uploaded image
- `brandColorPrimary` — hex string
- `brandColorSecondary` — hex string
- `showBrandingOnBookingPage` — boolean

Only applies on `/subdomain/[slug]` and `/book/[instructorId]` pages when instructor has PRO/BUSINESS subscription.

**DriveBook branding is never replaced by instructor branding on platform-level pages** (`/`, `/blog`, `/learn-to-drive`, etc.).

---

## Typography

Font stack in use (via Google Fonts, loaded in `app/layout.tsx`):
- **Primary:** Plus Jakarta Sans — headings, wordmark, UI elements
- **Secondary:** Inter — body text, UI

CSS variables:
- `--font-plus-jakarta-sans`
- `--font-inter`

---

## Colour Palette (Platform Brand)

| Name | Hex | Use |
|------|-----|-----|
| Brand violet | `#7c3aed` | Primary brand, gradients |
| Brand pink | `#ec4899` | Secondary brand, gradients |
| Brand indigo | `#4338ca` | D-mark start gradient |
| Background dark | `#020617` (`slate-950`) | All dark-theme pages |
| Text primary | `#ffffff` | On dark backgrounds |
| Text muted | `rgba(255,255,255,0.6)` | Subtext on dark |
| Accent gold | `#fde68a` | Steering wheel, highlights |
| Surface | `rgba(255,255,255,0.05)` | Cards on dark bg |

---

## What NOT to Do

- Do not render the DriveBook logo as an `<img>` tag pointing to `logo.svg` in nav headers — use the React `<Logo>` component
- Do not use the old Zap icon from lucide-react as the logo mark — it was replaced
- Do not use the old gradient text span pattern (`from-yellow-300 via-pink-300 to-purple-300`) as the wordmark — it was replaced
- Do not hardcode logo sizes in CSS — use the `size` prop
- On dark background pages, always pass `dark` prop — otherwise "Drive" renders dark-on-dark and is invisible
