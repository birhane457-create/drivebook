#!/usr/bin/env node
/**
 * F-09 Implementation: Wrap all transactions with withSerializableRetry
 * 
 * This script:
 * 1. Finds all prisma.$transaction calls
 * 2. Wraps them with withSerializableRetry
 * 3. Moves audit log calls outside transactions
 */

import { readFileSync, writeFileSync } from 'fs';

const file = 'app/api/stripe/webhook/route.ts';
console.log('F-09: Applying withSerializableRetry wrappers...\n');

let content = readFileSync(file, 'utf8');
const original = content;

// Transaction locations and their operation names
const transactions = [
  { line: 448, name: 'webhook-checkout-session-1', context: 'checkout.session.completed (first)' },
  { line: 562, name: 'webhook-checkout-session-subscription', context: 'checkout.session.completed (subscription)', hasAudit: true },
  { line: 679, name: 'webhook-wallet-payment', context: 'handleWalletPaymentSuccess' },
  { line: 876, name: 'webhook-booking-payment', context: 'payment_intent.succeeded (booking)' },
  { line: 1317, name: 'webhook-booking-payment-failed', context: 'handleBookingPaymentFailed' },
  { line: 1427, name: 'webhook-subscription-updated', context: 'subscription.updated', hasAudit: true },
  { line: 1571, name: 'webhook-subscription-cancelled', context: 'subscription.cancelled', hasAudit: true },
  { line: 1608, name: 'webhook-trial-ending', context: 'handleTrialEnding' },
  { line: 1656, name: 'webhook-invoice-payment-succeeded', context: 'handleInvoicePaymentSucceeded' },
  { line: 1701, name: 'webhook-invoice-payment-failed', context: 'handleInvoicePaymentFailed' },
  { line: 2237, name: 'webhook-checkout-connect-account', context: 'checkout.session.completed (connect)' },
];

console.log(`Found ${transactions.length} transactions to wrap\n`);

// Strategy: Process from bottom to top so line numbers don't shift
transactions.reverse();

let changesMade = 0;

for (const tx of transactions) {
  const lines = content.split('\n');
  
  // Find the transaction start line (0-indexed)
  let txStartLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (i >= tx.line - 10 && i <= tx.line + 10) {
      if (lines[i].includes('prisma.$transaction(async (tx)')) {
        txStartLine = i;
        break;
      }
    }
  }
  
  if (txStartLine === -1) {
    console.log(`⚠️  Could not find transaction at line ${tx.line} (${tx.context})`);
    continue;
  }
  
  // Find the matching closing brace with SERIALIZABLE_TX
  let txEndLine = -1;
  let braceCount = 0;
  let foundStart = false;
  
  for (let i = txStartLine; i < lines.length && i < txStartLine + 500; i++) {
    const line = lines[i];
    
    if (line.includes('$transaction')) {
      foundStart = true;
    }
    
    if (foundStart) {
      // Count braces
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      braceCount += openBraces - closeBraces;
      
      if (line.includes('SERIALIZABLE_TX);')) {
        txEndLine = i;
        break;
      }
    }
  }
  
  if (txEndLine === -1) {
    console.log(`⚠️  Could not find transaction end for line ${tx.line}`);
    continue;
  }
  
  // Check if already wrapped
  if (lines[txStartLine - 1]?.includes('withSerializableRetry') ||
      lines[txStartLine - 2]?.includes('withSerializableRetry')) {
    console.log(`✓ Already wrapped: ${tx.context}`);
    continue;
  }
  
  // Get indentation
  const indent = lines[txStartLine].match(/^(\s*)/)[1];
  
  // Wrap the transaction
  const wrapped = [
    `${indent}await withSerializableRetry(async () => {`,
    `${indent}  ${lines[txStartLine].trim()}`,
    ...lines.slice(txStartLine + 1, txEndLine + 1).map(l => `${indent}  ${l}`),
    `${indent}}, { operationName: '${tx.name}' });`,
  ];
  
  // Replace in lines array
  lines.splice(txStartLine, txEndLine - txStartLine + 1, ...wrapped);
  
  // Join back
  content = lines.join('\n');
  changesMade++;
  
  console.log(`✓ Wrapped: ${tx.context}`);
}

// Write back
if (changesMade > 0) {
  writeFileSync(file, content, 'utf8');
  console.log(`\n✅ Applied ${changesMade} transaction wrappers`);
  console.log(`\nNOTE: Audit log refactoring (3 locations) must be done manually due to complexity.`);
} else {
  console.log('\n⚠️  No changes made - transactions may already be wrapped');
}

console.log('\nDone!');
