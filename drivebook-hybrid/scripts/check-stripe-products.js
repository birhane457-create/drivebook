/**
 * Check Stripe Products and Price IDs
 * 
 * Run: node scripts/check-stripe-products.js
 */

const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
const envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes
        value = value.replace(/^["']|["']$/g, '');
        envVars[key] = value;
      }
    }
  });
}

async function checkStripeProducts() {
  console.log('\n🔍 Checking Stripe Configuration...\n');

  const stripeKey = envVars.STRIPE_SECRET_KEY;
  
  if (!stripeKey) {
    console.error('❌ STRIPE_SECRET_KEY not found in .env file\n');
    return;
  }

  const stripe = new Stripe(stripeKey);

  try {
    // Test Stripe connection
    console.log('✓ Stripe connection successful');
    console.log(`  Mode: ${stripeKey.startsWith('sk_test') ? 'TEST' : 'LIVE'}\n`);

    // List all products
    console.log('📦 Existing Products in Stripe:\n');
    const products = await stripe.products.list({ limit: 100, active: true });
    
    if (products.data.length === 0) {
      console.log('  ⚠️  No products found. You need to create them first!\n');
    } else {
      for (const product of products.data) {
        console.log(`  • ${product.name} (${product.id})`);
        
        // Get prices for this product
        const prices = await stripe.prices.list({ product: product.id, active: true });
        for (const price of prices.data) {
          const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
          const interval = price.recurring?.interval || 'one-time';
          console.log(`    - $${amount} ${price.currency.toUpperCase()} / ${interval}`);
          console.log(`      Price ID: ${price.id}`);
        }
        console.log('');
      }
    }

    // Check environment variables
    console.log('🔧 Environment Variables Status:\n');
    const requiredPriceIds = [
      'STRIPE_BASIC_MONTHLY_PRICE_ID',
      'STRIPE_BASIC_ANNUAL_PRICE_ID',
      'STRIPE_PRO_MONTHLY_PRICE_ID',
      'STRIPE_PRO_ANNUAL_PRICE_ID',
      'STRIPE_BUSINESS_MONTHLY_PRICE_ID',
      'STRIPE_BUSINESS_ANNUAL_PRICE_ID',
    ];

    let allConfigured = true;
    for (const varName of requiredPriceIds) {
      const value = envVars[varName];
      if (value && !value.startsWith('price_')) {
        console.log(`  ❌ ${varName}: Not configured`);
        allConfigured = false;
      } else if (value) {
        console.log(`  ✓ ${varName}: ${value}`);
      } else {
        console.log(`  ❌ ${varName}: Missing`);
        allConfigured = false;
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    if (!allConfigured) {
      console.log('⚠️  SETUP REQUIRED\n');
      console.log('Follow these steps:\n');
      console.log('1. Go to https://dashboard.stripe.com/test/products');
      console.log('2. Create 3 products:');
      console.log('   • DriveBook Basic ($29/month, $290/year)');
      console.log('   • DriveBook Pro ($79/month, $790/year)');
      console.log('   • DriveBook Business ($199/month, $1990/year)');
      console.log('3. Copy the 6 price IDs (they look like price_xxxxxxxxxxxxx)');
      console.log('4. Add them to your .env file');
      console.log('5. Restart your server\n');
      console.log('📖 See STRIPE_SETUP_GUIDE.md for detailed instructions\n');
    } else {
      console.log('✅ All price IDs configured!\n');
      console.log('Next steps:');
      console.log('1. Enable Billing Portal in Stripe dashboard');
      console.log('2. Restart your server');
      console.log('3. Test subscription flow\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure STRIPE_SECRET_KEY is set in your .env file\n');
  }
}

checkStripeProducts();
