const http = require('http');

console.log('\n🔍 Testing Mobile Login API...\n');
console.log('='.repeat(50));

// Test configuration
const API_HOST = '192.168.2.108';
const PORTS_TO_TEST = [3000, 8083, 8080, 3001];
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

async function testPort(port) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    const options = {
      hostname: API_HOST,
      port: port,
      path: '/api/auth/mobile-login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Check if response is JSON (API) or HTML (web app)
        const isJson = data.trim().startsWith('{');
        resolve({
          port,
          status: res.statusCode,
          isApi: isJson,
          data: data.substring(0, 200)
        });
      });
    });

    req.on('error', () => {
      resolve({ port, status: null, isApi: false });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ port, status: null, isApi: false });
    });

    req.write(postData);
    req.end();
  });
}

async function findApiPort() {
  console.log(`\n🔍 Scanning ports on ${API_HOST}...\n`);
  
  for (const port of PORTS_TO_TEST) {
    process.stdout.write(`   Testing port ${port}... `);
    const result = await testPort(port);
    
    if (result.status === null) {
      console.log('❌ No response');
    } else if (result.isApi) {
      console.log(`✅ API FOUND! (Status: ${result.status})`);
      console.log(`\n🎯 CORRECT PORT: ${port}`);
      console.log(`\n📝 Update mobile/constants/config.ts:`);
      console.log(`   export const API_URL = 'http://${API_HOST}:${port}';`);
      return port;
    } else {
      console.log(`⚠️  Web app (HTML) - not API`);
    }
  }
  
  console.log('\n❌ API not found on any tested port');
  return null;
}

findApiPort().then((port) => {
  if (!port) {
    console.log('\n💡 Make sure your server is running:');
    console.log('   npm run dev');
    console.log('\n   Then check the terminal output for the port number');
  }
  console.log('\n');
});

