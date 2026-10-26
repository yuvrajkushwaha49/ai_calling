import { ConfigService } from '@nestjs/config';
import { ElevenLabsService } from '../elevenlabs/elevenlabs.service';
export declare class VoiceService {
    private config;
    private elevenlabs;
    private readonly logger;
    constructor(config: ConfigService, elevenlabs: ElevenLabsService);
    getTtsProvider(): 'elevenlabs';
    normalizeSpeaker(speaker?: string): string;
    normalizeAppLanguage(language?: string): string;
    normalizeLanguage(language?: string): string;
    formatSpeechText(text: string, language?: string): string;
    textToSpeech(options: {
        text: string;
        speaker?: string;
        language?: string;
        pace?: number;
        temperature?: number;
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
