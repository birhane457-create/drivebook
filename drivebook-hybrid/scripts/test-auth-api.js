#!/usr/bin/env node

/**
 * Test Authentication API
 * 
 * Tests if NextAuth API endpoints are responding
 * Run: node scripts/test-auth-api.js
 */

const http = require('http');

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

console.log('\n🔐 Testing Authentication API\n');
console.log('='.repeat(60));
console.log(`Base URL: ${BASE_URL}\n`);

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Auth-Test-Script'
      },
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
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

async function testEndpoint(name, path, expectedStatus = 200) {
  try {
    console.log(`Testing: ${name}`);
    console.log(`  Path: ${path}`);
    
    const response = await makeRequest(path);
    
    if (response.status === expectedStatus || (Array.isArray(expectedStatus) && expectedStatus.includes(response.status))) {
      console.log(`  ✅ Status: ${response.status}`);
      
      // Try to parse JSON
      try {
        const json = JSON.parse(response.data);
        console.log(`  📄 Response:`, JSON.stringify(json, null, 2).split('\n').slice(0, 5).join('\n'));
      } catch (e) {
        console.log(`  📄 Response: ${response.data.substring(0, 100)}...`);
      }
      
      return true;
    } else {
      console.log(`  ❌ Status: ${response.status} (expected ${expectedStatus})`);
      console.log(`  📄 Response: ${response.data.substring(0, 200)}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`  ❌ Server not running`);
    } else {
      console.log(`  ❌ Error: ${error.message}`);
    }
    return false;
  } finally {
    console.log('');
  }
}

async function runTests() {
  console.log('Running authentication API tests...\n');
  
  const tests = [
    { name: 'Providers Endpoint', path: '/api/auth/providers', expected: 200 },
    { name: 'CSRF Token Endpoint', path: '/api/auth/csrf', expected: 200 },
    { name: 'Session Endpoint', path: '/api/auth/session', expected: 200 },
    { name: 'Signin Page', path: '/api/auth/signin', expected: [200, 302] }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.path, test.expected);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('='.repeat(60));
  console.log('\n📊 Test Results:\n');
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}\n`);
  
  if (failed === 0) {
    console.log('✅ All authentication endpoints are working!\n');
    console.log('Next steps:');
    console.log('1. Make sure you have restarted your dev server');
    console.log('2. Try logging in at: ' + BASE_URL + '/login');
    console.log('3. If you don\'t have an account, run: npm run create:admin\n');
    process.exit(0);
  } else {
    console.log('❌ Some endpoints are not working.\n');
    console.log('Troubleshooting:');
    console.log('1. Make sure the server is running: npm run dev');
    console.log('2. Check if the NextAuth route exists: app/api/auth/[...nextauth]/route.ts');
    console.log('3. Verify environment variables: npm run check:env');
    console.log('4. Check server logs for errors\n');
    process.exit(1);
  }
}

// Check if server is running first
console.log('Checking if server is running...\n');
makeRequest('/')
  .then(() => {
    console.log('✅ Server is running\n');
    console.log('='.repeat(60));
    console.log('');
    runTests();
  })
  .catch((error) => {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running!\n');
      console.log('Please start the server first:');
      console.log('  npm run dev\n');
      console.log('Then run this test again:');
      console.log('  node scripts/test-auth-api.js\n');
    } else {
      console.log('❌ Error connecting to server:', error.message, '\n');
    }
    process.exit(1);
  });
