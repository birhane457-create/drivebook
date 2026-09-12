/**
 * Get Price IDs from Product IDs
 * 
 * Usage: node scripts/get-price-ids-from-products.js
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
        value = value.replace(/^["']|["']$/g, '');
        envVars[key] = value;
      }
    }
  });
}

const PRODUCT_IDS = {
  BASIC: 'prod_U32uuu0tjxJDGg',
  PRO: 'prod_U32wcSZnw9QITt',
  BUSINESS: 'prod_U32x3U4OHEWVr3'
};

async function getPriceIds() {
  console.log('\n🔍 Fetching Price IDs from Stripe...\n');

  const stripeKey = envVars.STRIPE_SECRET_KEY;
  
  if (!stripeKey) {
    console.error('❌ STRIPE_SECRET_KEY not found in .env file\n');
    return;
  }

  const stripe = new Stripe(stripeKey);

  try {
    const priceMapping = {};

    for (const [tier, productId] of Object.entries(PRODUCT_IDS)) {
      console.log(`📦 ${tier} Plan (${productId}):`);
      
      const prices = await stripe.prices.list({
        product: productId,
        active: true
      });

      if (prices.data.length === 0) {
        console.log('  ⚠️  No prices found for this product!\n');
        continue;
      }

      for (const price of prices.data) {
        const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
        const interval = price.recurring?.interval || 'one-time';
        
        console.log(`  • $${amount} / ${interval}`);
        console.log(`    Price ID: ${price.id}`);
        
        // Map to environment variable name
        const intervalKey = interval === 'month' ? 'MONTHLY' : 'ANNUAL';
        const envVarName = `STRIPE_${tier}_${intervalKey}_PRICE_ID`;
        priceMapping[envVarName] = price.id;
      }
      console.log('');
    }

    // Generate .env lines
    console.log('=' .repeat(60));
    console.log('\n✅ Copy these lines to your .env file:\n');
    console.log('# Stripe Subscription Price IDs');
    
    const orderedKeys = [
      'STRIPE_BASIC_MONTHLY_PRICE_ID',
      'STRIPE_BASIC_ANNUAL_PRICE_ID',
      'STRIPE_PRO_MONTHLY_PRICE_ID',
      'STRIPE_PRO_ANNUAL_PRICE_ID',
      'STRIPE_BUSINESS_MONTHLY_PRICE_ID',
      'STRIPE_BUSINESS_ANNUAL_PRICE_ID',
    ];

    for (const key of orderedKeys) {
      if (priceMapping[key]) {
        console.log(`${key}=${priceMapping[key]}`);
      } else {
        console.log(`${key}=price_xxxxxxxxxxxxx  # ⚠️ NOT FOUND`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Next Steps:\n');
    console.log('1. Copy the lines above');
    console.log('2. Add them to your .env file');
    console.log('3. Restart your server: npm run dev');
    console.log('4. Test subscription flow\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getPriceIds();
