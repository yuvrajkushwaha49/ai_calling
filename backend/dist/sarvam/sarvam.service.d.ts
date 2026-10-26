import { ConfigService } from '@nestjs/config';
export type SarvamLanguageCode = 'bn-IN' | 'en-IN' | 'gu-IN' | 'hi-IN' | 'kn-IN' | 'ml-IN' | 'mr-IN' | 'od-IN' | 'pa-IN' | 'ta-IN' | 'te-IN';
export declare class SarvamService {
    private config;
    private readonly baseUrl;
    private readonly uploadsDir;
    constructor(config: ConfigService);
    private getApiKey;
    normalizeLanguage(language?: string): SarvamLanguageCode;
    normalizeAppLanguage(language?: string): string;
    normalizeSpeaker(speaker?: string): string;
    formatSpeechText(text: string, language?: string): string;
    textToSpeech(options: {
        text: string;
        speaker?: string;
        language?: string;
        pace?: number;
        temperature?: number;
        skipSave?: boolean;
    }): Promise<{
        audioBase64: string;
        fileName: string;
        filePath: string;
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
