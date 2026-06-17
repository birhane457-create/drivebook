# UI Styling & Dark Theme Design System

**Version:** 1.0  
**Updated:** June 11, 2026  
**Status:** Reference guide for all new UI development

---

## Overview

DriveBook uses a **dark theme** design system based on Tailwind CSS. All new pages and components should follow this palette for consistency.

**Why Dark Theme:**
- Reduces eye strain in low-light environments
- Modern, professional appearance
- Better contrast ratios for accessibility
- Consistent with current instructor dashboard

---

## Color Palette

### Core Backgrounds

| Use Case | Tailwind | Hex | Usage |
|----------|----------|-----|-------|
| Main page background | `bg-slate-950` | #030712 | Page container, main background |
| Card/container background | `bg-slate-900/80` | #0f172a (80% opacity) | Forms, cards, main sections |
| Card/container light | `bg-slate-900/40` | #0f172a (40% opacity) | Subtle backgrounds, hover states |
| Input field background | `bg-slate-950/60` | #030712 (60% opacity) | Text inputs, selects, textareas |

### Text Colors

| Hierarchy | Tailwind | Hex | Usage |
|-----------|----------|-----|-------|
| Primary | `text-white` | #ffffff | Main headings, strong text, selected items |
| Secondary | `text-slate-300` | #cbd5e1 | Form labels, secondary headings |
| Tertiary | `text-slate-400` | #94a3b8 | Hints, support text, icon colors |
| Muted | `text-slate-500` | #64748b | Placeholder text, disabled text |

### Borders

| Style | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| Standard | `border-white/10` | white @ 10% | Input borders, container borders, dividers |
| Strong | `border-white/20` | white @ 20% | Emphasized borders (if needed) |
| Subtle | `border-white/5` | white @ 5% | Hover state borders |

### Primary Interactive (Sky Blue)

| Element | Tailwind | Hex | Usage |
|---------|----------|-----|-------|
| Button background | `bg-sky-600` | #0284c7 | Primary actions |
| Button hover | `bg-sky-700` | #0369a1 | Button hover state |
| Focus ring | `focus:ring-sky-500` | #06b6d4 | Input focus states |
| Text accent | `text-sky-300` | #06b6d4 | Links, accents |
| Text light | `text-sky-200` | #7dd3fc | Light blue text |
| Info background | `bg-sky-500/10` | #0ea5e9 (10% opacity) | Info boxes |
| Info border | `border-sky-500/30` | #0ea5e9 (30% opacity) | Info box borders |

### Status Colors

#### Success (Emerald)
```
bg-emerald-500/20    # Background
text-emerald-400     # Text/icon
```

#### Warning (Amber)
```
bg-amber-500/10      # Background
border-amber-500/40  # Border
text-amber-200       # Heading text
text-amber-300       # Secondary text
```

#### Error (Red)
```
bg-red-500/10        # Background
border-red-500/30    # Border
text-red-200         # Heading text
text-red-300         # Secondary text
```

---

## Component Patterns

### Form Container
```jsx
<form className="bg-slate-900/80 border border-white/10 rounded-3xl shadow-lg p-6 sm:p-8 space-y-6">
  {/* Form fields */}
</form>
```

### Input Field
```jsx
<input
  className="w-full px-3 py-2 border border-white/10 bg-slate-950/60 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
  placeholder="Placeholder text..."
/>
```

### Label
```jsx
<label className="block text-sm font-medium text-slate-300 mb-2">
  Label Text
</label>
```

### Checkbox
```jsx
<input
  type="checkbox"
  className="bg-slate-950/60 border border-white/10 rounded accent-sky-500"
/>
```

### Primary Button
```jsx
<button className="bg-sky-600 hover:bg-sky-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
  Button Text
</button>
```

### Secondary Button
```jsx
<button className="bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg font-medium transition-colors border border-white/10">
  Button Text
</button>
```

### Info Box
```jsx
<div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4">
  <p className="text-sm font-semibold text-sky-200 mb-1">Heading</p>
  <p className="text-sm text-sky-300">Content</p>
</div>
```

### Alert Box
```jsx
<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
  <div>
    <p className="text-sm font-semibold text-red-200">Error</p>
    <p className="text-sm text-red-300">Error message</p>
  </div>
</div>
```

---

## Spacing & Rounded Corners

### Border Radius
```
rounded-lg      # 8px - Standard: inputs, small cards, buttons
rounded-3xl     # 24px - Large: main form containers, large cards
rounded-full    # 100% - Circle: badges, avatars, icons
```

### Padding
```
p-3             # Small: tight sections, badges
p-4             # Standard: form fields, small cards
p-6 sm:p-8      # Large: main form containers (6 on mobile, 8 on desktop)
```

### Gaps/Spacing
```
gap-2           # Tight spacing
gap-3           # Standard spacing
gap-4           # Generous spacing
space-y-4       # Vertical spacing between elements
space-y-6       # Larger vertical spacing
```

---

## Interactive States

### Hover States
```jsx
// Button
<button className="bg-sky-600 hover:bg-sky-700 transition-colors">
  Button
</button>

// Link
<a href="..." className="text-sky-300 hover:text-sky-200">
  Link
</a>

// Input
<input className="border border-white/10 hover:border-white/20" />
```

### Focus States
```jsx
<input
  className="focus:ring-2 focus:ring-sky-500 focus:border-transparent"
/>
```

### Disabled States
```jsx
<button disabled className="opacity-50 cursor-not-allowed">
  Disabled Button
</button>

<input disabled className="opacity-50 cursor-not-allowed" />
```

### Transitions
```jsx
// Add smooth color transitions
className="transition-colors"
className="transition-all duration-200"
```

---

## Accessibility

### Contrast
- All text meets WCAG AA minimum contrast ratios
- Focus indicators are clearly visible
- Status conveyed by color + icon (not color alone)

### Semantic HTML
- Use proper heading hierarchy (`<h1>`, `<h2>`, etc.)
- Use `<label>` elements for all form inputs
- Use button semantics (`<button>` not `<div>` styled as button)

### Keyboard Navigation
- All interactive elements accessible via keyboard
- Focus order is logical
- No keyboard traps

---

## Implementation Guide

### When Adding a New Page/Component

1. **Check This Document** for color/component patterns
2. **Copy Pattern Code** from above
3. **Apply Tailwind Classes** consistently
4. **Test Dark Background** (ensure sufficient contrast)
5. **Test Hover/Focus States** (verify transitions work)
6. **Test Mobile Layout** (responsive behavior)

### Common Mistakes to Avoid

❌ Don't use light backgrounds (use dark theme only)  
❌ Don't mix blue with sky-blue (be consistent)  
❌ Don't use gray text on dark backgrounds (use slate colors)  
❌ Don't forget focus rings on inputs  
❌ Don't skip transitions on hover states  

### Files Using This System

- ✅ `app/dashboard/bookings/new/page.tsx`
- ✅ `components/BookingFormNew.tsx`
- ✅ `components/SlotPicker.tsx`
- ✅ `app/dashboard/page.tsx` (instructor dashboard)
- ✅ (Others to follow)

---

## Configuration Files

**Tailwind Config:** `tailwind.config.ts`  
**Global Styles:** `app/globals.css`

The dark theme is configured at the Tailwind level, so no custom CSS needed—just use the class names listed above.

---

## Future Enhancements

- [ ] Add dark mode toggle (if users request)
- [ ] Create Storybook/component library with all patterns
- [ ] Add theme customization options
- [ ] Document animation/transition guidelines

---

## References

- **Tailwind CSS:** https://tailwindcss.com/docs
- **Color Contrast:** https://www.a11y-101.com/design/color-contrast
- **Dark Mode:** https://tailwindcss.com/docs/dark-mode

---

**Maintained By:** Development Team  
**Last Updated:** June 11, 2026  
**Status:** Active / Reference
