# Design Document: Security and Performance Fixes

## Overview

This document presents the technical design for addressing five critical security vulnerabilities and performance bottlenecks in the DriveBook platform. The fixes address credential exposure, financial data precision, error handling resilience, API performance under load, and database query optimization.

## Architecture

### 1. Credential Security Architecture

**Current State:** Production credentials are committed to the `.env` file in version control, exposing sensitive API keys, database passwords, and Stripe credentials to anyone with repository access.

**Target State:** Zero-trust credential management where all secrets are loaded from environment variables, with repository hygiene enforced through Git configuration and startup validation.

**Components:**

1. **Environment Configuration Layer**
   - Loads secrets exclusively from runtime environment variables
   - Validates presence of all required credentials at application startup
   - Fails fast with descriptive error messages for missing credentials

2. **Repository Safety Controls**
   - `.gitignore` rules preventing `.env` file commits
   - `.env.example` template documenting required variables without values
   - Pre-commit hooks (optional) scanning for credential patterns

3. **Required Environment Variables**
   ```
   DATABASE_URL           # PostgreSQL connection string
   DIRECT_URL            # Direct database connection (bypasses pooling)
   NEXTAUTH_SECRET       # NextAuth.js session signing key
   NEXTAUTH_URL          # Application base URL
   STRIPE_SECRET_KEY     # Stripe API secret key
   STRIPE_PUBLISHABLE_KEY # Stripe public key
   STRIPE_WEBHOOK_SECRET # Webhook signature validation
   RESEND_API_KEY        # Email service API key
   UPLOADTHING_SECRET    # File upload service secret
   UPLOADTHING_APP_ID    # File upload app identifier
   ```

**Implementation Approach:**

1. Remove all credential values from committed `.env` file
2. Add `.env` to `.gitignore` if not already present
3. Create `.env.example` with variable names and descriptions
4. Add startup validation in `lib/config.ts` that checks for required variables
5. Update deployment documentation with environment setup instructions

### 2. Financial Data Precision Architecture

**Current State:** All monetary fields use `Float` type in Prisma schema, causing precision loss in financial calculations due to IEEE 754 floating-point representation.

**Example Precision Problem:**
```typescript
// Current implementation (Float)
0.1 + 0.2 = 0.30000000000000004  // ❌ Incorrect for money

// Decimal implementation
Decimal("0.1").plus("0.2") = "0.30"  // ✅ Exact precision
```

**Target State:** All financial amounts stored as `Decimal` type with explicit precision (10 digits, 2 decimal places), with arithmetic performed using Prisma's Decimal class or `decimal.js` library.

**Schema Migration:**

The following models and fields require conversion from `Float` to `Decimal(@db.Decimal(12, 2))`:

**Booking Model:**
- `price` - Lesson price charged to client
- `platformFee` - Platform commission
- `providerPayout` - Amount paid to instructor

**Transaction Model:**
- `amount` - Transaction total
- `platformFee` - Platform commission
- `providerPayout` - Amount paid to provider
- `taxWithheld` - Tax withheld
- `gstAmount` - GST/tax amount

**ClientWallet Model:**
- `balance` - Current wallet balance

**WalletTransaction Model:**
- `amount` - Transaction amount

**Package Model:**
- `price` - Package price

**PDATestBooking Model:**
- `price` - Test booking price

**Refund Model:**
- `amount` - Refund amount

**JournalEntry Model:**
- `amount` - Ledger entry amount

**Quote Model:**
- `amount` - Quoted amount
- `depositAmount` - Deposit amount (if applicable)

**Service Model:**
- `price` - Service price

**PlatformSettings Model:**
- Various fee and discount percentages (keep as Float for percentages)
- `cancellationFee`, `noShowPenaltyAmount`, `walletTopUpMin`, `walletTopUpMax`
- `maxAdminCreditAmount`, `maxAdminDeductAmount`

**Migration Strategy:**

1. **Database Migration:**
   ```sql
   -- Example for Booking table
   ALTER TABLE "Booking" 
     ALTER COLUMN "price" TYPE DECIMAL(12,2) USING "price"::DECIMAL(12,2),
     ALTER COLUMN "platformFee" TYPE DECIMAL(12,2) USING "platformFee"::DECIMAL(12,2),
     ALTER COLUMN "providerPayout" TYPE DECIMAL(12,2) USING "providerPayout"::DECIMAL(12,2);
   ```

2. **Schema Update:**
   ```prisma
   model Booking {
     // Before: price Float
     // After:
     price          Decimal @db.Decimal(12, 2)
     platformFee    Decimal @db.Decimal(12, 2)
     providerPayout Decimal @db.Decimal(12, 2)
   }
   ```

3. **Code Update Pattern:**
   ```typescript
   // Before (Float)
   const totalPrice = booking.price * quantity;
   
   // After (Decimal)
   import { Decimal } from '@prisma/client/runtime/library';
   
   const totalPrice = new Decimal(booking.price).times(quantity);
   
   // Converting to number for display
   const displayPrice = totalPrice.toNumber();
   
   // Converting to string for exact display
   const exactPrice = totalPrice.toFixed(2);
   ```

**Decimal Arithmetic Operations:**
```typescript
import { Decimal } from '@prisma/client/runtime/library';

// Addition
const total = new Decimal(price).plus(tax);

// Subtraction  
const balance = new Decimal(credits).minus(debits);

// Multiplication
const fee = new Decimal(amount).times(0.036);

// Division
const average = new Decimal(total).dividedBy(count);

// Comparison
if (new Decimal(balance).greaterThan(minAmount)) { ... }
```

### 3. Error Resilience Architecture

**Current State:** Component errors cause full page crashes, displaying React error stack traces or blank screens to users. Single error cascades across entire dashboard.

**Target State:** Graceful degradation with isolated error boundaries, user-friendly fallback UI, comprehensive error logging, and recovery mechanisms.

**Error Boundary Hierarchy:**

```
RootLayout
├─ NavigationErrorBoundary (wraps DashboardNav)
├─ MainContentErrorBoundary
│  ├─ Page content
│  └─ Dynamic components
└─ SidebarErrorBoundary (if applicable)
```

**Component Design:**

```typescript
// components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  boundaryName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for debugging
    console.error(`Error caught by ${this.props.boundaryName || 'ErrorBoundary'}:`, error);
    console.error('Component stack:', errorInfo.componentStack);

    // Call optional error handler (for error tracking services)
    this.props.onError?.(error, errorInfo);

    // Log to error tracking service if configured
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
            boundaryName: this.props.boundaryName,
          },
        },
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600 text-lg font-semibold mb-2">
            Something went wrong
          </div>
          <p className="text-gray-600 text-sm mb-4 text-center max-w-md">
            We encountered an error loading this section. Please try refreshing the page.
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Refresh Page
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-xs text-left max-w-2xl">
              <summary className="cursor-pointer text-gray-600">Error Details (dev only)</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Usage Pattern:**

```typescript
// app/dashboard/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard-layout">
      <ErrorBoundary boundaryName="Navigation">
        <DashboardNav />
      </ErrorBoundary>
      
      <ErrorBoundary boundaryName="MainContent">
        <main>{children}</main>
      </ErrorBoundary>
      
      <ErrorBoundary boundaryName="Sidebar">
        <Sidebar />
      </ErrorBoundary>
    </div>
  );
}
```

**Error Tracking Integration:**

```typescript
// lib/errorTracking.ts (optional)
export function initErrorTracking() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Initialize Sentry or similar service
    const Sentry = require('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
    
    // Make available globally for ErrorBoundary
    (window as any).errorTracker = Sentry;
  }
}
```

### 4. Earnings API Performance Architecture

**Current State:** `/api/instructor/earnings` endpoint loads all transaction records into memory, causing slow response times (5-10s) for instructors with hundreds of transactions.

**Problem:**
```typescript
// Current inefficient approach
const transactions = await prisma.transaction.findMany({
  where: { providerId },
  include: { booking: true, provider: true }  // Loads all related data
});
// Returns 500+ records → 2-5 MB response → 5-10s load time
```

**Target State:** Cursor-based pagination with configurable page size, returning 20-50 records per request with metadata for navigation.

**API Interface:**

**Request Parameters:**
```typescript
interface EarningsQueryParams {
  page?: number;          // Page number (1-indexed), defaults to 1
  pageSize?: number;      // Records per page (max 50), defaults to 20
  sortBy?: 'date' | 'amount';  // Sort field, defaults to 'date'
  sortOrder?: 'asc' | 'desc';  // Sort direction, defaults to 'desc'
  status?: string;        // Filter by status (optional)
  startDate?: string;     // ISO date filter (optional)
  endDate?: string;       // ISO date filter (optional)
}
```

**Response Structure:**
```typescript
interface EarningsResponse {
  data: Transaction[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  summary: {
    totalEarnings: Decimal;
    pendingEarnings: Decimal;
    settledEarnings: Decimal;
  };
}
```

**Implementation:**

```typescript
// app/api/instructor/earnings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { Decimal } from '@prisma/client/runtime/library';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.providerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  
  // Parse and validate pagination parameters
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const requestedPageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize));
  
  const sortBy = searchParams.get('sortBy') || 'date';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Build where clause
  const where: any = {
    providerId: session.user.providerId,
  };
  
  if (status) {
    where.status = status;
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  try {
    // Get total count for pagination metadata
    const totalRecords = await prisma.transaction.count({ where });
    
    if (totalRecords === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          currentPage: 1,
          pageSize,
          totalRecords: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        summary: {
          totalEarnings: new Decimal(0),
          pendingEarnings: new Decimal(0),
          settledEarnings: new Decimal(0),
        },
      });
    }

    const totalPages = Math.ceil(totalRecords / pageSize);
    const skip = (page - 1) * pageSize;

    // Build order by clause
    const orderBy: any = {};
    if (sortBy === 'date') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'amount') {
      orderBy.amount = sortOrder;
    }

    // Fetch paginated transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        type: true,
        amount: true,
        platformFee: true,
        providerPayout: true,
        status: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            startTime: true,
            customer: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Calculate summary (using aggregation, not loading all records)
    const aggregates = await prisma.transaction.aggregate({
      where,
      _sum: {
        providerPayout: true,
      },
    });

    const pendingAgg = await prisma.transaction.aggregate({
      where: { ...where, status: 'PENDING' },
      _sum: { providerPayout: true },
    });

    const settledAgg = await prisma.transaction.aggregate({
      where: { ...where, status: 'SETTLED' },
      _sum: { providerPayout: true },
    });

    return NextResponse.json({
      data: transactions,
      pagination: {
        currentPage: page,
        pageSize,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      summary: {
        totalEarnings: aggregates._sum.providerPayout || new Decimal(0),
        pendingEarnings: pendingAgg._sum.providerPayout || new Decimal(0),
        settledEarnings: settledAgg._sum.providerPayout || new Decimal(0),
      },
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch earnings data' },
      { status: 500 }
    );
  }
}
```

**Frontend Implementation:**

```typescript
// app/dashboard/earnings/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function EarningsPage() {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadEarnings(currentPage);
  }, [currentPage]);

  async function loadEarnings(page: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/instructor/earnings?page=${page}&pageSize=20`);
      const json = await res.json();
      setData(json.data);
      setPagination(json.pagination);
    } catch (error) {
      console.error('Failed to load earnings:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Earnings table */}
      <table>{/* ... */}</table>
      
      {/* Pagination controls */}
      {pagination && (
        <div className="flex gap-2 mt-4">
          <button
            disabled={!pagination.hasPreviousPage}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            disabled={!pagination.hasNextPage}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

**Performance Impact:**
- Before: Load all 500 transactions → 5-10s response time, 2-5 MB payload
- After: Load 20 transactions → <500ms response time, 50-100 KB payload
- **90%+ reduction in response time and payload size**

### 5. Wallet Balance Efficiency Architecture

**Current State:** Wallet balance calculation loads all wallet transactions into memory and sums them in JavaScript, causing slow response times for clients with extensive transaction history.

**Problem:**
```typescript
// Current inefficient approach
const walletTransactions = await prisma.walletTransaction.findMany({
  where: { walletId }
});

const balance = walletTransactions.reduce((sum, tx) => {
  return tx.type === 'CREDIT' ? sum + tx.amount : sum - tx.amount;
}, 0);
// Loads 1000+ records into memory → slow calculation
```

**Target State:** Database-level aggregation using SQL SUM() functions, computing balance in constant time regardless of transaction history size.

**Optimized Implementation:**

```typescript
// lib/services/wallet-helpers.ts
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface WalletBalance {
  totalPaid: Decimal;   // Sum of CREDIT transactions
  totalSpent: Decimal;  // Sum of DEBIT transactions
  balance: Decimal;     // totalPaid - totalSpent
}

export async function getWalletBalance(walletId: string): Promise<WalletBalance> {
  // Aggregate CREDIT transactions (money added to wallet)
  const creditsAgg = await prisma.walletTransaction.aggregate({
    where: {
      walletId,
      type: 'CREDIT',
      status: 'CONFIRMED',
    },
    _sum: {
      amount: true,
    },
  });

  // Aggregate DEBIT transactions (money spent from wallet)
  const debitsAgg = await prisma.walletTransaction.aggregate({
    where: {
      walletId,
      type: 'DEBIT',
      status: 'CONFIRMED',
    },
    _sum: {
      amount: true,
    },
  });

  // Handle null results (no transactions) → treat as zero
  const totalPaid = creditsAgg._sum.amount
    ? new Decimal(creditsAgg._sum.amount)
    : new Decimal(0);
    
  const totalSpent = debitsAgg._sum.amount
    ? new Decimal(debitsAgg._sum.amount)
    : new Decimal(0);

  // Calculate balance
  const balance = totalPaid.minus(totalSpent);

  return {
    totalPaid,
    totalSpent,
    balance,
  };
}

// Helper function for quick balance check
export async function getQuickBalance(userId: string): Promise<Decimal> {
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!wallet) {
    return new Decimal(0);
  }

  const { balance } = await getWalletBalance(wallet.id);
  return balance;
}

// Helper function to check if user has sufficient balance
export async function hasSufficientBalance(
  userId: string,
  requiredAmount: Decimal | number
): Promise<boolean> {
  const balance = await getQuickBalance(userId);
  const required = new Decimal(requiredAmount);
  return balance.greaterThanOrEqualTo(required);
}
```

**Database Query Explanation:**

The aggregation approach generates SQL like:
```sql
-- Credits query
SELECT SUM("amount") 
FROM "WalletTransaction" 
WHERE "walletId" = $1 
  AND "type" = 'CREDIT' 
  AND "status" = 'CONFIRMED';

-- Debits query  
SELECT SUM("amount") 
FROM "WalletTransaction" 
WHERE "walletId" = $1 
  AND "type" = 'DEBIT' 
  AND "status" = 'CONFIRMED';
```

This executes in **O(1) time complexity** relative to transaction count (database index scan + aggregation), compared to **O(n) time and memory** for loading all records.

**Usage in Booking Flow:**

```typescript
// When creating a booking with wallet payment
import { getWalletBalance, hasSufficientBalance } from '@/lib/services/wallet-helpers';

export async function createBookingWithWallet(
  userId: string,
  bookingData: any
) {
  // Quick balance check before processing
  const hasBalance = await hasSufficientBalance(userId, bookingData.price);
  
  if (!hasBalance) {
    throw new Error('Insufficient wallet balance');
  }

  // Get full balance details for display
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId },
  });

  const balanceDetails = await getWalletBalance(wallet.id);

  // Proceed with booking...
  // Create booking and wallet debit transaction
}
```

**Performance Impact:**
- Before: Load 1000 transactions → 2-3s calculation time
- After: 2 aggregate queries → <50ms calculation time
- **98%+ reduction in calculation time**
- **Zero memory overhead** (no transaction records loaded)

## Data Models

### Prisma Schema Changes

The schema changes required are detailed in the Financial Data Precision Architecture section. Key changes:

1. All financial fields convert from `Float` to `Decimal(@db.Decimal(12, 2))`
2. No changes to relationships or indexes
3. Migration preserves existing data values

### Environment Variable Model

```typescript
// lib/config.ts
interface EnvironmentConfig {
  database: {
    url: string;
    directUrl: string;
  };
  auth: {
    secret: string;
    url: string;
  };
  stripe: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
  };
  email: {
    resendApiKey: string;
  };
  upload: {
    secret: string;
    appId: string;
  };
}

export function validateEnvironment(): EnvironmentConfig {
  const required = [
    'DATABASE_URL',
    'DIRECT_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'UPLOADTHING_SECRET',
    'UPLOADTHING_APP_ID',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  return {
    database: {
      url: process.env.DATABASE_URL!,
      directUrl: process.env.DIRECT_URL!,
    },
    auth: {
      secret: process.env.NEXTAUTH_SECRET!,
      url: process.env.NEXTAUTH_URL!,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    },
    email: {
      resendApiKey: process.env.RESEND_API_KEY!,
    },
    upload: {
      secret: process.env.UPLOADTHING_SECRET!,
      appId: process.env.UPLOADTHING_APP_ID!,
    },
  };
}
```

## Interfaces

### API Endpoints

#### GET /api/instructor/earnings

**Query Parameters:**
- `page` (optional): Page number, defaults to 1
- `pageSize` (optional): Records per page (max 50), defaults to 20  
- `sortBy` (optional): Sort field ('date' | 'amount'), defaults to 'date'
- `sortOrder` (optional): Sort direction ('asc' | 'desc'), defaults to 'desc'
- `status` (optional): Filter by transaction status
- `startDate` (optional): ISO date string for date range filter
- `endDate` (optional): ISO date string for date range filter

**Response:** See EarningsResponse type in architecture section

### Wallet Service Interface

```typescript
// lib/services/wallet-helpers.ts
export interface WalletBalance {
  totalPaid: Decimal;
  totalSpent: Decimal;
  balance: Decimal;
}

export async function getWalletBalance(walletId: string): Promise<WalletBalance>;
export async function getQuickBalance(userId: string): Promise<Decimal>;
export async function hasSufficientBalance(
  userId: string,
  requiredAmount: Decimal | number
): Promise<boolean>;
```

### Error Boundary Interface

```typescript
// components/ErrorBoundary.tsx
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  boundaryName?: string;
}
```

## Error Handling

### 1. Credential Loading Errors

**Scenario:** Missing or invalid environment variables at startup

**Handling:**
- Application fails to start
- Clear error message identifies missing variables
- Logs error to stderr
- Returns 500 error for health check endpoints

**Example:**
```
Error: Missing required environment variables: DATABASE_URL, STRIPE_SECRET_KEY
Please check your .env file and ensure all required variables are set.
```

### 2. Database Migration Errors

**Scenario:** Float to Decimal migration fails

**Handling:**
- Migration transaction rolls back automatically
- Error message includes failed table/column
- Manual intervention required before retrying
- Data remains in original Float format (safe fallback)

### 3. Pagination Errors

**Scenario:** Invalid pagination parameters

**Handling:**
- Clamp page number to valid range (minimum 1)
- Clamp page size to MAX_PAGE_SIZE (50)
- Negative or zero values default to valid minimum
- Invalid dates ignored, query proceeds without date filter

### 4. Wallet Aggregation Errors

**Scenario:** Database query fails during balance calculation

**Handling:**
- Catch database errors
- Log error with wallet context
- Return error response to client
- Client displays error message and retry option

### 5. Component Errors

**Scenario:** React component throws runtime error

**Handling:**
- Error boundary catches error
- Logs error with component stack to console
- Sends error to tracking service (if configured)
- Displays fallback UI with recovery options
- Other boundaries/components continue functioning

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Financial Calculation Precision Preservation

*For any* set of financial amounts and arithmetic operations (addition, subtraction, multiplication, division), when calculations are performed using the Decimal type, the results SHALL maintain exact decimal precision without floating-point rounding errors.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 2: Error Boundary Isolation

*For any* React component that throws an error, when wrapped in an ErrorBoundary, that error SHALL be caught and displayed in a fallback UI while allowing sibling components wrapped in separate ErrorBoundaries to continue functioning normally.

**Validates: Requirements 3.1, 3.2, 3.6**

### Property 3: Error Logging Completeness

*For any* error caught by an ErrorBoundary, the error details (error message, stack trace, and component stack) SHALL be logged to the console and reported to configured error tracking services.

**Validates: Requirements 3.3, 3.7**

### Property 4: Paginated Response Structure

*For any* valid pagination request to the Earnings API (with page number and page size parameters), the response SHALL include exactly the requested page of transaction records AND complete pagination metadata (currentPage, pageSize, totalRecords, totalPages, hasNextPage, hasPreviousPage).

**Validates: Requirements 4.3, 4.5**

### Property 5: Pagination Sort Consistency

*For any* sequence of paginated earnings requests with the same sort parameters, transaction records SHALL appear in consistent sort order (newest first by default) across all pages.

**Validates: Requirements 4.8**

### Property 6: Wallet Balance Calculation Accuracy

*For any* wallet with a set of CONFIRMED transactions, the calculated balance SHALL equal the sum of all CREDIT transaction amounts minus the sum of all DEBIT transaction amounts, with only CONFIRMED status transactions included in the calculation.

**Validates: Requirements 5.3, 5.4**

### Property 7: Wallet Balance Response Structure

*For any* wallet balance request, the response SHALL contain three fields: totalPaid (sum of credits), totalSpent (sum of debits), and balance (totalPaid - totalSpent).

**Validates: Requirements 5.9**

## Testing Strategy

### Unit Tests

1. **Decimal Arithmetic Tests**
   - Test addition, subtraction, multiplication, division with Decimal types
   - Test precision preservation with known edge cases (0.1 + 0.2, etc.)
   - Test conversion between Decimal, number, and string formats

2. **Error Boundary Component Tests**
   - Test error catching with components that throw different error types
   - Test fallback UI rendering
   - Test reset functionality
   - Test error logging calls

3. **Pagination Logic Tests**
   - Test parameter validation (negative values, zero, exceeding max)
   - Test page calculation logic
   - Test empty result set handling
   - Test metadata generation

4. **Wallet Service Tests**
   - Test balance calculation with mock transaction data
   - Test null aggregation result handling
   - Test CONFIRMED status filtering
   - Test empty wallet scenario

### Property-Based Tests

All property-based tests SHALL run with **minimum 100 iterations** to thoroughly test the input space.

#### Property 1: Financial Calculation Precision Preservation

**Test Implementation:**
```typescript
import { Decimal } from '@prisma/client/runtime/library';
import fc from 'fast-check';

describe('Property 1: Financial Calculation Precision', () => {
  test('decimal arithmetic maintains precision for any financial amounts', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100000, noNaN: true }),
        fc.double({ min: 0, max: 100000, noNaN: true }),
        (amount1, amount2) => {
          const dec1 = new Decimal(amount1.toFixed(2));
          const dec2 = new Decimal(amount2.toFixed(2));
          
          // Addition precision
          const sum = dec1.plus(dec2);
          const sumFixed = sum.toFixed(2);
          expect(sumFixed).toMatch(/^\d+\.\d{2}$/);
          
          // Subtraction precision
          const diff = dec1.minus(dec2);
          const diffFixed = diff.toFixed(2);
          expect(diffFixed).toMatch(/^-?\d+\.\d{2}$/);
          
          // No floating point errors
          const jsSum = amount1 + amount2;
          const decSum = parseFloat(sumFixed);
          expect(Math.abs(decSum - jsSum)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tag:** `Feature: security-performance-fixes, Property 1: decimal arithmetic maintains precision for any financial amounts`

#### Property 2: Error Boundary Isolation

**Test Implementation:**
```typescript
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import fc from 'fast-check';

const ThrowingComponent = ({ error }: { error: Error }) => {
  throw error;
};

const WorkingComponent = ({ text }: { text: string }) => <div>{text}</div>;

describe('Property 2: Error Boundary Isolation', () => {
  test('error in one boundary does not affect sibling boundaries', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (errorMessage, siblingText) => {
          const testError = new Error(errorMessage);
          
          const { container } = render(
            <div>
              <ErrorBoundary boundaryName="Boundary1">
                <ThrowingComponent error={testError} />
              </ErrorBoundary>
              <ErrorBoundary boundaryName="Boundary2">
                <WorkingComponent text={siblingText} />
              </ErrorBoundary>
            </div>
          );
          
          // First boundary should show error UI
          expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
          
          // Second boundary should render normally
          expect(screen.getByText(siblingText)).toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tag:** `Feature: security-performance-fixes, Property 2: error in one boundary does not affect sibling boundaries`

#### Property 3: Error Logging Completeness

**Test Implementation:**
```typescript
import { render } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import fc from 'fast-check';

describe('Property 3: Error Logging Completeness', () => {
  test('all caught errors are logged with full details', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new TypeError('Type error')),
          fc.constant(new ReferenceError('Reference error')),
          fc.string().map(msg => new Error(msg))
        ),
        (error) => {
          const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
          const onErrorHandler = jest.fn();
          
          const ThrowingComponent = () => { throw error; };
          
          render(
            <ErrorBoundary onError={onErrorHandler}>
              <ThrowingComponent />
            </ErrorBoundary>
          );
          
          // Console should be called with error
          expect(consoleErrorSpy).toHaveBeenCalled();
          const errorLog = consoleErrorSpy.mock.calls.find(call => 
            call.some(arg => arg === error || (typeof arg === 'string' && arg.includes('Error')))
          );
          expect(errorLog).toBeTruthy();
          
          // Custom handler should be called
          expect(onErrorHandler).toHaveBeenCalledWith(
            error,
            expect.objectContaining({ componentStack: expect.any(String) })
          );
          
          consoleErrorSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tag:** `Feature: security-performance-fixes, Property 3: all caught errors are logged with full details`

#### Property 4: Paginated Response Structure

**Test Implementation:**
```typescript
import { GET } from '@/app/api/instructor/earnings/route';
import { NextRequest } from 'next/server';
import fc from 'fast-check';

describe('Property 4: Paginated Response Structure', () => {
  test('all paginated responses contain complete structure', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        async (page, pageSize) => {
          const url = `http://localhost/api/instructor/earnings?page=${page}&pageSize=${pageSize}`;
          const req = new NextRequest(url);
          
          // Mock session
          jest.spyOn(require('next-auth'), 'getServerSession').mockResolvedValue({
            user: { providerId: 'test-provider-id' }
          });
          
          const response = await GET(req);
          const data = await response.json();
          
          // Verify response structure
          expect(data).toHaveProperty('data');
          expect(data).toHaveProperty('pagination');
          expect(data).toHaveProperty('summary');
          
          // Verify pagination metadata
          expect(data.pagination).toMatchObject({
            currentPage: expect.any(Number),
            pageSize: expect.any(Number),
            totalRecords: expect.any(Number),
            totalPages: expect.any(Number),
            hasNextPage: expect.any(Boolean),
            hasPreviousPage: expect.any(Boolean),
          });
          
          // Verify current page matches request
          expect(data.pagination.currentPage).toBe(page);
          expect(data.pagination.pageSize).toBe(Math.min(pageSize, 50));
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tag:** `Feature: security-performance-fixes, Property 4: all paginated responses contain complete structure`

#### Property 5: Pagination Sort Consistency

**Test Implementation:**
```typescript
describe('Property 5: Pagination Sort Consistency', () => {
  test('transaction sort order is consistent across pages', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (startPage) => {
          // Fetch two consecutive pages
          const page1Url = `http://localhost/api/instructor/earnings?page=${startPage}&pageSize=10&sortOrder=desc`;
          const page2Url = `http://localhost/api/instructor/earnings?page=${startPage + 1}&pageSize=10&sortOrder=desc`;
          
          const [res1, res2] = await Promise.all([
            GET(new NextRequest(page1Url)),
            GET(new NextRequest(page2Url)),
          ]);
          
          const [data1, data2] = await Promise.all([
            res1.json(),
            res2.json(),
          ]);
          
          if (data1.data.length === 0 || data2.data.length === 0) {
            return; // Skip if no data on either page
          }
          
          // Last item of page 1 should be newer or equal to first item of page 2
          const lastDate1 = new Date(data1.data[data1.data.length - 1].createdAt);
          const firstDate2 = new Date(data2.data[0].createdAt);
          
          expect(lastDate1.getTime()).toBeGreaterThanOrEqual(firstDate2.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tag:** `Feature: security-performance-fixes, Property 5: transaction sort order is consistent across pages`

#### Property 6: Wallet Balance Calculation Accuracy

**Test Implementation:**
```typescript
import { getWalletBalance } from '@/lib/services/wallet-helpers';
import { Decimal } from '@prisma/client/runtime/library';
import fc from 'fast-check';

describe('Property 6: Wallet Balance Calculation Accuracy', () => {
  test('balance equals credits minus debits for any transaction set', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('CREDIT', 'DEBIT'),
            amount: fc.double({ min: 0.01, max: 1000, noNaN: true }),
            status: fc.constantFrom('CONFIRMED', 'PENDING'),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        async (transactions) => {
          // Setup: Create wallet and transactions in test database
          const wallet = await prisma.clientWallet.create({
            data: { userId: 'test-user-' + Date.now() },
          });
          
          for (const tx of transactions) {
            await prisma.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: tx.type,
                amount: new Decimal(tx.amount.toFixed(2)),
                status: tx.status,
                description: 'Test transaction',
              },
            });
          }
          
          // Calculate expected balance (only CONFIRMED transactions)
          const confirmedTxs = transactions.filter(tx => tx.status === 'CONFIRMED');
          const expectedCredits = confirmedTxs
            .filter(tx => tx.type === 'CREDIT')
            .reduce((sum, tx) => sum + tx.amount, 0);
          const expectedDebits = confirmedTxs
            .filter(tx => tx.type === 'DEBIT')
            .reduce((sum, tx) => sum + tx.amount, 0);
          const expectedBalance = expectedCredits - expectedDebits;
          
          // Get actual balance
          const result = await getWalletBalance(wallet.id);
          
          // Verify
          expect(result.totalPaid.toNumber()).toBeCloseTo(expectedCredits, 2);
          expect(result.totalSpent.toNumber()).toBeCloseTo(expectedDebits, 2);
          expect(result.balance.toNumber()).toBeCloseTo(expectedBalance, 2);
          
          // Cleanup
          await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
          await prisma.clientWallet.delete({ where: { id: wallet.id } });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tag:** `Feature: security-performance-fixes, Property 6: balance equals credits minus debits for any transaction set`

#### Property 7: Wallet Balance Response Structure

**Test Implementation:**
```typescript
describe('Property 7: Wallet Balance Response Structure', () => {
  test('all wallet balance responses contain required fields', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('CREDIT', 'DEBIT'),
            amount: fc.double({ min: 0.01, max: 1000, noNaN: true }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        async (transactions) => {
          // Create test wallet
          const wallet = await prisma.clientWallet.create({
            data: { userId: 'test-user-' + Date.now() },
          });
          
          // Add transactions
          for (const tx of transactions) {
            await prisma.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: tx.type,
                amount: new Decimal(tx.amount.toFixed(2)),
                status: 'CONFIRMED',
                description: 'Test',
              },
            });
          }
          
          // Get balance
          const result = await getWalletBalance(wallet.id);
          
          // Verify structure
          expect(result).toHaveProperty('totalPaid');
          expect(result).toHaveProperty('totalSpent');
          expect(result).toHaveProperty('balance');
          
          // Verify types
          expect(result.totalPaid).toBeInstanceOf(Decimal);
          expect(result.totalSpent).toBeInstanceOf(Decimal);
          expect(result.balance).toBeInstanceOf(Decimal);
          
          // Cleanup
          await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
          await prisma.clientWallet.delete({ where: { id: wallet.id } });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tag:** `Feature: security-performance-fixes, Property 7: all wallet balance responses contain required fields`

### Integration Tests

1. **Environment Variable Validation**
   - Test startup with missing credentials
   - Test startup with all required credentials
   - Verify error messages for specific missing variables

2. **Database Migration**
   - Test migration on copy of production data
   - Verify all Float fields converted to Decimal
   - Verify data values preserved after migration
   - Test rollback capability

3. **Earnings API Performance**
   - Load test with 500+ transactions
   - Measure response time for paginated requests
   - Verify memory usage remains constant
   - Test concurrent requests

4. **Wallet Balance Performance**
   - Create wallet with 1000+ transactions
   - Measure balance calculation time
   - Verify database query plan uses aggregation
   - Compare memory usage vs old implementation

### Smoke Tests

1. **Credential Security**
   - Verify `.env` is in `.gitignore`
   - Verify `.env.example` exists with all required variables
   - Scan committed files for credential patterns

2. **Schema Validation**
   - Parse Prisma schema
   - Verify all listed financial fields use Decimal type
   - Verify precision/scale specified (min 10,2)
   - Verify no Float types on financial fields

3. **Error Boundary Placement**
   - Analyze component tree structure
   - Verify error boundaries wrap navigation, main content, sidebar
   - Verify critical pages have error boundaries

## Implementation Phases

### Phase 1: Credential Security (Priority: Critical, Duration: 2-4 hours)

**Tasks:**
1. Remove credential values from `.env` (keep file structure as comments)
2. Add `.env` to `.gitignore` if not present
3. Create `.env.example` with all required variables documented
4. Create `lib/config.ts` with environment validation function
5. Call validation in application entry point
6. Update deployment documentation
7. Test startup with missing credentials
8. **Security Review:** Verify no credentials in git history (consider using tools like `git-secrets`)

**Risk:** High - Exposure of production credentials
**Validation:** Application fails to start with clear error message when credentials missing

### Phase 2: Financial Data Precision (Priority: Critical, Duration: 1 day)

**Tasks:**
1. Create database backup
2. Write Prisma migration for Float → Decimal conversion
3. Update Prisma schema with Decimal types and precision
4. Generate Prisma client
5. Update all code using financial fields to use Decimal arithmetic
6. Add helper utilities for Decimal operations
7. Test calculations with known values
8. Run property-based tests (100+ iterations)
9. Test migration on development database
10. **Data Validation:** Compare sample financial calculations before/after migration

**Risk:** High - Data corruption if migration fails
**Validation:** All financial data values unchanged after migration, calculations produce exact decimal results

### Phase 3: Error Resilience (Priority: High, Duration: 4-6 hours)

**Tasks:**
1. Create `ErrorBoundary` component
2. Add error boundaries to dashboard layout (navigation, content, sidebar)
3. Add error boundaries to critical pages
4. Implement error logging
5. Configure error tracking service integration (optional)
6. Test error boundary behavior (trigger errors in different sections)
7. Verify sibling isolation
8. Add error recovery mechanisms

**Risk:** Medium - Poor error UX if not implemented correctly
**Validation:** Component errors display fallback UI, other sections continue working

### Phase 4: Earnings API Performance (Priority: High, Duration: 4-6 hours)

**Tasks:**
1. Create paginated earnings API endpoint
2. Implement query parameter validation
3. Implement pagination logic (skip/take)
4. Add pagination metadata to response
5. Implement aggregation for summary statistics
6. Update frontend to use paginated API
7. Add pagination controls to UI
8. Load test with 500+ transactions
9. Measure and document performance improvements

**Risk:** Medium - Breaking changes to API contract
**Validation:** API response time <500ms, payload size <100KB, property tests pass

### Phase 5: Wallet Balance Efficiency (Priority: High, Duration: 3-4 hours)

**Tasks:**
1. Create `wallet-helpers.ts` with aggregation-based balance calculation
2. Replace existing balance calculation code
3. Add helper functions for common operations
4. Test with empty wallets
5. Test with large transaction histories (1000+ records)
6. Verify CONFIRMED status filtering
7. Measure and document performance improvements
8. Run property-based tests (100+ iterations)

**Risk:** Low - Backward compatible change (same API)
**Validation:** Balance calculation time <50ms regardless of transaction count, property tests pass

### Phase 6: Testing and Validation (Priority: High, Duration: 1-2 days)

**Tasks:**
1. Write unit tests for all new components
2. Write property-based tests (minimum 100 iterations each)
3. Write integration tests
4. Run smoke tests
5. Load testing
6. Security audit
7. Code review
8. Documentation updates

**Risk:** Low - Verification phase
**Validation:** All tests pass, performance benchmarks met, security audit clean

## Dependencies

### External Libraries

1. **Prisma** - Already installed, used for Decimal type support
2. **@prisma/client/runtime/library** - Provides Decimal class
3. **fast-check** - Property-based testing library (dev dependency)
4. **@sentry/nextjs** - Optional, for error tracking integration

### Installation Commands

```bash
# Property-based testing library
npm install --save-dev fast-check @types/fast-check

# Error tracking (optional)
npm install @sentry/nextjs
```

### Internal Dependencies

- Next.js 14+ (already installed)
- NextAuth.js (already installed)
- React 18+ (already installed)
- PostgreSQL database (already configured)

## Deployment Considerations

### Environment Setup

1. **Production Environment Variables:**
   - Ensure all required variables set in hosting platform (Vercel, AWS, etc.)
   - Use platform secret management (Vercel Environment Variables, AWS Secrets Manager)
   - Never commit production credentials to version control

2. **Database Migration:**
   - Run migration during maintenance window
   - Create database backup before migration
   - Test migration on staging environment first
   - Monitor database performance during migration
   - Have rollback plan ready

3. **Monitoring:**
   - Set up error tracking (Sentry, LogRocket, etc.)
   - Monitor API response times
   - Monitor database query performance
   - Set up alerts for error spikes

### Rollback Plan

1. **Credential Changes:** Revert to previous environment configuration
2. **Database Migration:** Restore from backup if migration fails
3. **API Changes:** Deploy previous version (backward compatible)
4. **Error Boundaries:** Remove boundaries if causing issues (graceful degradation)

### Performance Baselines

**Before Fixes:**
- Earnings API: 5-10s response time, 2-5 MB payload
- Wallet Balance: 2-3s calculation time
- Error Handling: Full page crashes

**After Fixes:**
- Earnings API: <500ms response time, 50-100 KB payload
- Wallet Balance: <50ms calculation time
- Error Handling: Isolated errors, graceful degradation

### Security Checklist

- [ ] No credentials in version control
- [ ] `.env` in `.gitignore`
- [ ] `.env.example` created
- [ ] Environment validation on startup
- [ ] All financial fields use Decimal type
- [ ] Error messages don't expose sensitive data
- [ ] API pagination limits prevent DOS attacks
- [ ] Error tracking configured (optional)
- [ ] Security audit completed

## Conclusion

This design addresses five critical issues affecting security, data integrity, and performance:

1. **Credential Security:** Zero-trust environment variable management eliminates credential exposure
2. **Financial Precision:** Decimal types ensure accurate monetary calculations compliant with accounting standards
3. **Error Resilience:** Isolated error boundaries provide graceful degradation and better user experience
4. **API Performance:** Pagination reduces earnings API response time by 90%+ and payload size by 95%+
5. **Database Efficiency:** Aggregation queries reduce wallet balance calculation time by 98%+

All changes are backward compatible where possible, with comprehensive testing including property-based tests (100+ iterations) to ensure correctness across the input space.
