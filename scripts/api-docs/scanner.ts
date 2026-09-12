/**
 * File System Scanner for API Routes
 * Recursively scans the app/api/ directory to identify all Next.js route files
 * and converts them to URL paths following Next.js conventions
 */

import { API_DIR, PROJECT_ROOT } from './constants';
import { 
  findRouteFiles, 
  fileExists, 
  getRelativePath,
  filePathToUrlPath,
  getCategoryFromPath,
  logger 
} from './utils';

/**
 * Discovered route information (before AST analysis)
 */
export interface DiscoveredRoute {
  /** URL path (e.g., /api/bookings/[id]) */
  path: string;
  /** Route category based on directory structure */
  category: string;
  /** Relative file path from project root */
  filePath: string;
  /** Absolute file path */
  absolutePath: string;
}

/**
 * Determine if a bookings route is for instructors or clients
 * This is a heuristic based on path structure
 */
function determineBookingsCategory(pathParts: string[]): string {
  // If path contains 'client', it's a client booking route
  if (pathParts.some(p => p.includes('client'))) {
    return 'Bookings (Client)';
  }
  
  // Default to instructor bookings
  return 'Bookings (Instructor)';
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Check if a route path represents a dynamic route
 * Dynamic routes contain square brackets: [id], [...slug], [[...slug]]
 */
export function isDynamicRoute(urlPath: string): boolean {
  return /\[.*?\]/.test(urlPath);
}

/**
 * Check if a route path represents a catch-all route
 * Catch-all routes use [...slug] or [[...slug]] syntax
 */
export function isCatchAllRoute(urlPath: string): boolean {
  return /\[\.\.\..*?\]/.test(urlPath);
}

/**
 * Check if a route path represents an optional catch-all route
 * Optional catch-all routes use [[...slug]] syntax
 */
export function isOptionalCatchAllRoute(urlPath: string): boolean {
  return /\[\[\.\.\..*?\]\]/.test(urlPath);
}

/**
 * Extract the dynamic parameter name from a route segment
 * [id] → id
 * [...slug] → slug
 * [[...slug]] → slug
 */
export function extractParamName(segment: string): string | null {
  const match = segment.match(/\[+\.?\.?\.?([^\]]+)\]+/);
  return match ? match[1] : null;
}

/**
 * Scan the app/api/ directory and discover all API routes
 * 
 * @param apiDir - Path to the app/api/ directory (defaults to API_DIR constant)
 * @returns Array of discovered routes
 */
export async function scanApiRoutes(
  apiDir: string = API_DIR
): Promise<DiscoveredRoute[]> {
  logger.info('Starting API route discovery...');
  logger.info(`Scanning directory: ${apiDir}`);
  
  // Verify the API directory exists
  if (!fileExists(apiDir)) {
    throw new Error(`API directory not found: ${apiDir}`);
  }
  
  // Find all route files recursively
  const routeFiles = await findRouteFiles(apiDir);
  logger.info(`Found ${routeFiles.length} route files`);
  
  const discoveredRoutes: DiscoveredRoute[] = [];
  const errors: Array<{ file: string; error: string }> = [];
  
  // Process each route file
  for (const absolutePath of routeFiles) {
    try {
      // Convert file path to URL path
      const urlPath = filePathToUrlPath(absolutePath);
      
      // Determine category
      const category = getCategoryFromPath(urlPath);
      
      // Get relative path for storage
      const filePath = getRelativePath(absolutePath, PROJECT_ROOT);
      
      // Create discovered route entry
      discoveredRoutes.push({
        path: urlPath,
        category,
        filePath,
        absolutePath
      });
      
      logger.debug(`Discovered: ${urlPath} [${category}]`);
      
    } catch (error: any) {
      // Collect errors but continue processing other files
      errors.push({
        file: getRelativePath(absolutePath, PROJECT_ROOT),
        error: error.message
      });
      logger.warn(`Error processing ${absolutePath}: ${error.message}`);
    }
  }
  
  // Report summary
  logger.success(`Successfully discovered ${discoveredRoutes.length} routes`);
  
  if (errors.length > 0) {
    logger.warn(`Encountered ${errors.length} errors during discovery`);
    errors.forEach(({ file, error }) => {
      logger.warn(`  - ${file}: ${error}`);
    });
  }
  
  // Log category breakdown
  const categoryCounts = discoveredRoutes.reduce((acc, route) => {
    acc[route.category] = (acc[route.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  logger.info('\nRoutes by category:');
  Object.entries(categoryCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, count]) => {
      logger.info(`  ${category}: ${count} routes`);
    });
  
  return discoveredRoutes;
}

/**
 * Get statistics about discovered routes
 */
export interface RouteStatistics {
  total: number;
  byCategory: Record<string, number>;
  dynamicRoutes: number;
  catchAllRoutes: number;
  optionalCatchAllRoutes: number;
}

/**
 * Calculate statistics from discovered routes
 */
export function calculateRouteStatistics(
  routes: DiscoveredRoute[]
): RouteStatistics {
  const byCategory = routes.reduce((acc, route) => {
    acc[route.category] = (acc[route.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const dynamicRoutes = routes.filter(r => isDynamicRoute(r.path)).length;
  const catchAllRoutes = routes.filter(r => isCatchAllRoute(r.path)).length;
  const optionalCatchAllRoutes = routes.filter(r => 
    isOptionalCatchAllRoute(r.path)
  ).length;
  
  return {
    total: routes.length,
    byCategory,
    dynamicRoutes,
    catchAllRoutes,
    optionalCatchAllRoutes
  };
}

/**
 * Sort discovered routes for consistent ordering
 * Routes are sorted first by category, then alphabetically by path
 */
export function sortDiscoveredRoutes(
  routes: DiscoveredRoute[]
): DiscoveredRoute[] {
  return [...routes].sort((a, b) => {
    // First, sort by category
    const categoryCompare = a.category.localeCompare(b.category);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }
    
    // Then, sort by path
    return a.path.localeCompare(b.path);
  });
}
