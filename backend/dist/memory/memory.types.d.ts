export type FactSource = 'customer' | 'crm' | 'inference';
export type FactConfidence = 'confirmed' | 'approximate' | 'inferred';
export interface FactEntry {
    value: any;
    source: FactSource;
    confidence: FactConfidence;
    updatedAt: number;
    rawSnippet?: string;
    previousValue?: any;
}
export interface CustomerFacts {
    name?: string | null;
    purpose?: 'end_use' | 'investment' | string | null;
    bhk?: string | null;
    budget?: number | null;
    budgetLabel?: string | null;
    location?: string | null;
    timeline?: string | null;
    possession?: 'ready_to_move' | 'under_construction' | string | null;
    interestedProjects: string[];
    siteVisit?: {
        interested: boolean;
        preferredDay?: string;
        notes?: string;
    } | null;
}
export interface CustomerProfileCache {
    leadId: string | null;
    name: string | null;
    phone: string;
    purpose: string | null;
    bhk: string | null;
    budget: number | null;
    budgetLabel: string | null;
    preferredLocation: string | null;
    purchaseTimeline: string | null;
    interestedProjects: string[];
    leadStatus: string | null;
    lastCallOutcome: string | null;
    previousCallCount: number;
    lastCallAt: string | null;
    summary: string | null;
    updatedAt: number;
}
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    interrupted?: boolean;
}
export interface ConversationState {
    callId: string;
    leadId: string | null;
    phone: string;
    isReturningCustomer: boolean;
    previousCallCount: number;
    lastCallSummary?: string | null;
    customer: CustomerFacts;
    confirmedFacts: Record<string, FactEntry>;
    approximateFacts: Record<string, FactEntry>;
    answeredFields: string[];
    askedQuestions: string[];
    pendingQuestion: string | null;
    lastIntent: string | null;
    conversationStage: 'greeting' | 'discovery' | 'qualification' | 'project_pitch' | 'visit_booking' | 'closing';
    conversationSummary: string;
    lastAssistantResponse: string;
    updatedAt: number;
}
