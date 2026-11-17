export type FactSource = 'previous_call' | 'current_call' | 'customer' | 'crm' | 'inference';
export type FactConfidence = 'confirmed' | 'approximate' | 'inferred';
export interface FactEntry {
    value: any;
    source: FactSource;
    confidence: FactConfidence;
    updatedAt: number;
    rawSnippet?: string;
    previousValue?: any;
}
export type MissingFact = 'name' | 'bhk' | 'budget' | 'purpose' | 'location' | 'possession' | 'property_type' | 'site_visit';
export type NextAction = 'answer_direct_question' | 'acknowledge_update' | 'ask_name' | 'ask_bhk' | 'ask_budget' | 'ask_purpose' | 'ask_location' | 'ask_possession' | 'recommend_property' | 'offer_site_visit' | 'confirm_site_visit' | 'soft_close';
export interface ConversationFactContext {
    knownFacts: string[];
    missingFacts: MissingFact[];
    nextAction: NextAction;
    factDetails: Record<string, {
        value: any;
        source: string;
        confirmed: boolean;
        previousValue?: any;
    }>;
}
export interface CustomerFacts {
    name?: string | null;
    purpose?: 'end_use' | 'investment' | string | null;
    bhk?: string | null;
    budget?: number | null;
    budgetLabel?: string | null;
    location?: string | null;
    preferredLocations?: string[];
    preferredBuilders?: string[];
    rejectedBuilders?: string[];
    preferredProjects?: string[];
    rejectedProjects?: string[];
    timeline?: string | null;
    possession?: 'ready_to_move' | 'under_construction' | string | null;
    possessionPreference?: string | null;
    propertyType?: 'residential' | 'commercial' | string | null;
    sizePreference?: string | null;
    lastDiscussedProject?: string | null;
    lastDiscussedBuilder?: string | null;
    nextRecommendedProjects?: string[];
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
    preferredLocations?: string[];
    preferredBuilders?: string[];
    rejectedBuilders?: string[];
    preferredProjects?: string[];
    rejectedProjects?: string[];
    purchaseTimeline: string | null;
    propertyType?: string | null;
    sizePreference?: string | null;
    possessionPreference?: string | null;
    lastDiscussedProject?: string | null;
    lastDiscussedBuilder?: string | null;
    nextRecommendedProjects?: string[];
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
    factContext?: ConversationFactContext;
    updatedAt: number;
}
