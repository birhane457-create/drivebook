# DriveBook Blog

**Status:** ✅ COMPLETE — 23 posts live (July 2026)  
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

## Blog Content (23 Posts — July 2026)

### For Learner Drivers (12 posts)

| Slug | Tags |
|------|------|
| `how-many-driving-lessons-do-i-need-pda-western-australia` | PDA, lessons, WA, learner driver, preparation |
| `how-to-choose-the-right-driving-instructor-perth` | Perth, instructor, reviews, manual, automatic |
| `how-to-pass-the-pda-on-your-first-attempt` | PDA, test tips, preparation, WA, learner driver |
| `most-common-reasons-people-fail-the-pda-western-australia` | PDA, failure, blind spot, WA, observation |
| `how-much-does-learning-to-drive-cost-perth` | cost, Perth, pricing, WA, packages |
| `what-happens-during-first-driving-lesson` | beginner, first lesson, learner driver, instructor |
| `understanding-wa-logbook-requirements` | logbook, WA, supervised hours, night driving, learner driver |
| `manual-vs-automatic-which-licence-should-you-choose` | manual, automatic, licence, transmission, WA |
| `night-driving-tips-learner-drivers-wa` | night driving, logbook, WA, safety, learner driver |
| `parallel-parking-guide-learner-drivers` | parking, parallel parking, PDA, manoeuvres, learner driver |
| `roundabouts-explained-learner-drivers-wa` | roundabouts, road rules, WA, PDA, intersections |
| `hazard-perception-test-guide-wa` | HPT, hazard perception, WA, P plates, provisional licence |

### For Driving Instructors (11 posts)

| Slug | Tags |
|------|------|
| `how-to-grow-your-driving-school-without-advertising` | marketing, online booking, reminders, driving school, DriveBook |
| `how-to-increase-student-retention-driving-instructors` | retention, feedback, online booking, packages, DriveBook |
| `pricing-your-driving-lessons-guide-instructors` | pricing, revenue, instructor business, packages, Perth |
| `managing-last-minute-cancellations-driving-instructors` | cancellations, no-shows, reminders, policy, DriveBook |
| `building-five-star-reputation-driving-instructor` | reviews, reputation, feedback, instructor business, DriveBook |
| `driving-school-vs-independent-instructor` | independent, driving school, DIA, WA, instructor business |
| `best-software-for-driving-instructors-australia` | software, booking system, DriveBook, instructor tools, Australia |
| `how-to-grow-through-referrals-driving-instructor` | referrals, word of mouth, growth, reviews, DriveBook |
| `managing-multiple-instructors-driving-school` | multi-instructor, driving school, scheduling, DriveBook, management |
| `why-online-booking-increases-revenue-driving-instructors` | online booking, revenue, no-shows, payments, DriveBook |
| `running-a-professional-driving-school` | professional, driving school, systems, DriveBook, Australia |

---

## Adding New Posts

1. Create `content/blog/[slug].mdx` with correct frontmatter (see format above)
2. Deploy — the post appears automatically on the listing page, sitemap, and RSS feed
3. No code changes required

**Important:** Tag slugs are auto-generated from the `tags` array. A new tag creates a new archive page at `/blog/tag/[slug]` automatically via `generateStaticParams`.

---

## Future Improvements (Backlog)

| Item | When |
|------|------|
| Cover images (`coverImage` frontmatter field) | When images are available |
| Client-side search (Fuse.js) | At 40+ posts |
| Pagination (`/blog?page=2`) | At 60+ posts |
| Reading progress bar | Next sprint |
| Newsletter signup | When email service is ready |
| Author pages | When multiple authors |
