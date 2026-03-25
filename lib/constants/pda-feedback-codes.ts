/**
 * PDA Performance Feedback Codes
 * 
 * Aligned with Department of Transport WA Practical Driving Assessment (PDA) criteria.
 * Using integer codes to minimize database storage while maintaining rich feedback.
 * 
 * Categories:
 * - 10-19: Signal
 * - 20-29: Look Behind
 * - 30-39: Movement & Speed
 * - 40-49: Path & Positioning
 * - 50-59: Vehicle Management
 * - 60-69: Responsiveness & Hazards
 * - 70-79: Flow
 * - 80-89: Critical/Instant Fail
 */

export enum PDACategory {
  SIGNAL = 'SIGNAL',
  LOOK_BEHIND = 'LOOK_BEHIND',
  MOVEMENT = 'MOVEMENT',
  PATH = 'PATH',
  VEHICLE_MANAGEMENT = 'VEHICLE_MANAGEMENT',
  RESPONSIVENESS = 'RESPONSIVENESS',
  FLOW = 'FLOW',
  CRITICAL = 'CRITICAL'
}

export enum PDASeverity {
  MINOR = 'MINOR',           // Needs improvement
  MODERATE = 'MODERATE',     // Significant issue
  MAJOR = 'MAJOR',           // Serious concern
  CRITICAL = 'CRITICAL'      // Instant fail
}

export interface PDAFeedbackCode {
  code: number
  category: PDACategory
  severity: PDASeverity
  shortText: string
  fullText: string
  officialCriteria: string
  improvementTip: string
}

export const PDA_FEEDBACK_CODES: Record<number, PDAFeedbackCode> = {
  // ========== SIGNAL (10-19) ==========
  10: {
    code: 10,
    category: PDACategory.SIGNAL,
    severity: PDASeverity.MODERATE,
    shortText: 'No signal at roundabout exit',
    fullText: 'Failed to signal when exiting the roundabout',
    officialCriteria: 'Signal: Correct and timely use of indicators',
    improvementTip: 'Always signal left when exiting a roundabout, even if going straight'
  },
  11: {
    code: 11,
    category: PDACategory.SIGNAL,
    severity: PDASeverity.MODERATE,
    shortText: 'Signal too late',
    fullText: 'Signalled less than 5 seconds before moving from kerb',
    officialCriteria: 'Signal: Must signal for at least 5 seconds before moving from kerb',
    improvementTip: 'Count to 5 after signalling before moving off'
  },
  12: {
    code: 12,
    category: PDACategory.SIGNAL,
    severity: PDASeverity.MINOR,
    shortText: 'Forgot to cancel signal',
    fullText: 'Failed to cancel signal after completing maneuver',
    officialCriteria: 'Signal: Indicators must be cancelled after use',
    improvementTip: 'Check your indicator is off after every turn or lane change'
  },
  13: {
    code: 13,
    category: PDACategory.SIGNAL,
    severity: PDASeverity.MAJOR,
    shortText: 'Wrong direction signal',
    fullText: 'Signalled in the wrong direction for the maneuver',
    officialCriteria: 'Signal: Correct direction indication',
    improvementTip: 'Double-check which way you\'re turning before signalling'
  },
  14: {
    code: 14,
    category: PDACategory.SIGNAL,
    severity: PDASeverity.MODERATE,
    shortText: 'No signal when changing lanes',
    fullText: 'Failed to signal when changing lanes',
    officialCriteria: 'Signal: Must indicate lane changes',
    improvementTip: 'Always signal before changing lanes, even if no traffic is visible'
  },
 // ========== SIGNAL (15-16) additional ==========
  15: {
    code: 15,
    category: PDACategory.SIGNAL,
    severity: PDASeverity.MINOR,
    shortText: 'Signal flicker/inconsistent',
    fullText: 'Indicator flickered or was inconsistent during maneuver',
    officialCriteria: 'Signal: Steady and clear use of indicators',
    improvementTip: 'Keep a steady, consistent signal throughout the maneuver'
  },
  16: {
    code: 16,
    category: PDACategory.SIGNAL,
    severity: PDASeverity.MODERATE,
    shortText: 'Missed hazard signal to other road users',
    fullText: 'Did not signal to alert others of intended maneuver in a shared environment',
    officialCriteria: 'Signal: Must communicate intentions clearly to other road users',
    improvementTip: 'Use your indicators to clearly show intentions, especially in traffic'
  },
  // ========== LOOK BEHIND (20-29) ==========
  20: {
    code: 20,
    category: PDACategory.LOOK_BEHIND,
    severity: PDASeverity.MAJOR,
    shortText: 'No blind spot check',
    fullText: 'Failed to check blind spot (head check) before moving',
    officialCriteria: 'Look Behind: Consistent use of mirrors and blind spot checks',
    improvementTip: 'Always do a head check over your shoulder before moving off or changing lanes'
  },
  21: {
    code: 21,
    category: PDACategory.LOOK_BEHIND,
    severity: PDASeverity.MODERATE,
    shortText: 'No mirror check before braking',
    fullText: 'Failed to check mirrors before braking or slowing',
    officialCriteria: 'Look Behind: Check mirrors before changing speed',
    improvementTip: 'Check rear-view mirror before every brake application'
  },
  22: {
    code: 22,
    category: PDACategory.LOOK_BEHIND,
    severity: PDASeverity.MODERATE,
    shortText: 'No mirror check before signal',
    fullText: 'Failed to check mirrors before signalling',
    officialCriteria: 'Look Behind: Mirror-Signal-Maneuver sequence',
    improvementTip: 'Always check mirrors BEFORE signalling (Mirror-Signal-Maneuver)'
  },
  23: {
    code: 23,
    category: PDACategory.LOOK_BEHIND,
    severity: PDASeverity.MAJOR,
    shortText: 'Poor observation reversing',
    fullText: 'Inadequate observation during reverse maneuver',
    officialCriteria: 'Look Behind: 360-degree awareness during reversing',
    improvementTip: 'Check all around continuously while reversing, not just one direction'
  },
  24: {
    code: 24,
    category: PDACategory.LOOK_BEHIND,
    severity: PDASeverity.MODERATE,
    shortText: 'Staring at mirrors too long',
    fullText: 'Stared at mirrors too long, losing forward vision',
    officialCriteria: 'Look Behind: Quick glances, maintain forward awareness',
    improvementTip: 'Quick glances at mirrors (1 second max), keep eyes on the road ahead'
  },
  // ========== LOOK BEHIND (25-26) additional ==========
  25: {
    code: 25,
    category: PDACategory.LOOK_BEHIND,
    severity: PDASeverity.MINOR,
    shortText: 'Mirror not checked before lane exit',
    fullText: 'Failed to check mirrors when leaving lane or turning',
    officialCriteria: 'Look Behind: Always check mirrors before leaving a lane',
    improvementTip: 'Glance in mirrors before moving out of a lane or lane change'
  },
  26: {
    code: 26,
    category: PDACategory.LOOK_BEHIND,
    severity: PDASeverity.MODERATE,
    shortText: 'Blind spot missed while reversing',
    fullText: 'Did not check blind spot properly during reverse maneuver',
    officialCriteria: 'Look Behind: Use mirrors and head check when reversing',
    improvementTip: "Turn head to check blind spot, don't rely solely on mirrors"
  },

  // ========== MOVEMENT & SPEED (30-39) ==========
  30: {
    code: 30,
    category: PDACategory.MOVEMENT,
    severity: PDASeverity.CRITICAL,
    shortText: 'Exceeded speed limit',
    fullText: 'Exceeded the posted speed limit',
    officialCriteria: 'Movement: Appropriate speed for conditions and limits',
    improvementTip: 'Always check speed signs and stay within the limit'
  },
  31: {
    code: 31,
    category: PDACategory.MOVEMENT,
    severity: PDASeverity.MODERATE,
    shortText: 'Jerky acceleration',
    fullText: 'Acceleration was too aggressive or jerky',
    officialCriteria: 'Movement: Smooth acceleration and braking',
    improvementTip: 'Apply throttle gradually and smoothly'
  },
  32: {
    code: 32,
    category: PDACategory.MOVEMENT,
    severity: PDASeverity.MODERATE,
    shortText: 'Harsh braking',
    fullText: 'Braked too late or too hard',
    officialCriteria: 'Movement: Smooth and progressive braking',
    improvementTip: 'Look ahead and brake earlier with gentle pressure'
  },
  33: {
    code: 33,
    category: PDACategory.MOVEMENT,
    severity: PDASeverity.MODERATE,
    shortText: 'Driving too slowly',
    fullText: 'Driving too slowly for traffic conditions, impeding flow',
    officialCriteria: 'Movement: Appropriate speed for conditions',
    improvementTip: 'Drive at the speed limit when safe, don\'t hold up traffic'
  },
  34: {
    code: 34,
    category: PDACategory.MOVEMENT,
    severity: PDASeverity.CRITICAL,
    shortText: 'Rolling stop',
    fullText: 'Failed to stop completely at a Stop sign',
    officialCriteria: 'Movement: Complete stop at Stop signs',
    improvementTip: 'Come to a complete stop (wheels stopped) at every Stop sign'
  },
  35: {
    code: 35,
    category: PDACategory.MOVEMENT,
    severity: PDASeverity.MINOR,
    shortText: 'Uneven speed',
    fullText: 'Speed varied unnecessarily (speeding up and slowing down)',
    officialCriteria: 'Movement: Consistent speed maintenance',
    improvementTip: 'Maintain steady speed using cruise control or gentle throttle'
  },


  // ========== MOVEMENT & SPEED (36-37) additional ==========
  36: {
    code: 36,
    category: PDACategory.MOVEMENT,
    severity: PDASeverity.MINOR,
    shortText: 'Vehicle creeping at stop',
    fullText: 'Vehicle moved slightly forward when it should have been stationary',
    officialCriteria: 'Movement: Vehicle must remain stationary at stops',
    improvementTip: 'Keep foot steady on brake or clutch to prevent creeping'
  },
  37: {
    code: 37,
    category: PDACategory.MOVEMENT,
    severity: PDASeverity.MINOR,
    shortText: 'Slow start on hill',
    fullText: 'Took too long to move off from a hill start',
    officialCriteria: 'Movement: Smooth and timely hill start',
    improvementTip: 'Practice hill starts with clutch control to move smoothly'
  },

  // ========== PATH & POSITIONING (40-49) ==========
  40: {
    code: 40,
    category: PDACategory.PATH,
    severity: PDASeverity.MAJOR,
    shortText: 'Cut the corner',
    fullText: 'Cut the corner on a right-hand turn',
    officialCriteria: 'Path: Correct steering and staying on best track',
    improvementTip: 'Stay in your lane throughout the turn, don\'t cut corners'
  },
  41: {
    code: 41,
    category: PDACategory.PATH,
    severity: PDASeverity.MODERATE,
    shortText: 'Poor lane position',
    fullText: 'Positioned too far left or right in the lane',
    officialCriteria: 'Path: Maintain center of lane',
    improvementTip: 'Keep the car centered in your lane, about 1 meter from the curb'
  },
  42: {
    code: 42,
    category: PDACategory.PATH,
    severity: PDASeverity.CRITICAL,
    shortText: 'Crossed solid line',
    fullText: 'Crossed a solid white line unnecessarily',
    officialCriteria: 'Path: Obey road markings',
    improvementTip: 'Never cross solid white lines unless absolutely necessary'
  },
  43: {
    code: 43,
    category: PDACategory.PATH,
    severity: PDASeverity.MAJOR,
    shortText: 'Wrong lane at roundabout',
    fullText: 'Incorrect lane choice at multi-lane roundabout',
    officialCriteria: 'Path: Correct lane selection',
    improvementTip: 'Left lane for left/straight, right lane for right turns at roundabouts'
  },
  44: {
    code: 44,
    category: PDACategory.PATH,
    severity: PDASeverity.MAJOR,
    shortText: 'Following too close',
    fullText: 'Followed the vehicle ahead too closely (insufficient gap)',
    officialCriteria: 'Path: Maintain safe following distance',
    improvementTip: 'Keep 3-second gap in good conditions, 4+ seconds in rain'
  },
  45: {
    code: 45,
    category: PDACategory.PATH,
    severity: PDASeverity.MODERATE,
    shortText: 'Wide turn',
    fullText: 'Turn was too wide, encroached on adjacent lane',
    officialCriteria: 'Path: Tight, controlled turns',
    improvementTip: 'Turn the wheel more to stay within your lane'
  },
 // ========== PATH & POSITIONING (46-47) additional ==========
  46: {
    code: 46,
    category: PDACategory.PATH,
    severity: PDASeverity.MINOR,
    shortText: 'Drifting within lane',
    fullText: 'Vehicle drifted within lane without touching lines',
    officialCriteria: 'Path: Maintain steady lane position',
    improvementTip: 'Keep steering steady and watch lane markings to avoid drifting'
  },
  47: {
    code: 47,
    category: PDACategory.PATH,
    severity: PDASeverity.MODERATE,
    shortText: 'Improper lane usage at merge',
    fullText: 'Chose incorrect lane during merge or multi-lane transition',
    officialCriteria: 'Path: Select correct lane for merge/transition',
    improvementTip: 'Check traffic and lane markings before merging into traffic'
  },

  // ========== VEHICLE MANAGEMENT (50-59) ==========
  50: {
    code: 50,
    category: PDACategory.VEHICLE_MANAGEMENT,
    severity: PDASeverity.MODERATE,
    shortText: 'Stalled engine',
    fullText: 'Stalled the engine',
    officialCriteria: 'Vehicle Management: Smooth clutch and gear use',
    improvementTip: 'Bring clutch up slowly to biting point before releasing fully'
  },
  51: {
    code: 51,
    category: PDACategory.VEHICLE_MANAGEMENT,
    severity: PDASeverity.MODERATE,
    shortText: 'Wrong gear',
    fullText: 'Incorrect gear selection for speed or incline',
    officialCriteria: 'Vehicle Management: Appropriate gear selection',
    improvementTip: 'Use lower gears for hills and slow speeds, higher gears for faster speeds'
  },
  52: {
    code: 52,
    category: PDACategory.VEHICLE_MANAGEMENT,
    severity: PDASeverity.MODERATE,
    shortText: 'Coasting',
    fullText: 'Coasting with clutch down or in neutral for too long',
    officialCriteria: 'Vehicle Management: Maintain engine braking',
    improvementTip: 'Keep car in gear when moving, only use clutch when changing gears'
  },
  53: {
    code: 53,
    category: PDACategory.VEHICLE_MANAGEMENT,
    severity: PDASeverity.MINOR,
    shortText: 'Poor steering technique',
    fullText: 'Poor steering control (crossing arms incorrectly)',
    officialCriteria: 'Vehicle Management: Proper steering technique',
    improvementTip: 'Use push-pull steering, hands at 9 and 3 o\'clock'
  },
  54: {
    code: 54,
    category: PDACategory.VEHICLE_MANAGEMENT,
    severity: PDASeverity.MINOR,
    shortText: 'Handbrake not used',
    fullText: 'Failed to use handbrake when appropriate',
    officialCriteria: 'Vehicle Management: Handbrake use on hills',
    improvementTip: 'Use handbrake when stopped on hills or for more than a few seconds'
  },
 // ========== VEHICLE MANAGEMENT (55-57) additional ==========
  55: {
    code: 55,
    category: PDACategory.VEHICLE_MANAGEMENT,
    severity: PDASeverity.MINOR,
    shortText: 'Delayed gear shift',
    fullText: 'Shifted gear later than appropriate, affecting control',
    officialCriteria: 'Vehicle Management: Timely gear changes',
    improvementTip: 'Plan gear changes ahead to maintain smooth control'
  },
  56: {
    code: 56,
    category: PDACategory.VEHICLE_MANAGEMENT,
    severity: PDASeverity.MINOR,
    shortText: 'Clutch riding',
    fullText: 'Foot remained on clutch unnecessarily while driving',
    officialCriteria: 'Vehicle Management: Use clutch only when needed',
    improvementTip: 'Keep foot off clutch except when changing gears'
  },
  57: {
    code: 57,
    category: PDACategory.VEHICLE_MANAGEMENT,
    severity: PDASeverity.MINOR,
    shortText: 'Overcorrecting steering',
    fullText: 'Steering corrections were exaggerated, affecting smoothness',
    officialCriteria: 'Vehicle Management: Smooth, controlled steering',
    improvementTip: 'Make small, smooth steering adjustments for control'
  },

  // ========== RESPONSIVENESS & HAZARDS (60-69) ==========
  60: {
    code: 60,
    category: PDACategory.RESPONSIVENESS,
    severity: PDASeverity.MAJOR,
    shortText: 'Missed hazard',
    fullText: 'Failed to react to a developing hazard',
    officialCriteria: 'Responsiveness: Identifying and responding to road hazards',
    improvementTip: 'Scan ahead constantly for potential hazards (pedestrians, cars, cyclists)'
  },
  61: {
    code: 61,
    category: PDACategory.RESPONSIVENESS,
    severity: PDASeverity.CRITICAL,
    shortText: 'Failed to give way',
    fullText: 'Failed to give way to a pedestrian or vehicle with right of way',
    officialCriteria: 'Responsiveness: Obey give way rules',
    improvementTip: 'Always give way to pedestrians on crossings and vehicles with right of way'
  },
  62: {
    code: 62,
    category: PDACategory.RESPONSIVENESS,
    severity: PDASeverity.MODERATE,
    shortText: 'Hesitated too long',
    fullText: 'Hesitated too long at a clear intersection',
    officialCriteria: 'Responsiveness: Decisive action when safe',
    improvementTip: 'When it\'s clear and safe, proceed confidently without unnecessary delay'
  },
  63: {
    code: 63,
    category: PDACategory.RESPONSIVENESS,
    severity: PDASeverity.MAJOR,
    shortText: 'Blocked intersection',
    fullText: 'Entered intersection when exit was blocked',
    officialCriteria: 'Responsiveness: Don\'t block intersections',
    improvementTip: 'Only enter intersection if you can clear it completely'
  },
  64: {
    code: 64,
    category: PDACategory.RESPONSIVENESS,
    severity: PDASeverity.MODERATE,
    shortText: 'Slow reaction to lights',
    fullText: 'Slow to react to traffic light change',
    officialCriteria: 'Responsiveness: Timely response to signals',
    improvementTip: 'Watch traffic lights ahead and be ready to move when green'
  },

 
  // ========== RESPONSIVENESS & HAZARDS (65-66) additional ==========
  65: {
    code: 65,
    category: PDACategory.RESPONSIVENESS,
    severity: PDASeverity.MODERATE,
    shortText: 'Missed pedestrian approaching',
    fullText: 'Did not notice a pedestrian about to cross',
    officialCriteria: 'Responsiveness: Continuous observation of surroundings',
    improvementTip: 'Scan intersections and pedestrian paths frequently'
  },
  66: {
    code: 66,
    category: PDACategory.RESPONSIVENESS,
    severity: PDASeverity.MODERATE,
    shortText: 'Slow lane merge',
    fullText: 'Took too long to safely merge into traffic',
    officialCriteria: 'Responsiveness: Merge promptly and safely',
    improvementTip: 'Check mirrors, signal, and merge smoothly without hesitation'
  },

  // ========== FLOW (70-79) ==========
  70: {
    code: 70,
    category: PDACategory.FLOW,
    severity: PDASeverity.MODERATE,
    shortText: 'Paused to think',
    fullText: 'Paused or hesitated, breaking the flow of driving',
    officialCriteria: 'Flow: Combining skills confidently without hesitation',
    improvementTip: 'Practice until actions become automatic and smooth'
  },
  71: {
    code: 71,
    category: PDACategory.FLOW,
    severity: PDASeverity.MINOR,
    shortText: 'Uncoordinated actions',
    fullText: 'Actions were not well coordinated (e.g., signal-mirror-maneuver)',
    officialCriteria: 'Flow: Smooth integration of all skills',
    improvementTip: 'Practice the sequence: Mirror-Signal-Maneuver until it\'s automatic'
  },
  72: {
    code: 72,
    category: PDACategory.FLOW,
    severity: PDASeverity.MINOR,
    shortText: 'Overthinking',
    fullText: 'Overthinking simple maneuvers, affecting confidence',
    officialCriteria: 'Flow: Confident execution',
    improvementTip: 'Trust your training and act decisively when you know what to do'
  },
  // ========== FLOW (73-74) additional ==========
  73: {
    code: 73,
    category: PDACategory.FLOW,
    severity: PDASeverity.MINOR,
    shortText: 'Hesitant at roundabout entry',
    fullText: 'Entered roundabout too slowly or uncertainly',
    officialCriteria: 'Flow: Confident and timely entry into roundabouts',
    improvementTip: 'Check traffic and enter confidently at safe speed'
  },
  74: {
    code: 74,
    category: PDACategory.FLOW,
    severity: PDASeverity.MINOR,
    shortText: 'Over-correcting steering mid-turn',
    fullText: 'Steering corrections were too large during turn, breaking flow',
    officialCriteria: 'Flow: Smooth, continuous steering',
    improvementTip: 'Practice turns to maintain steady, small steering adjustments'
  },

  // ========== CRITICAL / INSTANT FAIL (80-89) ==========
  80: {
    code: 80,
    category: PDACategory.CRITICAL,
    severity: PDASeverity.CRITICAL,
    shortText: 'Assessor intervention',
    fullText: 'Assessor/Instructor had to intervene (grab wheel, use dual controls)',
    officialCriteria: 'Critical: Assessor intervention = Instant Fail',
    improvementTip: 'This is a critical safety issue - more practice needed before test'
  },
  81: {
    code: 81,
    category: PDACategory.CRITICAL,
    severity: PDASeverity.CRITICAL,
    shortText: 'Disobeyed regulatory sign',
    fullText: 'Disobeyed a regulatory sign (Stop, Give Way, No Entry, etc.)',
    officialCriteria: 'Critical: Regulatory sign disobedience = Instant Fail',
    improvementTip: 'Always obey regulatory signs - they are law, not suggestions'
  },
  82: {
    code: 82,
    category: PDACategory.CRITICAL,
    severity: PDASeverity.CRITICAL,
    shortText: 'Dangerous action',
    fullText: 'Performed a dangerous action that risked collision',
    officialCriteria: 'Critical: Dangerous driving = Instant Fail',
    improvementTip: 'Safety is paramount - never take risks that could cause an accident'
  },
  83: {
    code: 83,
    category: PDACategory.CRITICAL,
    severity: PDASeverity.CRITICAL,
    shortText: 'Red light violation',
    fullText: 'Proceeded through a red traffic light',
    officialCriteria: 'Critical: Red light violation = Instant Fail',
    improvementTip: 'Always stop at red lights - amber means stop if safe to do so'
  },

  // ========== CRITICAL / INSTANT FAIL (84-86) additional ==========
  84: {
    code: 84,
    category: PDACategory.CRITICAL,
    severity: PDASeverity.CRITICAL,
    shortText: 'Dangerous overtaking',
    fullText: 'Overtook unsafely causing immediate risk',
    officialCriteria: 'Critical: Unsafe overtaking = Instant Fail',
    improvementTip: 'Only overtake when it is fully safe and legal'
  },
  85: {
    code: 85,
    category: PDACategory.CRITICAL,
    severity: PDASeverity.CRITICAL,
    shortText: 'Near collision',
    fullText: 'Vehicle nearly collided with another road user',
    officialCriteria: 'Critical: Risk of collision = Instant Fail',
    improvementTip: 'Maintain awareness and safe distance at all times'
  },
  86: {
    code: 86,
    category: PDACategory.CRITICAL,
    severity: PDASeverity.CRITICAL,
    shortText: 'Ignored stop sign',
    fullText: 'Completely failed to stop at a stop sign',
    officialCriteria: 'Critical: Stop sign disobedience = Instant Fail',
    improvementTip: 'Always make a full stop at stop signs'
  },
}

// Helper function to get feedback by code
export function getFeedbackByCode(code: number): PDAFeedbackCode | undefined {
  return PDA_FEEDBACK_CODES[code]
}

// Helper function to get all codes by category
export function getFeedbackByCategory(category: PDACategory): PDAFeedbackCode[] {
  return Object.values(PDA_FEEDBACK_CODES).filter(
    feedback => feedback.category === category
  )
}

// Helper function to get all codes by severity
export function getFeedbackBySeverity(severity: PDASeverity): PDAFeedbackCode[] {
  return Object.values(PDA_FEEDBACK_CODES).filter(
    feedback => feedback.severity === severity
  )
}

// Helper to check if code is critical (instant fail)
export function isCriticalFeedback(code: number): boolean {
  const feedback = getFeedbackByCode(code)
  return feedback?.severity === PDASeverity.CRITICAL
}

// Get category display name
export function getCategoryDisplayName(category: PDACategory): string {
  const names: Record<PDACategory, string> = {
    [PDACategory.SIGNAL]: 'Signal',
    [PDACategory.LOOK_BEHIND]: 'Look Behind',
    [PDACategory.MOVEMENT]: 'Movement & Speed',
    [PDACategory.PATH]: 'Path & Positioning',
    [PDACategory.VEHICLE_MANAGEMENT]: 'Vehicle Management',
    [PDACategory.RESPONSIVENESS]: 'Responsiveness & Hazards',
    [PDACategory.FLOW]: 'Flow',
    [PDACategory.CRITICAL]: 'Critical Issues'
  }
  return names[category]
}

// Get severity color for UI
export function getSeverityColor(severity: PDASeverity): string {
  const colors: Record<PDASeverity, string> = {
    [PDASeverity.MINOR]: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    [PDASeverity.MODERATE]: 'text-orange-600 bg-orange-50 border-orange-200',
    [PDASeverity.MAJOR]: 'text-red-600 bg-red-50 border-red-200',
    [PDASeverity.CRITICAL]: 'text-red-900 bg-red-100 border-red-400'
  }
  return colors[severity]
}
