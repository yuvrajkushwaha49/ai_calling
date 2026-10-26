import { AiService } from './ai.service';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';
export declare class AiController {
    private aiService;
    constructor(aiService: AiService);
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
        workingHours: import("@prisma/client/runtime/library").JsonValue | null;
        knowledgeBase: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        approvedPlaybook: import("@prisma/client/runtime/library").JsonValue | null;
        retryRules: import("@prisma/client/runtime/library").JsonValue | null;
        timezone: string;
    }>;
    getPlaybook(): Promise<{
        preferredOpener: import("../calls/opener-bank").OpenerStyle | null;
        lastOpener: import("../calls/opener-bank").OpenerStyle | null;
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
        workingHours: import("@prisma/client/runtime/library").JsonValue | null;
        knowledgeBase: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        approvedPlaybook: import("@prisma/client/runtime/library").JsonValue | null;
        retryRules: import("@prisma/client/runtime/library").JsonValue | null;
        timezone: string;
    }>;
    uploadKnowledgeBase(body: {
        files: string[];
    }): Promise<{
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
        workingHours: import("@prisma/client/runtime/library").JsonValue | null;
        knowledgeBase: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        approvedPlaybook: import("@prisma/client/runtime/library").JsonValue | null;
        retryRules: import("@prisma/client/runtime/library").JsonValue | null;
        timezone: string;
    }>;
    previewVoice(body: {
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
