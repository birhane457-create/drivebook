// Test mobile API connection
const API_URL = 'http://192.168.107.108:3000';

async function testConnection() {
  console.log('🔧 Testing Mobile API Connection...\n');
  console.log('API URL:', API_URL);
  console.log('');

  const endpoints = [
    '/api/health',
    '/api/auth/mobile-login',
    '/api/bookings/mobile',
  ];

  for (const endpoint of endpoints) {
    const url = API_URL + endpoint;
    console.log(`Testing: ${endpoint}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 401) {
        console.log('  ✅ Endpoint accessible (requires auth)');
      } else if (response.ok) {
        console.log('  ✅ Endpoint accessible');
      } else {
        console.log('  ⚠️  Endpoint returned error');
      }
    } catch (error) {
      console.log(`  ❌ Connection failed: ${error.message}`);
    }
    console.log('');
  }

  console.log('\n📱 Connection Test Complete');
  console.log('\nIf all endpoints show connection errors:');
  console.log('1. Make sure Next.js dev server is running: npm run dev');
  console.log('2. Check firewall allows port 3000');
  console.log('3. Verify IP address is correct: ipconfig');
  console.log('4. Try using tunnel mode: npx expo start --tunnel');
}

testConnection();
