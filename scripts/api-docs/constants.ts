/**
 * Shared constants and configuration for the API Documentation System
 */

import path from 'path';

// ============================================================================
// Project Paths
// ============================================================================

export const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const API_DIR = path.join(PROJECT_ROOT, 'app', 'api');
export const DOCS_DIR = path.join(PROJECT_ROOT, 'docs', 'DOCROLEBASE', '08-technical');
export const SPEC_DIR = path.join(PROJECT_ROOT, '.kiro', 'specs', 'api-documentation-update');

// ============================================================================
// Output Paths
// ============================================================================

export const ROUTE_REGISTRY_PATH = path.join(SPEC_DIR, 'route-registry.json');
export const API_REFERENCE_PATH = path.join(DOCS_DIR, 'API_REFERENCE.md');
export const VALIDATION_REPORT_PATH = path.join(SPEC_DIR, 'validation-report.json');

// ============================================================================
// API Documentation Configuration
// ============================================================================

export const BASE_URL = 'https://drivebook.com.au/api';

export const STANDARD_ERROR_FORMAT = `All endpoints return errors in a consistent format:

\`\`\`json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error description"
}
\`\`\`

Common HTTP status codes:
- **200 OK**: Successful request
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required or invalid
- **403 Forbidden**: Authenticated but not authorized for this resource
- **404 Not Found**: Resource does not exist
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error (rare, logged for investigation)`;

export const RATE_LIMITS_INFO = [
  { category: 'Financial operations', limit: '10 req/min' },
  { category: 'Authentication', limit: '20 req/min' },
  { category: 'File uploads', limit: '5 req/min' },
  { category: 'Email operations', limit: '10 req/min' },
  { category: 'General API', limit: '100 req/min' }
];

export const VALIDATION_INFO = `Request validation is performed using Zod schemas. Validation errors return:

\`\`\`json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
\`\`\``;

export const RELATED_DOCS = [
  {
    title: 'Booking System Documentation',
    path: '../BOOKING_SYSTEM.md',
    description: 'Detailed documentation of the booking workflow and business logic'
  },
  {
    title: 'Subscription System Documentation',
    path: '../SUBSCRIPTION_SYSTEM.md',
    description: 'Stripe integration and subscription management'
  },
  {
    title: 'Authentication & Authorization',
    path: '../AUTH_SYSTEM.md',
    description: 'NextAuth configuration and role-based access control'
  }
];

// ============================================================================
// Category Configuration
// ============================================================================

/**
 * Standard category order for documentation
 * Categories not listed here will be added alphabetically after these
 */
export const CATEGORY_ORDER = [
  'Auth',
  'Admin',
  'Bookings (Instructor)',
  'Bookings (Client)',
  'Calendar',
  'Clients',
  'Dashboard',
  'Mobile',
  'Public',
  'Webhooks'
];

/**
 * Category descriptions
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Auth': 'Authentication and session management endpoints',
  'Admin': 'Administrative endpoints requiring ADMIN role',
  'Bookings (Instructor)': 'Booking management for instructors',
  'Bookings (Client)': 'Booking management for clients',
  'Calendar': 'Calendar and availability management',
  'Clients': 'Client profile and data management',
  'Dashboard': 'Dashboard data and analytics',
  'Mobile': 'Mobile app-specific endpoints with JWT authentication',
  'Public': 'Publicly accessible endpoints (no authentication required)',
  'Webhooks': 'External service webhook handlers (Stripe, Twilio, etc.)'
};

// ============================================================================
// Authentication Display Mapping
// ============================================================================

/**
 * Map auth types to display strings for documentation
 */
export const AUTH_DISPLAY: Record<string, string> = {
  'ADMIN': '🔐 ADMIN',
  'INSTRUCTOR': '🔐 INSTRUCTOR',
  'CLIENT': '🔐 CLIENT',
  'INSTRUCTOR|CLIENT': '🔐 INSTRUCTOR/CLIENT',
  'JWT': '🔑 JWT',
  'CRON_SECRET': '⏰ CRON',
  'WEBHOOK_SIG': '🔔 Webhook',
  'PUBLIC': '—'
};

// ============================================================================
// Glossary Terms
// ============================================================================

/**
 * Glossary terms for terminology consistency checking
 */
export const GLOSSARY_TERMS: Record<string, string> = {
  'api_documentation': 'The API_REFERENCE.md file located in docs/DOCROLEBASE/08-technical/',
  'api_route': 'An HTTP endpoint defined in the app/api/ directory',
  'route_category': 'A logical grouping of related API routes',
  'route_specification': 'Documentation entry for an API route',
  'authentication_requirement': 'The role or session type required to access an endpoint',
  'documentation_system': 'The collection of markdown files describing the platform',
  'api_directory': 'The app/api/ directory containing all Next.js API route handlers',
  'route_discovery': 'The process of identifying all API routes by scanning',
  'documentation_completeness': 'The measure of whether all routes have documentation',
  'request_schema': 'The structure and validation rules for request data',
  'response_schema': 'The structure and format of response data',
  'error_response_format': 'The standardized structure for error messages'
};

// ============================================================================
// AST Parsing Configuration
// ============================================================================

/**
 * Authentication patterns to detect in AST
 */
export const AUTH_PATTERNS = {
  NEXT_AUTH: 'getServerSession',
  JWT_VERIFY: ['jwt.verify', 'verify'],
  CRON_SECRET: 'CRON_SECRET',
  STRIPE_SIGNATURE: ['stripe-signature', 'stripe.webhooks.constructEvent']
};

/**
 * Role check patterns
 */
export const ROLE_PATTERNS = {
  ADMIN: ['role === "ADMIN"', 'role === Role.ADMIN', 'roles.includes("ADMIN")'],
  INSTRUCTOR: ['role === "INSTRUCTOR"', 'role === Role.INSTRUCTOR', 'roles.includes("INSTRUCTOR")'],
  CLIENT: ['role === "CLIENT"', 'role === Role.CLIENT', 'roles.includes("CLIENT")']
};

// ============================================================================
// Validation Configuration
// ============================================================================

/**
 * Maximum length for route descriptions in tables
 */
export const MAX_DESCRIPTION_LENGTH = 120;

/**
 * Minimum property-based test iterations
 */
export const MIN_PBT_ITERATIONS = 100;

/**
 * Validation thresholds
 */
export const VALIDATION_THRESHOLDS = {
  MIN_COVERAGE_PERCENTAGE: 90,
  MAX_UNDOCUMENTED_ROUTES: 10
};

// ============================================================================
// Debug and Development
// ============================================================================

/**
 * Enable debug logging
 */
export const DEBUG = process.env.DEBUG === 'true';

/**
 * Skip certain validations in development
 */
export const SKIP_SLOW_VALIDATIONS = process.env.NODE_ENV === 'development';
