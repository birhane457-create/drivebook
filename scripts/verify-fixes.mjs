import { readFileSync } from 'fs'

const profile  = readFileSync('app/api/instructor/profile/route.ts',  'utf8')
const settings = readFileSync('app/api/instructor/settings/route.ts', 'utf8')
const core     = readFileSync('lib/core/getProviderProfile.ts',        'utf8')
const clients  = readFileSync('app/api/clients/route.ts',              'utf8')
const auth     = readFileSync('lib/auth.ts',                           'utf8')

const checks = [
  ['profile GET has businessModel in select',       profile.includes('businessModel: true')],
  ['profile PUT update returns businessModel',       profile.includes("select: { id: true, businessModel: true }")],
  ['settings GET has businessModel in select',       settings.includes('businessModel: true')],
  ['vehicleTypes -> drivingUpdate (not updateData)', settings.includes('drivingUpdate.vehicleTypes')  && !settings.includes('updateData.vehicleTypes')],
  ['insuranceNumber -> drivingUpdate',               settings.includes('drivingUpdate.insuranceNumber')],
  ['getProviderProfile handles MARKETPLACE',         core.includes("businessModel === 'MARKETPLACE'")],
  ['clients GET uses preferredProviderId OR',        clients.includes('preferredProviderId') && clients.includes('bookings: { some:')],
  ['clients POST uses preferredProviderId',          clients.includes('preferredProviderId: session')],
  ['auth session null guard for token',              auth.includes('if (!token)')],
]

let allOk = true
for (const [label, result] of checks) {
  console.log((result ? '✅' : '❌') + ' ' + label)
  if (!result) allOk = false
}
console.log(allOk ? '\n✅ All checks passed' : '\n❌ Some checks failed')
