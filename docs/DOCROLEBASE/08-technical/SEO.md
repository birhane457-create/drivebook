# DriveBook — SEO Technical Reference

**Status:** ✅ COMPLETE (July 2026)  
**Last Updated:** July 2026

---

## Overview

DriveBook's SEO strategy targets two audiences via distinct URL patterns:

1. **Platform search** (`/book`) — learner drivers searching for local instructors
2. **Instructor microsites** (`subdomain.drivebook.com.au` or `/subdomain/[slug]`) — direct instructor profiles with local SEO
3. **Content SEO** — 100+ blog posts + 4 pillar hub pages targeting informational queries

---

## Root Metadata (`app/layout.tsx`)

Title template: `"Page Title | DriveBook"` (via `title.template`)

Default title: `"DriveBook – Book Driving Lessons in Australia"`

Description: `"Find approved local driving instructors near you. Book online or by phone 24/7. Flexible lesson packages, transparent pricing, instant SMS confirmation. Manual & Automatic available."`

OpenGraph locale: `en_AU`

Keywords include: driving lessons, driving instructor, driving instructor near me, manual/automatic, PDA test, Australia driving school

Favicon: `favicon.svg` (SVG format, supported by all modern browsers). Falls back to `favicon.ico`.

### JSON-LD in root layout

Two scripts injected for every page:

**Organization** — enables Google Knowledge Panel:
```json
{
  "@type": "Organization",
  "name": "DriveBook",
  "url": "https://drivebook.com.au",
  "logo": "https://drivebook.com.au/logo.png",
  "areaServed": { "@type": "Country", "name": "Australia" }
}
```

**WebSite** — enables Google Sitelinks Searchbox:
```json
{
  "@type": "WebSite",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://drivebook.com.au/book?location={search_term_string}"
  }
}
```

---

## Page-Level Metadata

| Route | Title | Notes |
|-------|-------|-------|
| `/` | DriveBook – Book Driving Lessons in Australia | Root default via layout |
| `/book` | Find a Driving Instructor Near You – Book Online | Via `app/book/layout.tsx` |
| `/learn-to-drive` | Learn to Drive in Western Australia — Complete Learner Driver Guide | Pillar page — priority 0.9 |
| `/pda-guide` | Complete WA PDA Guide — Practical Driving Assessment Western Australia | Pillar page — priority 0.9 |
| `/for-instructors` | Driving Instructor Hub — Grow Your Driving School \| DriveBook | Pillar page — priority 0.9 |
| `/platform` | DriveBook Platform — How It Works for Driving Instructors | Pillar page — priority 0.85 |
| `/teach-with-drivebook` | Grow Your Driving School with DriveBook | Via page export |
| `/about` | About Us \| DriveBook | Via page export |
| `/blog` | Driving Tips, Instructor Guides & WA Learner Resources \| DriveBook | Via page export |
| `/blog/[slug]` | `{post.title}` | Via `generateMetadata` in `[slug]/page.tsx` |
| `/blog/tag/[tag]` | `{tagLabel} — Articles \| DriveBook` | Via `generateMetadata` in `[tag]/page.tsx` |
| `/subdomain/[slug]` | `Book Driving Lessons with {name}` | Via `generateMetadata` in subdomain page |

---

## Sitemap (`app/sitemap.ts`)

Dynamic sitemap at `/sitemap.xml`. Regenerates hourly (`revalidate = 3600`).

Includes:
- All static public pages with priority scores
- All four pillar pages (`/learn-to-drive`, `/pda-guide`, `/for-instructors`, `/platform`)
- All active/approved instructor subdomain pages (`/subdomain/[slug]`)
- All blog posts (`/blog/[slug]`) — dated from frontmatter
- All blog tag archive pages (`/blog/tag/[tag]`) — derived from post tags
- `/rss.xml` entry
- `/blog` listing page

Priority mapping:
| URL pattern | Priority |
|-------------|----------|
| `/` | 1.0 |
| `/book` | 0.9 |
| `/learn-to-drive` | 0.9 |
| `/pda-guide` | 0.9 |
| `/for-instructors` | 0.9 |
| `/teach-with-drivebook` | 0.8 |
| `/platform` | 0.85 |
| Instructor subdomain pages | 0.8 |
| Blog posts | 0.75 |
| `/about`, `/contact` | 0.6 |
| Blog tag archives | 0.6 |
| `/help`, `/register` | 0.4–0.5 |
| `/rss.xml` | 0.3 |

---

## Robots (`app/robots.ts`)

Allows all crawlable public routes. Explicitly disallows:
- `/dashboard/` — instructor private area
- `/admin/` — admin panel
- `/client-dashboard/` — student private area
- `/api/` — API routes
- `/login`, `/register`, `/set-password`, `/reset-password`, `/forgot-password`
- `/setup/`, `/staff/`, `/payment/`

Points to: `https://drivebook.com.au/sitemap.xml`

---

## RSS Feed (`app/rss.xml/route.ts`)

RSS 2.0 feed at `/rss.xml`. Includes all blog posts with:
- Title, link, GUID, description
- pubDate, category (Learner Driver / Instructor)
- Individual tag categories
- Author email

Cache-Control: `public, max-age=3600`

Auto-discovered via `<link rel="alternate" type="application/rss+xml">` in root layout `<head>`.

---

## Blog SEO

Each blog post generates:

**BlogPosting JSON-LD:**
```json
{
  "@type": "BlogPosting",
  "headline": "...",
  "keywords": "PDA, WA, ...",
  "author": { "@type": "Organization", "name": "DriveBook Team" },
  "publisher": { "@type": "Organization", "name": "DriveBook", "logo": "..." },
  "datePublished": "...",
  "mainEntityOfPage": { "@type": "WebPage" }
}
```

**BreadcrumbList JSON-LD** on every post and tag page.

**CollectionPage JSON-LD** on the `/blog` listing page.

**Canonical URLs** set on all blog pages via `alternates.canonical`.

**OpenGraph tags** with `type: "article"`, `publishedTime`, and `tags` (from frontmatter).

---

## Pillar Page SEO (July 2026)

Four hub pages were built as topical authority anchors. Each includes:

### `/learn-to-drive`
- JSON-LD: `BreadcrumbList` + `FAQPage` (5 questions about WA learner driving)
- Targets: "learn to drive WA", "learner driver guide western australia"
- Links to ~40 student blog posts
- CTA → `/book`

### `/pda-guide`
- JSON-LD: `BreadcrumbList` + `FAQPage` (5 PDA-specific questions)
- Targets: "PDA western australia", "practical driving assessment WA", "how to pass PDA"
- Links to all PDA-related blog posts
- CTA → `/book`

### `/for-instructors`
- JSON-LD: `BreadcrumbList`
- Targets: "driving instructor resources australia", "how to grow driving school"
- Links to ~60 instructor blog posts organised by topic
- CTA → `/teach-with-drivebook`

### `/platform`
- JSON-LD: `BreadcrumbList` + `SoftwareApplication`
- Targets: "driving school software australia", "driving lesson booking platform"
- Documents all platform features with internal links to relevant blog posts
- CTA → `/teach-with-drivebook`

---

## Instructor Microsite SEO (`/subdomain/[slug]`)

Each instructor's booking page generates:

**LocalBusiness JSON-LD:**
```json
{
  "@type": "LocalBusiness",
  "name": "Instructor Name",
  "areaServed": "Perth suburb",
  "priceRange": "From $XX/hr",
  "aggregateRating": { "ratingValue": 4.8, "reviewCount": 23 }
}
```

Title: `"Book Driving Lessons with {name}"`  
Description: Instructor bio (first 155 chars) or generated fallback  
OpenGraph image: Instructor profile photo (if set)

`generateMetadata` uses `{ revalidate: 300 }` (5-minute cache).

---

## Internal Linking Structure

All pillar pages are linked from:
- Homepage footer navigation (Company column + Resources column)
- Each pillar page's nav links to the other pillar pages
- Blog posts include relevant in-content links to pillar pages

This distributes page authority from the homepage through the pillar pages and outward to cluster blog posts.

---

## Middleware — SEO-Safe Routes

The following routes are excluded from auth middleware to ensure Google can always crawl them:

- `/sitemap.xml`
- `/robots.txt`
- `/rss.xml`
- `/blog` and all `/blog/*` paths
- `/subdomain/*` subdomain rewrite paths
- `/learn-to-drive`, `/pda-guide`, `/for-instructors`, `/platform`

See `middleware.ts` — `skipPaths` and `publicPaths` arrays.

**Note:** Pillar pages (`/learn-to-drive`, `/pda-guide`, `/for-instructors`, `/platform`) must be verified as public in middleware before deploy.

---

## Search Console Setup

After each deploy, submit to Google Search Console:
1. Go to https://search.google.com/search-console
2. Select `drivebook.com.au` property
3. Sitemaps → Submit `https://drivebook.com.au/sitemap.xml`
4. URL Inspection → Request indexing for `/`, `/book`, `/blog`, `/learn-to-drive`, `/pda-guide`, `/for-instructors`, `/platform`

---

## Current SEO Architecture Status (July 2026)

| Layer | Status | Count |
|-------|--------|-------|
| Blog posts | ✅ Complete | 100 |
| Tag archive pages | ✅ Auto-generated | ~120 unique tags |
| RSS feed | ✅ Live | All 100 posts |
| Sitemap | ✅ Dynamic, hourly | All posts + tags + instructors + pillar pages |
| Pillar pages | ✅ Complete | 4 |
| Instructor microsite pages | ✅ Live | Dynamic from DB |
| JSON-LD structured data | ✅ All pages | BlogPosting, FAQPage, LocalBusiness, Organization, WebSite, SoftwareApplication |

---

## Pending SEO Work (see TODO.md for full roadmap)

| Phase | What | Priority |
|-------|------|----------|
| 2 | Feature landing pages (`/features/*`) | High |
| 3 | Comparison pages (`/compare/*`) | High |
| 4 | Location pages (`/perth`, `/joondalup` etc.) | Medium |
| 5 | Documentation centre (`/docs`) | Medium |
| 6 | Interactive tools (calculators, quizzes) | Low |
| — | OG images per post (1200×630) | When design assets ready |
| — | Add pillar pages to middleware public paths | Before deploy |
