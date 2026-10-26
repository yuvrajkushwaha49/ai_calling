export declare function computeInterestScore(input: {
    userMessage: string;
    priorTranscript?: string | null;
    known?: {
        interested?: boolean;
        budgetLabel?: string | null;
        location?: string | null;
        bhk?: string | null;
        askedVisit?: boolean;
    };
    outcome?: string;
    siteVisitInterest?: boolean;
    meetingBooked?: boolean;
    previousScore?: number | null;
}): number;
export declare function interestLevelFromScore(score: number): string;
