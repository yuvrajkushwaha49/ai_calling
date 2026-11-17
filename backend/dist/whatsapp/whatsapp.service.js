"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WhatsAppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let WhatsAppService = WhatsAppService_1 = class WhatsAppService {
    config;
    logger = new common_1.Logger(WhatsAppService_1.name);
    constructor(config) {
        this.config = config;
    }
    isConfigured() {
        const apiKey = this.config.get('WHATSAPP_API_KEY') ||
            this.config.get('WHATSAPP_ACCESS_TOKEN');
        const phoneId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
        return Boolean(apiKey && phoneId);
    }
    async sendDocument(options) {
        const rawPhone = (options.toPhone || '').replace(/\D/g, '');
        if (!rawPhone || rawPhone.length < 10) {
            return {
                success: false,
                status: 'FAILED',
                reason: 'invalid_phone_number',
                disclaimer: 'Aapka valid WhatsApp number verify nahi ho paya hai. Humari team aapse call ke baad sampark karegi.',
            };
        }
        if (!this.isConfigured()) {
            this.logger.log(`[WhatsApp] Gateway not configured. Queuing document dispatch note for lead=${options.toPhone} project=${options.projectName || 'general'}`);
            return {
                success: false,
                status: 'UNAVAILABLE',
                reason: 'gateway_not_configured',
                disclaimer: 'Main team ko note karwa deti hoon, wo details aur layout verify karke aapke WhatsApp number par share kar denge.',
            };
        }
        try {
            const apiKey = this.config.get('WHATSAPP_API_KEY') ||
                this.config.get('WHATSAPP_ACCESS_TOKEN');
            const phoneId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
            const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: rawPhone.length === 10 ? `91${rawPhone}` : rawPhone,
                    type: options.documentUrl ? 'document' : 'text',
                    ...(options.documentUrl
                        ? {
                            document: {
                                link: options.documentUrl,
                                caption: `${options.projectName ? `${options.projectName} - ` : ''}Workains Reality - ${options.documentType === 'floor_plan' ? 'Floor Plan Layout' : 'Project Brochure'}`,
                            },
                        }
                        : {
                            text: {
                                body: `Namaste ${options.leadName || ''}! ${options.projectName ? `${options.projectName} ke ` : ''}details aur layout Workains Reality ke dwara share kiye gaye hain.`,
                            },
                        }),
                }),
            });
            if (!response.ok) {
                const errText = await response.text();
                this.logger.warn(`[WhatsApp] API dispatch failed: ${response.status} - ${errText}`);
                return {
                    success: false,
                    status: 'FAILED',
                    reason: `api_error_${response.status}`,
                    disclaimer: 'WhatsApp par document abhi send nahi ho paya.',
                };
            }
            const data = (await response.json());
            const messageId = data?.messages?.[0]?.id;
            this.logger.log(`[WhatsApp] 📨 Successfully dispatched to ${rawPhone}, messageId=${messageId}`);
            return {
                success: true,
                status: 'SENT',
                messageId,
                disclaimer: options.documentType === 'floor_plan'
                    ? 'Main aapko WhatsApp par floor plan bhej rahi hoon.'
                    : 'Main aapko WhatsApp par document bhej rahi hoon.',
            };
        }
        catch (err) {
            this.logger.error(`[WhatsApp] Dispatch error: ${err}`);
            return {
                success: false,
                status: 'FAILED',
                reason: err instanceof Error ? err.message : String(err),
                disclaimer: 'WhatsApp par document abhi send nahi ho paya.',
            };
        }
    }
    handleWebhookStatus(messageId, status, timestamp) {
        const deliveryStatusMap = {
            sent: 'SENT',
            delivered: 'DELIVERED',
            read: 'READ',
            failed: 'FAILED',
        };
        const resolvedStatus = deliveryStatusMap[status.toLowerCase()] || 'SENT';
        this.logger.log(`[WhatsApp-Webhook] Delivery status update: messageId=${messageId} status=${resolvedStatus}`);
        return {
            messageId,
            status: resolvedStatus,
            timestamp: timestamp || new Date().toISOString(),
        };
    }
};
exports.WhatsAppService = WhatsAppService;
exports.WhatsAppService = WhatsAppService = WhatsAppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WhatsAppService);
//# sourceMappingURL=whatsapp.service.js.map