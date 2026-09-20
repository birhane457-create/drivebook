#!/usr/bin/env node

/**
 * P0-01 Staging Integration Test Runner
 * 
 * Tests wallet ownership enforcement via staging API
 * 
 * Usage:
 *   node run-p0-01-tests.mjs --env=staging
 *   node run-p0-01-tests.mjs --env=production --dry-run
 * 
 * Prerequisites:
 *   - Set environment variables:
 *     TEST_USER_A_SESSION=<session_token_for_victim>
 *     TEST_USER_B_SESSION=<session_token_for_attacker>
 *     STAGING_URL=https://your-staging.vercel.app
 */

import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';

const config = {
  stagingUrl: process.env.STAGING_URL || 'http://localhost:3000',
  userASession: process.env.TEST_USER_A_SESSION,
  userBSession: process.env.TEST_USER_B_SESSION,
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v')
};

const results = {
  scenarioA: null,
  scenarioB: null,
  scenarioC: null,
  scenarioE: null,
  timestamp: new Date().toISOString(),
  environment: config.stagingUrl
};

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(80), 'cyan');
}

async function makeRequest(endpoint, options = {}) {
  const url = `${config.stagingUrl}${endpoint}`;
  
  if (config.verbose) {
    log(`\n→ ${options.method || 'GET'} ${url}`, 'gray');
    if (options.body) {
      log(`  Body: ${JSON.stringify(JSON.parse(options.body), null, 2)}`, 'gray');
    }
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const body = await response.json().catch(() => ({}));

  if (config.verbose) {
    log(`← Status: ${response.status}`, response.ok ? 'green' : 'red');
    log(`  Response: ${JSON.stringify(body, null, 2)}`, 'gray');
  }

  return { status: response.status, body, headers: response.headers };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function scenarioA_LegitimateTopUp() {
  logSection('Scenario A: Legitimate Wallet Top-Up (Baseline)');
  
  if (!config.userASession) {
    log('⊘ SKIPPED: TEST_USER_A_SESSION not set', 'yellow');
    return { status: 'SKIPPED', reason: 'Missing TEST_USER_A_SESSION' };
  }

  try {
    // Step 1: Create PaymentIntent via Stripe
    log('\nStep 1: Creating PaymentIntent for User A ($50.00)...');
    
    if (config.dryRun) {
      log('  [DRY RUN] Would create Stripe PaymentIntent', 'yellow');
      return { status: 'DRY_RUN' };
    }

    const createIntentRes = await makeRequest('/api/payments/create-intent', {
      method: 'POST',
      headers: {
        'Cookie': `next-auth.session-token=${config.userASession}`
      },
      body: JSON.stringify({
        amount: 50.00,
        type: 'wallet_purchase',
        currency: 'aud'
      })
    });

    if (createIntentRes.status !== 200) {
      throw new Error(`Failed to create PaymentIntent: ${createIntentRes.status}`);
    }

    const { clientSecret, paymentIntentId } = createIntentRes.body;
    log(`  ✓ PaymentIntent created: ${paymentIntentId}`, 'green');

    // Step 2: Note - In real test, payment would be completed via Stripe UI
    // For automated testing, we'd need test mode auto-confirmation
    log('\nStep 2: Payment completion');
    log('  ⚠ Manual step required: Complete payment via Stripe test card', 'yellow');
    log('  ⚠ Use card: 4242 4242 4242 4242, any future date, any CVC', 'yellow');
    
    // For this automated test, we'll skip to wallet-add assuming payment succeeded
    // In real manual test, wait for payment completion before proceeding
    
    log('\n[AUTOMATED TEST LIMITATION]', 'yellow');
    log('This script cannot complete the Stripe payment automatically.', 'yellow');
    log('For full Scenario A testing:', 'yellow');
    log('1. Use the PaymentIntent ID above to complete payment manually', 'yellow');
    log('2. Then call /api/client/wallet-add with that PaymentIntent ID', 'yellow');
    
    return {
      status: 'PARTIAL',
      paymentIntentId,
      message: 'PaymentIntent created, manual completion required'
    };

  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    return { status: 'FAILED', error: error.message };
  }
}

async function scenarioB_CrossUserAttack(victimPaymentIntentId) {
  logSection('Scenario B: Cross-User Attack Attempt (CRITICAL TEST)');
  
  if (!config.userBSession) {
    log('⊘ SKIPPED: TEST_USER_B_SESSION not set', 'yellow');
    return { status: 'SKIPPED', reason: 'Missing TEST_USER_B_SESSION' };
  }

  if (!victimPaymentIntentId) {
    log('⊘ SKIPPED: No victim PaymentIntent ID provided', 'yellow');
    log('  To test: Provide a PaymentIntent ID that belongs to User A', 'yellow');
    return { status: 'SKIPPED', reason: 'No victim PaymentIntent' };
  }

  try {
    log(`\nAttempting to credit attacker wallet with victim's PaymentIntent: ${victimPaymentIntentId}`);
    
    if (config.dryRun) {
      log('  [DRY RUN] Would attempt cross-user wallet credit', 'yellow');
      return { status: 'DRY_RUN' };
    }

    const attackRes = await makeRequest('/api/client/wallet-add', {
      method: 'POST',
      headers: {
        'Cookie': `next-auth.session-token=${config.userBSession}`
      },
      body: JSON.stringify({
        amount: 50.00,
        paymentIntentId: victimPaymentIntentId
      })
    });

    // CRITICAL: Attack MUST be blocked with 403
    assert(
      attackRes.status === 403,
      `Expected HTTP 403, got ${attackRes.status}`
    );

    assert(
      attackRes.body.error && attackRes.body.error.includes('different account'),
      `Expected ownership error, got: ${attackRes.body.error}`
    );

    log('✓ Attack blocked with HTTP 403', 'green');
    log(`✓ Error message: "${attackRes.body.error}"`, 'green');
    log('\n✅ SCENARIO B PASSED: P0-01 fix working correctly', 'green');

    return {
      status: 'PASSED',
      blockedStatus: attackRes.status,
      errorMessage: attackRes.body.error
    };

  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    log('⚠ CRITICAL: Cross-user attack was NOT blocked!', 'red');
    return { status: 'FAILED', error: error.message, severity: 'CRITICAL' };
  }
}

async function scenarioC_MissingMetadata() {
  logSection('Scenario C: Missing Metadata Attack (Fail-Closed)');
  
  if (!config.userBSession) {
    log('⊘ SKIPPED: TEST_USER_B_SESSION not set', 'yellow');
    return { status: 'SKIPPED', reason: 'Missing TEST_USER_B_SESSION' };
  }

  try {
    log('\nAttempting to use PaymentIntent without userId metadata...');
    log('  Note: This requires a PaymentIntent created directly via Stripe API', 'yellow');
    log('  For automated testing, using a fake PaymentIntent ID', 'yellow');
    
    const fakePaymentIntentId = 'pi_no_metadata_test_12345';

    if (config.dryRun) {
      log('  [DRY RUN] Would test missing metadata rejection', 'yellow');
      return { status: 'DRY_RUN' };
    }

    const testRes = await makeRequest('/api/client/wallet-add', {
      method: 'POST',
      headers: {
        'Cookie': `next-auth.session-token=${config.userBSession}`
      },
      body: JSON.stringify({
        amount: 50.00,
        paymentIntentId: fakePaymentIntentId
      })
    });

    // Should be rejected (400 or 403)
    assert(
      testRes.status === 400 || testRes.status === 403,
      `Expected HTTP 400/403, got ${testRes.status}`
    );

    log(`✓ Rejected with HTTP ${testRes.status}`, 'green');
    log(`✓ Error message: "${testRes.body.error}"`, 'green');
    log('\n✅ SCENARIO C PASSED: Missing metadata handled correctly', 'green');

    return {
      status: 'PASSED',
      blockedStatus: testRes.status,
      errorMessage: testRes.body.error
    };

  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    return { status: 'FAILED', error: error.message };
  }
}

async function scenarioE_Idempotency(paymentIntentId) {
  logSection('Scenario E: Idempotency (Duplicate Prevention)');
  
  if (!config.userASession) {
    log('⊘ SKIPPED: TEST_USER_A_SESSION not set', 'yellow');
    return { status: 'SKIPPED', reason: 'Missing TEST_USER_A_SESSION' };
  }

  if (!paymentIntentId) {
    log('⊘ SKIPPED: No PaymentIntent ID provided', 'yellow');
    return { status: 'SKIPPED', reason: 'No PaymentIntent for idempotency test' };
  }

  try {
    log(`\nAttempting duplicate wallet-add with same PaymentIntent: ${paymentIntentId}`);
    
    if (config.dryRun) {
      log('  [DRY RUN] Would test idempotency', 'yellow');
      return { status: 'DRY_RUN' };
    }

    // First call (should succeed or return duplicate if already processed)
    const firstCall = await makeRequest('/api/client/wallet-add', {
      method: 'POST',
      headers: {
        'Cookie': `next-auth.session-token=${config.userASession}`
      },
      body: JSON.stringify({
        amount: 50.00,
        paymentIntentId
      })
    });

    log(`  First call: HTTP ${firstCall.status}`);

    // Second call (should return duplicate)
    const secondCall = await makeRequest('/api/client/wallet-add', {
      method: 'POST',
      headers: {
        'Cookie': `next-auth.session-token=${config.userASession}`
      },
      body: JSON.stringify({
        amount: 50.00,
        paymentIntentId
      })
    });

    log(`  Second call: HTTP ${secondCall.status}`);

    // Second call should either:
    // - Return 200 with duplicate: true
    // - Return 409 Conflict
    assert(
      secondCall.status === 200 || secondCall.status === 409,
      `Expected HTTP 200 or 409, got ${secondCall.status}`
    );

    if (secondCall.status === 200) {
      assert(
        secondCall.body.duplicate === true,
        'Expected duplicate flag in response'
      );
    }

    log('✓ Idempotency working correctly', 'green');
    log('\n✅ SCENARIO E PASSED: Duplicate credits prevented', 'green');

    return {
      status: 'PASSED',
      firstCallStatus: firstCall.status,
      secondCallStatus: secondCall.status,
      duplicateFlag: secondCall.body.duplicate
    };

  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    return { status: 'FAILED', error: error.message };
  }
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║         P0-01 Staging Integration Test Suite                              ║', 'cyan');
  log('║         Wallet Ownership Bypass Vulnerability Testing                     ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan');

  log('\nConfiguration:', 'cyan');
  log(`  Environment: ${config.stagingUrl}`);
  log(`  User A Session: ${config.userASession ? '✓ Set' : '✗ Not set'}`);
  log(`  User B Session: ${config.userBSession ? '✓ Set' : '✗ Not set'}`);
  log(`  Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE TEST'}`);
  log(`  Verbose: ${config.verbose ? 'ON' : 'OFF'}`);

  if (!config.userASession || !config.userBSession) {
    log('\n⚠ WARNING: Missing session tokens', 'yellow');
    log('Set environment variables:', 'yellow');
    log('  export TEST_USER_A_SESSION="<victim_session_token>"', 'yellow');
    log('  export TEST_USER_B_SESSION="<attacker_session_token>"', 'yellow');
    log('\nSome tests will be skipped.\n', 'yellow');
  }

  // Run test scenarios
  results.scenarioA = await scenarioA_LegitimateTopUp();
  
  // For Scenario B, provide a known victim PaymentIntent ID
  // In automated testing, this would come from Scenario A or be pre-created
  const victimPaymentIntentId = process.env.VICTIM_PAYMENT_INTENT_ID || null;
  results.scenarioB = await scenarioB_CrossUserAttack(victimPaymentIntentId);
  
  results.scenarioC = await scenarioC_MissingMetadata();
  
  // For Scenario E, use same PaymentIntent from Scenario A
  const idempotencyTestId = results.scenarioA?.paymentIntentId || 
                            process.env.IDEMPOTENCY_TEST_PAYMENT_INTENT_ID || 
                            null;
  results.scenarioE = await scenarioE_Idempotency(idempotencyTestId);

  // Summary
  logSection('Test Results Summary');
  
  const scenarios = [
    { name: 'Scenario A: Legitimate Top-Up', result: results.scenarioA },
    { name: 'Scenario B: Cross-User Attack', result: results.scenarioB },
    { name: 'Scenario C: Missing Metadata', result: results.scenarioC },
    { name: 'Scenario E: Idempotency', result: results.scenarioE }
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  scenarios.forEach(({ name, result }) => {
    const status = result?.status || 'UNKNOWN';
    let symbol = '?';
    let color = 'gray';

    if (status === 'PASSED') {
      symbol = '✓';
      color = 'green';
      passed++;
    } else if (status === 'FAILED') {
      symbol = '✗';
      color = 'red';
      failed++;
    } else if (status === 'SKIPPED' || status === 'DRY_RUN' || status === 'PARTIAL') {
      symbol = '⊘';
      color = 'yellow';
      skipped++;
    }

    log(`  ${symbol} ${name}: ${status}`, color);
  });

  log('\n' + '─'.repeat(80), 'gray');
  log(`  Total: ${scenarios.length} tests`, 'cyan');
  log(`  Passed: ${passed}`, 'green');
  log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'gray');
  log(`  Skipped: ${skipped}`, 'yellow');

  // Critical assessment
  log('\n' + '═'.repeat(80), 'cyan');
  if (results.scenarioB?.status === 'FAILED') {
    log('⚠ CRITICAL FAILURE: P0-01 vulnerability still exploitable!', 'red');
    log('Cross-user attack was NOT blocked. DO NOT deploy to production.', 'red');
    process.exit(1);
  } else if (results.scenarioB?.status === 'PASSED') {
    log('✅ P0-01 CRITICAL TEST PASSED: Cross-user attack successfully blocked', 'green');
    log('Wallet ownership enforcement is working correctly.', 'green');
  } else {
    log('⚠ INCONCLUSIVE: Critical Scenario B was not executed', 'yellow');
    log('Cannot verify P0-01 fix without cross-user attack test.', 'yellow');
  }
  log('═'.repeat(80), 'cyan');

  // Save results
  try {
    await mkdir('tests/integration/results', { recursive: true });
    const resultsFile = `tests/integration/results/p0-01-test-${Date.now()}.json`;
    const fs = await import('fs/promises');
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    log(`\nResults saved to: ${resultsFile}`, 'gray');
  } catch (err) {
    log(`\nWarning: Could not save results: ${err.message}`, 'yellow');
  }

  log('');
}

main().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
