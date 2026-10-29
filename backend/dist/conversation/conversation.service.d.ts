import { CallOutcome, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { type OpenerStyle } from '../calls/opener-bank';
export declare function pullSpokenSentences(buffer: string, options?: {
    force?: boolean;
    minChars?: number;
}): {
    sentences: string[];
    rest: string;
};
export declare function dropUnbackedPromises(text: string, knowledge: string): string;
export type DetectedLanguage = 'en-IN' | 'hi-IN' | 'hinglish' | 'mr-IN' | 'gu-IN' | 'ta-IN' | 'te-IN' | 'kn-IN' | 'bn-IN' | 'pa-IN' | 'mixed';
export declare class ConversationService {
    private prisma;
    private llm;
    private knowledge;
    private readonly logger;
    constructor(prisma: PrismaService, llm: LlmService, knowledge: KnowledgeService);
    detectLanguage(text: string, fallback?: string): DetectedLanguage;
    private isAmbiguousLanguageCue;
    resolveReplyLanguage(options: {
        userMessage: string;
        priorTranscript?: string | null;
        stickyLanguage?: string | null;
        fallback?: string;
    }): DetectedLanguage;
    private languageInstruction;
    private scriptLanguage;
    ensureProjectKnowledge(projectId: string): Promise<({
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: Prisma.JsonValue | null;
            embedding: Prisma.JsonValue | null;
            sourceId: string;
            chunkIndex: number;
            tokenCount: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }) | ({
        _count: {
            chunks: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }) | null>;
    buildOpening(options: {
        lead: {
            id: string;
            name: string;
            budget?: number | null;
            project?: {
                id?: string;
                name?: string | null;
                companyName?: string | null;
                builder?: string | null;
                location?: string | null;
            } | null;
        };
        agentName: string;
        companyName?: string;
        language?: string;
        tone?: string;
        agentVoice?: string;
        openerLearning?: unknown;
    }): Promise<{
        text: string;
        language: import("../calls/call-scripts").AppLanguage;
        openerStyle: OpenerStyle;
        known: import("../calls/call-scripts").ConversationFacts;
    }>;
    reply(options: {
        lead: {
            id: string;
            name: string;
            budget?: number | null;
            preferredLanguage?: string | null;
            preferredLocation?: string | null;
            bhkPreference?: string | null;
            purchaseTimeline?: string | null;
            projectId?: string | null;
            project?: {
                id: string;
                name: string;
                companyName?: string | null;
                builder?: string | null;
                location?: string | null;
                startingPrice?: number | null;
                endingPrice?: number | null;
                reraNumber?: string | null;
                possessionDate?: Date | null;
                amenities?: unknown;
                description?: string | null;
            } | null;
        };
        userMessage: string;
        priorTranscript?: string | null;
        agentName: string;
        companyName?: string;
        defaultLanguage?: string;
        tone?: string;
        systemPrompt?: string | null;
        llmModel?: string;
        approvedPlaybook?: unknown;
        agentVoice?: string;
        phoneLatency?: boolean;
        stream?: boolean;
        onTextDelta?: (delta: string) => void;
        onSentence?: (sentence: string) => void | Promise<void>;
        isInbound?: boolean;
    }): Promise<{
        replyText: string;
        languageDetected: "hinglish" | "hi-IN" | "en-IN" | "mr-IN" | "gu-IN" | "ta-IN" | "te-IN" | "kn-IN" | "bn-IN" | "pa-IN";
        sources: {
            chunkId: string;
            score: number;
            title: string;
            sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
            fileName: string | null;
            sourceUrl: string | null;
            excerpt: string;
        }[];
        qualification: {
            language: string;
            budgetLabel: string | null;
            preferredLocation: string | null;
            bhkPreference: string | null;
            purchaseTimeline: string | null;
            interestLevel: string;
            interestScore: number;
            objections: string | null;
            siteVisitInterest: boolean;
            callbackAt: string | null;
            outcome: string;
            summary: string;
            suggestedNextAction: string;
        };
        usedLlm: boolean;
        known: import("../calls/call-scripts").ConversationFacts;
        resolvedProjectId: string | null;
        resolvedProjectName: string | null;
    }>;
    private consumeLlmStream;
    matchProjectFromSpeech(text: string): Promise<{
        id: string;
        name: string;
        companyName?: string | null;
        builder?: string | null;
        location?: string | null;
        startingPrice?: number | null;
        endingPrice?: number | null;
        reraNumber?: string | null;
        possessionDate?: Date | null;
        amenities?: unknown;
        description?: string | null;
    } | null>;
    private stripBannedPhrases;
    private fixGenderedSpeech;
    private extractQualification;
    mapOutcomeToLeadStatus(outcome: string): LeadStatus;
    mapOutcomeEnum(outcome: string): CallOutcome;
    applyQualificationToLead(leadId: string, qualification: Record<string, unknown>): Promise<{
        email: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        budget: number | null;
        propertyType: import("@prisma/client").$Enums.PropertyType | null;
        status: import("@prisma/client").$Enums.LeadStatus;
        notes: string | null;
        projectId: string | null;
        aiSummary: string | null;
        preferredLanguage: string | null;
        preferredLocation: string | null;
        bhkPreference: string | null;
        purchaseTimeline: string | null;
        interestLevel: string | null;
        interestScore: number | null;
        objections: string | null;
        siteVisitInterest: boolean;
        callbackAt: Date | null;
        doNotCall: boolean;
        consentToCall: boolean;
        suggestedNextAction: string | null;
        lastQualifiedAt: Date | null;
    }>;
}
