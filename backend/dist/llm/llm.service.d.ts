import { ConfigService } from '@nestjs/config';
export type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};
export type LlmProvider = 'gemini' | 'openai';
export declare class LlmService {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    getProvider(): LlmProvider;
    isConfigured(): boolean;
    private getGeminiKey;
    private getOpenAiKey;
    private getOpenAiBaseUrl;
    private getDefaultModel;
    private getEmbedModel;
    getStatus(): {
        configured: boolean;
        provider: LlmProvider;
        defaultModel: string;
        baseUrl: string;
    };
    chat(messages: ChatMessage[], options?: {
        temperature?: number;
        json?: boolean;
        model?: string;
        maxOutputTokens?: number;
        timeoutMs?: number;
        lowLatency?: boolean;
    }): Promise<string | null>;
    chatStream(messages: ChatMessage[], options?: {
        temperature?: number;
        model?: string;
        maxOutputTokens?: number;
        timeoutMs?: number;
        lowLatency?: boolean;
    }): AsyncGenerator<string, void, unknown>;
    private buildGeminiBody;
    private streamGemini;
    private streamOpenAi;
    private resolveChatModel;
    private chatGemini;
    private chatGeminiOnce;
    private chatOpenAi;
    embed(texts: string[]): Promise<number[][] | null>;
    private embedGemini;
    private embedOpenAi;
    localEmbed(text: string, dims?: number): number[];
    cosine(a: number[], b: number[]): number;
}
