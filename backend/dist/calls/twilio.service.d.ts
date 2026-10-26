import { ConfigService } from '@nestjs/config';
export declare class TwilioService {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    getPublicBaseUrl(): string;
    getStatus(): {
        configured: boolean;
        fromNumber: string | null;
        publicBaseUrl: string;
        webhookVoice: string;
        webhookStatus: string;
        mediaWs: string;
        webhookReady: boolean;
        needsTunnel: boolean;
        message: string;
    };
    normalizePhone(raw: string): string;
    private authHeader;
    buildVoiceTwiml(options: {
        callId: string;
        greetingAudioUrl?: string | null;
        greetingText?: string | null;
    }): string;
    createOutboundCall(options: {
        to: string;
        callId: string;
    }): Promise<{
        sid: string;
    }>;
    private extractError;
}
