# Implementation Plan: API Documentation Update

## Overview

This implementation creates an automated API documentation system for DriveBook. The system consists of three TypeScript-based tools: a Route Discovery Tool that scans the `app/api/` directory to identify all API routes and extract metadata, a Documentation Generator that creates comprehensive markdown documentation from the discovered routes, and a Documentation Validator that ensures completeness and consistency. The tools integrate with the development workflow through npm scripts and can be used in CI/CD pipelines.

## Tasks

- [x] 1. Set up project structure and core types
  - Create `scripts/api-docs/` directory structure
  - Define TypeScript interfaces for RouteMetadata, SchemaDefinition, ValidationReport, and other core data models
  - Set up TypeScript configuration for the scripts directory
  - Install required dependencies: `@typescript-eslint/parser`, `@typescript-eslint/typescript-estree`, `unified`, `remark-parse`, `remark-stringify`
  - Create shared utilities module for file system operations
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 6.1_

- [ ] 2. Implement Route Discovery Tool
  - [-] 2.1 Create file system scanner for API routes
    - Implement recursive directory traversal of `app/api/`
    - Identify Next.js route files (route.ts, route.js)
    - Convert file paths to URL paths following Next.js conventions
    - Handle dynamic routes ([id]), catch-all routes ([...slug]), and special routes ([...nextauth])
    - Categorize routes based on directory structure
    - _Requirements: 1.1, 3.1, 7.1_
  
  - [~] 2.2 Create TypeScript AST parser for route metadata extraction
    - Parse TypeScript files using @typescript-eslint/typescript-estree
    - Extract exported HTTP method handlers (GET, POST, PUT, PATCH, DELETE)
    - Detect authentication patterns (getServerSession, JWT verification, CRON_SECRET, webhook signatures)
    - Identify role-based access control checks (ADMIN, INSTRUCTOR, CLIENT)
    - Extract Zod schema definitions for request/response validation
    - Detect ownership verification patterns
    - Extract JSDoc comments and inline descriptions
    - _Requirements: 1.2, 2.1, 2.4, 5.1, 5.2, 5.3, 5.5_
  
  - [~] 2.3 Build route registry and save to JSON
    - Aggregate all discovered route metadata
    - Generate route-registry.json with complete route information
    - Include metadata: total routes, generation timestamp, discovery version
    - Compare with previous registry to mark newly added routes
    - Handle parse errors gracefully with fallback metadata
    - _Requirements: 3.2, 3.3, 3.4_

- [~] 3. Checkpoint - Ensure discovery tool works
  - Run the Route Discovery Tool on the actual `app/api/` directory
  - Verify route-registry.json is generated with all routes
  - Review a sample of routes for accuracy
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Documentation Generator
  - [~] 4.1 Create markdown template engine
    - Build document header generator (status, last updated, base URL)
    - Create category section generator with route tables
    - Implement detailed route documentation formatter (request/response schemas)
    - Build field documentation table generator
    - Create error code documentation formatter
    - Generate examples from schema definitions
    - _Requirements: 1.3, 1.4, 1.5, 2.2, 2.3, 4.2, 6.1, 6.4, 6.5_
  
  - [~] 4.2 Implement route categorization and sorting
    - Group routes by category (Auth, Admin, Bookings, Mobile, Webhooks, etc.)
    - Sort categories in logical order (core categories first, then alphabetical)
    - Sort routes alphabetically within each category
    - Handle new categories not in existing documentation
    - _Requirements: 1.3, 7.1, 7.2_
  
  - [~] 4.3 Create documentation formatting utilities
    - Format authentication requirements for display (ADMIN, JWT, CRON_SECRET, etc.)
    - Add visual indicators (🆕 for new routes, ~~strikethrough~~ for deprecated)
    - Format descriptions with proper escaping
    - Generate JSON examples with proper formatting
    - Convert Zod validation rules to human-readable descriptions
    - _Requirements: 1.2, 2.3, 3.4, 3.5, 6.2, 7.4_
  
  - [~] 4.4 Generate complete API reference documentation
    - Read route-registry.json
    - Generate all category sections
    - Add standard sections (Error Responses, Rate Limits, Validation, Related Docs)
    - Include glossary term references
    - Add relative links to related documentation files
    - Write output to `docs/DOCROLEBASE/08-technical/API_REFERENCE.md`
    - _Requirements: 1.5, 2.5, 4.1, 4.3, 5.4, 6.3, 6.5, 7.3, 7.5_

- [~] 5. Checkpoint - Ensure documentation generation works
  - Run the Documentation Generator
  - Verify API_REFERENCE.md is created/updated
  - Manually review a few category sections for correctness
  - Check that formatting is consistent
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Documentation Validator
  - [~] 6.1 Create markdown parser for existing documentation
    - Parse API_REFERENCE.md using unified/remark
    - Extract route entries from tables
    - Parse detailed documentation sections
    - Build searchable index of documented routes
    - _Requirements: 3.1, 3.2_
  
  - [~] 6.2 Implement validation rules
    - Check all discovered routes are documented (Property 1)
    - Verify all route entries have required fields (method, path, auth, description)
    - Validate schema completeness for routes with request/response data (Property 2)
    - Check alphabetical ordering within categories (Property 3)
    - Verify authentication documentation clarity (Property 4)
    - Validate internal link paths (Property 8)
    - Check terminology consistency against glossary (Property 9)
    - Verify error documentation for error-returning routes
    - _Requirements: 3.2, 3.4, 4.2, 5.1, 6.2, 6.3, 6.4_
  
  - [~] 6.3 Create validation report generator
    - Generate structured validation report (JSON and markdown)
    - Calculate documentation coverage percentage
    - Categorize issues by severity (ERROR, WARNING)
    - Provide actionable suggestions for each issue
    - Include timestamps and overall status
    - Exit with appropriate status code for CI integration
    - _Requirements: 3.3, 3.4_

- [~] 7. Checkpoint - Ensure validation tool works
  - Run the Documentation Validator on generated documentation
  - Review validation report for accuracy
  - Test with deliberately incomplete documentation
  - Verify CI exit codes work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [~] 8. Create npm scripts and CLI integration
  - Add `docs:api:discover` script to run Route Discovery Tool
  - Add `docs:api:generate` script to run Documentation Generator
  - Add `docs:api:validate` script to run Documentation Validator
  - Add `docs:api:update` script to run all three in sequence
  - Create CLI entry points with proper error handling and logging
  - Add progress indicators for long-running operations
  - _Requirements: All requirements (integration point)_

- [~] 9. Create initial documentation baseline
  - Run full documentation update (`npm run docs:api:update`)
  - Generate route-registry.json with all 169+ routes
  - Generate complete API_REFERENCE.md
  - Validate and address any critical errors
  - Commit baseline documentation and registry
  - _Requirements: 1.1, 3.3, 3.4_

- [ ]* 10. Write unit tests for core functionality
  - Test file path to URL path conversion with Next.js route patterns
  - Test authentication pattern detection with sample AST structures
  - Test Zod schema parsing with various schema types
  - Test markdown template generation with different route configurations
  - Test validation rules with known good/bad inputs
  - Test category sorting and route ordering logic
  - _Requirements: All requirements (quality assurance)_

- [ ]* 11. Write property-based tests for correctness properties
  - [ ]* 11.1 Write property test for documentation completeness
    - **Property 1: Documentation Completeness**
    - **Validates: Requirements 1.1, 1.2**
    - Test that any discovered route has complete documentation with all required fields
  
  - [ ]* 11.2 Write property test for schema completeness
    - **Property 2: Schema Completeness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
    - Test that routes with schemas have complete field documentation and valid JSON examples
  
  - [ ]* 11.3 Write property test for documentation structure consistency
    - **Property 3: Documentation Structure Consistency**
    - **Validates: Requirements 1.3, 1.4, 1.5, 6.1, 6.4**
    - Test that documentation maintains consistent structure, metadata, and ordering
  
  - [ ]* 11.4 Write property test for authentication documentation
    - **Property 4: Authentication Documentation Completeness**
    - **Validates: Requirements 5.1, 5.4, 5.5**
    - Test that all routes have clear authentication requirements documented
  
  - [ ]* 11.5 Write property test for link validity
    - **Property 8: Link Validity**
    - **Validates: Requirements 6.3**
    - Test that all internal documentation links use valid relative paths
  
  - [ ]* 11.6 Write property test for terminology consistency
    - **Property 9: Terminology Consistency**
    - **Validates: Requirements 6.2**
    - Test that technical terms match glossary definitions

- [~] 12. Final checkpoint and documentation review
  - Review complete API_REFERENCE.md for quality and accuracy
  - Verify all routes are categorized correctly
  - Check that authentication requirements are clear
  - Ensure schema examples are helpful
  - Test all npm scripts work end-to-end
  - Update README or developer docs with documentation workflow instructions
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The implementation uses TypeScript for all tooling to ensure type safety
- AST parsing allows accurate extraction of authentication patterns and schemas without manual annotation
- The route registry acts as an intermediate cache to decouple discovery from generation
- Property-based tests validate universal correctness properties across randomized inputs
- The validation tool can be integrated into CI/CD to prevent documentation drift
- Tools are designed to be extensible through plugin systems for custom metadata extractors and templates
- All tools handle errors gracefully and provide actionable feedback

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3"] },
    { "id": 9, "tasks": ["8"] },
    { "id": 10, "tasks": ["9"] },
    { "id": 11, "tasks": ["10", "11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 12, "tasks": ["12"] }
  ]
}
```
