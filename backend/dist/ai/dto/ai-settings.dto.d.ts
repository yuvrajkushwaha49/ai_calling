export declare class UpdateAiSettingsDto {
    agentName?: string;
    agentVoice?: string;
    language?: string;
    tone?: string;
    llmModel?: string;
    companyName?: string;
    systemPrompt?: string;
    workingHours?: Record<string, unknown>;
    knowledgeBase?: string[];
    isActive?: boolean;
    voiceSettings?: {
        stability?: number;
        similarityBoost?: number;
        style?: number;
        speed?: number;
        useSpeakerBoost?: boolean;
    };
    voiceStability?: number;
    voiceSimilarity?: number;
    voiceStyle?: number;
    voiceSpeed?: number;
    voiceSpeakerBoost?: boolean;
}
