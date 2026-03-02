// Script to show your computer's IP address for mobile app configuration
const os = require('os');

console.log('\n🌐 Your Computer\'s IP Addresses:\n');

const interfaces = os.networkInterfaces();
let found = false;

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    // Skip internal and non-IPv4 addresses
    if (iface.family === 'IPv4' && !iface.internal) {
      console.log(`✅ ${name}: ${iface.address}`);
      found = true;
    }
  }
}

if (!found) {
  console.log('❌ No external IPv4 addresses found');
  console.log('\nTry running: ipconfig (Windows) or ifconfig (Mac/Linux)');
} else {
  console.log('\n📱 Use one of these addresses in mobile/constants/config.ts:');
  console.log('   export const API_URL = \'http://YOUR_IP:3000\';');
  console.log('\n💡 Make sure your phone is on the same WiFi network!\n');
}
