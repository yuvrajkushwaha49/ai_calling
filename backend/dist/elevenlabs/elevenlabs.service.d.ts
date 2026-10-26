import { ConfigService } from '@nestjs/config';
export declare const ELEVENLABS_VOICES: Record<string, {
    id: string;
    label: string;
    gender: 'male' | 'female';
}>;
export declare class ElevenLabsService {
    private config;
    private readonly logger;
    private readonly baseUrl;
    private readonly uploadsDir;
    private freeVoiceIdCache;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    private getApiKey;
    private getModel;
    normalizeSpeaker(speaker?: string): string;
    resolveVoiceId(speaker?: string): string;
    pickFreePlanVoiceId(): Promise<string | null>;
    voiceGender(speaker?: string): 'male' | 'female';
    listVoices(): {
        value: string;
        label: string;
        gender: "male" | "female";
        voiceId: string;
    }[];
    private freePlanHelpMessage;
    formatForElevenLabs(text: string, language?: string, modelOverride?: string): string;
    resolveLanguageCode(language?: string, romanized?: boolean, modelOverride?: string): string | undefined;
    textToSpeech(options: {
        text: string;
        speaker?: string;
        language?: string;
        pace?: number;
        skipSave?: boolean;
        outputFormat?: string;
        modelId?: string;
        optimizeStreamingLatency?: number;
    }): Promise<{
        audioBase64: string;
        fileName: string;
        filePath: string;
        mimeType: string;
    }>;
    private sttLanguageCode;
    speechToText(options: {
        filePath?: string;
        buffer?: Buffer;
        fileName?: string;
        language?: string;
    }): Promise<{
        transcript: string;
        languageCode?: string | null;
    }>;
    getAudioAbsolutePath(fileName: string): string;
}
