import { ConfigService } from '@nestjs/config';
export type WhatsAppDeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'UNAVAILABLE';
export interface WhatsAppSendResult {
    success: boolean;
    status: WhatsAppDeliveryStatus;
    messageId?: string;
    reason?: string;
    disclaimer: string;
    builderAttribution?: string;
}
export declare class WhatsAppService {
    private readonly config;
    private readonly logger;
    private readonly processedWebhooks;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    sendDocument(options: {
        toPhone: string;
        leadName?: string;
        projectName?: string;
        builderName?: string;
        documentType: 'brochure' | 'floor_plan' | 'price_sheet';
        documentUrl?: string;
        hasConsent?: boolean;
        isOptedOut?: boolean;
    }): Promise<WhatsAppSendResult>;
    handleWebhookStatus(messageId: string, status: 'sent' | 'delivered' | 'read' | 'failed', timestamp?: string): {
        messageId: string;
        status: WhatsAppDeliveryStatus;
        timestamp: string;
        idempotent: boolean;
    };
}
