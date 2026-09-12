/**
 * Core type definitions for the API Documentation System
 * These types define the structure of route metadata, schemas, and validation reports
 */

// ============================================================================
// HTTP and Route Types
// ============================================================================

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE"
}

// ============================================================================
// Authentication Types
// ============================================================================

export type AuthType = "NextAuth" | "JWT" | "CronSecret" | "WebhookSignature" | "Public";

export type UserRole = "ADMIN" | "INSTRUCTOR" | "CLIENT";

export interface AuthRequirement {
  type: AuthType;
  roles?: UserRole[];
  description?: string;
}

// ============================================================================
// Schema Types
// ============================================================================

export type SchemaType = "RequestBody" | "QueryParams" | "PathParams" | "Response";

export type ValidationRuleType = "min" | "max" | "email" | "url" | "regex" | "enum";

export interface ValidationRule {
  type: ValidationRuleType;
  value: any;
  message?: string;
}

export interface SchemaField {
  name: string;
  type: string; // "string", "number", "boolean", "object", "array", etc.
  required: boolean;
  validation?: ValidationRule[];
  description?: string;
  example?: any;
}

export interface SchemaDefinition {
  type: SchemaType;
  fields: SchemaField[];
  example: object;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ErrorCode {
  code: string;
  httpStatus: number;
  description: string;
  conditions: string;
  example?: object;
}

// ============================================================================
// Route Metadata Types
// ============================================================================

export interface RouteMetadata {
  path: string;
  methods: HttpMethod[];
  category: string;
  filePath: string;
  auth: AuthRequirement;
  description: string;
  requestSchema?: SchemaDefinition;
  responseSchema?: SchemaDefinition;
  errorCodes?: ErrorCode[];
  ownershipCheck?: boolean;
  isDeprecated?: boolean;
  deprecationReason?: string;
  isNewlyAdded?: boolean;
  relatedDocs?: string[];
}

// ============================================================================
// Route Registry Types
// ============================================================================

export interface RouteRegistry {
  generatedAt: string;
  totalRoutes: number;
  routes: RouteMetadata[];
}

// ============================================================================
// Documentation Types
// ============================================================================

export type DocumentationStatus = "Complete" | "Partially Complete" | "In Progress";

export interface DocumentationMetadata {
  status: DocumentationStatus;
  lastUpdated: string;
  baseUrl: string;
  totalRoutes: number;
  documentedRoutes: number;
}

export interface RouteDocumentation {
  method: HttpMethod;
  path: string;
  auth: string;
  description: string;
  isNew?: boolean;
  isDeprecated?: boolean;
  detailedDocs?: {
    requestBody?: string;
    responseFormat?: string;
    errorCodes?: string;
    examples?: string;
  };
}

export interface DocumentationCategory {
  name: string;
  description?: string;
  routes: RouteDocumentation[];
}

export interface RateLimitRule {
  category: string;
  limit: string;
}

export interface RelatedDocLink {
  title: string;
  path: string;
  description?: string;
}

export interface APIDocumentation {
  metadata: DocumentationMetadata;
  categories: DocumentationCategory[];
  errorResponseFormat: string;
  rateLimits: RateLimitRule[];
  validationInfo: string;
  relatedDocs: RelatedDocLink[];
}

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationErrorType = 
  | "UNDOCUMENTED_ROUTE" 
  | "MISSING_FIELD" 
  | "INVALID_FORMAT" 
  | "BROKEN_LINK" 
  | "INCONSISTENT_TERMINOLOGY";

export type ValidationWarningType = 
  | "MISSING_SCHEMA" 
  | "INCOMPLETE_ERROR_DOCS" 
  | "SORTING_ISSUE" 
  | "DEPRECATED_UNMARKED";

export type ValidationSeverity = "ERROR" | "WARNING";

export interface ValidationError {
  type: ValidationErrorType;
  severity: "ERROR";
  message: string;
  location?: string;
  suggestion?: string;
}

export interface ValidationWarning {
  type: ValidationWarningType;
  severity: "WARNING";
  message: string;
  location?: string;
  suggestion?: string;
}

export interface ValidationCoverage {
  totalRoutes: number;
  documentedRoutes: number;
  percentage: number;
}

export interface ValidationReport {
  timestamp: string;
  overallStatus: "PASS" | "FAIL";
  coverage: ValidationCoverage;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

// ============================================================================
// Tool Error Types
// ============================================================================

export type ToolName = "discovery" | "generation" | "validation";

export interface ToolError {
  tool: ToolName;
  timestamp: string;
  errorType: string;
  message: string;
  details?: any;
  stack?: string;
}

// ============================================================================
// Parsed Documentation Types (for validation)
// ============================================================================

export interface ParsedRoute {
  method?: string;
  path?: string;
  auth?: string;
  description?: string;
  hasRequestSchema?: boolean;
  hasResponseSchema?: boolean;
  hasErrorDocs?: boolean;
}

export interface ParsedCategory {
  name: string;
  routes: ParsedRoute[];
}

export interface ParsedDocumentation {
  metadata: {
    status?: string;
    lastUpdated?: string;
    baseUrl?: string;
  };
  categories: ParsedCategory[];
  routes: ParsedRoute[];
}
