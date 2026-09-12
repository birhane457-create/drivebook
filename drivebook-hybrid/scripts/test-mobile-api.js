const axios = require('axios');

// Test mobile login API
async function testMobileLogin() {
  console.log('\n🔍 Testing Mobile Login API...\n');
  console.log('='.repeat(50));

  // Get API URL from mobile config
  const API_URL = 'http://192.168.2.108:8083';
  
  console.log(`\n📡 API URL: ${API_URL}`);
  console.log(`\n1️⃣ Testing server connection...`);
  
  try {
    // Test 1: Check if server is reachable
    const healthCheck = await axios.get(`${API_URL}/api/health`, {
      timeout: 5000
    }).catch(err => {
      console.log(`❌ Server not reachable at ${API_URL}`);
      console.log(`   Error: ${err.message}`);
      return null;
    });

    if (!healthCheck) {
      console.log('\n💡 Possible issues:');
      console.log('   1. Server is not running on port 8083');
      console.log('   2. IP address has changed');
      console.log('   3. Firewall is blocking the connection');
      console.log('\n🔧 Solutions:');
      console.log('   1. Check if server is running: npm run dev');
      console.log('   2. Get your current IP: ipconfig (Windows) or ifconfig (Mac/Linux)');
      console.log('   3. Update mobile/constants/config.ts with correct IP and port');
      return;
    }

    console.log('✅ Server is reachable!');

    // Test 2: Test mobile login endpoint
    console.log(`\n2️⃣ Testing mobile login endpoint...`);
    
    const testEmail = 'test@example.com';
    const testPassword = 'password123';
    
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    
    try {
      const loginResponse = await axios.post(
        `${API_URL}/api/auth/mobile-login`,
        {
          email: testEmail,
          password: testPassword
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('✅ Login successful!');
      console.log('\n📦 Response:');
      console.log(JSON.stringify(loginResponse.data, null, 2));
      
    } catch (loginError) {
      if (loginError.response) {
        console.log(`❌ Login failed with status ${loginError.response.status}`);
        console.log(`   Error: ${loginError.response.data.error || 'Unknown error'}`);
        
        if (loginError.response.status === 401) {
          console.log('\n💡 This is expected if the test credentials don\'t exist.');
          console.log('   Try with your actual instructor credentials.');
        }
      } else {
        console.log(`❌ Request failed: ${loginError.message}`);
      }
    }

    // Test 3: Check what port the server is actually running on
    console.log(`\n3️⃣ Checking alternative ports...`);
    
    const portsToTry = [3000, 8083, 8080, 3001];
    
    for (const port of portsToTry) {
      try {
        const testUrl = `http://192.168.2.108:${port}/api/auth/mobile-login`;
        await axios.post(testUrl, {}, { timeout: 2000 });
        console.log(`✅ Server responding on port ${port}`);
      } catch (err) {
        if (err.response) {
          console.log(`✅ Server found on port ${port} (responded with ${err.response.status})`);
        } else {
          console.log(`❌ No server on port ${port}`);
        }
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n📝 Summary:');
  console.log('   1. Make sure your server is running: npm run dev');
  console.log('   2. Check the port in the terminal output');
  console.log('   3. Update mobile/constants/config.ts with correct IP:PORT');
  console.log('   4. Make sure phone and computer are on same network');
  console.log('\n');
}

testMobileLogin();
