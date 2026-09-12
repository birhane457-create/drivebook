const jwt = require('jsonwebtoken');

// Test JWT token structure
const testToken = jwt.sign(
  {
    userId: '699016b397d4ad25232db3b0',
    email: 'test@example.com',
    role: 'INSTRUCTOR',
    instructorId: '699016b397d4ad25232db3b0',
  },
  process.env.NEXTAUTH_SECRET || 'your-secret-key',
  { expiresIn: '30d' }
);

console.log('Test Token:', testToken);

// Decode it to verify
const decoded = jwt.verify(testToken, process.env.NEXTAUTH_SECRET || 'your-secret-key');
console.log('Decoded:', decoded);

// Test the endpoint
const axios = require('axios');

async function testEndpoint() {
  try {
    const response = await axios.get('http://localhost:3000/api/pda-tests/mobile', {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.data);
  }
}

testEndpoint();
