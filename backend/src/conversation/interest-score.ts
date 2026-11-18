/**
 * Workains Reality — Transparent Lead Qualification Scoring Engine
 *
 * Implements deterministic, rule-based lead qualification scoring (0-100 and 0-10)
 * based on verified property purchase attributes.
 *
 * RULES:
 * 1. An answered call starts with a baseline score of 0. Merely picking up NEVER qualifies a lead.
 * 2. Qualification Criteria (Weighted to 100 points total):
 *    - BHK Preference verified: +20 points
 *    - Budget Preference verified: +20 points
 *    - Location Preference verified: +15 points
 *    - Timeline / Possession verified: +15 points
 *    - Purchase Purpose (End-Use / Investment) verified: +10 points
 *    - Site Visit / Meeting Requested or Confirmed: +20 points
 * 3. Qualification Threshold: Score >= 60 points (or >= 6/10).
 * 4. Disqualification Signals: Opt-out, DNC, "not interested", "nahi chahiye", wrong number
 *    immediately caps score <= 10 and sets isQualified = false.
 */

export interface LeadScoreCriterion {
  points: number;
  max: number;
  verified: boolean;
  value?: string | number | boolean | null;
  source?: 'customer_explicit' | 'prior_transcript' | 'crm_profile' | 'inferred';
  timestamp?: string;
}

export interface LeadScoreBreakdown {
  bhk: LeadScoreCriterion;
  budget: LeadScoreCriterion;
  location: LeadScoreCriterion;
  timeline: LeadScoreCriterion;
  purpose: LeadScoreCriterion;
  siteVisit: LeadScoreCriterion;
  engagement: { points: number; max: 10; leadTurns: number };
  disqualified: boolean;
  disqualificationReason?: string;
}

export interface LeadQualificationResult {
  score100: number; // 0 to 100
  score10: number;  // 0 to 10
  isQualified: boolean;
  breakdown: LeadScoreBreakdown;
  preferenceSources: Record<string, { value: unknown; source: string; timestamp: string }>;
}

export interface LeadScoringInput {
  userMessage?: string;
  priorTranscript?: string | null;
  known?: {
    interested?: boolean;
    budgetLabel?: string | null;
    budget?: number | null;
    location?: string | null;
    bhk?: string | null;
    timeline?: string | null;
    purpose?: string | null;
    askedVisit?: boolean;
    callerName?: string | null;
  };
  outcome?: string;
  siteVisitInterest?: boolean;
  meetingBooked?: boolean;
  previousScore?: number | null;
}

/**
 * Transparent evaluation of lead qualification criteria.
 */
export function evaluateLeadQualification(input: LeadScoringInput): LeadQualificationResult {
  const msg = (input.userMessage || '').toLowerCase();
  const prior = (input.priorTranscript || '').toLowerCase();
  const all = `${prior}\n${msg}`.trim();
  const known = input.known || {};
  const now = new Date().toISOString();

  // 1. Detect explicit disqualification signals
  const isDisqualified =
    /not interested|nahi chahiye|नहीं चाहिए|don't call|do not call|no thanks|mat call|मत कॉल|wrong number|गलत नंबर|rakho phone|rakh do/i.test(
      msg,
    ) || input.outcome === 'NOT_INTERESTED';

  const preferenceSources: Record<string, { value: unknown; source: string; timestamp: string }> = {};

  // 2. Evaluate BHK (Max 20)
  let bhkVerified = false;
  let bhkVal: string | null = null;
  let bhkSource: 'customer_explicit' | 'prior_transcript' | 'crm_profile' | 'inferred' = 'customer_explicit';

  const bhkMsgMatch = msg.match(/\b([1-5])\s*(?:bhk|bedroom|बी\s*एच\s*के|बीएचके)\b/i);
  if (bhkMsgMatch) {
    bhkVerified = true;
    bhkVal = `${bhkMsgMatch[1]} BHK`;
    bhkSource = 'customer_explicit';
  } else if (known.bhk) {
    bhkVerified = true;
    bhkVal = known.bhk;
    bhkSource = 'crm_profile';
  } else {
    const bhkPriorMatch = prior.match(/\b([1-5])\s*(?:bhk|bedroom|बी\s*एच\s*के|बीएचके)\b/i);
    if (bhkPriorMatch) {
      bhkVerified = true;
      bhkVal = `${bhkPriorMatch[1]} BHK`;
      bhkSource = 'prior_transcript';
    }
  }

  if (bhkVerified && bhkVal) {
    preferenceSources.bhk = { value: bhkVal, source: bhkSource, timestamp: now };
  }

  // 3. Evaluate Budget (Max 20)
  let budgetVerified = false;
  let budgetVal: string | null = null;
  let budgetSource: 'customer_explicit' | 'prior_transcript' | 'crm_profile' | 'inferred' = 'customer_explicit';

  const budgetMsgMatch = msg.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|crore|cr|लाख|करोड़)\b/i);
  if (budgetMsgMatch) {
    budgetVerified = true;
    budgetVal = budgetMsgMatch[0].trim();
    budgetSource = 'customer_explicit';
  } else if (known.budgetLabel || known.budget) {
    budgetVerified = true;
    budgetVal = known.budgetLabel || `${known.budget} INR`;
    budgetSource = 'crm_profile';
  } else {
    const budgetPriorMatch = prior.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|crore|cr|लाख|करोड़)\b/i);
    if (budgetPriorMatch) {
      budgetVerified = true;
      budgetVal = budgetPriorMatch[0].trim();
      budgetSource = 'prior_transcript';
    }
  }

  if (budgetVerified && budgetVal) {
    preferenceSources.budget = { value: budgetVal, source: budgetSource, timestamp: now };
  }

  // 4. Evaluate Location (Max 15)
  let locationVerified = false;
  let locVal: string | null = null;
  let locSource: 'customer_explicit' | 'prior_transcript' | 'crm_profile' | 'inferred' = 'customer_explicit';

  const locMatch = msg.match(/(?:noida\s*(?:extension|west|expressway)?|greater\s*noida(?:\s*west)?|ghaziabad|gurgaon|gurugram|delhi\s*ncr|raj\s*nagar|sector\s*\d+)/i);
  if (locMatch) {
    locationVerified = true;
    locVal = locMatch[0].trim();
    locSource = 'customer_explicit';
  } else if (known.location) {
    locationVerified = true;
    locVal = known.location;
    locSource = 'crm_profile';
  } else {
    const locPriorMatch = prior.match(/(?:noida\s*(?:extension|west|expressway)?|greater\s*noida(?:\s*west)?|ghaziabad|gurgaon|gurugram|delhi\s*ncr|raj\s*nagar|sector\s*\d+)/i);
    if (locPriorMatch) {
      locationVerified = true;
      locVal = locPriorMatch[0].trim();
      locSource = 'prior_transcript';
    }
  }

  if (locationVerified && locVal) {
    preferenceSources.location = { value: locVal, source: locSource, timestamp: now };
  }

  // 5. Evaluate Timeline / Possession (Max 15)
  let timelineVerified = false;
  let timelineVal: string | null = null;
  let timelineSource: 'customer_explicit' | 'prior_transcript' | 'crm_profile' | 'inferred' = 'customer_explicit';

  const timelineMatch = all.match(/(?:ready\s*to\s*move|under\s*construction|rtm|uc\b|within\s*\d+\s*(?:month|year)s?|immediate|jaldi|turant|6\s*month|1\s*year)/i);
  if (timelineMatch) {
    timelineVerified = true;
    timelineVal = timelineMatch[0].trim();
    timelineSource = msg.includes(timelineMatch[0]) ? 'customer_explicit' : 'prior_transcript';
  } else if (known.timeline) {
    timelineVerified = true;
    timelineVal = known.timeline;
    timelineSource = 'crm_profile';
  }

  if (timelineVerified && timelineVal) {
    preferenceSources.timeline = { value: timelineVal, source: timelineSource, timestamp: now };
  }

  // 6. Evaluate Purchase Purpose (End-use / Investment) (Max 10)
  let purposeVerified = false;
  let purposeVal: string | null = null;
  let purposeSource: 'customer_explicit' | 'prior_transcript' | 'crm_profile' | 'inferred' = 'customer_explicit';

  const purposeMatch = all.match(/(?:self\s*use|end\s*use|rehne\s*ke\s*liye|family\s*ke\s*liye|khud\s*ke\s*liye|investment|rental|rent\s*ke\s*liye|invest)/i);
  if (purposeMatch) {
    purposeVerified = true;
    purposeVal = purposeMatch[0].trim();
    purposeSource = msg.includes(purposeMatch[0]) ? 'customer_explicit' : 'prior_transcript';
  } else if (known.purpose) {
    purposeVerified = true;
    purposeVal = known.purpose;
    purposeSource = 'crm_profile';
  }

  if (purposeVerified && purposeVal) {
    preferenceSources.purpose = { value: purposeVal, source: purposeSource, timestamp: now };
  }

  // 7. Evaluate Site Visit or In-Person Meeting (Max 20)
  let visitVerified = false;
  let visitSource: 'customer_explicit' | 'prior_transcript' | 'crm_profile' | 'inferred' = 'customer_explicit';

  if (input.meetingBooked || /booked your meeting|meeting booked|मीटिंग.*सेट|calendar/i.test(prior)) {
    visitVerified = true;
    visitSource = 'customer_explicit';
  } else if (
    input.siteVisitInterest ||
    known.askedVisit ||
    input.outcome === 'SITE_VISIT_INTERESTED' ||
    /(?:site\s*visit|visit\s*karna|visit\s*karein|dekhna\s*hai|site\s*pe\s*aana|aunga|aayenge)/i.test(msg)
  ) {
    visitVerified = true;
    visitSource = input.siteVisitInterest ? 'customer_explicit' : 'prior_transcript';
  }

  if (visitVerified) {
    preferenceSources.siteVisit = { value: true, source: visitSource, timestamp: now };
  }

  // 8. Lead Turn Engagement Bonus (Max 10)
  const leadTurns = (all.match(/(?:^|\n)\s*lead\s*:/gi) || []).length;
  let engagementPoints = 0;
  if (leadTurns >= 6) {
    engagementPoints = 10;
  } else if (leadTurns >= 3) {
    engagementPoints = 5;
  }

  // Assemble Breakdown
  const breakdown: LeadScoreBreakdown = {
    bhk: { points: bhkVerified ? 20 : 0, max: 20, verified: bhkVerified, value: bhkVal, source: bhkSource, timestamp: now },
    budget: { points: budgetVerified ? 20 : 0, max: 20, verified: budgetVerified, value: budgetVal, source: budgetSource, timestamp: now },
    location: { points: locationVerified ? 15 : 0, max: 15, verified: locationVerified, value: locVal, source: locSource, timestamp: now },
    timeline: { points: timelineVerified ? 15 : 0, max: 15, verified: timelineVerified, value: timelineVal, source: timelineSource, timestamp: now },
    purpose: { points: purposeVerified ? 10 : 0, max: 10, verified: purposeVerified, value: purposeVal, source: purposeSource, timestamp: now },
    siteVisit: { points: visitVerified ? 20 : 0, max: 20, verified: visitVerified, value: visitVerified, source: visitSource, timestamp: now },
    engagement: { points: engagementPoints, max: 10, leadTurns },
    disqualified: isDisqualified,
    disqualificationReason: isDisqualified ? 'Customer stated not interested / opt-out / wrong number' : undefined,
  };

  if (isDisqualified) {
    return {
      score100: 10,
      score10: 1,
      isQualified: false,
      breakdown,
      preferenceSources,
    };
  }

  // Sum points: Criteria sum to max 100
  let rawScore =
    breakdown.bhk.points +
    breakdown.budget.points +
    breakdown.location.points +
    breakdown.timeline.points +
    breakdown.purpose.points +
    breakdown.siteVisit.points +
    breakdown.engagement.points;

  // Cap at 100
  const score100 = Math.max(0, Math.min(100, rawScore));
  const score10 = Math.max(0, Math.min(10, Math.round(score100 / 10)));

  // Qualification condition: Score >= 60 points
  const isQualified = score100 >= 60;

  return {
    score100,
    score10,
    isQualified,
    breakdown,
    preferenceSources,
  };
}

/**
 * Backward-compatible interest score computation returning integer 0-10.
 * Directly leverages evaluateLeadQualification for unified logic.
 */
export function computeInterestScore(input: LeadScoringInput): number {
  if (!input.userMessage && !input.priorTranscript && !input.known && !input.outcome) {
    return 0; // Fresh call without facts starts at 0, never arbitrary 4
  }

  const result = evaluateLeadQualification(input);
  return result.score10;
}

export function interestLevelFromScore(score: number): string {
  if (score <= 2) return 'none';
  if (score <= 4) return 'low';
  if (score <= 6) return 'medium';
  if (score <= 8) return 'high';
  return 'hot';
}
