/**
 * Test script for the route scanner
 * Run with: npx tsx scripts/api-docs/test-scanner.ts
 */

import { 
  scanApiRoutes, 
  calculateRouteStatistics,
  sortDiscoveredRoutes,
  isDynamicRoute,
  isCatchAllRoute,
  extractParamName
} from './scanner';
import { filePathToUrlPath, getCategoryFromPath } from './utils';

async function testScanner() {
  console.log('='.repeat(60));
  console.log('API Route Scanner Test');
  console.log('='.repeat(60));
  console.log();
  
  // Test path conversion functions
  console.log('Testing path conversion functions:');
  console.log('---');
  
  const testPaths = [
    'app/api/bookings/route.ts',
    'app/api/bookings/[id]/route.ts',
    'app/api/auth/[...nextauth]/route.ts',
    'E:\\DOC\\flowstate-wms\\AI voice assistance - Copy - Copy - Copy\\drivebook\\app\\api\\admin\\users\\route.ts'
  ];
  
  testPaths.forEach(path => {
    try {
      const urlPath = filePathToUrlPath(path);
      const category = getCategoryFromPath(urlPath);
      const dynamic = isDynamicRoute(urlPath);
      const catchAll = isCatchAllRoute(urlPath);
      
      console.log(`File: ${path}`);
      console.log(`  URL: ${urlPath}`);
      console.log(`  Category: ${category}`);
      console.log(`  Dynamic: ${dynamic}`);
      console.log(`  Catch-all: ${catchAll}`);
      
      // Extract param names if dynamic
      if (dynamic) {
        const segments = urlPath.split('/');
        const params = segments
          .filter((s: string) => s.startsWith('['))
          .map((s: string) => extractParamName(s))
          .filter(Boolean);
        console.log(`  Params: ${params.join(', ')}`);
      }
      console.log();
    } catch (error: any) {
      console.error(`Error: ${error.message}\n`);
    }
  });
  
  // Scan actual routes
  console.log('\n' + '='.repeat(60));
  console.log('Scanning actual API routes...');
  console.log('='.repeat(60));
  console.log();
  
  try {
    const routes = await scanApiRoutes();
    const stats = calculateRouteStatistics(routes);
    
    console.log('\n' + '='.repeat(60));
    console.log('Route Discovery Statistics');
    console.log('='.repeat(60));
    console.log(`Total routes: ${stats.total}`);
    console.log(`Dynamic routes: ${stats.dynamicRoutes}`);
    console.log(`Catch-all routes: ${stats.catchAllRoutes}`);
    console.log(`Optional catch-all routes: ${stats.optionalCatchAllRoutes}`);
    console.log();
    
    // Show sample routes from each category
    console.log('Sample routes by category:');
    console.log('---');
    
    const sortedRoutes = sortDiscoveredRoutes(routes);
    const categories = Object.keys(stats.byCategory).sort();
    
    categories.forEach(category => {
      const categoryRoutes = sortedRoutes.filter(r => r.category === category);
      const sampleSize = Math.min(3, categoryRoutes.length);
      const samples = categoryRoutes.slice(0, sampleSize);
      
      console.log(`\n${category} (${categoryRoutes.length} total):`);
      samples.forEach(route => {
        console.log(`  - ${route.path}`);
      });
      
      if (categoryRoutes.length > sampleSize) {
        console.log(`  ... and ${categoryRoutes.length - sampleSize} more`);
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('Scanner test completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\nError during route scanning:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testScanner().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
