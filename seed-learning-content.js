/**
 * Seed initial learning content for the recommendation engine.
 * Maps PDA feedback codes to tips shown on the student progress page.
 *
 * Run: node seed-learning-content.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const content = [
  {
    title: 'Roundabout Exit — Signal Left',
    description: 'One of the most common test mistakes in WA. You must signal left before exiting a roundabout, even when going straight.',
    tipText: 'Signal left before your exit point, not after. Check mirrors first, then signal, then exit.',
    category: 'SIGNAL',
    difficulty: 'basic',
    pdaCodes: [10],
  },
  {
    title: 'Signal Timing — 5 Seconds Before Moving',
    description: 'Signalling too late before moving from the kerb is a common moderate error.',
    tipText: 'Count to 5 after signalling before moving off. This gives other road users time to react.',
    category: 'SIGNAL',
    difficulty: 'basic',
    pdaCodes: [11],
  },
  {
    title: 'Blind Spot Check — Head Check Before Moving',
    description: 'Mirrors alone are not enough. A head check over your shoulder is required before moving off or changing lanes.',
    tipText: 'Always turn your head to check the blind spot — mirrors have a dead zone. Do it every time.',
    category: 'LOOK_BEHIND',
    difficulty: 'basic',
    pdaCodes: [20, 26],
  },
  {
    title: 'Mirror-Signal-Maneuver Sequence',
    description: 'The correct sequence is Mirror → Signal → Maneuver. Skipping the mirror check before signalling is a common error.',
    tipText: 'Before every signal: check your rear-view mirror first. Then signal. Then move.',
    category: 'LOOK_BEHIND',
    difficulty: 'basic',
    pdaCodes: [21, 22, 25],
  },
  {
    title: 'Smooth Braking — Look Further Ahead',
    description: 'Harsh braking usually means you are not looking far enough ahead. The fix is earlier observation, not better braking.',
    tipText: 'Look 10–15 seconds ahead. When you see a hazard early, you can brake gently and progressively.',
    category: 'MOVEMENT',
    difficulty: 'basic',
    pdaCodes: [32],
  },
  {
    title: 'Complete Stop at Stop Signs',
    description: 'A rolling stop is an instant fail. Your wheels must fully stop before you proceed.',
    tipText: 'Count "one, two" after stopping before moving. If you can feel the car still rolling, you have not stopped.',
    category: 'MOVEMENT',
    difficulty: 'basic',
    pdaCodes: [34],
  },
  {
    title: 'Right Turn — Stay in Your Lane',
    description: 'Cutting the corner on a right-hand turn is a major error. You must stay within your lane throughout the turn.',
    tipText: 'Wait until you can see the far kerb before turning the wheel. Turn late, not early.',
    category: 'PATH',
    difficulty: 'basic',
    pdaCodes: [40],
  },
  {
    title: 'Safe Following Distance — 3-Second Rule',
    description: 'Following too close is dangerous and a major test error. Use the 3-second rule to maintain a safe gap.',
    tipText: 'Pick a fixed point. When the car ahead passes it, count 3 seconds. You should not reach that point before 3.',
    category: 'PATH',
    difficulty: 'basic',
    pdaCodes: [44],
  },
  {
    title: 'Lane Position — Stay Centred',
    description: 'Drifting within your lane or poor positioning is a common moderate error, especially on curves.',
    tipText: 'Focus on the centre of your lane ahead, not the kerb beside you. Your eyes guide the car.',
    category: 'PATH',
    difficulty: 'basic',
    pdaCodes: [41, 46],
  },
  {
    title: 'Clutch Control — Smooth Hill Starts',
    description: 'Stalling or slow hill starts come from rushing the clutch. Slow down the release.',
    tipText: 'Find the biting point first — feel the car lift slightly. Then slowly release the clutch while adding throttle.',
    category: 'VEHICLE_MANAGEMENT',
    difficulty: 'basic',
    pdaCodes: [50, 37],
  },
  {
    title: 'Give Way Rules — Pedestrians and Right of Way',
    description: 'Failing to give way is an instant fail. Pedestrians on crossings always have right of way.',
    tipText: 'At any crossing or intersection, scan for pedestrians before moving. If in doubt, wait.',
    category: 'RESPONSIVENESS',
    difficulty: 'basic',
    pdaCodes: [61],
  },
  {
    title: 'Hazard Awareness — Scan Ahead Constantly',
    description: 'Missing a developing hazard is a major error. You need to be scanning, not just watching the car in front.',
    tipText: 'Use a Z-scan pattern: left mirror → ahead → right mirror → ahead. Repeat every few seconds.',
    category: 'RESPONSIVENESS',
    difficulty: 'basic',
    pdaCodes: [60, 65],
  },
  {
    title: 'Confident Driving — Trust Your Training',
    description: 'Hesitating or pausing mid-maneuver breaks the flow of driving and signals uncertainty to the assessor.',
    tipText: 'If you have checked and it is safe, commit. Hesitation causes more problems than it prevents.',
    category: 'FLOW',
    difficulty: 'basic',
    pdaCodes: [70, 62],
  },
  {
    title: 'Roundabout Entry — Confident and Timely',
    description: 'Entering a roundabout too slowly or hesitating at the entry is a flow error.',
    tipText: 'Approach at a speed where you can either stop safely or enter smoothly. Decide early — don\'t creep.',
    category: 'FLOW',
    difficulty: 'basic',
    pdaCodes: [73],
  },
  {
    title: 'Critical Safety — Assessor Intervention',
    description: 'If the assessor or instructor had to intervene, this is the most serious feedback possible. More practice is needed before your test.',
    tipText: 'Do not book your test yet. Focus on the specific situation that caused the intervention and practice it repeatedly.',
    category: 'CRITICAL',
    difficulty: 'advanced',
    pdaCodes: [80, 82, 84, 85],
  },
]

async function seed() {
  console.log('Seeding learning content...')

  let created = 0
  let skipped = 0

  for (const item of content) {
    // Check if content for these codes already exists
    const existing = await prisma.learningContent.findFirst({
      where: { pdaCodes: { hasSome: item.pdaCodes } },
    })

    if (existing) {
      console.log(`  SKIP — content for codes [${item.pdaCodes}] already exists: "${existing.title}"`)
      skipped++
      continue
    }

    await prisma.learningContent.create({ data: item })
    console.log(`  OK   — "${item.title}" (codes: ${item.pdaCodes.join(', ')})`)
    created++
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`)
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
