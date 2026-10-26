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
}
