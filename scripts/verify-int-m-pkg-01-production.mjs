#!/usr/bin/env node
/**
 * INT-M-PKG-01 Production Verification Script
 * 
 * This script verifies that the mobile package purchase endpoint
 * is properly disabled in production with HTTP 503 response.
 * 
 * Usage:
 *   node scripts/verify-int-m-pkg-01-production.mjs <PRODUCTION_URL>
 * 
 * Example:
 *   node scripts/verify-int-m-pkg-01-production.mjs https://your-app.vercel.app
 */

const PRODUCTION_URL = process.argv[2];

if (!PRODUCTION_URL) {
  console.error('❌ Error: Production URL required');
  console.error('Usage: node scripts/verify-int-m-pkg-01-production.mjs <PRODUCTION_URL>');
  process.exit(1);
}

console.log('='.repeat(70));
console.log('INT-M-PKG-01 Production Verification');
console.log('='.repeat(70));
console.log(`Target: ${PRODUCTION_URL}`);
console.log(`Commit: 91102a3a (expected)`);
console.log();

const testCases = [
  {
    name: 'PROD-1: Kill switch active - valid package attempt',
    payload: {
      packageId: 'pkg_10hours_300',
      providerId: 'valid-provider-id',
      studentId: 'student-123'
    }
  },
  {
    name: 'PROD-2: Kill switch active - IDOR attempt',
    payload: {
      packageId: 'pkg_competitor_stolen',
      providerId: 'attacker-controlled-id',
      studentId: 'attacker-student'
    }
  },
  {
    name: 'PROD-3: Kill switch active - missing fields',
    payload: {
      packageId: 'any-package'
    }
  }
];

async function verifyProduction() {
  const endpoint = `${PRODUCTION_URL}/api/client/packages/mobile`;
  let passed = 0;
  let failed = 0;

  console.log(`Testing endpoint: ${endpoint}\n`);

  for (const test of testCases) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.payload)
      });

      const data = await response.json();

      // Expected: HTTP 503 with kill switch message
      if (response.status === 503) {
        if (data.error?.includes('temporarily unavailable') || 
            data.error?.includes('disabled') ||
            data.message?.includes('temporarily unavailable') ||
            data.message?.includes('disabled')) {
          console.log(`✅ ${test.name}`);
          console.log(`   Status: ${response.status} Service Unavailable`);
          console.log(`   Message: ${data.error || data.message}`);
          passed++;
        } else {
          console.log(`❌ ${test.name}`);
          console.log(`   Status: ${response.status} (correct)`);
          console.log(`   Message: Unexpected - ${JSON.stringify(data)}`);
          failed++;
        }
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Status: ${response.status} (EXPECTED: 503)`);
        console.log(`   Response: ${JSON.stringify(data)}`);
        console.log(`   ⚠️  SECURITY RISK: Endpoint may be active!`);
        failed++;
      }
      console.log();

    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
      console.log();
    }
  }

  console.log('='.repeat(70));
  console.log('Production Verification Results');
  console.log('='.repeat(70));
  console.log(`Passed: ${passed}/${testCases.length}`);
  console.log(`Failed: ${failed}/${testCases.length}`);
  console.log();

  if (failed === 0) {
    console.log('✅ PRODUCTION VERIFICATION PASSED');
    console.log('   INT-M-PKG-01 containment is active in production');
    console.log('   All requests correctly return HTTP 503');
    console.log();
    console.log('Next steps:');
    console.log('1. Verify ENABLE_MOBILE_PACKAGE_PURCHASE env var is NOT set in Vercel');
    console.log('2. Document operational control: No one may enable until root cause fixed');
    console.log('3. Update tracker: Production containment verified');
    console.log('4. Root cause remediation remains open (catalog + payment redesign)');
    process.exit(0);
  } else {
    console.log('❌ PRODUCTION VERIFICATION FAILED');
    console.log('   Security containment may not be active in production!');
    console.log();
    console.log('Required actions:');
    console.log('1. Check deployed commit SHA matches 91102a3a');
    console.log('2. Verify ENABLE_MOBILE_PACKAGE_PURCHASE is not set to "true"');
    console.log('3. Review Vercel deployment logs for build errors');
    console.log('4. Re-deploy if necessary');
    process.exit(1);
  }
}

// Additional: Check if we can retrieve build info
async function checkBuildInfo() {
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('Build Information:');
      console.log(JSON.stringify(data, null, 2));
      console.log();
    }
  } catch (error) {
    // Health endpoint may not exist, continue
  }
}

// Run verification
(async () => {
  await checkBuildInfo();
  await verifyProduction();
})();
