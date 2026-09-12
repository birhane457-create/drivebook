#!/usr/bin/env node

/**
 * Pre-Deployment Checklist
 * 
 * Runs all checks before deploying to production
 * Run: node scripts/pre-deploy-check.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🚀 Pre-Deployment Checklist\n');
console.log('='.repeat(60));

const checks = [];

// Helper function to run command
function runCommand(command, description) {
  try {
    execSync(command, { stdio: 'pipe' });
    return { success: true, message: description };
  } catch (error) {
    return { success: false, message: description, error: error.message };
  }
}

// Helper function to check file exists
function fileExists(filePath) {
  return fs.existsSync(path.join(process.cwd(), filePath));
}

console.log('\n1️⃣  Checking Environment Configuration...\n');

// Check .env file
if (fileExists('.env')) {
  console.log('✅ .env file exists');
  checks.push({ name: '.env file', passed: true });
} else {
  console.log('❌ .env file missing');
  checks.push({ name: '.env file', passed: false });
}

// Check critical env vars
const criticalEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'STRIPE_SECRET_KEY'
];

require('dotenv').config();
let envVarsOk = true;
criticalEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.log(`❌ Missing: ${varName}`);
    envVarsOk = false;
  }
});

if (envVarsOk) {
  console.log('✅ All critical environment variables set');
  checks.push({ name: 'Environment variables', passed: true });
} else {
  checks.push({ name: 'Environment variables', passed: false });
}

console.log('\n2️⃣  Checking Database...\n');

// Check Prisma schema
const schemaCheck = runCommand('npx prisma validate', 'Prisma schema validation');
if (schemaCheck.success) {
  console.log('✅ Prisma schema is valid');
  checks.push({ name: 'Prisma schema', passed: true });
} else {
  console.log('❌ Prisma schema validation failed');
  checks.push({ name: 'Prisma schema', passed: false });
}

// Check if Prisma client is generated
if (fileExists('node_modules/.prisma/client')) {
  console.log('✅ Prisma client is generated');
  checks.push({ name: 'Prisma client', passed: true });
} else {
  console.log('❌ Prisma client not generated (run: npx prisma generate)');
  checks.push({ name: 'Prisma client', passed: false });
}

console.log('\n3️⃣  Checking TypeScript...\n');

// Check TypeScript compilation
const tsCheck = runCommand('npx tsc --noEmit', 'TypeScript compilation');
if (tsCheck.success) {
  console.log('✅ TypeScript compiles without errors');
  checks.push({ name: 'TypeScript compilation', passed: true });
} else {
  console.log('⚠️  TypeScript has errors (check with: npx tsc --noEmit)');
  checks.push({ name: 'TypeScript compilation', passed: false });
}

console.log('\n4️⃣  Checking Dependencies...\n');

// Check if node_modules exists
if (fileExists('node_modules')) {
  console.log('✅ Dependencies installed');
  checks.push({ name: 'Dependencies', passed: true });
} else {
  console.log('❌ Dependencies not installed (run: npm install)');
  checks.push({ name: 'Dependencies', passed: false });
}

// Check for security vulnerabilities
console.log('\n   Checking for security vulnerabilities...');
const auditCheck = runCommand('npm audit --audit-level=high', 'Security audit');
if (auditCheck.success) {
  console.log('✅ No high-severity vulnerabilities');
  checks.push({ name: 'Security audit', passed: true });
} else {
  console.log('⚠️  Security vulnerabilities found (run: npm audit)');
  checks.push({ name: 'Security audit', passed: false });
}

console.log('\n5️⃣  Checking Build...\n');

// Try to build
console.log('   Building application (this may take a minute)...');
const buildCheck = runCommand('npm run build', 'Next.js build');
if (buildCheck.success) {
  console.log('✅ Application builds successfully');
  checks.push({ name: 'Build', passed: true });
} else {
  console.log('❌ Build failed (run: npm run build)');
  checks.push({ name: 'Build', passed: false });
}

console.log('\n6️⃣  Checking Critical Files...\n');

const criticalFiles = [
  'package.json',
  'next.config.js',
  'tsconfig.json',
  'tailwind.config.ts',
  'prisma/schema.prisma',
  'lib/auth.ts',
  'lib/prisma.ts'
];

let filesOk = true;
criticalFiles.forEach(file => {
  if (fileExists(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ Missing: ${file}`);
    filesOk = false;
  }
});

checks.push({ name: 'Critical files', passed: filesOk });

console.log('\n7️⃣  Checking Documentation...\n');

const docFiles = [
  'README.md',
  'DEPLOY_NOW.md',
  'PLATFORM_READY_TO_LAUNCH.md'
];

let docsOk = true;
docFiles.forEach(file => {
  if (fileExists(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`⚠️  Missing: ${file}`);
    docsOk = false;
  }
});

checks.push({ name: 'Documentation', passed: docsOk });

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:\n');

const passed = checks.filter(c => c.passed).length;
const failed = checks.filter(c => !c.passed).length;

checks.forEach(check => {
  const icon = check.passed ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
});

console.log(`\n✅ Passed: ${passed}/${checks.length}`);
console.log(`❌ Failed: ${failed}/${checks.length}`);

console.log('\n' + '='.repeat(60));

if (failed === 0) {
  console.log('\n🎉 All checks passed! Your platform is ready to deploy!\n');
  console.log('Next steps:');
  console.log('1. Review your environment variables for production');
  console.log('2. Set up your production database');
  console.log('3. Configure Stripe webhooks');
  console.log('4. Deploy to your hosting platform');
  console.log('5. Run post-deployment tests\n');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed. Please fix the issues above before deploying.\n');
  process.exit(1);
}
