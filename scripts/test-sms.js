// Test Twilio SMS functionality
// Hardcoded credentials from your .env file

async function testSMS() {
  const accountSid = 'ACd97478e87ca4d78d699ca742f636edef';
  const authToken = '585d4a1d2d8e8f399cdd4d5e8948eaa6';
  const fromNumber = '+17089335601';
  
  console.log('🔧 Testing Twilio SMS Configuration...\n');
  console.log('Account SID:', accountSid);
  console.log('From Number:', fromNumber);
  console.log('');

  // Test phone number (your instructor number in international format)
  const testPhone = '+61469335578';
  const testMessage = 'Test SMS from PDA Booking System. Your SMS notifications are working! 🎉';

  console.log(`📱 Sending test SMS to: ${testPhone}\n`);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: testPhone,
          From: fromNumber,
          Body: testMessage,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Twilio API Error:', JSON.stringify(error, null, 2));
      
      if (error.code === 21211) {
        console.log('\n💡 Phone number format issue. Make sure it starts with + and country code.');
        console.log('   Example: +61469335578 (not 0469335578)');
      }
      
      if (error.code === 21608) {
        console.log('\n💡 Unverified number. For trial accounts, you need to verify the recipient phone number.');
        console.log('   Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
        console.log('   Add and verify: ' + testPhone);
      }
      
      return;
    }

    const result = await response.json();
    console.log('✅ SMS sent successfully!');
    console.log('\nMessage Details:');
    console.log('  SID:', result.sid);
    console.log('  Status:', result.status);
    console.log('  To:', result.to);
    console.log('  From:', result.from);
    console.log('  Body:', result.body);
    console.log('\n🎉 SMS service is working correctly!');
    console.log('\n📱 Check your phone for the test message.');
    
  } catch (error) {
    console.error('❌ Error sending SMS:', error.message);
  }
}

testSMS();
