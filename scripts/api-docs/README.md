# API Documentation System

Automated tools for generating and maintaining comprehensive API documentation for DriveBook.

## Overview

This directory contains TypeScript-based tools that:

1. **Discover** all API routes by scanning the `app/api/` directory
2. **Extract** metadata from route files using AST parsing
3. **Generate** comprehensive markdown documentation
4. **Validate** documentation completeness and consistency

## Directory Structure

```
scripts/api-docs/
├── README.md                 # This file
├── tsconfig.json            # TypeScript configuration
├── index.ts                 # Main entry point (exports)
├── types.ts                 # Core type definitions
├── utils.ts                 # Shared utility functions
├── constants.ts             # Configuration and constants
├── discover.ts              # Route Discovery Tool
├── generate.ts              # Documentation Generator
├── validate.ts              # Documentation Validator
└── dist/                    # Compiled JavaScript output
```

## Core Files

### types.ts
Defines all TypeScript interfaces for:
- Route metadata (`RouteMetadata`, `SchemaDefinition`)
- Authentication types (`AuthRequirement`, `UserRole`)
- Documentation structure (`APIDocumentation`, `RouteDocumentation`)
- Validation reports (`ValidationReport`, `ValidationError`)

### utils.ts
Shared utility functions for:
- File system operations (reading, writing, directory traversal)
- Path manipulation (file path to URL path conversion)
- String utilities (markdown escaping, truncation)
- Logging and error handling

### constants.ts
Configuration values including:
- Project paths (API directory, docs directory, output paths)
- API documentation settings (base URL, error formats)
- Category ordering and descriptions
- Authentication display mappings
- AST parsing patterns

## Usage

### TypeScript Compilation

```bash
# Compile TypeScript to JavaScript
cd scripts/api-docs
npx tsc

# Compiled output will be in dist/
```

### Running Tools

```bash
# From project root:

# Discover all API routes
npm run docs:api:discover

# Generate documentation
npm run docs:api:generate

# Validate documentation
npm run docs:api:validate

# Run all three in sequence
npm run docs:api:update
```

## Development

### Adding New Types

1. Add type definitions to `types.ts`
2. Export from `index.ts` if needed externally
3. Update this README with description

### Adding New Utilities

1. Add functions to `utils.ts`
2. Group related functions with comments
3. Export from `index.ts` if needed externally

### Adding New Constants

1. Add constants to `constants.ts`
2. Group by purpose (paths, configuration, patterns, etc.)
3. Add JSDoc comments for complex constants

## Type Safety

All tools are written in TypeScript with strict mode enabled:
- `strict: true` - All strict type-checking options
- `noUnusedLocals: true` - Error on unused local variables
- `noUnusedParameters: true` - Error on unused parameters
- `noImplicitReturns: true` - Error on missing return statements

## Dependencies

Required npm packages:
- `@typescript-eslint/parser` - Parse TypeScript files
- `@typescript-eslint/typescript-estree` - TypeScript AST parsing
- `unified` - Markdown processing pipeline
- `remark-parse` - Parse markdown to AST
- `remark-stringify` - Stringify AST to markdown
- `@types/node` - Node.js type definitions

## Output Files

### route-registry.json
Located in `.kiro/specs/api-documentation-update/`

Contains discovered route metadata:
```json
{
  "generatedAt": "2024-02-09T11:00:00.000Z",
  "totalRoutes": 169,
  "routes": [
    {
      "path": "/api/bookings",
      "methods": ["GET", "POST"],
      "category": "Bookings",
      "auth": { "type": "NextAuth", "roles": ["INSTRUCTOR"] },
      "description": "Manage bookings"
    }
  ]
}
```

### API_REFERENCE.md
Located in `docs/DOCROLEBASE/08-technical/`

Generated markdown documentation with:
- Route tables by category
- Request/response schemas
- Authentication requirements
- Error codes and examples

### validation-report.json
Located in `.kiro/specs/api-documentation-update/`

Validation results:
```json
{
  "timestamp": "2024-02-09T11:00:00.000Z",
  "overallStatus": "PASS",
  "coverage": {
    "totalRoutes": 169,
    "documentedRoutes": 169,
    "percentage": 100
  },
  "errors": [],
  "warnings": []
}
```

## Next Steps

1. Implement Route Discovery Tool (`discover.ts`)
2. Implement Documentation Generator (`generate.ts`)
3. Implement Documentation Validator (`validate.ts`)
4. Add npm scripts to `package.json`
5. Write unit tests
6. Write property-based tests

## Related Documentation

- Requirements: `.kiro/specs/api-documentation-update/requirements.md`
- Design: `.kiro/specs/api-documentation-update/design.md`
- Tasks: `.kiro/specs/api-documentation-update/tasks.md`
