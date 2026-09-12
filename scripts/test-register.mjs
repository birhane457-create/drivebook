/**
 * Test registration API for all business types.
 * Run with: node scripts/test-register.mjs
 */

const BASE_URL = 'http://localhost:3000'
const ts = Date.now()

const tests = [
  { businessType: 'plumber',     name: 'Test Plumber',     hourlyRate: 120 },
  { businessType: 'electrician', name: 'Test Electrician', hourlyRate: 130 },
  { businessType: 'driving',     name: 'Test Instructor',  hourlyRate: 65  },
]

async function testRegistration(data) {
  const payload = {
    email: `test_${data.businessType}_${ts}@example.com`,
    password: 'Test1234!',
    name: data.name,
    phone: '0412345678',
    businessType: data.businessType,
    baseAddress: '123 Test St, Perth WA 6000',
    hourlyRate: data.hourlyRate,
    serviceRadiusKm: 25,
    termsAccepted: true,
    termsVersion: '1.0',
    ageDeclaration: true,
  }

  const response = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const body = await response.json().catch(() => ({}))
  const ok = response.status === 201
  console.log(`${ok ? '✅' : '❌'} ${data.businessType.padEnd(12)} — ${response.status} — ${ok ? `Provider: ${body.providerId}` : (body.error ?? 'unknown error')}`)
  return ok
}

console.log('\n=== Registration API Test — All Business Types ===\n')

let allPassed = true
for (const test of tests) {
  const ok = await testRegistration(test).catch(e => { console.log(`❌ ${test.businessType.padEnd(12)} — Network error: ${e.message}`); return false })
  if (!ok) allPassed = false
}

console.log(allPassed ? '\n✅ All registrations passed!' : '\n❌ Some registrations failed — check server logs.')
