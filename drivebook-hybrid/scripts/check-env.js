#!/usr/bin/env node

/**
 * Environment Variable Checker
 * 
 * Run this script to validate your environment configuration:
 * node scripts/check-env.js
 */

const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const envVars = [
  // Critical
  { name: 'DATABASE_URL', required: true, category: 'Database' },
  { name: 'NEXTAUTH_URL', required: true, category: 'Authentication' },
  { name: 'NEXTAUTH_SECRET', required: true, category: 'Authentication' },
  { name: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', required: true, category: 'Maps' },
  { name: 'STRIPE_PUBLISHABLE_KEY', required: true, category: 'Payment' },
  { name: 'STRIPE_SECRET_KEY', required: true, category: 'Payment' },
  
  // Important
  { name: 'STRIPE_WEBHOOK_SECRET', required: false, category: 'Payment', importance: 'production' },
  { name: 'SMTP_HOST', required: false, category: 'Email', importance: 'recommended' },
  { name: 'SMTP_PORT', required: false, category: 'Email', importance: 'recommended' },
  { name: 'SMTP_USER', required: false, category: 'Email', importance: 'recommended' },
  { name: 'SMTP_PASS', required: false, category: 'Email', importance: 'recommended' },
  { name: 'SMTP_FROM', required: false, category: 'Email', importance: 'recommended' },
  
  // Optional
  { name: 'PLATFORM_NAME', required: false, category: 'Platform', importance: 'optional' },
  { name: 'ADMIN_EMAIL', required: false, category: 'Platform', importance: 'optional' },
  { name: 'PLATFORM_COMMISSION_RATE', required: false, category: 'Platform', importance: 'optional' },
  { name: 'TWILIO_ACCOUNT_SID', required: false, category: 'SMS', importance: 'optional' },
  { name: 'TWILIO_AUTH_TOKEN', required: false, category: 'SMS', importance: 'optional' },
  { name: 'TWILIO_PHONE_NUMBER', required: false, category: 'SMS', importance: 'optional' },
  { name: 'GOOGLE_CLIENT_ID', required: false, category: 'Calendar', importance: 'optional' },
  { name: 'GOOGLE_CLIENT_SECRET', required: false, category: 'Calendar', importance: 'optional' },
  { name: 'GOOGLE_REDIRECT_URI', required: false, category: 'Calendar', importance: 'optional' }
];

function checkEnv() {
  console.log('\n🔍 Environment Variable Check\n');
  console.log('='.repeat(60));
  
  const results = {
    critical: { configured: 0, missing: 0, vars: [] },
    production: { configured: 0, missing: 0, vars: [] },
    recommended: { configured: 0, missing: 0, vars: [] },
    optional: { configured: 0, missing: 0, vars: [] }
  };
  
  // Group by category
  const categories = {};
  envVars.forEach(v => {
    if (!categories[v.category]) categories[v.category] = [];
    categories[v.category].push(v);
  });
  
  // Check each category
  Object.keys(categories).forEach(category => {
    console.log(`\n📁 ${category}:`);
    
    categories[category].forEach(({ name, required, importance = 'optional' }) => {
      const value = process.env[name];
      const status = value ? '✅' : '❌';
      const type = required ? 'critical' : importance;
      
      if (value) {
        results[type].configured++;
        // Mask sensitive values
        const displayValue = name.includes('SECRET') || name.includes('PASS') || name.includes('TOKEN')
          ? '***' + value.slice(-4)
          : value.length > 50
          ? value.slice(0, 30) + '...'
          : value;
        console.log(`  ${status} ${name}: ${displayValue}`);
      } else {
        results[type].missing++;
        results[type].vars.push(name);
        console.log(`  ${status} ${name}: NOT SET`);
      }
    });
  });
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');
  
  console.log(`✅ Critical (Required): ${results.critical.configured}/${results.critical.configured + results.critical.missing}`);
  if (results.critical.missing > 0) {
    console.log(`   Missing: ${results.critical.vars.join(', ')}`);
  }
  
  console.log(`⚠️  Production: ${results.production.configured}/${results.production.configured + results.production.missing}`);
  if (results.production.missing > 0) {
    console.log(`   Missing: ${results.production.vars.join(', ')}`);
  }
  
  console.log(`💡 Recommended: ${results.recommended.configured}/${results.recommended.configured + results.recommended.missing}`);
  if (results.recommended.missing > 0) {
    console.log(`   Missing: ${results.recommended.vars.join(', ')}`);
  }
  
  console.log(`🔧 Optional: ${results.optional.configured}/${results.optional.configured + results.optional.missing}`);
  if (results.optional.missing > 0) {
    console.log(`   Missing: ${results.optional.vars.join(', ')}`);
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Final verdict
  if (results.critical.missing > 0) {
    console.log('\n❌ CRITICAL: Missing required environment variables!');
    console.log('   Your application will not work without these.\n');
    console.log('   Please add them to your .env file.\n');
    process.exit(1);
  } else if (results.production.missing > 0) {
    console.log('\n⚠️  WARNING: Missing production-critical variables!');
    console.log('   Your application will work in development but may fail in production.\n');
  } else if (results.recommended.missing > 0) {
    console.log('\n💡 INFO: Some recommended features are not configured.');
    console.log('   Your application will work but some features may be limited.\n');
  } else {
    console.log('\n✅ SUCCESS: All environment variables are configured!\n');
  }
}

checkEnv();
