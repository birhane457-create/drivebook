# Design Document: API Documentation Update

## Overview

This design describes a comprehensive system for updating and maintaining the DriveBook API documentation. The system consists of three main components: a **Route Discovery Tool** that scans the codebase to identify all API routes, a **Documentation Generator** that creates and updates route specifications, and a **Documentation Validator** that ensures completeness and consistency.

The approach prioritizes automation and maintainability, using static analysis to discover routes and their characteristics, then generating standardized documentation that can be easily kept in sync with the codebase.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Documentation System                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐       ┌───────────────────┐              │
│  │  Route Discovery │──────▶│   Route Metadata  │              │
│  │      Tool        │       │     Extractor     │              │
│  └──────────────────┘       └───────────────────┘              │
│          │                            │                          │
│          │                            ▼                          │
│          │                   ┌────────────────┐                 │
│          │                   │ Route Registry │                 │
│          │                   │  (JSON cache)  │                 │
│          │                   └────────────────┘                 │
│          │                            │                          │
│          ▼                            ▼                          │
│  ┌──────────────────┐       ┌───────────────────┐              │
│  │   Documentation  │◀──────│    Documentation  │              │
│  │    Generator     │       │     Validator     │              │
│  └──────────────────┘       └───────────────────┘              │
│          │                            │                          │
│          ▼                            ▼                          │
│  ┌─────────────────────────────────────────┐                   │
│  │       API_REFERENCE.md (output)         │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Descriptions

#### 1. Route Discovery Tool
**Responsibility:** Scan the `app/api/` directory to identify all API route files and extract basic route information.

**Implementation:**
- Recursively traverses the `app/api/` directory structure
- Identifies Next.js route files (`route.ts`, `route.js`, `[...nextauth]/route.ts`, etc.)
- Maps directory structure to URL paths following Next.js conventions:
  - `app/api/bookings/route.ts` → `/api/bookings`
  - `app/api/bookings/[id]/route.ts` → `/api/bookings/[id]`
  - `app/api/auth/[...nextauth]/route.ts` → `/api/auth/[...nextauth]`
- Detects HTTP methods by looking for exported handler functions (GET, POST, PUT, PATCH, DELETE)
- Categorizes routes based on top-level directory (e.g., `/api/admin/*` → "Admin" category)

**Output:** JSON array of discovered routes with path, methods, file location, and category

**Technology:** Node.js script using `fs` and `path` modules

#### 2. Route Metadata Extractor
**Responsibility:** Analyze route source code to extract authentication requirements, request/response schemas, and other metadata.

**Implementation:**
- Parses TypeScript/JavaScript AST using `@typescript-eslint/parser` or Babel
- Detects authentication patterns:
  - `getServerSession()` calls → INSTRUCTOR/CLIENT/ADMIN (determined by role checks)
  - `Authorization: Bearer` header checks → JWT
  - `CRON_SECRET` environment variable checks → CRON_SECRET
  - Stripe signature verification → Stripe sig
  - No auth checks → Public (—)
- Extracts Zod schema definitions:
  - Identifies `z.object()` declarations
  - Extracts field names, types, and validation rules (`.min()`, `.max()`, `.email()`, etc.)
  - Distinguishes between request body, query params, and path params based on schema usage
- Identifies response formats by analyzing return statements
- Detects ownership verification patterns (e.g., `booking.instructorId === session.user.id`)

**Output:** Enhanced route metadata with auth requirements, schemas, and special handling

**Technology:** TypeScript with AST parsing libraries

#### 3. Route Registry
**Responsibility:** Store discovered and analyzed route data for use by other components.

**Implementation:**
- JSON file stored in `.kiro/specs/api-documentation-update/route-registry.json`
- Structure:
```typescript
interface RouteRegistry {
  generatedAt: string;
  totalRoutes: number;
  routes: Array<{
    path: string;
    methods: string[];
    category: string;
    filePath: string;
    auth: string;
    description?: string;
    requestSchema?: SchemaDefinition;
    responseSchema?: SchemaDefinition;
    errorCodes?: ErrorCode[];
    ownershipCheck?: boolean;
    isDeprecated?: boolean;
    isNewlyAdded?: boolean;
  }>;
}
```

**Update Strategy:** Regenerated on each documentation update run

#### 4. Documentation Generator
**Responsibility:** Transform route registry data into formatted markdown documentation.

**Implementation:**
- Reads route registry JSON
- Groups routes by category
- For each category:
  - Creates markdown section with heading
  - Generates route table with columns: Method | Route | Auth | Description
  - Sorts routes alphabetically by path within each category
  - For routes with detailed schemas, adds subsections with:
    - Request/response examples in JSON code blocks
    - Field documentation tables
    - Error code listings
- Maintains document structure:
  - Status indicator (✅ Complete / ⚠️ Partially Complete)
  - Last updated timestamp
  - Base URL
  - Table of contents (for large documents)
  - Standard sections (Error Responses, Rate Limits, Validation, Related Docs)
- Marks newly added routes with 🆕 indicator
- Marks deprecated routes with ~~strikethrough~~ and deprecation notice

**Template Structure:**
```markdown
# API Reference

**Status:** [status]
**Last Updated:** [date]
**Note:** [coverage note]

Base URL: `https://drivebook.com.au/api`

---

## [Category Name]

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| [method] | `[path]` | [auth] | [description] |

### [Detailed Route Title] — Request Body

`[METHOD] [path]`

```json
{ [request example] }
```

[Field documentation table]

### [Detailed Route Title] — Response

```json
{ [response example] }
```

[Field documentation table]

---

[Repeat for all categories]

---

## Error Responses
## Rate Limits
## Validation
## Related
```

**Output:** Updated `API_REFERENCE.md` file

**Technology:** TypeScript with template generation

#### 5. Documentation Validator
**Responsibility:** Ensure documentation meets all requirements for completeness, consistency, and quality.

**Implementation:**
- Compares route registry against documentation to identify:
  - Undocumented routes
  - Routes missing required fields (method, path, auth, description)
  - Inconsistent formatting
  - Missing schemas for routes that accept/return data
  - Broken internal links
  - Terminology inconsistencies (checks against glossary)
- Validates structure:
  - Required metadata present (status, last updated, base URL)
  - Categories properly formatted with headers and tables
  - Alphabetical ordering within categories
  - JSON examples are valid JSON
  - Markdown syntax is correct
- Generates validation report with:
  - Coverage percentage (documented/total routes)
  - List of validation errors and warnings
  - Suggestions for improvement

**Output:** Validation report (JSON and human-readable markdown)

**Technology:** TypeScript with markdown parsing (unified/remark)

### Data Flow

1. **Discovery Phase:**
   - User runs: `npm run docs:api:discover`
   - Route Discovery Tool scans `app/api/`
   - Route Metadata Extractor analyzes each route file
   - Route Registry is created/updated

2. **Generation Phase:**
   - User runs: `npm run docs:api:generate`
   - Documentation Generator reads Route Registry
   - Applies templates and formatting rules
   - Writes updated `API_REFERENCE.md`

3. **Validation Phase:**
   - User runs: `npm run docs:api:validate`
   - Documentation Validator compares registry to docs
   - Generates validation report
   - Exits with error code if validation fails (for CI/CD)

4. **Combined Workflow:**
   - User runs: `npm run docs:api:update`
   - Executes discovery → generation → validation in sequence

## Data Models

### RouteMetadata
```typescript
interface RouteMetadata {
  path: string;                    // e.g., "/api/bookings/[id]"
  methods: HttpMethod[];           // ["GET", "PATCH"]
  category: string;                // e.g., "Bookings (Instructor)"
  filePath: string;                // Relative path to route file
  auth: AuthRequirement;           // Auth type and required roles
  description: string;             // Human-readable description
  requestSchema?: SchemaDefinition;
  responseSchema?: SchemaDefinition;
  errorCodes?: ErrorCode[];
  ownershipCheck?: boolean;        // True if route verifies ownership
  isDeprecated?: boolean;
  deprecationReason?: string;
  isNewlyAdded?: boolean;          // True for routes added since last review
  relatedDocs?: string[];          // Links to related documentation
}

enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE"
}

interface AuthRequirement {
  type: "NextAuth" | "JWT" | "CronSecret" | "WebhookSignature" | "Public";
  roles?: ("ADMIN" | "INSTRUCTOR" | "CLIENT")[];
  description?: string;            // e.g., "Authorization: Bearer <CRON_SECRET>"
}

interface SchemaDefinition {
  type: "RequestBody" | "QueryParams" | "PathParams" | "Response";
  fields: SchemaField[];
  example: object;                 // JSON example
}

interface SchemaField {
  name: string;
  type: string;                    // "string", "number", "boolean", "object", etc.
  required: boolean;
  validation?: ValidationRule[];
  description?: string;
  example?: any;
}

interface ValidationRule {
  type: "min" | "max" | "email" | "url" | "regex" | "enum";
  value: any;
  message?: string;
}

interface ErrorCode {
  code: string;                    // e.g., "UNAUTHORIZED"
  httpStatus: number;              // e.g., 401
  description: string;
  conditions: string;              // When this error occurs
  example?: object;                // JSON error response example
}
```

### Documentation Structure
```typescript
interface APIDocumentation {
  metadata: {
    status: "Complete" | "Partially Complete" | "In Progress";
    lastUpdated: string;           // ISO date
    baseUrl: string;
    totalRoutes: number;
    documentedRoutes: number;
  };
  categories: DocumentationCategory[];
  errorResponseFormat: string;     // Standard error format description
  rateLimits: RateLimitRule[];
  validationInfo: string;          // General validation description
  relatedDocs: RelatedDocLink[];
}

interface DocumentationCategory {
  name: string;                    // e.g., "Admin"
  description?: string;
  routes: RouteDocumentation[];
}

interface RouteDocumentation {
  method: HttpMethod;
  path: string;
  auth: string;                    // Display string, e.g., "ADMIN"
  description: string;
  isNew?: boolean;                 // Shows 🆕 indicator
  isDeprecated?: boolean;
  detailedDocs?: {
    requestBody?: string;          // Markdown section
    responseFormat?: string;       // Markdown section
    errorCodes?: string;           // Markdown section
    examples?: string;             // Markdown section
  };
}

interface RateLimitRule {
  category: string;                // e.g., "Financial operations"
  limit: string;                   // e.g., "10 req/min"
}

interface RelatedDocLink {
  title: string;
  path: string;                    // Relative path
  description?: string;
}
```

### Validation Report
```typescript
interface ValidationReport {
  timestamp: string;
  overallStatus: "PASS" | "FAIL";
  coverage: {
    totalRoutes: number;
    documentedRoutes: number;
    percentage: number;
  };
  errors: ValidationError[];       // Must be fixed
  warnings: ValidationWarning[];   // Should be fixed
  suggestions: string[];           // Nice to have
}

interface ValidationError {
  type: "UNDOCUMENTED_ROUTE" | "MISSING_FIELD" | "INVALID_FORMAT" | 
        "BROKEN_LINK" | "INCONSISTENT_TERMINOLOGY";
  severity: "ERROR";
  message: string;
  location?: string;               // File path or route path
  suggestion?: string;
}

interface ValidationWarning {
  type: "MISSING_SCHEMA" | "INCOMPLETE_ERROR_DOCS" | 
        "SORTING_ISSUE" | "DEPRECATED_UNMARKED";
  severity: "WARNING";
  message: string;
  location?: string;
  suggestion?: string;
}
```

## Implementation Details

### Route Discovery Algorithm

```typescript
async function discoverRoutes(apiDir: string): Promise<RouteMetadata[]> {
  const routes: RouteMetadata[] = [];
  
  // Recursively find all route files
  const routeFiles = await findRouteFiles(apiDir);
  
  for (const filePath of routeFiles) {
    // Convert file path to URL path
    // e.g., app/api/bookings/[id]/route.ts → /api/bookings/[id]
    const urlPath = filePathToUrlPath(filePath);
    
    // Determine category from top-level directory
    const category = getCategoryFromPath(urlPath);
    
    // Read and parse the file
    const sourceCode = await fs.readFile(filePath, 'utf-8');
    const ast = parseTypeScript(sourceCode);
    
    // Extract metadata from AST
    const methods = extractHttpMethods(ast);
    const auth = extractAuthRequirement(ast);
    const requestSchema = extractRequestSchema(ast);
    const responseSchema = extractResponseSchema(ast);
    const errorCodes = extractErrorCodes(ast);
    const ownershipCheck = detectOwnershipVerification(ast);
    
    // Try to extract description from comments
    const description = extractDescription(ast, sourceCode);
    
    routes.push({
      path: urlPath,
      methods,
      category,
      filePath: relativePath(filePath, projectRoot),
      auth,
      description: description || `[TODO: Add description]`,
      requestSchema,
      responseSchema,
      errorCodes,
      ownershipCheck,
      isNewlyAdded: isNewRoute(urlPath, previousRegistry)
    });
  }
  
  return routes;
}

function extractAuthRequirement(ast: AST): AuthRequirement {
  // Look for authentication patterns in the code
  
  // Pattern 1: NextAuth session
  if (hasCallExpression(ast, 'getServerSession')) {
    const roleChecks = findRoleChecks(ast);
    if (roleChecks.includes('ADMIN')) {
      return { type: 'NextAuth', roles: ['ADMIN'] };
    }
    if (roleChecks.includes('INSTRUCTOR')) {
      return { type: 'NextAuth', roles: ['INSTRUCTOR'] };
    }
    if (roleChecks.includes('CLIENT')) {
      return { type: 'NextAuth', roles: ['CLIENT'] };
    }
    return { type: 'NextAuth', roles: ['INSTRUCTOR', 'CLIENT'] };
  }
  
  // Pattern 2: JWT token
  if (hasHeaderCheck(ast, 'Authorization', 'Bearer') && 
      hasCallExpression(ast, 'jwt.verify')) {
    return { type: 'JWT', description: 'JWT token in Authorization header' };
  }
  
  // Pattern 3: CRON_SECRET
  if (hasEnvVarCheck(ast, 'CRON_SECRET')) {
    return { 
      type: 'CronSecret', 
      description: 'Authorization: Bearer <CRON_SECRET>' 
    };
  }
  
  // Pattern 4: Webhook signature
  if (hasHeaderCheck(ast, 'stripe-signature') ||
      hasCallExpression(ast, 'stripe.webhooks.constructEvent')) {
    return { 
      type: 'WebhookSignature', 
      description: 'Stripe signature verification' 
    };
  }
  
  // No authentication found
  return { type: 'Public' };
}

function extractRequestSchema(ast: AST): SchemaDefinition | undefined {
  // Look for Zod schema definitions
  const zodSchemas = findZodSchemas(ast);
  
  // Find the schema used for request validation
  const requestSchema = zodSchemas.find(schema => 
    isUsedForValidation(schema, ast)
  );
  
  if (!requestSchema) return undefined;
  
  // Parse Zod schema into our schema definition format
  const fields = parseZodFields(requestSchema);
  const example = generateExampleFromSchema(fields);
  
  return {
    type: determineSchemaType(requestSchema, ast), // RequestBody | QueryParams
    fields,
    example
  };
}
```

### Documentation Generation Algorithm

```typescript
async function generateDocumentation(
  registry: RouteRegistry
): Promise<string> {
  const sections: string[] = [];
  
  // Header
  sections.push(generateHeader(registry));
  
  // Group routes by category
  const categorizedRoutes = groupByCategory(registry.routes);
  
  // Sort categories (standard order, then alphabetical)
  const sortedCategories = sortCategories(Object.keys(categorizedRoutes));
  
  // Generate each category section
  for (const category of sortedCategories) {
    const routes = categorizedRoutes[category];
    sections.push(generateCategorySection(category, routes));
  }
  
  // Standard sections
  sections.push(generateErrorResponsesSection());
  sections.push(generateRateLimitsSection());
  sections.push(generateValidationSection());
  sections.push(generateRelatedDocsSection());
  
  return sections.join('\n\n---\n\n');
}

function generateCategorySection(
  category: string, 
  routes: RouteMetadata[]
): string {
  const lines: string[] = [];
  
  // Category heading
  lines.push(`## ${category}`);
  lines.push('');
  
  // Route table header
  lines.push('| Method | Route | Auth | Description |');
  lines.push('|--------|-------|------|-------------|');
  
  // Sort routes alphabetically
  const sortedRoutes = routes.sort((a, b) => 
    a.path.localeCompare(b.path)
  );
  
  // Route table rows
  for (const route of sortedRoutes) {
    const methods = route.methods.join('/');
    const authDisplay = formatAuthForTable(route.auth);
    const description = formatDescription(route.description, route);
    
    lines.push(
      `| ${methods} | \`${route.path}\` | ${authDisplay} | ${description} |`
    );
  }
  
  lines.push('');
  
  // Detailed documentation for routes with schemas
  for (const route of sortedRoutes) {
    if (route.requestSchema || route.responseSchema) {
      lines.push(generateDetailedRouteDoc(route));
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

function formatDescription(
  description: string, 
  route: RouteMetadata
): string {
  let formatted = description;
  
  // Add indicators
  if (route.isNewlyAdded) {
    formatted = `🆕 ${formatted}`;
  }
  if (route.isDeprecated) {
    formatted = `~~${formatted}~~ (deprecated: ${route.deprecationReason})`;
  }
  
  return formatted;
}

function generateDetailedRouteDoc(route: RouteMetadata): string {
  const sections: string[] = [];
  
  // Request body documentation
  if (route.requestSchema) {
    sections.push(`### ${getRouteTitle(route)} — Request Body`);
    sections.push('');
    sections.push(`\`${route.methods[0]} ${route.path}\``);
    sections.push('');
    sections.push('```json');
    sections.push(JSON.stringify(route.requestSchema.example, null, 2));
    sections.push('```');
    sections.push('');
    
    // Field documentation table
    if (route.requestSchema.fields.length > 0) {
      sections.push(generateFieldTable(route.requestSchema.fields));
      sections.push('');
    }
  }
  
  // Response documentation
  if (route.responseSchema) {
    sections.push(`### ${getRouteTitle(route)} — Response`);
    sections.push('');
    sections.push('```json');
    sections.push(JSON.stringify(route.responseSchema.example, null, 2));
    sections.push('```');
    sections.push('');
    
    if (route.responseSchema.fields.length > 0) {
      sections.push(generateFieldTable(route.responseSchema.fields));
      sections.push('');
    }
  }
  
  // Error codes
  if (route.errorCodes && route.errorCodes.length > 0) {
    sections.push(`### ${getRouteTitle(route)} — Error Codes`);
    sections.push('');
    sections.push('| Code | HTTP Status | Description | Conditions |');
    sections.push('|------|-------------|-------------|------------|');
    
    for (const error of route.errorCodes) {
      sections.push(
        `| ${error.code} | ${error.httpStatus} | ${error.description} | ${error.conditions} |`
      );
    }
    sections.push('');
  }
  
  return sections.join('\n');
}
```

### Validation Algorithm

```typescript
async function validateDocumentation(
  registry: RouteRegistry,
  documentationPath: string
): Promise<ValidationReport> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];
  
  // Parse existing documentation
  const docContent = await fs.readFile(documentationPath, 'utf-8');
  const parsedDoc = parseMarkdownDoc(docContent);
  
  // Check 1: All routes are documented
  for (const route of registry.routes) {
    if (!isRouteDocumented(route, parsedDoc)) {
      errors.push({
        type: 'UNDOCUMENTED_ROUTE',
        severity: 'ERROR',
        message: `Route not found in documentation: ${route.path}`,
        location: route.path,
        suggestion: `Add documentation for ${route.methods.join('/')} ${route.path} in the ${route.category} section`
      });
    }
  }
  
  // Check 2: All documented routes have required fields
  for (const docRoute of parsedDoc.routes) {
    if (!docRoute.method || !docRoute.path || !docRoute.auth || !docRoute.description) {
      errors.push({
        type: 'MISSING_FIELD',
        severity: 'ERROR',
        message: `Route missing required fields: ${docRoute.path}`,
        location: docRoute.path,
        suggestion: 'Ensure all routes have method, path, auth, and description'
      });
    }
  }
  
  // Check 3: Routes with request data have schemas
  for (const route of registry.routes) {
    if (acceptsRequestData(route) && !route.requestSchema) {
      warnings.push({
        type: 'MISSING_SCHEMA',
        severity: 'WARNING',
        message: `Route accepts request data but lacks schema: ${route.path}`,
        location: route.path,
        suggestion: 'Add request schema documentation with field types and validation'
      });
    }
  }
  
  // Check 4: Alphabetical ordering
  for (const category of parsedDoc.categories) {
    if (!isAlphabeticallySorted(category.routes)) {
      warnings.push({
        type: 'SORTING_ISSUE',
        severity: 'WARNING',
        message: `Routes in category "${category.name}" are not alphabetically sorted`,
        location: category.name,
        suggestion: 'Sort routes alphabetically by path'
      });
    }
  }
  
  // Check 5: Terminology consistency
  const glossary = loadGlossary();
  const terminologyIssues = checkTerminology(parsedDoc, glossary);
  errors.push(...terminologyIssues);
  
  // Check 6: Valid internal links
  const brokenLinks = findBrokenLinks(parsedDoc);
  errors.push(...brokenLinks);
  
  // Calculate coverage
  const coverage = {
    totalRoutes: registry.routes.length,
    documentedRoutes: registry.routes.filter(r => 
      isRouteDocumented(r, parsedDoc)
    ).length,
    percentage: 0
  };
  coverage.percentage = (coverage.documentedRoutes / coverage.totalRoutes) * 100;
  
  return {
    timestamp: new Date().toISOString(),
    overallStatus: errors.length === 0 ? 'PASS' : 'FAIL',
    coverage,
    errors,
    warnings,
    suggestions
  };
}
```

## Error Handling

### Route Discovery Errors
- **File read errors:** Log warning and skip file, continue with other routes
- **Parse errors:** Log detailed error with file path and line number, mark route as "Parse Error" in registry
- **Invalid route structure:** Log warning, attempt best-effort extraction, flag for manual review

### Documentation Generation Errors
- **Invalid route data:** Skip route with warning, continue generation
- **Template rendering errors:** Use fallback template, log error
- **File write errors:** Fail with clear error message (don't partially update doc)

### Validation Errors
- **Non-existent documentation file:** Create report indicating 0% coverage
- **Malformed markdown:** Attempt graceful parsing, report formatting issues
- **Missing registry:** Fail with clear message to run discovery first

### Error Response Format
All validation and generation tools use consistent error format:
```typescript
interface ToolError {
  tool: string;              // "discovery" | "generation" | "validation"
  timestamp: string;
  errorType: string;
  message: string;
  details?: any;
  stack?: string;
}
```

## Integration Points

### Next.js API Routes
- **Input:** Routes in `app/api/` directory following Next.js conventions
- **Constraint:** Must export HTTP method handlers (GET, POST, etc.)
- **Assumption:** Route files are TypeScript with Zod validation

### Documentation System
- **Output:** Updates `docs/DOCROLEBASE/08-technical/API_REFERENCE.md`
- **Constraint:** Must maintain backward compatibility with existing doc structure
- **Integration:** Links to related docs (BOOKING_SYSTEM.md, SUBSCRIPTION_SYSTEM.md, etc.)

### CI/CD Pipeline
- **Hook:** Run validation on pre-commit or in CI
- **Exit codes:**
  - 0: All validation passed
  - 1: Validation errors found (fail build)
  - 2: Warnings only (succeed with notice)

### Development Workflow
```bash
# During development: discover new routes
npm run docs:api:discover

# Review registry changes
git diff .kiro/specs/api-documentation-update/route-registry.json

# Generate documentation
npm run docs:api:generate

# Validate completeness
npm run docs:api:validate

# Or run all at once
npm run docs:api:update
```

## Security Considerations

### Sensitive Information in Documentation
- **Issue:** Route analysis might expose sensitive patterns or business logic
- **Mitigation:** 
  - Never include actual API keys, secrets, or credentials in examples
  - Use placeholder values (e.g., `"<CRON_SECRET>"`)
  - Review generated docs before commit for sensitive data leaks

### Authentication Documentation
- **Issue:** Detailed auth docs could help attackers
- **Mitigation:** 
  - Document auth requirements without exposing implementation details
  - Don't document specific JWT algorithms or secret rotation patterns
  - Focus on "what" is required, not "how" it's verified

### Endpoint Discovery
- **Issue:** Comprehensive API documentation exposes all endpoints
- **Mitigation:**
  - This is acceptable for internal documentation
  - For public-facing docs, use filtered version with only public/documented APIs
  - Mark internal/debug endpoints clearly as "Not for production use"

## Performance Considerations

### Route Discovery Performance
- **Challenge:** Parsing 169+ TypeScript files can be slow
- **Optimization:**
  - Use incremental updates (only re-analyze changed files)
  - Cache AST parse results
  - Parallelize file processing with worker threads
- **Target:** Complete discovery in < 10 seconds

### Documentation Generation Performance
- **Challenge:** Large documentation files become slow to edit
- **Optimization:**
  - Split documentation by category if file exceeds 5000 lines
  - Use index file with links to category-specific files
  - Generate table of contents for navigation

### Validation Performance
- **Challenge:** Comparing 169+ routes against documentation
- **Optimization:**
  - Build route index for O(1) lookup
  - Use streaming markdown parser
  - Early exit on first error for CI (optional flag)

## Extensibility

### Adding New Validation Rules
```typescript
interface ValidationRule {
  name: string;
  check: (route: RouteMetadata, doc: ParsedDoc) => ValidationIssue[];
  severity: 'ERROR' | 'WARNING';
}

// Register new rules
validationEngine.register({
  name: 'check-example-validity',
  check: (route, doc) => {
    // Custom validation logic
    return issues;
  },
  severity: 'WARNING'
});
```

### Custom Documentation Templates
```typescript
interface DocumentationTemplate {
  name: string;
  generateSection: (routes: RouteMetadata[]) => string;
}

// Register custom template for specific category
documentationGenerator.registerTemplate('Mobile', {
  name: 'mobile-api-template',
  generateSection: (routes) => {
    // Custom formatting for mobile endpoints
    return markdown;
  }
});
```

### Plugin System for Route Metadata Extraction
```typescript
interface MetadataExtractor {
  name: string;
  priority: number;
  extract: (ast: AST, sourceCode: string) => Partial<RouteMetadata>;
}

// Add custom extractor (e.g., for rate limit annotations)
discoveryTool.registerExtractor({
  name: 'rate-limit-extractor',
  priority: 100,
  extract: (ast, sourceCode) => {
    // Look for rate limit decorators or comments
    return { rateLimit: extractRateLimit(ast) };
  }
});
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Documentation Completeness

*For any* API route discovered in the API directory, the generated documentation SHALL include a route specification with all required fields: HTTP method(s), complete route path, authentication requirement, and description.

**Validates: Requirements 1.1, 1.2**

### Property 2: Schema Completeness

*For any* route that accepts request data or returns structured response data, the documentation SHALL include complete schema specifications with field names, types, validation requirements, and JSON examples.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5**

### Property 3: Documentation Structure Consistency

*For any* documentation state, it SHALL maintain consistent structure including: required metadata (status, last updated, base URL), logical category hierarchy, table format for route listings, and alphabetical ordering within categories.

**Validates: Requirements 1.3, 1.4, 1.5, 6.1, 6.4**

### Property 4: Authentication Documentation Completeness

*For any* API route, the documentation SHALL clearly indicate its authentication requirement, whether it is public (—), requires NextAuth session with specific role, requires JWT token, or uses special authentication mechanism with documented header format.

**Validates: Requirements 5.1, 5.4, 5.5**

### Property 5: Route Metadata Accuracy

*For any* route specification in the documentation, it SHALL include accurate metadata such as: new route indicator (🆕) if recently added, deprecation marker and reason if deprecated, summary counts reflecting actual totals, and last updated timestamp.

**Validates: Requirements 3.3, 3.4, 3.5, 6.5**

### Property 6: Error Documentation Completeness

*For any* route that can return specific error codes, the documentation SHALL list each error code with its HTTP status code, conditions that trigger it, and example error response.

**Validates: Requirements 4.2**

### Property 7: Ownership Verification Documentation

*For any* route that performs ownership verification (checking that the authenticated user owns the resource being accessed), the documentation SHALL explicitly document the authorization check performed.

**Validates: Requirements 5.3**

### Property 8: Link Validity

*For any* cross-reference to related documentation within the API documentation, it SHALL use a relative link path that resolves to an existing documentation file.

**Validates: Requirements 6.3**

### Property 9: Terminology Consistency

*For any* technical term used in the API documentation, it SHALL match the definition provided in the requirements glossary, ensuring consistent terminology across authentication requirements, route categories, and technical concepts.

**Validates: Requirements 6.2**

### Property 10: Category Coverage

*For any* route category that exists in the API directory (including newly discovered categories like business, mobile, webhooks, etc.), the documentation SHALL include a properly structured section with appropriate heading and route table.

**Validates: Requirements 7.1, 7.2**

### Property 11: Special Endpoint Marking

*For any* route identified as debug, test, or development-only (based on path patterns like `/api/debug/*`, `/api/test-*`, `/api/seed`), the documentation SHALL include an indicator that it is not for production use.

**Validates: Requirements 7.4**

### Property 12: Source Code Schema Consistency

*For any* route that uses Zod validation schemas in its source code, when both the source code and documentation are analyzed, the validation rules documented SHALL match the validation rules defined in the Zod schema (considering this requires source code analysis, property-based tests will use mock source+doc pairs to verify the matching logic is correct).

**Validates: Requirements 2.4**

## Testing Strategy

### Unit Tests
- **Route Discovery:** Test file path to URL path conversion with various Next.js route patterns
- **Auth Detection:** Test authentication pattern detection with sample AST structures
- **Schema Parsing:** Test Zod schema to SchemaDefinition conversion with various schema types
- **Markdown Generation:** Test template rendering with different route combinations
- **Validation Logic:** Test individual validation rules with known good/bad inputs

### Property-Based Tests
All property-based tests will run with minimum 100 iterations to ensure comprehensive coverage through randomization.

#### Property 1 Test
```typescript
// Feature: api-documentation-update, Property 1: Documentation Completeness
// For any API route discovered in the API directory, the generated documentation 
// SHALL include a route specification with all required fields

test('documentation includes all required fields for discovered routes', () => {
  fc.assert(
    fc.property(
      routeMetadataGenerator(),  // Generates random RouteMetadata
      (route) => {
        // Generate documentation from this route
        const doc = generateDocumentationFromRoutes([route]);
        const parsedDoc = parseMarkdownDoc(doc);
        
        // Find the route in parsed documentation
        const docRoute = parsedDoc.routes.find(r => r.path === route.path);
        
        // Verify all required fields are present
        expect(docRoute).toBeDefined();
        expect(docRoute.method).toBeDefined();
        expect(docRoute.path).toBe(route.path);
        expect(docRoute.auth).toBeDefined();
        expect(docRoute.description).toBeDefined();
        expect(docRoute.description).not.toBe('');
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 2 Test
```typescript
// Feature: api-documentation-update, Property 2: Schema Completeness
test('routes with schemas have complete documentation', () => {
  fc.assert(
    fc.property(
      routeWithSchemaGenerator(),  // Generates routes that have request/response schemas
      (route) => {
        const doc = generateDocumentationFromRoutes([route]);
        const parsedDoc = parseMarkdownDoc(doc);
        const docRoute = parsedDoc.routes.find(r => r.path === route.path);
        
        if (route.requestSchema) {
          expect(docRoute.detailedDocs?.requestBody).toBeDefined();
          
          // Verify schema has fields
          const schemaSection = extractSchemaSection(doc, route.path, 'request');
          expect(schemaSection.fields.length).toBeGreaterThan(0);
          
          // Verify JSON example is present and valid
          expect(schemaSection.example).toBeDefined();
          expect(() => JSON.parse(JSON.stringify(schemaSection.example))).not.toThrow();
          
          // Verify all fields have types
          schemaSection.fields.forEach(field => {
            expect(field.type).toBeDefined();
            expect(field.name).toBeDefined();
          });
        }
        
        if (route.responseSchema) {
          expect(docRoute.detailedDocs?.responseFormat).toBeDefined();
          
          const schemaSection = extractSchemaSection(doc, route.path, 'response');
          expect(schemaSection.fields.length).toBeGreaterThan(0);
          expect(schemaSection.example).toBeDefined();
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 3 Test
```typescript
// Feature: api-documentation-update, Property 3: Documentation Structure Consistency
test('documentation maintains consistent structure', () => {
  fc.assert(
    fc.property(
      fc.array(routeMetadataGenerator(), { minLength: 5, maxLength: 20 }),
      (routes) => {
        const doc = generateDocumentationFromRoutes(routes);
        const parsedDoc = parseMarkdownDoc(doc);
        
        // Check required metadata
        expect(parsedDoc.metadata.status).toMatch(/Complete|Partially Complete|In Progress/);
        expect(parsedDoc.metadata.lastUpdated).toMatch(/\d{4}-\d{2}-\d{2}/);
        expect(parsedDoc.metadata.baseUrl).toBeDefined();
        
        // Check categories are properly structured
        parsedDoc.categories.forEach(category => {
          expect(category.name).toBeDefined();
          expect(category.routes).toBeInstanceOf(Array);
          
          // Check alphabetical ordering
          const paths = category.routes.map(r => r.path);
          const sortedPaths = [...paths].sort();
          expect(paths).toEqual(sortedPaths);
          
          // Check table format for each route
          category.routes.forEach(route => {
            expect(route.method).toBeDefined();
            expect(route.path).toBeDefined();
            expect(route.auth).toBeDefined();
            expect(route.description).toBeDefined();
          });
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 4 Test
```typescript
// Feature: api-documentation-update, Property 4: Authentication Documentation Completeness
test('all routes have clear authentication documentation', () => {
  fc.assert(
    fc.property(
      routeMetadataGenerator(),
      (route) => {
        const doc = generateDocumentationFromRoutes([route]);
        const parsedDoc = parseMarkdownDoc(doc);
        const docRoute = parsedDoc.routes.find(r => r.path === route.path);
        
        // Auth field must be present and non-empty
        expect(docRoute.auth).toBeDefined();
        expect(docRoute.auth.trim()).not.toBe('');
        
        // For special auth types, verify format is documented
        if (route.auth.type === 'CronSecret') {
          const detailSection = findAuthDetailSection(doc, route.path);
          expect(detailSection).toContain('Authorization: Bearer');
        }
        
        if (route.auth.type === 'JWT') {
          const authDisplay = docRoute.auth;
          expect(authDisplay).toMatch(/JWT|Bearer/i);
        }
        
        if (route.auth.type === 'NextAuth' && route.auth.roles) {
          const authDisplay = docRoute.auth;
          route.auth.roles.forEach(role => {
            expect(authDisplay).toContain(role);
          });
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 8 Test
```typescript
// Feature: api-documentation-update, Property 8: Link Validity
test('all internal doc links are valid relative paths', () => {
  fc.assert(
    fc.property(
      routeWithRelatedDocsGenerator(),  // Generates routes with related doc links
      (route) => {
        const doc = generateDocumentationFromRoutes([route]);
        
        // Extract all markdown links
        const links = extractMarkdownLinks(doc);
        
        // Filter for internal doc links (not external URLs)
        const internalLinks = links.filter(link => 
          !link.startsWith('http') && link.endsWith('.md')
        );
        
        // Verify all are relative paths
        internalLinks.forEach(link => {
          expect(link.startsWith('/')).toBe(false);  // Not absolute
          expect(link.startsWith('../') || link.startsWith('./')).toBe(true);
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 9 Test
```typescript
// Feature: api-documentation-update, Property 9: Terminology Consistency
test('documentation uses consistent glossary terms', () => {
  fc.assert(
    fc.property(
      routeMetadataGenerator(),
      (route) => {
        const doc = generateDocumentationFromRoutes([route]);
        const glossary = loadGlossary();
        
        // Extract all technical terms from documentation
        const terms = extractTechnicalTerms(doc);
        
        // Check each term against glossary
        terms.forEach(term => {
          if (glossary.has(term.toLowerCase())) {
            // Verify the term usage matches glossary definition
            const usage = getTermContext(doc, term);
            const definition = glossary.get(term.toLowerCase());
            
            // Basic consistency: if glossary defines it as X, 
            // documentation shouldn't contradict that
            expect(isConsistentWithDefinition(usage, definition)).toBe(true);
          }
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Tests
- **Route Discovery + Generation:** Run full pipeline on small test API directory with known routes
- **Validation Integration:** Generate documentation with deliberate errors, verify validation catches them
- **File System Integration:** Test actual file reading/writing with temp directories
- **Next.js Route Conventions:** Test against actual Next.js project structure patterns

### Example-Based Tests
- **Standard Error Format Section:** Verify documentation contains the error response format section
- **Rate Limits Section:** Verify documentation contains rate limits table
- **Specific Category Presence:** Verify mobile, webhooks, and other new categories have sections
- **Metadata Presence:** Verify documentation header has Status, Last Updated, and Base URL

## Deployment and Maintenance

### Initial Setup
1. Install documentation tools: `npm install --save-dev @typescript-eslint/parser unified remark-parse`
2. Add npm scripts to `package.json`:
```json
{
  "scripts": {
    "docs:api:discover": "node scripts/api-docs/discover.js",
    "docs:api:generate": "node scripts/api-docs/generate.js",
    "docs:api:validate": "node scripts/api-docs/validate.js",
    "docs:api:update": "npm run docs:api:discover && npm run docs:api:generate && npm run docs:api:validate"
  }
}
```
3. Create scripts directory: `mkdir -p scripts/api-docs`
4. Initial run to generate baseline: `npm run docs:api:update`

### Ongoing Maintenance
- **When adding new routes:** Run `npm run docs:api:update` to regenerate documentation
- **Before committing:** Run `npm run docs:api:validate` to ensure completeness
- **CI integration:** Add validation check to GitHub Actions/CI pipeline
- **Quarterly review:** Manually review and enhance auto-generated descriptions

### Rollout Strategy
1. **Phase 1:** Implement route discovery tool, generate route registry, review for accuracy
2. **Phase 2:** Implement documentation generator, generate initial complete documentation, manual review
3. **Phase 3:** Implement validation tool, integrate into CI
4. **Phase 4:** Add detailed schema extraction for high-traffic routes
5. **Phase 5:** Enhance with custom templates and additional metadata extractors

