import { ConfigService } from '@nestjs/config';
export declare class McubeService {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    getPublicBaseUrl(): string;
    getStatus(): {
        configured: boolean;
        publicBaseUrl: string;
        websocketUrlTemplate: string;
        alternativeWsUrl: string;
        webhookReady: boolean;
        needsTunnel: boolean;
        message: string;
    };
    normalizePhone(raw: string): string;
    createOutboundCall(options: {
        to: string;
        callId: string;
    }): Promise<{
        status: string;
        callId: string;
    }>;
}
