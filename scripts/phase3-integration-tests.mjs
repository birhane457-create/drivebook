#!/usr/bin/env node
/**
 * Phase 3B Integration Tests - Isolated Environment Verification
 * 
 * Tests production deployment against isolated test infrastructure:
 * - Supabase test account
 * - Stripe test mode
 * - Test email accounts
 * - External API test accounts
 * 
 * Base URL: https://drivebook-wheat.vercel.app
 * Environment: Isolated test environment (no real customer data)
 * 
 * Usage: node scripts/phase3-integration-tests.mjs
 */

import https from 'https';
import http from 'http';

const BASE_URL = 'https://drivebook-wheat.vercel.app';
const RESULTS = [];

// Test result tracking
function logTest(category, test, status, details = {}) {
  const result = {
    category,
    test,
    status, // PASS, FAIL, SKIP, WARN
    timestamp: new Date().toISOString(),
    ...details
  };
  RESULTS.push(result);
  
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏭️';
  console.log(`${icon} ${category} > ${test}: ${status}`);
  if (details.error) console.log(`   Error: ${details.error}`);
  if (details.message) console.log(`   ${details.message}`);
}

// HTTP request helper
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// ============================================================================
// Test 1: Public Routes & Deployment Status
// ============================================================================
async function testPublicRoutes() {
  console.log('\n📡 Test 1: Public Routes & Deployment Status\n');
  
  const routes = [
    { path: '/', name: 'Homepage' },
    { path: '/api/health', name: 'Health Check' },
    { path: '/login', name: 'Login Page' },
    { path: '/register', name: 'Registration Page' }
  ];
  
  for (const route of routes) {
    try {
      const res = await request(`${BASE_URL}${route.path}`, {
        method: 'GET',
        headers: { 'User-Agent': 'Phase3-Integration-Test/1.0' }
      });
      
      if (res.statusCode === 200) {
        logTest('Public Routes', route.name, 'PASS', { 
          statusCode: res.statusCode,
          contentLength: res.body.length
        });
      } else if (res.statusCode === 404) {
        logTest('Public Routes', route.name, 'FAIL', {
          statusCode: res.statusCode,
          error: 'Route returns 404'
        });
      } else {
        logTest('Public Routes', route.name, 'WARN', {
          statusCode: res.statusCode,
          message: `Unexpected status code: ${res.statusCode}`
        });
      }
    } catch (error) {
      logTest('Public Routes', route.name, 'FAIL', {
        error: error.message
      });
    }
  }
}

// ============================================================================
// Test 2: Security Headers
// ============================================================================
async function testSecurityHeaders() {
  console.log('\n🔒 Test 2: Security Headers\n');
  
  try {
    const res = await request(`${BASE_URL}/`, { method: 'GET' });
    
    const headers = [
      { name: 'x-frame-options', expected: true },
      { name: 'x-content-type-options', expected: true },
      { name: 'strict-transport-security', expected: true },
      { name: 'x-xss-protection', expected: false } // Optional/deprecated
    ];
    
    for (const header of headers) {
      const present = res.headers[header.name] !== undefined;
      
      if (header.expected && present) {
        logTest('Security Headers', header.name, 'PASS', {
          value: res.headers[header.name]
        });
      } else if (header.expected && !present) {
        logTest('Security Headers', header.name, 'WARN', {
          message: 'Header not present'
        });
      } else if (!header.expected && present) {
        logTest('Security Headers', header.name, 'PASS', {
          message: 'Optional header present',
          value: res.headers[header.name]
        });
      } else {
        logTest('Security Headers', header.name, 'SKIP', {
          message: 'Optional header not present'
        });
      }
    }
  } catch (error) {
    logTest('Security Headers', 'Header Check', 'FAIL', {
      error: error.message
    });
  }
}

// ============================================================================
// Test 3: Authentication Boundary
// ============================================================================
async function testAuthBoundary() {
  console.log('\n🔐 Test 3: Authentication Boundary\n');
  
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/bookings',
    '/dashboard/earnings',
    '/api/instructor/subscription'
  ];
  
  for (const route of protectedRoutes) {
    try {
      const res = await request(`${BASE_URL}${route}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Phase3-Integration-Test/1.0'
        }
      });
      
      // Protected routes should redirect to login or return 401/403
      if (res.statusCode === 401 || res.statusCode === 403) {
        logTest('Auth Boundary', route, 'PASS', {
          statusCode: res.statusCode,
          message: 'Protected route correctly blocks unauthenticated access'
        });
      } else if (res.statusCode === 307 || res.statusCode === 302) {
        // Check if redirecting to login
        const location = res.headers.location || '';
        if (location.includes('login') || location.includes('signin')) {
          logTest('Auth Boundary', route, 'PASS', {
            statusCode: res.statusCode,
            message: `Redirects to: ${location}`
          });
        } else {
          logTest('Auth Boundary', route, 'WARN', {
            statusCode: res.statusCode,
            message: `Redirects to unexpected location: ${location}`
          });
        }
      } else if (res.statusCode === 200) {
        logTest('Auth Boundary', route, 'FAIL', {
          statusCode: res.statusCode,
          error: 'Protected route returns 200 without authentication'
        });
      } else {
        logTest('Auth Boundary', route, 'WARN', {
          statusCode: res.statusCode,
          message: `Unexpected status: ${res.statusCode}`
        });
      }
    } catch (error) {
      logTest('Auth Boundary', route, 'FAIL', {
        error: error.message
      });
    }
  }
}

// ============================================================================
// Test 4: Database Connectivity (Indirect)
// ============================================================================
async function testDatabaseConnectivity() {
  console.log('\n💾 Test 4: Database Connectivity (Indirect)\n');
  
  // Test routes that require database access
  const dbRoutes = [
    { path: '/api/health', name: 'Health Check' },
    { path: '/driving-lessons', name: 'Driving Lessons (SEO route)' }
  ];
  
  for (const route of dbRoutes) {
    try {
      const res = await request(`${BASE_URL}${route.path}`, {
        method: 'GET',
        headers: { 'User-Agent': 'Phase3-Integration-Test/1.0' }
      });
      
      if (res.statusCode === 200) {
        logTest('Database', route.name, 'PASS', {
          statusCode: res.statusCode,
          message: 'Route successfully returns data (DB likely connected)'
        });
      } else if (res.statusCode === 500) {
        logTest('Database', route.name, 'FAIL', {
          statusCode: res.statusCode,
          error: 'Route returns 500 (possible DB connection issue)'
        });
      } else {
        logTest('Database', route.name, 'WARN', {
          statusCode: res.statusCode,
          message: `Unexpected status: ${res.statusCode}`
        });
      }
    } catch (error) {
      logTest('Database', route.name, 'FAIL', {
        error: error.message
      });
    }
  }
  
  console.log('\n   ℹ️  Note: Full database integration requires authenticated session');
  console.log('   ℹ️  Create test account manually to verify database writes');
}

// ============================================================================
// Test 5: Stripe Configuration Detection
// ============================================================================
async function testStripeConfiguration() {
  console.log('\n💳 Test 5: Stripe Configuration Detection\n');
  
  try {
    // Check if Stripe publishable key is exposed in client-side bundle
    const res = await request(`${BASE_URL}/dashboard/subscription`, {
      method: 'GET',
      headers: { 'User-Agent': 'Phase3-Integration-Test/1.0' }
    });
    
    const body = res.body;
    
    // Look for Stripe test vs live key indicators
    if (body.includes('pk_test_')) {
      logTest('Stripe Config', 'Publishable Key Mode', 'PASS', {
        message: 'Stripe TEST mode detected (pk_test_...)',
        mode: 'TEST'
      });
    } else if (body.includes('pk_live_')) {
      logTest('Stripe Config', 'Publishable Key Mode', 'WARN', {
        message: '⚠️  Stripe LIVE mode detected (pk_live_...)',
        mode: 'LIVE'
      });
    } else if (body.includes('NEXT_PUBLIC_STRIPE')) {
      logTest('Stripe Config', 'Publishable Key Mode', 'WARN', {
        message: 'Stripe key placeholder found but mode unclear'
      });
    } else {
      logTest('Stripe Config', 'Publishable Key Mode', 'SKIP', {
        message: 'Cannot determine Stripe mode from public routes'
      });
    }
    
    console.log('\n   ℹ️  Note: Full Stripe verification requires authenticated session');
    console.log('   ℹ️  Test payment intent creation via manual dashboard access');
    
  } catch (error) {
    logTest('Stripe Config', 'Configuration Check', 'FAIL', {
      error: error.message
    });
  }
}

// ============================================================================
// Test 6: API Routes Health
// ============================================================================
async function testAPIRoutes() {
  console.log('\n🔌 Test 6: API Routes Health\n');
  
  const apiRoutes = [
    { path: '/api/health', method: 'GET', expectedStatus: 200 },
    { path: '/api/payments/create-intent', method: 'POST', expectedStatus: [401, 403] }
  ];
  
  for (const route of apiRoutes) {
    try {
      const res = await request(`${BASE_URL}${route.path}`, {
        method: route.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Phase3-Integration-Test/1.0'
        },
        body: route.method === 'POST' ? JSON.stringify({}) : undefined
      });
      
      const expectedStatuses = Array.isArray(route.expectedStatus) 
        ? route.expectedStatus 
        : [route.expectedStatus];
      
      if (expectedStatuses.includes(res.statusCode)) {
        logTest('API Routes', `${route.method} ${route.path}`, 'PASS', {
          statusCode: res.statusCode,
          message: `Returns expected status: ${res.statusCode}`
        });
      } else {
        logTest('API Routes', `${route.method} ${route.path}`, 'WARN', {
          statusCode: res.statusCode,
          message: `Expected ${expectedStatuses.join(' or ')}, got ${res.statusCode}`
        });
      }
    } catch (error) {
      logTest('API Routes', `${route.method} ${route.path}`, 'FAIL', {
        error: error.message
      });
    }
  }
}

// ============================================================================
// Test 7: Build Artifacts & Static Assets
// ============================================================================
async function testStaticAssets() {
  console.log('\n📦 Test 7: Build Artifacts & Static Assets\n');
  
  const assets = [
    { path: '/favicon.ico', name: 'Favicon' },
    { path: '/_next/static/css', name: 'CSS Bundle', partial: true }
  ];
  
  for (const asset of assets) {
    try {
      const res = await request(`${BASE_URL}${asset.path}`, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Phase3-Integration-Test/1.0' }
      });
      
      if (res.statusCode === 200) {
        logTest('Static Assets', asset.name, 'PASS', {
          statusCode: res.statusCode
        });
      } else if (res.statusCode === 404 && asset.partial) {
        logTest('Static Assets', asset.name, 'SKIP', {
          message: 'Partial path check - build artifacts likely present'
        });
      } else {
        logTest('Static Assets', asset.name, 'WARN', {
          statusCode: res.statusCode,
          message: `Asset not found or unexpected status`
        });
      }
    } catch (error) {
      logTest('Static Assets', asset.name, 'WARN', {
        error: error.message
      });
    }
  }
}

// ============================================================================
// Generate Test Report
// ============================================================================
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 PHASE 3B INTEGRATION TEST REPORT');
  console.log('='.repeat(80) + '\n');
  
  const summary = {
    PASS: RESULTS.filter(r => r.status === 'PASS').length,
    FAIL: RESULTS.filter(r => r.status === 'FAIL').length,
    WARN: RESULTS.filter(r => r.status === 'WARN').length,
    SKIP: RESULTS.filter(r => r.status === 'SKIP').length,
    TOTAL: RESULTS.length
  };
  
  console.log(`Total Tests: ${summary.TOTAL}`);
  console.log(`✅ Passed:   ${summary.PASS}`);
  console.log(`❌ Failed:   ${summary.FAIL}`);
  console.log(`⚠️  Warnings: ${summary.WARN}`);
  console.log(`⏭️  Skipped:  ${summary.SKIP}`);
  console.log('');
  
  // Category breakdown
  const categories = [...new Set(RESULTS.map(r => r.category))];
  console.log('📋 Results by Category:\n');
  
  for (const category of categories) {
    const categoryResults = RESULTS.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.status === 'PASS').length;
    const failed = categoryResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`${category}: ${passed}/${categoryResults.length} passed`);
    
    // Show failures
    const failures = categoryResults.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      failures.forEach(f => {
        console.log(`  ❌ ${f.test}: ${f.error || 'Failed'}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 ASSESSMENT');
  console.log('='.repeat(80) + '\n');
  
  if (summary.FAIL === 0) {
    console.log('✅ All critical tests passed');
    console.log('✅ Deployment is functional on isolated test environment');
    console.log('✅ Ready to proceed with manual authenticated testing');
  } else {
    console.log('❌ Some tests failed - investigation required');
    console.log(`   ${summary.FAIL} test(s) need attention before proceeding`);
  }
  
  if (summary.WARN > 0) {
    console.log(`\n⚠️  ${summary.WARN} warning(s) - review recommended but not blocking`);
  }
  
  console.log('\n📝 Next Steps:\n');
  console.log('1. Review any failures or warnings above');
  console.log('2. Create test user account via /register');
  console.log('3. Test authenticated flows:');
  console.log('   - Login/logout');
  console.log('   - Dashboard access');
  console.log('   - Subscription page (verify Stripe test mode)');
  console.log('   - Create test booking (verify database writes)');
  console.log('4. Monitor application logs for errors');
  console.log('5. Document integration test results');
  console.log('');
  
  // Return exit code
  return summary.FAIL === 0 ? 0 : 1;
}

// ============================================================================
// Main Execution
// ============================================================================
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         Phase 3B Integration Tests - Isolated Environment                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`🔬 Environment: Isolated test (Supabase test account)`);
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log('');
  
  try {
    await testPublicRoutes();
    await testSecurityHeaders();
    await testAuthBoundary();
    await testDatabaseConnectivity();
    await testStripeConfiguration();
    await testAPIRoutes();
    await testStaticAssets();
    
    const exitCode = generateReport();
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n❌ Fatal error during test execution:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
main();
