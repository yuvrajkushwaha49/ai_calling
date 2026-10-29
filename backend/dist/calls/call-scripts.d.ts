import { CallOutcome } from '@prisma/client';
export type AppLanguage = 'en-IN' | 'hi-IN' | 'hinglish' | 'mr-IN' | 'gu-IN';
export type AppTone = 'professional' | 'friendly' | 'persuasive' | 'warm' | 'formal';
export type SpeechGender = 'male' | 'female';
export declare function inferGenderFromName(name?: string | null): SpeechGender | null;
export declare function agentGenderFromVoice(voice?: string | null): SpeechGender;
export declare function resolveSpeechGender(options: {
    leadName?: string | null;
    agentName?: string | null;
    agentVoice?: string | null;
}): SpeechGender;
export declare function ag(gender: SpeechGender, male: string, female: string): string;
type ReplyKind = 'not_interested' | 'close_ack' | 'callback' | 'explain_why_call' | 'greeting_inbound' | 'liveness_ack' | 'thinking_filler' | 'ask_planning' | 'ask_bhk' | 'ask_possession' | 'offer_visit' | 'confirm_followup' | 'confirm_details' | 'price_soft' | 'default';
export type ConversationFacts = {
    budgetLabel?: string;
    location?: string;
    bhk?: string;
    timeline?: string;
    possession?: string;
    visitDay?: string;
    interested?: boolean;
    askedVisit?: boolean;
    callerName?: string;
    purpose?: string;
};
export declare function normalizeLanguage(language?: string): AppLanguage;
export declare function normalizeTone(tone?: string): AppTone;
export declare function phoneSpeechGuide(): string;
export declare function sarvamSpeechGuide(): string;
export declare function toneStyleGuide(tone?: string): string;
export declare function compactToneGuide(tone?: string): string;
export declare function parseBudgetToNumber(label?: string | null): number | undefined;
export declare function inferBudgetFromShortReply(raw: string, options?: {
    agentAskedBudget?: boolean;
}): string | undefined;
export declare function extractFactsFromText(raw: string): ConversationFacts;
export declare function mergeFacts(...parts: Array<ConversationFacts | undefined>): ConversationFacts;
export declare function factsFromLead(lead?: {
    budget?: number | null;
    preferredLocation?: string | null;
    bhkPreference?: string | null;
    propertyType?: string | null;
    project?: {
        location?: string | null;
        name?: string | null;
    } | null;
    trustProfileBudget?: boolean;
}): ConversationFacts;
export declare function lastAgentLine(transcript?: string | null): string;
export declare function isShortAffirmation(text: string): boolean;
export declare function isShortDecline(text: string): boolean;
export declare function lastAgentWasSoftClose(agentLine: string): boolean;
export declare function lastAgentAskedTalkPermission(agentLine: string): boolean;
export declare function lastAgentOfferedDetails(agentLine: string): boolean;
export declare function lastAgentOfferedCallback(agentLine: string): boolean;
export declare function resolveContextualShortReply(options: {
    userMessage: string;
    priorTranscript?: string | null;
}): {
    kind: ReplyKind;
    outcome: CallOutcome;
} | null;
export declare function isSameTalk(a: string, b: string): boolean;
export declare function priorAgentAsked(prior?: string | null): {
    askedBudget: boolean;
    askedLocation: boolean;
    askedBhk: boolean;
    askedTimeline: boolean;
    askedPossession: boolean;
    askedPlanning: boolean;
    offeredVisit: boolean;
    askedDay: boolean;
};
export declare function buildGreetingText(options: {
    leadName: string;
    agentName: string;
    projectName?: string | null;
    hasBudget?: boolean;
    budgetLabel?: string;
    language?: string;
    tone?: string;
    agentVoice?: string;
    companyName?: string | null;
}): string;
export declare function detectIntent(text: string): {
    notInterested: boolean;
    callback: boolean;
    askingWhyCall: boolean;
    askingIdentity: boolean;
    isGreeting: boolean;
    askingPrice: boolean;
    statingBhk: boolean;
    statingPossession: boolean;
    statingVisitDay: boolean;
    positive: boolean;
};
export declare function buildFollowUpReply(options: {
    transcript: string;
    leadName: string;
    language?: string;
    tone?: string;
    priorTranscript?: string | null;
    knownFacts?: ConversationFacts;
    speechGender?: SpeechGender;
    agentVoice?: string;
    agentName?: string;
    companyName?: string;
    isInbound?: boolean;
}): {
    text: string;
    outcome: CallOutcome;
    facts: ConversationFacts;
};
export declare function previewSampleText(agentName: string, language?: string): string;
export {};
