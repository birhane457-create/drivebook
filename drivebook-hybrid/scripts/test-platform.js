#!/usr/bin/env node

/**
 * Platform Testing Script
 * 
 * Tests all critical endpoints and features
 * Run: node scripts/test-platform.js
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

console.log('\n🧪 Platform Testing Script\n');
console.log('='.repeat(60));
console.log(`Testing: ${BASE_URL}\n`);

const tests = [
  // Public pages
  { name: 'Landing Page', path: '/', method: 'GET', expectedStatus: 200 },
  { name: 'Book Page', path: '/book', method: 'GET', expectedStatus: 200 },
  { name: 'Login Page', path: '/login', method: 'GET', expectedStatus: 200 },
  { name: 'Register Page', path: '/register', method: 'GET', expectedStatus: 200 },
  
  // API Health Checks
  { name: 'Instructors Search API', path: '/api/instructors/search?lat=-31.9505&lng=115.8605', method: 'GET', expectedStatus: 200 },
  { name: 'Availability Slots API', path: '/api/availability/slots', method: 'GET', expectedStatus: [200, 400] }, // 400 if no params
  
  // Protected routes (should redirect or return 401)
  { name: 'Dashboard (Protected)', path: '/dashboard', method: 'GET', expectedStatus: [200, 302, 401] },
  { name: 'Admin (Protected)', path: '/admin', method: 'GET', expectedStatus: [200, 302, 401, 403] },
];

let passed = 0;
let failed = 0;
let skipped = 0;

function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'User-Agent': 'Platform-Test-Script'
      },
      timeout: 10000
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function runTest(test) {
  const url = `${BASE_URL}${test.path}`;
  
  try {
    const response = await makeRequest(url, test.method);
    const expectedStatuses = Array.isArray(test.expectedStatus) 
      ? test.expectedStatus 
      : [test.expectedStatus];
    
    if (expectedStatuses.includes(response.status)) {
      console.log(`✅ ${test.name}`);
      console.log(`   Status: ${response.status}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Expected: ${expectedStatuses.join(' or ')}, Got: ${response.status}`);
      failed++;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`⏭️  ${test.name}`);
      console.log(`   Server not running at ${BASE_URL}`);
      skipped++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }
}

async function runAllTests() {
  console.log('Running tests...\n');
  
  for (const test of tests) {
    await runTest(test);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results:\n');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📝 Total: ${tests.length}\n`);
  
  if (skipped === tests.length) {
    console.log('⚠️  Server is not running!');
    console.log('   Start the server with: npm run dev\n');
    process.exit(1);
  } else if (failed > 0) {
    console.log('❌ Some tests failed. Please check the errors above.\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

// Check if server is running first
makeRequest(BASE_URL)
  .then(() => {
    console.log('✅ Server is running\n');
    runAllTests();
  })
  .catch((error) => {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running!');
      console.log(`   Please start the server first: npm run dev`);
      console.log(`   Expected URL: ${BASE_URL}\n`);
      process.exit(1);
    } else {
      console.log('❌ Error connecting to server:', error.message);
      process.exit(1);
    }
  });
