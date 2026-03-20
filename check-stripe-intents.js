// Load env manually
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
});
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const intentIds = [
  'pi_3TCtvNPFqwsHwRMq1YwRkXo6', // booking 1 - PENDING_PAYMENT $885.78
  'pi_3TCdMqPFqwsHwRMq0GWhSTCx', // booking 2 - PENDING $885.78
  'pi_3TCcpSPFqwsHwRMq1WYs4r4l', // booking 3 - PENDING $652.68
  'pi_3TCZCFPFqwsHwRMq1bIei6BA', // booking 4 - PENDING $652.68
  'pi_3TCZ8TPFqwsHwRMq0fTUuX9f', // booking 5 - PENDING $652.68
  'pi_3TCu9WPFqwsHwRMq0UFPeyNL', // booking 6 - PENDING_PAYMENT $725.20
];

async function check() {
  console.log('\n🔍 Checking Stripe payment intents...\n');
  for (const id of intentIds) {
    try {
      const pi = await stripe.paymentIntents.retrieve(id);
      console.log(`${id}`);
      console.log(`  status=${pi.status}  amount=${pi.amount/100}  amount_received=${pi.amount_received/100}`);
      console.log(`  metadata=${JSON.stringify(pi.metadata)}`);
      console.log();
    } catch (e) {
      console.log(`${id} → ERROR: ${e.message}\n`);
    }
  }
}

check().catch(console.error);
