# Earnings Dashboard UX Improvements

## 🎯 Problems Identified

### 1. Too Much History = Messy
- Long list of weeks makes page overwhelming
- Hard to find recent earnings
- Scrolling through months of data

### 2. Invoice Per Booking = Cluttered
- Individual invoice button for each booking is messy
- Not how real businesses work
- Tax/audit needs consolidated reports

## ✅ Solutions

### 1. Show Recent Only + "See More"
```
DEFAULT VIEW:
├── This Week (current)
├── Last Week
└── [See More History] button

AFTER CLICKING "SEE MORE":
├── This Week
├── Last Week
├── 2 Weeks Ago
├── 3 Weeks Ago
└── [Load More] button
```

### 2. Proper Invoice System
```
REMOVE: Individual booking invoices ❌
ADD: Professional invoicing ✅

├── Weekly Receipt (per week)
│   └── All bookings for that week
├── Monthly Summary (per month)
│   └── All bookings for that month
└── Annual Report (for tax)
    └── All bookings for the year
```

## 📊 New Layout

### Stats Cards (Top)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ This Week   │ Last Week   │ This Month  │ Scheduled   │
│ $420.00     │ $350.00     │ $1,240.00   │ $280.00     │
│ 6 lessons   │ 5 lessons   │ 18 lessons  │ 4 lessons   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Weekly History (Collapsed by Default)
```
┌─────────────────────────────────────────────────────────┐
│ THIS WEEK (Feb 19-25)                          $420.00  │
│ 6 lessons • 6.5 hours                                   │
│ [▼ Expand]                                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ LAST WEEK (Feb 12-18)                          $350.00  │
│ 5 lessons • 5.0 hours                                   │
│ [▶ Expand]                                              │
└─────────────────────────────────────────────────────────┘

                    [📄 See More History]
```

### When Expanded
```
┌─────────────────────────────────────────────────────────┐
│ THIS WEEK (Feb 19-25)                          $420.00  │
│ 6 lessons • 6.5 hours                                   │
│ [▼ Collapse]                                            │
│                                                         │
│ Daily Breakdown:                                        │
│ Mon $70 | Tue $140 | Wed $70 | Thu $70 | Fri $70 | ... │
│                                                         │
│ [📄 Download Weekly Receipt]                            │
└─────────────────────────────────────────────────────────┘
```

### Click on a Day
```
┌─────────────────────────────────────────────────────────┐
│ MONDAY, FEB 19                                  $140.00  │
│ 2 lessons • 2.0 hours                                   │
│                                                         │
│ Lesson 1: John Smith, 10:00 AM                         │
│ ├─ 1 hour from 15h package                             │
│ ├─ Gross: $70.00                                       │
│ ├─ Commission (12%): -$8.40                            │
│ └─ Net: $61.60                                         │
│                                                         │
│ Lesson 2: Sarah Lee, 2:00 PM                           │
│ ├─ 1 hour standalone                                   │
│ ├─ Gross: $70.00                                       │
│ ├─ Commission (12%): -$8.40                            │
│ └─ Net: $61.60                                         │
└─────────────────────────────────────────────────────────┘
```

## 🧾 Invoice System

### Weekly Receipt
```
WEEKLY EARNINGS RECEIPT
Week of Feb 19-25, 2024

Instructor: [Name]
Period: Monday, Feb 19 - Sunday, Feb 25

LESSONS TAUGHT:
Mon Feb 19: 2 lessons → $140.00
Tue Feb 20: 2 lessons → $140.00
Wed Feb 21: 1 lesson  → $70.00
Thu Feb 22: 1 lesson  → $70.00

SUMMARY:
Total Lessons: 6
Total Hours: 6.5
Gross Earnings: $525.00
Platform Fee (12%): -$63.00
Processing Fees: -$15.23
Net Earnings: $446.77

Status: Paid on Feb 26, 2024
Payment Method: Bank Transfer
```

### Monthly Summary
```
MONTHLY EARNINGS SUMMARY
February 2024

Instructor: [Name]

WEEKLY BREAKDOWN:
Week 1 (Feb 1-4):   $280.00 (4 lessons)
Week 2 (Feb 5-11):  $350.00 (5 lessons)
Week 3 (Feb 12-18): $350.00 (5 lessons)
Week 4 (Feb 19-25): $420.00 (6 lessons)
Week 5 (Feb 26-29): $140.00 (2 lessons)

MONTHLY TOTALS:
Total Lessons: 22
Total Hours: 23.5
Gross Earnings: $1,645.00
Platform Fees: -$197.40
Processing Fees: -$47.69
Net Earnings: $1,399.91

Payouts Received: 4
Total Paid: $1,399.91

For tax purposes, keep this summary with your records.
```

### Annual Report (Tax Document)
```
ANNUAL EARNINGS REPORT - 2024
For Tax Filing

Instructor: [Name]
ABN/TIN: [Number]

MONTHLY BREAKDOWN:
January:   $1,200.00 (18 lessons)
February:  $1,400.00 (22 lessons)
March:     $1,600.00 (24 lessons)
...
December:  $1,800.00 (26 lessons)

ANNUAL TOTALS:
Total Lessons: 264
Total Hours: 280.5
Gross Earnings: $18,480.00
Platform Fees: -$2,217.60
Processing Fees: -$535.68
Net Earnings: $15,726.72

DEDUCTIONS:
Platform Commission: $2,217.60
Payment Processing: $535.68
Total Deductions: $2,753.28

NET TAXABLE INCOME: $15,726.72

This document is for tax filing purposes.
Consult your tax advisor for proper reporting.
```

## 🔧 Implementation Plan

### Phase 1: Simplify History Display
1. Show only 2 most recent weeks by default
2. Add "See More History" button
3. Load 4 more weeks when clicked
4. Add "Load More" for older history

### Phase 2: Remove Individual Invoices
1. Remove "Invoice" button from each booking
2. Keep breakdown visible when day is expanded
3. Focus on weekly/monthly summaries

### Phase 3: Add Weekly Receipt
1. Create `/api/instructor/receipts/weekly/[weekId]` endpoint
2. Generate PDF with all bookings for that week
3. Add "Download Weekly Receipt" button per week
4. Include all commission breakdowns

### Phase 4: Add Monthly Summary
1. Create `/api/instructor/receipts/monthly/[month]` endpoint
2. Generate PDF with monthly totals
3. Add "Monthly Summaries" section
4. List all months with download buttons

### Phase 5: Add Annual Report
1. Create `/api/instructor/receipts/annual/[year]` endpoint
2. Generate tax-ready PDF
3. Add "Tax Documents" section
4. Include all necessary tax information

## 📱 Mobile Optimization

### Mobile View
```
┌─────────────────────┐
│ This Week           │
│ $420.00             │
│ 6 lessons           │
└─────────────────────┘

┌─────────────────────┐
│ Last Week           │
│ $350.00             │
│ 5 lessons           │
└─────────────────────┘

[See More History]
```

## ✅ Benefits

### For Instructors:
- ✅ Cleaner, less overwhelming interface
- ✅ Focus on recent earnings
- ✅ Professional receipts for records
- ✅ Easy tax filing with annual report
- ✅ Faster page load (less data)

### For Platform:
- ✅ Better UX = happier instructors
- ✅ Professional appearance
- ✅ Reduced server load (pagination)
- ✅ Industry standard approach

## 🎯 Success Metrics

- Page load time < 2 seconds
- Only 2 weeks visible by default
- Weekly receipt downloads
- Monthly summary downloads
- Annual report for tax season
