import { ConfigService } from '@nestjs/config';
export type WhatsAppDeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'UNAVAILABLE';
export interface WhatsAppSendResult {
    success: boolean;
    status: WhatsAppDeliveryStatus;
    messageId?: string;
    reason?: string;
    disclaimer: string;
}
export declare class WhatsAppService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    sendDocument(options: {
        toPhone: string;
        leadName?: string;
        projectName?: string;
        documentType: 'brochure' | 'floor_plan' | 'price_sheet';
        documentUrl?: string;
    }): Promise<WhatsAppSendResult>;
}
