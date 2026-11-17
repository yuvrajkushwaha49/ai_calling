import { CustomerFacts, FactConfidence } from './memory.types';
export interface ExtractedTurnFacts {
    facts: Partial<CustomerFacts>;
    confidenceMap: Record<string, FactConfidence>;
    isCorrection: boolean;
    correctionField?: string;
    rawSnippets: Record<string, string>;
    preferredProjects?: string[];
    rejectedProjects?: string[];
    preferredBuilders?: string[];
    rejectedBuilders?: string[];
}
export declare class FactExtractorService {
    private readonly logger;
    private readonly projectPatterns;
    private readonly builderPatterns;
    extractFacts(text: string, context?: {
        priorAgentText?: string;
        lastDiscussedProject?: string | null;
    }): ExtractedTurnFacts;
    extractFromUtterance(text: string, context?: {
        priorAgentText?: string;
        lastDiscussedProject?: string | null;
    }): ExtractedTurnFacts;
    private normalizeNumerals;
    private extractBhk;
    private extractBudget;
    private extractPurpose;
    private extractLocation;
    private extractTimeline;
    private extractPropertyType;
    extractProjects(text: string): {
        interested: string[];
        rejected: string[];
    };
    extractBuilders(text: string): {
        preferred: string[];
        rejected: string[];
    };
    private extractName;
}
