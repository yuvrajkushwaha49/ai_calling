import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';
import { VoiceService } from '../voice/voice.service';
import { LlmService } from '../llm/llm.service';
import { type OpenerLearning, type OpenerStyle } from '../calls/opener-bank';
export declare class AiService {
    private prisma;
    private voice;
    private llm;
    private settingsCache;
    private readonly settingsTtlMs;
    constructor(prisma: PrismaService, voice: VoiceService, llm: LlmService);
    getSettings(): Promise<{
        llmConfigured: boolean;
        llmProvider: import("../llm/llm.service").LlmProvider;
        ttsProvider: "elevenlabs";
        ttsVoices: {
            value: string;
            label: string;
            gender: "male" | "female";
        }[] | undefined;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyName: string;
        agentName: string;
        agentVoice: string;
        language: string;
        tone: string;
        llmModel: string;
        systemPrompt: string;
        workingHours: Prisma.JsonValue | null;
        knowledgeBase: Prisma.JsonValue | null;
        isActive: boolean;
        approvedPlaybook: Prisma.JsonValue | null;
        retryRules: Prisma.JsonValue | null;
        timezone: string;
    }>;
    invalidateSettingsCache(): void;
    private loadSettings;
    private normalizeTone;
    normalizeLlmModel(model?: string): string;
    getOpenerLearning(settings?: {
        approvedPlaybook?: unknown;
    }): OpenerLearning;
    private mutateOpenerLearning;
    recordOpenerUse(style: OpenerStyle): Promise<OpenerLearning>;
    recordOpenerWin(style: OpenerStyle): Promise<OpenerLearning>;
    learnFromCompletedCall(input: {
        callId: string;
        outcome?: string | null;
        transcript?: string | null;
        interestScore?: number | null;
    }): Promise<string | null>;
    getPlaybookSummary(): Promise<{
        preferredOpener: OpenerStyle | null;
        lastOpener: OpenerStyle | null;
        openerStyles: {
            id: "soft_time" | "project_hook" | "warm_checkin" | "curiosity" | "availability";
            uses: number;
            wins: number;
            winRate: number;
        }[];
        tips: import("./playbook").PlaybookTip[];
        autoLessons: import("./playbook").AutoLesson[];
        history: import("./playbook").ImprovementEvent[];
        totals: {
            tips: number;
            autoLessons: number;
            history: number;
        };
    }>;
    updateSettings(dto: UpdateAiSettingsDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyName: string;
        agentName: string;
        agentVoice: string;
        language: string;
        tone: string;
        llmModel: string;
        systemPrompt: string;
        workingHours: Prisma.JsonValue | null;
        knowledgeBase: Prisma.JsonValue | null;
        isActive: boolean;
        approvedPlaybook: Prisma.JsonValue | null;
        retryRules: Prisma.JsonValue | null;
        timezone: string;
    }>;
    uploadKnowledgeBase(files: string[]): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyName: string;
        agentName: string;
        agentVoice: string;
        language: string;
        tone: string;
        llmModel: string;
        systemPrompt: string;
        workingHours: Prisma.JsonValue | null;
        knowledgeBase: Prisma.JsonValue | null;
        isActive: boolean;
        approvedPlaybook: Prisma.JsonValue | null;
        retryRules: Prisma.JsonValue | null;
        timezone: string;
    }>;
    previewVoice(options?: {
        text?: string;
        speaker?: string;
        language?: string;
    }): Promise<{
        speaker: string;
        language: string;
        mimeType: string;
        audioBase64: string;
        fileName: string;
        ttsProvider: "elevenlabs";
    }>;
}
