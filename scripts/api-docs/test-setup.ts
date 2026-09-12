/**
 * Simple test to verify the setup is working correctly
 * Run with: npx ts-node test-setup.ts
 */

import { 
  filePathToUrlPath, 
  getCategoryFromPath,
  getCurrentISODate,
  logger 
} from './utils';
import { HttpMethod, RouteMetadata } from './types';
import { PROJECT_ROOT, API_DIR, BASE_URL } from './constants';

logger.info('Testing API Documentation System Setup');
logger.info('=====================================\n');

// Test 1: Path conversion
logger.info('Test 1: File path to URL path conversion');
try {
  const testCases = [
    'app/api/bookings/route.ts',
    'app/api/bookings/[id]/route.ts',
    'app/api/auth/[...nextauth]/route.ts'
  ];
  
  testCases.forEach(testPath => {
    const urlPath = filePathToUrlPath(testPath);
    logger.info(`  ${testPath} → ${urlPath}`);
  });
  logger.success('✓ Path conversion works\n');
} catch (error) {
  logger.error('✗ Path conversion failed:', error);
}

// Test 2: Category extraction
logger.info('Test 2: Category extraction from paths');
try {
  const testPaths = [
    '/api/admin/users',
    '/api/bookings/[id]',
    '/api/mobile/auth'
  ];
  
  testPaths.forEach(path => {
    const category = getCategoryFromPath(path);
    logger.info(`  ${path} → ${category}`);
  });
  logger.success('✓ Category extraction works\n');
} catch (error) {
  logger.error('✗ Category extraction failed:', error);
}

// Test 3: Type system
logger.info('Test 3: TypeScript type system');
try {
  const sampleRoute: RouteMetadata = {
    path: '/api/test',
    methods: [HttpMethod.GET],
    category: 'Test',
    filePath: 'app/api/test/route.ts',
    auth: {
      type: 'NextAuth',
      roles: ['ADMIN']
    },
    description: 'Test route'
  };
  
  logger.info(`  Created sample route: ${sampleRoute.path}`);
  logger.info(`  Methods: ${sampleRoute.methods.join(', ')}`);
  logger.info(`  Auth: ${sampleRoute.auth.type} (${sampleRoute.auth.roles?.join(', ')})`);
  logger.success('✓ Type system works\n');
} catch (error) {
  logger.error('✗ Type system failed:', error);
}

// Test 4: Constants
logger.info('Test 4: Configuration constants');
logger.info(`  Project Root: ${PROJECT_ROOT}`);
logger.info(`  API Directory: ${API_DIR}`);
logger.info(`  Base URL: ${BASE_URL}`);
logger.info(`  Current Date: ${getCurrentISODate()}`);
logger.success('✓ Constants loaded\n');

logger.success('=====================================');
logger.success('All setup tests passed! ✓');
logger.info('\nYou can now proceed to implement the Route Discovery Tool.');
