import { CustomerFacts, FactConfidence } from './memory.types';
export interface ExtractedTurnFacts {
    facts: Partial<CustomerFacts>;
    confidenceMap: Record<string, FactConfidence>;
    isCorrection: boolean;
    correctionField?: string;
    rawSnippets: Record<string, string>;
}
export declare class FactExtractorService {
    private readonly logger;
    private readonly projectPatterns;
    extractFacts(text: string): ExtractedTurnFacts;
    extractFromUtterance(text: string): ExtractedTurnFacts;
    private normalizeNumerals;
    private extractBhk;
    private extractBudget;
    private extractPurpose;
    private extractLocation;
    private extractTimeline;
    private extractProjects;
    private extractName;
}
