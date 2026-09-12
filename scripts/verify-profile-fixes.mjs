import { readFileSync } from 'fs'

const profile = readFileSync('app/dashboard/profile/page.tsx', 'utf8')
const settings = readFileSync('app/dashboard/settings/page.tsx', 'utf8')

const checks = [
  ['Profile: imports useBusinessConfig', profile.includes("import { useBusinessConfig } from '@/hooks/useBusinessConfig'")],
  ['Profile: calls isDriving hook', profile.includes('const { isDriving } = useBusinessConfig()')],
  ['Profile: Car Details section wrapped with isDriving', profile.includes('Car Details — Driving Only') && profile.includes('{isDriving && (')],
  ['Profile: submission guards car fields', profile.includes('...(isDriving ? {') && profile.includes('carImage,')],
  ['Profile: submission guards vehicleTypes API call', profile.includes('if (isDriving) {') && profile.includes('vehicleTypes: formData.vehicleTypes')],
  ['Profile: fetch guards car field loading', profile.includes('carMake: isDriving ?')],
  ['Settings: Professional Credentials wrapped', settings.includes('Professional Credentials — Driving Only')],
  ['Settings: PDA section wrapped', settings.includes('PDA Test Configurations Section — Driving Only')],
  ['Settings: Booking Durations uses terminology', settings.includes("isDriving ? 'Lesson' : 'Booking'")],
]

let allOk = true
for (const [label, result] of checks) {
  console.log((result ? '✅' : '❌') + ' ' + label)
  if (!result) allOk = false
}
console.log(allOk ? '\n✅ All profile/settings checks passed' : '\n❌ Some checks failed')
