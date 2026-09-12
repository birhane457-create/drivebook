const axios = require('axios');

async function testLogin() {
  try {
    console.log('\n=== TESTING MOBILE LOGIN ===');
    console.log('URL: http://192.168.118.108:3000/api/auth/mobile-login');
    console.log('Email: debesay304@gmail.com');
    console.log('Testing...\n');

    const response = await axios.post(
      'http://192.168.118.108:3000/api/auth/mobile-login',
      {
        email: 'debesay304@gmail.com',
        password: 'Debesay@2024'
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ LOGIN SUCCESSFUL!');
    console.log('Status:', response.status);
    console.log('Token received:', !!response.data.token);
    console.log('User data:', JSON.stringify(response.data.user, null, 2));
    
  } catch (error) {
    console.log('❌ LOGIN FAILED');
    
    if (error.code === 'ECONNABORTED') {
      console.log('Error: Connection timeout');
      console.log('The server is not responding. Check:');
      console.log('1. Is the dev server running? (npm run dev)');
      console.log('2. Is the IP address correct?');
      console.log('3. Is the firewall blocking port 3000?');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('Error: Connection refused');
      console.log('The server is not accepting connections on port 3000');
    } else if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n💡 Wrong password! Try:');
        console.log('1. Check the password is correct');
        console.log('2. Try logging in on the web version first');
      }
    } else {
      console.log('Error:', error.message);
    }
  }
}

testLogin();
