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
    engagement: {
        points: number;
        max: 10;
        leadTurns: number;
    };
    disqualified: boolean;
    disqualificationReason?: string;
}
export interface LeadQualificationResult {
    score100: number;
    score10: number;
    isQualified: boolean;
    breakdown: LeadScoreBreakdown;
    preferenceSources: Record<string, {
        value: unknown;
        source: string;
        timestamp: string;
    }>;
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
export declare function evaluateLeadQualification(input: LeadScoringInput): LeadQualificationResult;
export declare function computeInterestScore(input: LeadScoringInput): number;
export declare function interestLevelFromScore(score: number): string;
