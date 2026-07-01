# DriveBook Blog

**Status:** ✅ COMPLETE — 100 posts live (July 2026)  
**Last Updated:** July 2026

---

## Overview

The DriveBook blog (`/blog`) serves two purposes:

1. **SEO** — organic traffic from learner drivers and driving instructors searching for help
2. **Conversion** — every post ends with a category-appropriate CTA driving users to `/book` (students) or `/teach-with-drivebook` (instructors)

---

## Architecture

**Platform:** Static MDX files rendered server-side. No CMS dependency.

**Dependencies:** `gray-matter` (frontmatter parsing), `next-mdx-remote` (MDX rendering)

**Content location:** `content/blog/*.mdx` — flat directory, no subdirectories

**Key files:**

| File | Purpose |
|------|---------|
| `lib/blog.ts` | Reads all MDX files, parses frontmatter, sorts newest-first. Exports `getAllPosts()`, `getPostBySlug()`, `getAdjacentPosts()`, `getRelatedPosts()` |
| `app/blog/page.tsx` | Listing page — featured hero, two sections (students/instructors), mid-page CTAs |
| `app/blog/[slug]/page.tsx` | Individual post — MDX rendering, breadcrumb, tags, related articles, prev/next nav |
| `app/blog/tag/[tag]/page.tsx` | Tag archive pages — filtered by tag, tag cloud sidebar |
| `app/rss.xml/route.ts` | RSS 2.0 feed at `/rss.xml` |
| `app/sitemap.ts` | Includes all post and tag archive URLs |

---

## Post Frontmatter Format

Every post in `content/blog/*.mdx` must have:

```yaml
---
title: "Post Title"
description: "SEO meta description, ~155 chars"
date: "2025-07-01"
author: "DriveBook Team"
category: "students"        # or "instructors"
readTime: "5 min read"
tags: ['PDA', 'WA', 'learner driver', 'preparation', 'test tips']
---
```

**Fields:**
- `title` — shown in header, used for SEO title and OpenGraph
- `description` — shown in header and cards; used for meta description
- `date` — ISO format, used for sorting (newest first) and sitemap
- `author` — shown in byline
- `category` — controls which section it appears in on the listing page and which CTA is shown
- `readTime` — displayed with clock icon
- `tags` — array of strings; powers tag archive pages at `/blog/tag/[tag-slug]`; shown on cards and post header

**Optional fields:**
- `featured: true` — pins post as featured hero on listing page (if not set, newest post is featured)

---

## Listing Page (`/blog`)

Structure:
1. Breadcrumb (Home / Blog)
2. Page heading
3. **Featured article hero** — large accent-bar card for most recent (or `featured: true`) post
4. **For Learner Drivers** section — grid of student-category posts
5. **Mid-page CTA** — "Looking for a driving instructor?" → `/book`
6. **For Driving Instructors** section — grid of instructor-category posts
7. **Mid-page CTA** — "Are you an instructor?" → `/teach-with-drivebook`

JSON-LD: `CollectionPage` + `BreadcrumbList`

---

## Individual Post Page (`/blog/[slug]`)

Structure:
1. Breadcrumb (Home / Blog / Post Title) + JSON-LD
2. Category badge + read time (clock icon)
3. H1 title
4. Description paragraph
5. Author + date
6. Tags (linked to `/blog/tag/[tag]`)
7. MDX content with prose styling
8. Category CTA block
9. Related articles (3 same-category posts)
10. Previous / Next navigation

JSON-LD: `BlogPosting` (with publisher logo, mainEntityOfPage, keywords from tags)

`generateStaticParams` pre-builds all post pages at deploy time.
`generateMetadata` sets per-post title, description, OG, canonical URL, keywords.

---

## Tag Archive Pages (`/blog/tag/[tag]`)

URL format: `/blog/tag/pda`, `/blog/tag/night-driving`, `/blog/tag/roundabouts`

Tag slugs are encoded: spaces → hyphens, lowercase. E.g. "night driving" → `night-driving`.

Structure:
- Breadcrumb + JSON-LD
- Filtered post grid (same-category posts first)
- Tag cloud sidebar (all tags with counts, active tag highlighted)

`generateStaticParams` pre-builds all tag pages derived from all post tags.

---

## Blog Content (100 Posts — July 2026)

### For Learner Drivers (~30 posts)

Topics covered:
- How many lessons needed for PDA in WA
- Choosing the right driving instructor in Perth
- How to pass the PDA on first attempt
- Most common PDA failure reasons WA
- How much does learning to drive cost in Perth
- What happens during first driving lesson
- Understanding WA logbook requirements / Logbook tips
- Manual vs automatic licence choice
- Night driving tips WA
- Parallel parking guide
- Roundabouts explained WA
- Hazard perception test guide / How to pass the HPT
- What is the PDA in WA (complete overview)
- Freeway driving for learner drivers WA
- Three-point turn guide
- Driving anxiety tips
- Reversing and parking manoeuvres
- Speed limit rules WA
- Give way rules WA complete guide
- How to use DriveBook as a student
- Wet weather driving WA
- What to expect at WA PDA test centre
- Manual transmission for learners
- Parking rules WA
- Country road driving WA
- Logbook tips — complete 50 hours right
- Understanding provisional licence WA (P1/P2)
- How to pass the Hazard Perception Test WA
- Why students prefer booking online
- How student dashboards improve retention
- What students expect from modern driving schools
- How DriveBook wallet works
- Preparing students for PDA using progress tracking

### For Driving Instructors (~70 posts)

Topics covered:
- Business setup and starting a driving school in Australia
- Independent vs driving school comparison
- Getting first students
- Pricing driving lessons guide
- Own car vs student's car
- Tax deductions for Australian driving instructors
- Marketing guide (complete)
- Google Business Profile guide
- Social media — what actually works
- Building five-star reputation
- Why reviews help rank higher
- Growing through referrals
- Growing without advertising
- AI phone receptionist how it works
- AI vs human receptionist comparison
- Can AI really book lessons
- How AI reduces missed calls
- AI for small driving schools
- Why SMS reminders reduce no-shows
- Cash vs card vs online payment
- Why online payments = more serious students
- How packages improve cash flow
- Why prepaid packages reduce cancellations
- Weekly payouts explained
- Tracking revenue without an accountant
- How DriveBook handles refunds
- Why online booking increases revenue
- How to stop double bookings
- Managing last-minute cancellations
- Setting a cancellation policy
- Managing holidays on DriveBook
- Recording offline cash bookings
- Branding with custom domain
- Custom domain vs social media
- Why every instructor needs a booking website
- Build a brand students remember
- How to write a winning instructor bio
- Optimise profile for more bookings
- How Google finds your DriveBook profile
- DriveBook subdomain booking page explained
- Setting up DriveBook profile
- Connecting custom domain to DriveBook
- Increasing student retention
- How student dashboards improve retention
- Student progress tracking and lesson feedback
- Dealing with difficult students
- Handling student complaints
- Assigning students to right instructor
- Growing from 1 instructor to 10
- Managing 5 instructors from one dashboard
- Managing multiple instructors
- Systems needed before scaling
- Monitoring instructor performance
- Giving each instructor their own calendar
- Onboarding a new instructor
- Managing instructor burnout
- Reducing admin time
- How to run driving school without spreadsheets
- How to stop double bookings
- Drivebook platform overview plain English
- DriveBook vs Google Calendar
- DriveBook vs paper diary
- Does DriveBook lock me in
- Can I export my students and data
- Is student data secure on DriveBook
- Why we built DriveBook
- DriveBook subscription plans explained
- Understanding weekly instructor payouts
- How DriveBook wallet works (instructor view)
- Starting your own driving school Australia
- Running a professional driving school
- How to manage multiple instructors school
- Best software for driving instructors Australia

---

## Adding New Posts

1. Create `content/blog/[slug].mdx` with correct frontmatter (see format above)
2. Deploy — the post appears automatically on the listing page, sitemap, and RSS feed
3. No code changes required

**Ongoing publishing cadence:** 2–4 posts per month. Focus on:
- New platform features as they ship
- Australian state expansion content (NSW/VIC road rules)
- Seasonal content (wet season, school holidays)
- DoT rule changes and road safety campaigns

**Important:** Tag slugs are auto-generated from the `tags` array. A new tag creates a new archive page at `/blog/tag/[slug]` automatically via `generateStaticParams`.

---

## Pillar Pages (July 2026)

Four hub pages were built to act as topical authority anchors. They are NOT blog posts — they are full Next.js app route pages that link to ~40 existing articles each.

| Route | Title | Audience |
|-------|-------|----------|
| `/learn-to-drive` | Learn to Drive in WA — Complete Learner Driver Hub | Students |
| `/pda-guide` | The Complete WA PDA Master Guide | Students |
| `/for-instructors` | Driving Instructor Resource Hub | Instructors |
| `/platform` | DriveBook Platform Guide | Instructors / Evaluators |

Each pillar page includes:
- Full JSON-LD (BreadcrumbList + FAQPage or SoftwareApplication)
- Canonical URL
- Metadata with targeted head terms
- Internal links to all relevant blog posts
- CTA to `/book` (student pages) or `/teach-with-drivebook` (instructor pages)
- Added to `app/sitemap.ts` at priority 0.9

---

## Future Improvements (Backlog — see TODO.md)

| Item | When |
|------|------|
| OG images (1200×630) per post | When design assets available |
| Client-side search (Fuse.js) | At 150+ posts |
| Pagination | At 150+ posts |
| Reading progress bar | Client-side component needed |
| Newsletter signup | When email service ready |
| Feature landing pages (`/features/*`) | Phase 2 SEO — see TODO.md |
| Comparison pages (`/compare/*`) | Phase 3 SEO — see TODO.md |
| Location pages (`/perth`, `/joondalup` etc.) | Phase 4 SEO — see TODO.md |
