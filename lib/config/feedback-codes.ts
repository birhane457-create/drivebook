/**
 * Lesson Feedback Categories and Codes
 * 
 * Numeric codes save database space compared to storing full text strings.
 * Each category contains related feedback items with 1-100 numeric codes.
 */

export interface FeedbackCode {
  code: number;
  text: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface FeedbackCategory {
  id: string;
  name: string;
  description: string;
  codes: Record<number, string>;
}

export const FEEDBACK_CODES: Record<string, FeedbackCategory> = {
  MOVEMENT: {
    id: 'movement',
    name: 'Movement & Control',
    description: 'Smooth and controlled vehicle movement',
    codes: {
      1: 'Harsh acceleration',
      2: 'Harsh braking / Emergency stop',
      3: 'Jerky steering input',
      4: 'Poor throttle control',
      5: 'Failed to smooth transition between gears',
    },
  },

  PATH: {
    id: 'path',
    name: 'Path & Positioning',
    description: 'Correct lane positioning and track line',
    codes: {
      10: 'Poor lane position (too left/right)',
      11: 'Cornering speed too high',
      12: 'Uneven or inconsistent track line',
      13: 'Wide on roundabout',
      14: 'Cutting corners',
      15: 'Poor positioning for junction',
    },
  },

  LOOKING: {
    id: 'looking',
    name: 'Looking & Signs',
    description: 'Effective observation and sign comprehension',
    codes: {
      20: 'Failed mirror checks',
      21: 'Late signal application',
      22: 'Ignoring or misreading speed sign',
      23: 'Poor peripheral awareness',
      24: 'Distracted driving / Phone use',
      25: 'Failed to identify warning sign',
    },
  },

  HAZARD_AWARENESS: {
    id: 'hazard',
    name: 'Hazard Awareness',
    description: 'Identifying and reacting to hazards',
    codes: {
      30: 'Failed to spot pedestrian',
      31: 'Failed to spot cyclist',
      32: 'Failed to identify parked vehicle hazard',
      33: 'Inadequate speed in hazardous area',
      34: 'Failed to react to hazard in time',
      35: 'Insufficient gap checking at junction',
    },
  },

  PROCEDURES: {
    id: 'procedures',
    name: 'Procedures & Rules',
    description: 'Following correct driving procedures',
    codes: {
      40: 'Failed to signal intention',
      41: 'Failed to check before maneuver',
      42: 'Incorrect use of seat belt',
      43: 'Incorrect mirror adjustment',
      44: 'Failed to position for maneuver',
      45: 'Incorrect application of parking brake',
    },
  },

  HAZARD_RESPONSE: {
    id: 'response',
    name: 'Hazard Response',
    description: 'Correct and controlled responses to hazards',
    codes: {
      50: 'Failed to reduce speed appropriately',
      51: 'Uncontrolled emergency braking',
      52: 'Inadequate steering to avoid obstacle',
      53: 'Wrong decision at hazard point',
      54: 'Hesitation causing traffic obstruction',
      55: 'Forced other vehicle to brake',
    },
  },

  INDEPENDENCE: {
    id: 'independence',
    name: 'Independence & Confidence',
    description: 'Confident and independent decision-making',
    codes: {
      60: 'Excessive reliance on instructor guidance',
      61: 'Lack of confidence in driving ability',
      62: 'Unsafe hesitation at junctions',
      63: 'Over-cautious driving affecting traffic flow',
      64: 'Needs repeated reminders',
    },
  },

  POSITIVES: {
    id: 'positives',
    name: 'Positive Observations',
    description: 'Things the student did well',
    codes: {
      70: 'Excellent vehicle control',
      71: 'Great observation skills',
      72: 'Confident decision-making',
      73: 'Smooth and safe driving',
      74: 'Good hazard awareness',
      75: 'Positive progress shown',
      76: 'Excellent response to instruction',
    },
  },
};

/**
 * Get feedback code description
 * @param code The numeric code
 * @returns The text description or undefined if not found
 */
export function getFeedbackDescription(code: number): string | undefined {
  for (const category of Object.values(FEEDBACK_CODES)) {
    if (code in category.codes) {
      return category.codes[code as keyof typeof category.codes];
    }
  }
  return undefined;
}

/**
 * Get all codes by category
 * @param categoryId The category ID
 * @returns Array of [code, description] pairs
 */
export function getCategoryFeedback(categoryId: string): [number, string][] {
  const category = FEEDBACK_CODES[categoryId];
  if (!category) return [];
  return Object.entries(category.codes).map(([code, desc]) => [
    Number(code),
    desc,
  ]);
}

/**
 * Get category info
 */
export function getCategory(categoryId: string): FeedbackCategory | undefined {
  return FEEDBACK_CODES[categoryId];
}

/**
 * Get all categories
 */
export function getAllCategories(): FeedbackCategory[] {
  return Object.values(FEEDBACK_CODES);
}

/**
 * Convert feedback codes to descriptions
 */
export function decodeFeedback(codes: number[] | string[]): string[] {
  const numCodes = codes.map((c) => (typeof c === 'string' ? parseInt(c) : c));
  return numCodes
    .map((code) => getFeedbackDescription(code))
    .filter((desc): desc is string => !!desc);
}
