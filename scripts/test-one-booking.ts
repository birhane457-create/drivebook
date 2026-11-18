/**
 * Quick debug script: make one booking request and print the response.
 * Run while dev server is running on port 3001.
 */
async function main() {
  const providerId = process.env.TEST_PROVIDER_ID
  if (!providerId) {
    console.error('Set TEST_PROVIDER_ID')
    process.exit(1)
  }

  const body = {
    providerId,
    packageType: 'CUSTOM',
    hours: 1,
    bookingType: 'now',
    registrationType: 'myself',
    accountHolderName: 'Test User',
    accountHolderEmail: 'debug@test.com',
    accountHolderPhone: '0400000001',
    scheduledBookings: [{
      date: '2027-08-10',
      time: '10:00',
      duration: 60,
      pickupLocation: '',
      notes: '',
    }],
  }

  const res = await fetch('http://localhost:3001/api/public/bookings/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `debug-${Date.now()}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  console.log('Status:', res.status)
  console.log('Body:', JSON.stringify(data, null, 2))
}

main().catch(console.error)
