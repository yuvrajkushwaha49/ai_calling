import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WhatsAppDeliveryStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'UNAVAILABLE';

export interface WhatsAppSendResult {
  success: boolean;
  status: WhatsAppDeliveryStatus;
  messageId?: string;
  reason?: string;
  disclaimer: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Check if WhatsApp API gateway is configured in environment.
   */
  isConfigured(): boolean {
    const apiKey =
      this.config.get<string>('WHATSAPP_API_KEY') ||
      this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    return Boolean(apiKey && phoneId);
  }

  /**
   * Attempt to dispatch project brochure / floor plan / details to customer's WhatsApp.
   * If gateway is unconfigured or fails, returns clear status with safe disclaimer.
   */
  async sendDocument(options: {
    toPhone: string;
    leadName?: string;
    projectName?: string;
    documentType: 'brochure' | 'floor_plan' | 'price_sheet';
    documentUrl?: string;
  }): Promise<WhatsAppSendResult> {
    const rawPhone = (options.toPhone || '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) {
      return {
        success: false,
        status: 'FAILED',
        reason: 'invalid_phone_number',
        disclaimer:
          'Aapka valid WhatsApp number verify nahi ho paya hai. Humari team aapse call ke baad sampark karegi.',
      };
    }

    if (!this.isConfigured()) {
      this.logger.log(
        `[WhatsApp] Gateway not configured. Queuing document dispatch note for lead=${options.toPhone} project=${options.projectName || 'general'}`,
      );
      return {
        success: false,
        status: 'UNAVAILABLE',
        reason: 'gateway_not_configured',
        disclaimer:
          'Main team ko note karwa deti hoon, wo details aur layout verify karke aapke WhatsApp number par share kar denge.',
      };
    }

    try {
      const apiKey =
        this.config.get<string>('WHATSAPP_API_KEY') ||
        this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
      const phoneId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');

      // WhatsApp Cloud API payload
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneId}/messages`,
        {
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
                    caption: `${options.projectName || 'Saya Group'} - ${options.documentType === 'floor_plan' ? 'Floor Plan Layout' : 'Project Brochure'}`,
                  },
                }
              : {
                  text: {
                    body: `Namaste ${options.leadName || ''}! ${options.projectName || 'Saya Group'} ke details aur layout aapke request par share kiye gaye hain.`,
                  },
                }),
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        this.logger.warn(`[WhatsApp] API dispatch failed: ${response.status} - ${errText}`);
        return {
          success: false,
          status: 'FAILED',
          reason: `api_error_${response.status}`,
          disclaimer:
            'Main team ko note karwa deti hoon, wo verified layout aapke WhatsApp par share kar denge.',
        };
      }

      const data = (await response.json()) as any;
      const messageId = data?.messages?.[0]?.id;
      this.logger.log(`[WhatsApp] 📨 Successfully dispatched to ${rawPhone}, messageId=${messageId}`);

      return {
        success: true,
        status: 'SENT',
        messageId,
        disclaimer:
          'Maine aapke WhatsApp number par details share kar di hain, aap ek baar check kar sakte hain.',
      };
    } catch (err) {
      this.logger.error(`[WhatsApp] Dispatch error: ${err}`);
      return {
        success: false,
        status: 'FAILED',
        reason: err instanceof Error ? err.message : String(err),
        disclaimer:
          'Main team ko note karwa deti hoon, wo details verify karke aapke WhatsApp number par bhej denge.',
      };
    }
  }
}

