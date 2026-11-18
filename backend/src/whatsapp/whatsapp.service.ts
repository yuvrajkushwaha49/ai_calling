import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WhatsAppDeliveryStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'UNAVAILABLE';

export interface WhatsAppSendResult {
  success: boolean;
  status: WhatsAppDeliveryStatus;
  messageId?: string;
  reason?: string;
  disclaimer: string;
  builderAttribution?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly processedWebhooks = new Map<string, number>();

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
   * Enforces customer consent and accurate builder attribution.
   */
  async sendDocument(options: {
    toPhone: string;
    leadName?: string;
    projectName?: string;
    builderName?: string;
    documentType: 'brochure' | 'floor_plan' | 'price_sheet';
    documentUrl?: string;
    hasConsent?: boolean;
    isOptedOut?: boolean;
  }): Promise<WhatsAppSendResult> {
    // 1. Consent and Opt-out verification
    if (options.isOptedOut || options.hasConsent === false) {
      this.logger.warn(`[WhatsApp] Dispatch blocked: Customer ${options.toPhone} has opted out or lacks consent`);
      return {
        success: false,
        status: 'FAILED',
        reason: 'consent_missing_or_opted_out',
        disclaimer: 'Customer has opted out of communication or consent is not provided.',
      };
    }

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

    const builderAttribution =
      options.projectName && options.builderName
        ? `${options.projectName} by ${options.builderName}`
        : options.projectName || 'Workains Reality Partner Project';

    if (!this.isConfigured()) {
      this.logger.log(
        `[WhatsApp] Gateway not configured. Queuing document dispatch note for lead=${options.toPhone} project=${builderAttribution}`,
      );
      return {
        success: false,
        status: 'UNAVAILABLE',
        reason: 'gateway_not_configured',
        disclaimer:
          'Main team ko note karwa deti hoon, wo details aur layout verify karke aapke WhatsApp number par share kar denge.',
        builderAttribution,
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
                    caption: `${builderAttribution} - Workains Reality - ${options.documentType === 'floor_plan' ? 'Floor Plan Layout' : 'Project Brochure'}`,
                  },
                }
              : {
                  text: {
                    body: `Namaste ${options.leadName || ''}! ${builderAttribution} ke details aur verified floor plans Workains Reality ke dwara share kiye gaye hain.`,
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
          disclaimer: 'WhatsApp par document abhi send nahi ho paya.',
          builderAttribution,
        };
      }

      const data = (await response.json()) as any;
      const messageId = data?.messages?.[0]?.id;
      this.logger.log(`[WhatsApp] 📨 Successfully dispatched to ${rawPhone}, messageId=${messageId}`);

      return {
        success: true,
        status: 'SENT',
        messageId,
        builderAttribution,
        disclaimer:
          options.documentType === 'floor_plan'
            ? 'Main aapko WhatsApp par floor plan bhej rahi hoon.'
            : 'Main aapko WhatsApp par document bhej rahi hoon.',
      };
    } catch (err) {
      this.logger.error(`[WhatsApp] Dispatch error: ${err}`);
      return {
        success: false,
        status: 'FAILED',
        reason: err instanceof Error ? err.message : String(err),
        disclaimer: 'WhatsApp par document abhi send nahi ho paya.',
        builderAttribution,
      };
    }
  }

  /**
   * Process incoming Meta Cloud API delivery webhook status callbacks.
   * Lifecycle states: sent -> delivered -> read | failed.
   * Handles idempotent webhook retries safely.
   */
  handleWebhookStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    timestamp?: string,
  ): { messageId: string; status: WhatsAppDeliveryStatus; timestamp: string; idempotent: boolean } {
    const deliveryStatusMap: Record<string, WhatsAppDeliveryStatus> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };
    const resolvedStatus = deliveryStatusMap[status.toLowerCase()] || 'SENT';
    const key = `${messageId}:${resolvedStatus}`;
    const isDuplicate = this.processedWebhooks.has(key);

    if (isDuplicate) {
      this.logger.log(`[WhatsApp-Webhook] Idempotent retry ignored for messageId=${messageId} status=${resolvedStatus}`);
      return {
        messageId,
        status: resolvedStatus,
        timestamp: timestamp || new Date().toISOString(),
        idempotent: true,
      };
    }

    this.processedWebhooks.set(key, Date.now());
    // Evict older items if map exceeds 5000 items
    if (this.processedWebhooks.size > 5000) {
      const oldestKey = this.processedWebhooks.keys().next().value;
      if (oldestKey) this.processedWebhooks.delete(oldestKey);
    }

    this.logger.log(
      `[WhatsApp-Webhook] Delivery status update: messageId=${messageId} status=${resolvedStatus}`,
    );
    return {
      messageId,
      status: resolvedStatus,
      timestamp: timestamp || new Date().toISOString(),
      idempotent: false,
    };
  }
}
