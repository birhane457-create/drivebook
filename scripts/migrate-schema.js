#!/usr/bin/env node

/**
 * Schema Migration Script
 * 
 * This script helps you migrate the database schema to add:
 * - ClientWallet model
 * - WalletTransaction model
 * - Package tracking fields in Booking model
 * - New indexes for better performance
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🚀 Database Schema Migration\n');
  console.log('This will update your database schema to add:');
  console.log('  ✅ ClientWallet model for credit/balance tracking');
  console.log('  ✅ WalletTransaction model for transaction history');
  console.log('  ✅ Package tracking fields in Booking model');
  console.log('  ✅ New indexes for better query performance\n');

  const answer = await question('Do you want to proceed? (yes/no): ');
  
  if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
    console.log('\n❌ Migration cancelled\n');
    rl.close();
    return;
  }

  console.log('\n📦 Step 1: Pushing schema to database...\n');
  
  try {
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('\n✅ Schema pushed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error pushing schema:', error.message);
    console.log('\nPlease check your database connection and try again.\n');
    rl.close();
    process.exit(1);
  }

  console.log('📦 Step 2: Generating Prisma Client...\n');
  
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('\n✅ Prisma Client generated successfully!\n');
  } catch (error) {
    console.error('\n❌ Error generating client:', error.message);
    rl.close();
    process.exit(1);
  }

  console.log('🎉 Migration Complete!\n');
  console.log('Next steps:');
  console.log('  1. Restart your development server');
  console.log('  2. Test the package tracking at /dashboard/packages');
  console.log('  3. Test the wallet system at /dashboard/wallet');
  console.log('  4. Create a test booking to verify everything works\n');

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
