/**
 * Creates the DriveBook AI Receptionist assistant in Vapi.
 * Run: node create-vapi-assistant.js YOUR_VAPI_PRIVATE_KEY
 *
 * Vapi API v2: tools are created separately, then referenced by ID in the assistant.
 */

const https = require('https');

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Usage: node create-vapi-assistant.js YOUR_VAPI_PRIVATE_KEY');
  process.exit(1);
}

const BASE_URL = 'drivebook-production-12ab.up.railway.app';

function vapiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.vapi.ai',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const TOOL_DEFINITIONS = [
  {
    name: 'validateLocation',
    description: 'Validate and geocode a pickup location. Call this first before searching for instructors.',
    inputSchema: {
      type: 'object',
      properties: {
        pickupLocation: { type: 'string', description: "Suburb, postcode or address e.g. 'Maylands 6051'" }
      },
      required: ['pickupLocation']
    },
    url: `https://${BASE_URL}/api/locations/validate`,
    method: 'POST'
  },
  {
    name: 'findInstructors',
    description: 'Find driving instructors by location or name. Always pass location. Returns instructors with id, name, hourlyRate.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Suburb, postcode or formatted address. ALWAYS provide this.' },
        name: { type: 'string', description: 'Instructor name for searching a specific person.' }
      }
    },
    url: `https://${BASE_URL}/api/instructors/search`,
    method: 'GET'
  },
  {
    name: 'getPackages',
    description: 'Get lesson package pricing for an instructor. Always call after finding instructor.',
    inputSchema: {
      type: 'object',
      properties: {
        instructorId: { type: 'string', description: 'Instructor ID from findInstructors' }
      },
      required: ['instructorId']
    },
    url: `https://${BASE_URL}/api/packages`,
    method: 'GET'
  },
  {
    name: 'getAvailableSlots',
    description: 'Get available lesson time slots. Use lessonDurationMinutes=60.',
    inputSchema: {
      type: 'object',
      properties: {
        instructorId: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD format' },
        lessonDurationMinutes: { type: 'integer', description: 'Always 60', default: 60 }
      },
      required: ['instructorId', 'date']
    },
    url: `https://${BASE_URL}/api/availability/slots`,
    method: 'GET'
  },
  {
    name: 'createBooking',
    description: 'Create a booking. Only call after verbal confirmation. Never send pricing field.',
    inputSchema: {
      type: 'object',
      properties: {
        instructorId: { type: 'string' },
        packageType: { type: 'string', enum: ['PACKAGE_6', 'PACKAGE_10', 'PACKAGE_15'] },
        hours: { type: 'integer' },
        bookingType: { type: 'string', enum: ['now'] },
        registrationType: { type: 'string', enum: ['myself'] },
        includeTestPackage: { type: 'boolean', default: false },
        accountHolderName: { type: 'string' },
        accountHolderEmail: { type: 'string' },
        accountHolderPhone: { type: 'string', description: '10-digit Australian mobile, no spaces' },
        scheduledBookings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'YYYY-MM-DD' },
              time: { type: 'string', description: 'HH:MM 24-hour' },
              duration: { type: 'integer', default: 60 },
              pickupLocation: { type: 'string' },
              notes: { type: 'string', default: '' },
              isShortNotice: { type: 'boolean', default: false }
            },
            required: ['date', 'time', 'duration', 'pickupLocation']
          }
        }
      },
      required: ['instructorId', 'packageType', 'hours', 'bookingType', 'registrationType', 'accountHolderName', 'accountHolderEmail', 'accountHolderPhone', 'scheduledBookings']
    },
    url: `https://${BASE_URL}/api/public/bookings/bulk`,
    method: 'POST'
  },
  {
    name: 'lookupBookings',
    description: 'Find existing bookings by caller phone number.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Australian mobile number' }
      },
      required: ['phone']
    },
    url: `https://${BASE_URL}/api/bookings/lookup`,
    method: 'GET'
  },
  {
    name: 'getCancellationPolicy',
    description: 'Check if booking can be cancelled and get exact refund amount. Always call before cancelling.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Booking ID' }
      },
      required: ['id']
    },
    url: `https://${BASE_URL}/api/bookings/{{id}}/cancellation-policy`,
    method: 'GET'
  },
  {
    name: 'sendOtp',
    description: 'Send 6-digit OTP to caller phone. Store verificationId from response internally. Never ask caller for verificationId.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        purpose: { type: 'string', enum: ['cancel', 'reschedule'] }
      },
      required: ['phone', 'purpose']
    },
    url: `https://${BASE_URL}/api/verifications/otp`,
    method: 'POST'
  },
  {
    name: 'confirmOtp',
    description: 'Confirm OTP. Use verificationId from sendOtp (not the code). code is the 6-digit number caller said.',
    inputSchema: {
      type: 'object',
      properties: {
        verificationId: { type: 'string', description: 'From sendOtp response. Never ask caller for this.' },
        code: { type: 'string', description: '6-digit number caller read aloud' },
        phone: { type: 'string' }
      },
      required: ['verificationId', 'code', 'phone']
    },
    url: `https://${BASE_URL}/api/verifications/otp/confirm`,
    method: 'POST'
  },
  {
    name: 'cancelBooking',
    description: 'Cancel booking after OTP confirmed and caller said yes.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        verificationToken: { type: 'string', description: 'From confirmOtp response' },
        reason: { type: 'string', default: 'student_request' }
      },
      required: ['id', 'verificationToken']
    },
    url: `https://${BASE_URL}/api/public/bookings/{{id}}/cancel`,
    method: 'POST'
  },
  {
    name: 'rescheduleBooking',
    description: 'Reschedule booking after OTP confirmed and caller gave new time.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        verificationToken: { type: 'string' },
        newDate: { type: 'string', description: 'YYYY-MM-DD' },
        newTime: { type: 'string', description: 'HH:MM 24-hour' },
        duration: { type: 'integer', default: 60 },
        phone: { type: 'string' },
        reason: { type: 'string', default: 'Client request' }
      },
      required: ['id', 'verificationToken', 'newDate', 'newTime', 'phone']
    },
    url: `https://${BASE_URL}/api/public/bookings/{{id}}/reschedule`,
    method: 'POST'
  }
];

const SYSTEM_PROMPT = `You are the DriveBook AI Receptionist — a professional, warm voice assistant for driving lesson bookings in Western Australia. You speak conversationally, ask ONE question at a time, and always confirm before taking action.

VOICE STYLE:
- Short sentences. Natural speech.
- Never say "Would you like to disconnect?" Just close warmly: "Have a great day. Goodbye!"
- When caller says yes to a confirmation, act immediately. Do not ask them to confirm again.
- After completing an action say what happened and ask "Is there anything else I can help with?"

BOOKING FLOW:
1. Ask for pickup location
2. Call validateLocation. Store the formattedAddress for all future calls.
3. Ask if they have a preferred instructor or want a recommendation
4. Call findInstructors with location=formattedAddress. ALWAYS pass location. Never call with no parameters.
5. Present instructor name, rate, vehicle type. IMMEDIATELY call getPackages and present:
   - 6 hours for $X (5% saving)
   - 10 hours for $X (10% off, most popular)
   - 15 hours for $X (12% off, best value)
   Ask which package they want.
6. Ask for preferred date. Accept whatever date they give.
7. Call getAvailableSlots with instructorId, date as YYYY-MM-DD, lessonDurationMinutes=60. Present 2-3 times.
8. Ask which time they prefer
9. Collect: full name, email, phone (10-digit Australian mobile, no spaces e.g. 0400123456)
10. Read back summary once: "Just to confirm — [package] hours with [Name], first lesson [date] at [time], pickup at [address], total $[price]. Name [name], email [email], phone [phone]. Is that right?"
11. Wait for yes. Call createBooking immediately with exact payload.
12. After booking: "Done. A payment link has been sent to your phone. Your slot is held for 10 minutes. Remaining hours stay as credit for future lessons. Is there anything else I can help with?"

CREATING A BOOKING — exact payload:
- packageType: PACKAGE_6, PACKAGE_10, or PACKAGE_15
- hours: 6, 10, or 15
- bookingType: now
- registrationType: myself
- includeTestPackage: false
- accountHolderPhone: 10 digits no spaces no country code (e.g. 0400123456)
- scheduledBookings array: date YYYY-MM-DD, time HH:MM 24hr, duration 60, pickupLocation from validateLocation, notes empty string, isShortNotice false
- DO NOT send pricing field

OTP VERIFICATION — CRITICAL:
1. Call sendOtp with phone and purpose
2. Store verificationId from response INTERNALLY. NEVER ask caller for verificationId.
3. Say: "I have sent a 6-digit code to your phone. What is the code?"
4. When caller reads the code, call confirmOtp with verificationId (from sendOtp) and code (what caller said)
5. Store verificationToken for cancel/reschedule call

GEOGRAPHY: Only service Western Australia. Politely decline other states/countries.`;

async function main() {
  console.log('Creating Vapi tools...');
  const toolIds = [];

  for (const toolDef of TOOL_DEFINITIONS) {
    const payload = {
      type: 'apiRequest',
      method: toolDef.method,
      url: toolDef.url,
      async: false,
      function: {
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.inputSchema
      }
    };

    const result = await vapiRequest('POST', '/tool', payload);
    if (result.status === 201 || result.status === 200) {
      console.log(`  ✅ ${toolDef.name} → ${result.body.id}`);
      toolIds.push(result.body.id);
    } else {
      console.error(`  ❌ ${toolDef.name} failed:`, JSON.stringify(result.body));
    }
  }

  if (toolIds.length === 0) {
    console.error('No tools created. Cannot create assistant.');
    process.exit(1);
  }

  console.log(`\nCreating assistant with ${toolIds.length} tools...`);

  const assistantPayload = {
    name: 'DriveBook AI Receptionist',
    firstMessage: 'Hi, thanks for calling DriveBook. I can help you book a lesson, change an existing booking, or cancel. What can I help you with today?',
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      toolIds
    },
    voice: {
      provider: '11labs',
      voiceId: 'pNInz6obpgDQGcFmaJgB',
      stability: 0.5,
      similarityBoost: 0.75
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en-AU'
    },
    endCallMessage: 'Have a great day. Goodbye!',
    maxDurationSeconds: 600
  };

  const result = await vapiRequest('POST', '/assistant', assistantPayload);

  if (result.status === 201 || result.status === 200) {
    console.log('\n✅ Assistant created successfully!');
    console.log(`   ID:   ${result.body.id}`);
    console.log(`   Name: ${result.body.name}`);
    console.log('\nNext step:');
    console.log('  Go to Vapi → Phone Numbers → +61 8 6610 1110');
    console.log('  Set Assistant → DriveBook AI Receptionist');
    console.log('  Save');
  } else {
    console.error('\n❌ Assistant creation failed:', JSON.stringify(result.body, null, 2));
  }
}

main().catch(console.error);
