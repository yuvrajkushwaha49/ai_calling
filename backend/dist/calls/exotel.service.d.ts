import { ConfigService } from '@nestjs/config';
export declare class ExotelService {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    getStatus(): {
        configured: boolean;
        fromNumber: string | null;
        appId: string | null;
        publicBaseUrl: string;
        webhookStatus: string;
        webhookGreeting: string;
        webhookVoicebot: string;
        voicebotWs: string;
        webhookReady: boolean;
        needsTunnel: boolean;
        message: string;
    };
    normalizePhone(raw: string): string;
    toExotelFrom(raw: string): string;
    getPublicBaseUrl(): string;
    private getApiHost;
    private authHeader;
    flowUrl(): string;
    createOutboundCall(options: {
        to: string;
        callId: string;
    }): Promise<{
        sid: string;
    }>;
    private extractCallSid;
    private extractErrorMessage;
}
