/**
 * Shared utility functions for the API Documentation System
 * Provides file system operations, path handling, and common helpers
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Promisified fs functions
export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);
export const readdir = promisify(fs.readdir);
export const stat = promisify(fs.stat);
export const mkdir = promisify(fs.mkdir);

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Convert file system path to Next.js API route URL path
 * Examples:
 *   app/api/bookings/route.ts → /api/bookings
 *   app/api/bookings/[id]/route.ts → /api/bookings/[id]
 *   app/api/auth/[...nextauth]/route.ts → /api/auth/[...nextauth]
 */
export function filePathToUrlPath(filePath: string): string {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');
  
  // Extract the part after app/api/
  const match = normalized.match(/app\/api\/(.+)\/route\.(ts|js)$/);
  if (!match) {
    throw new Error(`Invalid route file path: ${filePath}`);
  }
  
  const routePath = match[1];
  return `/api/${routePath}`;
}

/**
 * Extract category from URL path
 * Examples:
 *   /api/admin/users → Admin
 *   /api/bookings/[id] → Bookings
 *   /api/mobile/auth → Mobile
 */
export function getCategoryFromPath(urlPath: string): string {
  const parts = urlPath.split('/').filter(p => p && p !== 'api');
  
  if (parts.length === 0) {
    return 'General';
  }
  
  // Use the first path segment as category
  const category = parts[0];
  
  // Handle special cases
  if (category === 'auth') return 'Auth';
  if (category === 'admin') return 'Admin';
  if (category === 'mobile') return 'Mobile';
  if (category === 'webhooks') return 'Webhooks';
  
  // Capitalize first letter
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Get relative path from project root
 */
export function getRelativePath(filePath: string, projectRoot: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

// ============================================================================
// File System Utilities
// ============================================================================

/**
 * Recursively find all files matching a pattern in a directory
 */
export async function findFiles(
  dir: string, 
  pattern: RegExp,
  results: string[] = []
): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        // Skip node_modules and .next directories
        if (entry !== 'node_modules' && entry !== '.next' && entry !== '.git') {
          await findFiles(fullPath, pattern, results);
        }
      } else if (stats.isFile() && pattern.test(fullPath)) {
        results.push(fullPath);
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
    return results;
  }
}

/**
 * Find all Next.js API route files in a directory
 */
export async function findRouteFiles(apiDir: string): Promise<string[]> {
  const routePattern = /route\.(ts|js)$/;
  return findFiles(apiDir, routePattern);
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Read JSON file and parse it
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write object to JSON file with pretty formatting
 */
export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Escape special characters for markdown table cells
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Convert camelCase or PascalCase to Title Case
 */
export function toTitleCase(text: string): string {
  // Insert space before capital letters
  const spaced = text.replace(/([A-Z])/g, ' $1').trim();
  // Capitalize first letter of each word
  return spaced.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Check if an array is sorted alphabetically
 */
export function isAlphabeticallySorted(items: string[]): boolean {
  for (let i = 1; i < items.length; i++) {
    if (items[i].localeCompare(items[i - 1]) < 0) {
      return false;
    }
  }
  return true;
}

/**
 * Sort array of objects by a property
 */
export function sortBy<T>(
  items: T[], 
  key: keyof T, 
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const aVal = String(a[key]);
    const bVal = String(b[key]);
    const comparison = aVal.localeCompare(bVal);
    return order === 'asc' ? comparison : -comparison;
  });
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get current ISO date string (YYYY-MM-DD)
 */
export function getCurrentISODate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// ============================================================================
// Logging Utilities
// ============================================================================

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  
  success: (message: string, ...args: any[]) => {
    console.log(`[SUCCESS] ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
};

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Create a standardized tool error
 */
export function createToolError(
  tool: 'discovery' | 'generation' | 'validation',
  errorType: string,
  message: string,
  details?: any
): any {
  return {
    tool,
    timestamp: getCurrentTimestamp(),
    errorType,
    message,
    details,
    stack: new Error().stack
  };
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
